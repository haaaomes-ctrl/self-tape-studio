#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const NO_OP_PATTERNS = [
  /(^|\s)true(\s|$)/i,
  /(^|\s)exit\s+0(\s|$)/i,
  /node\s+-e\s+['\"]\s*process\.exit\(0\)\s*['\"]/i,
  /^\s*echo\b/i,
];

function hasNoOpOnly(command) {
  const trimmed = command.trim();
  if (!trimmed) return true;
  const segments = trimmed.split(/&&/).map((s) => s.trim()).filter(Boolean);
  return segments.every((segment) => NO_OP_PATTERNS.some((p) => p.test(segment)));
}

const SEPARATORS = new Set(['&&', '||', ';', '|', '&']);
const RUN_FLAGS_WITH_VALUE = new Set(['--workspace', '-w']);

function tokenizeCommand(command) {
  return command
    .replace(/([;|&])/g, ' $1 ')
    .replace(/&&/g, ' && ')
    .replace(/\|\|/g, ' || ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function extractNpmRunTargets(command) {
  const tokens = tokenizeCommand(command);
  const targets = [];

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] !== 'npm') continue;
    const runner = tokens[i + 1];
    if (runner !== 'run' && runner !== 'run-script') continue;

    let j = i + 2;
    while (j < tokens.length) {
      const tok = tokens[j];
      if (SEPARATORS.has(tok)) break;
      if (tok === '--') break;
      if (tok.startsWith('-')) {
        if (RUN_FLAGS_WITH_VALUE.has(tok) && j + 1 < tokens.length && !SEPARATORS.has(tokens[j + 1])) {
          j += 2;
          continue;
        }
        j += 1;
        continue;
      }

      targets.push(tok);
      break;
    }
  }

  return targets;
}

function commandContainsNoOpGuard(command) {
  return /^\s*(echo\b|true\b|exit\s+0\b|node\s+-e\s+['\"]\s*process\.exit\(0\)\s*['\"])/i.test(command)
    || /(^|\s)!\s*(node\s+scripts\/validate-|npm\s+run(\-script)?\s+.*gate:)/i.test(command)
    || /\|\|/i.test(command)
    || /\|\|\s*(true|:|echo\b|exit\s+0|node\s+-e\s+['\"]\s*process\.exit\(0\)\s*['\"])/i.test(command)
    || /;\s*(true|echo\b|exit\s+0)/i.test(command)
    || /\|\s*\w+/i.test(command);
}

function normalizeCommandContinuations(command) {
  return String(command).replace(/&&\s*\\?\s*\r?\n\s*/g, ' && ');
}

function stripShellComments(command) {
  return String(command)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, ''))
    .join('\n');
}

function containsNonPropagatingSeparator(command) {
  const normalized = normalizeCommandContinuations(command);
  return /(^|[^|]);/.test(normalized) || /\|\s*\w+/.test(normalized) || /(^|[^&])&(?!&)/.test(normalized) || /\r?\n/.test(normalized);
}

function hasFailurePropagatingValidator(expandedCommand, validatorRegex) {
  const normalized = normalizeCommandContinuations(stripShellComments(expandedCommand));
  return normalized
    .split(/&&/)
    .some((segment) => validatorRegex.test(segment) && !commandContainsNoOpGuard(segment) && !containsNonPropagatingSeparator(segment));
}

function hasFailureSwallowedValidator(expandedCommand, validatorRegex) {
  const normalized = normalizeCommandContinuations(stripShellComments(expandedCommand));
  return normalized
    .split(/&&/)
    .some((segment) => validatorRegex.test(segment) && (commandContainsNoOpGuard(segment) || containsNonPropagatingSeparator(segment)));
}

export function collectScriptExpansion(scripts, start, state = {}) {
  const visited = state.visited ?? new Set();
  const stack = state.stack ?? new Set();
  const cache = state.cache ?? new Map();
  const missingTargets = state.missingTargets ?? new Set();

  if (cache.has(start)) return { expanded: cache.get(start), missingTargets, visited, stack, cache };
  if (!scripts[start]) {
    missingTargets.add(start);
    return { expanded: '', missingTargets, visited, stack, cache };
  }
  if (stack.has(start)) return { expanded: '', missingTargets, visited, stack, cache };
  if (visited.has(start)) return { expanded: cache.get(start) ?? '', missingTargets, visited, stack, cache };
  stack.add(start);
  visited.add(start);

  const command = scripts[start];
  let expanded = command;
  const runRefs = extractNpmRunTargets(command);

  for (const ref of runRefs) {
    const child = collectScriptExpansion(scripts, ref, { visited, missingTargets, stack, cache });
    if (child.expanded) expanded += ` && ${child.expanded}`;
  }
  stack.delete(start);
  cache.set(start, expanded);

  return { expanded, missingTargets, visited, stack, cache };
}


function extractRunSteps(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  const steps = [];
  let current = null;
  let inEnvBlock = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue;
    const runMatch = line.match(/^\s*-\s*run:\s*(.+)\s*$/);
    if (runMatch) {
      if (/[>|]-?\s*$/.test(runMatch[1])) {
        steps.push({ run: '__UNSUPPORTED_MULTILINE__', env: {} });
        current = null;
        inEnvBlock = false;
        continue;
      }
      current = { run: runMatch[1], env: {} };
      steps.push(current);
      inEnvBlock = false;
      continue;
    }
    if (current && /^\s*env:\s*$/.test(line)) {
      inEnvBlock = true;
      continue;
    }
    if (!current) continue;
    if (/^\s*-\s/.test(line)) {
      current = null;
      inEnvBlock = false;
      continue;
    }
    const envMatch = line.match(/^\s+([A-Z0-9_]+):\s*(.+)\s*$/);
    if (envMatch && inEnvBlock) {
      current.env[envMatch[1]] = envMatch[2];
    }
  }
  return steps;
}

function hasExecutableRunStep(steps, commandRegex) {
  return steps.some((s) => commandRegex.test(s.run) && !/^\s*echo\b/i.test(s.run) && !/(__UNSUPPORTED_MULTILINE__)/.test(s.run));
}

function isFailurePropagatingRun(run) {
  const stripped = stripShellComments(run).trim();
  if (/^\s*echo\b/i.test(stripped)) return false;
  if (/^\s*printf\b/i.test(stripped)) return false;
  if (/^\s*node\s+-e\b/i.test(stripped)) return false;
  if (/^\s*!\s*/.test(run)) return false;
  if (/(\|\||;|\||(^|[^&])&(?!&)|(^|[^\&])\n(?!\s*&&))/m.test(stripped)) return false;
  return true;
}

function workflowHasPullRequestTrigger(workflowText) {
  return /(?:^|\n)\s*on:\s*(?:\n[^\n]*)*?\n\s*pull_request\s*:/m.test(workflowText)
    || /(?:^|\n)\s*on:\s*\[[^\]]*\bpull_request\b[^\]]*\]/m.test(workflowText)
    || /(?:^|\n)\s*on:\s*['"]?pull_request['"]?\s*$/m.test(workflowText);
}

function workflowHasCheckoutFetchDepthZero(workflowText) {
  const lines = workflowText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue;
    if (/uses:\s*actions\/checkout@/i.test(line)) {
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^\s*#/.test(lines[j])) continue;
        if (/^\s*-\s+/.test(lines[j])) break;
        if (/^\s*uses:\s*/.test(lines[j])) break;
        if (/^\s*fetch-depth:\s*0\s*$/.test(lines[j])) return true;
      }
    }
  }
  return false;
}

export function validateV3Gates({ cwd = process.cwd(), packageJsonOverride, workflowOverride } = {}) {
  const root = cwd;
  const failures = [];
  const file = (relativePath) => path.join(root, relativePath);
  const read = (relativePath) => readFileSync(file(relativePath), 'utf8');

  const requiredFiles = [
    'README.md', 'package.json',
    'AGENTS.md', 'env-vars.md', '.github/ISSUE_TEMPLATE/release-slice.yml',
    '.github/ISSUE_TEMPLATE/protected-area-exception.yml', '.github/pull_request_template.md',
    '.github/workflows/contracts.yml', '.github/workflows/build.yml', '.github/workflows/gatekeeper.yml',
    'src/server/v3/contracts/release-gates.ts', 'src/server/v3/contracts/storage-bundle.ts',
    'src/server/__tests__/v3-contracts.test.ts',
  ];

  for (const rf of requiredFiles) {
    if (!existsSync(file(rf))) failures.push(`missing required file: ${rf}`);
  }

  const releaseGatesPath = 'src/server/v3/contracts/release-gates.ts';
  const storageContractPath = 'src/server/v3/contracts/storage-bundle.ts';

  const releaseGates = existsSync(file(releaseGatesPath)) ? read(releaseGatesPath) : '';
  const storageContract = existsSync(file(storageContractPath)) ? read(storageContractPath) : '';
  const gatekeeperWorkflow = workflowOverride?.gatekeeper ?? (existsSync(file('.github/workflows/gatekeeper.yml')) ? read('.github/workflows/gatekeeper.yml') : '');
  const contractsWorkflow = workflowOverride?.contracts ?? (existsSync(file('.github/workflows/contracts.yml')) ? read('.github/workflows/contracts.yml') : '');
  const buildWorkflow = workflowOverride?.build ?? (existsSync(file('.github/workflows/build.yml')) ? read('.github/workflows/build.yml') : '');
  let packageJson = packageJsonOverride ?? null;
  if (!packageJson) {
    if (existsSync(file('package.json'))) {
      try {
        packageJson = JSON.parse(read('package.json'));
      } catch (error) {
        failures.push(`invalid package.json: ${error.message}`);
        packageJson = {};
      }
    } else {
      packageJson = {};
    }
  }
  const scripts = packageJson.scripts ?? {};
  const readme = existsSync(file('README.md')) ? read('README.md') : '';

  const requiredGateLiterals = [
    "level2_status: 'not_accepted'", "production_safe_status: 'blocked'", "public_scoring_status: 'blocked'",
    "public_technique_authority_status: 'blocked'", 'public_output_unchanged_required: true',
    'upload_changes_allowed: false', 'mux_changes_allowed: false', 'webhook_changes_allowed: false',
  ];
  if (releaseGates) {
    for (const lit of requiredGateLiterals) if (!releaseGates.includes(lit)) failures.push(`release gate contract missing ${lit}`);
  }
  if (storageContract) {
    for (const req of ['manifest.json', 'qa/acceptance_metrics.json']) if (!storageContract.includes(`'${req}'`)) failures.push(`storage contract missing ${req}`);
    if (!storageContract.includes('expected_file_count_when_technique_and_score_sources_exist: 12')) failures.push('storage contract must keep the current 12-file validation target');
  }

  if (!scripts['test:contracts']) failures.push('package.json missing test:contracts script');
  if (!scripts['gate:release']) failures.push('package.json missing gate:release script');

  if (scripts['test:contracts']) {
    const { expanded: expandedTest } = collectScriptExpansion(scripts, 'test:contracts');
    if (hasNoOpOnly(expandedTest)) failures.push('test:contracts appears to be a no-op');
    const normalizedTest = normalizeCommandContinuations(stripShellComments(expandedTest));
    const hasExecutableCoverage = normalizedTest.split(/&&/).some((segment) => {
      const s = segment.trim();
      if (!s) return false;
      if (/^\s*(echo|printf)\b/i.test(s)) return false;
      if (/^\s*node\s+-e\b/i.test(s)) return false;
      return /(^|\s)vitest\s+run\b/.test(s) && /v3-contracts\.test\.ts/.test(s);
    });
    if (!hasExecutableCoverage) failures.push('test:contracts missing contract test execution coverage');
  }

  if (scripts['gate:release']) {
    const rawGateRelease = stripShellComments(scripts['gate:release']);
    const { expanded: expandedRelease, missingTargets } = collectScriptExpansion(scripts, 'gate:release');
    const normalizedRelease = normalizeCommandContinuations(expandedRelease);
    if (hasNoOpOnly(expandedRelease)) failures.push('gate:release appears to be a no-op');
    for (const missingTarget of missingTargets) {
      failures.push(`gate:release references missing npm script: ${missingTarget}`);
    }
    const protectedMatcher = /(^|[;&|\n]\s*|\s)node\s+scripts\/validate-protected-areas\.mjs(\s|$)/i;
    const storageMatcher = /(^|[;&|\n]\s*|\s)node\s+scripts\/validate-storage-bundle\.mjs(\s|$)/i;
    const v3Matcher = /(^|[;&|\n]\s*|\s)node\s+scripts\/validate-v3-gates\.mjs(\s|$)/i;

    if (!hasFailurePropagatingValidator(normalizedRelease, protectedMatcher)) failures.push('gate:release missing protected-area validation coverage');
    if (!hasFailurePropagatingValidator(normalizedRelease, storageMatcher)) failures.push('gate:release missing Storage bundle validation coverage');
    if (!hasFailurePropagatingValidator(normalizedRelease, v3Matcher)) failures.push('gate:release missing v3 gate validation coverage');

    if (hasFailureSwallowedValidator(normalizedRelease, protectedMatcher)) failures.push(normalizedRelease.includes('\n') ? 'gate:release protected-area validator is present but failure is swallowed by newline chaining' : 'gate:release protected-area validator is present but failure is swallowed');
    if (hasFailureSwallowedValidator(normalizedRelease, storageMatcher)) failures.push(normalizedRelease.includes('\n') ? 'gate:release Storage bundle validator is present but failure is swallowed by newline chaining' : 'gate:release Storage bundle validator is present but failure is swallowed');
    if (hasFailureSwallowedValidator(normalizedRelease, v3Matcher)) failures.push(normalizedRelease.includes('\n') ? 'gate:release v3 gate validator is present but failure is swallowed by newline chaining' : 'gate:release v3 gate validator is present but failure is swallowed');
    if (/\bnpm\s+run(\-script)?\s+\S+\s*\n\s*npm\s+run(\-script)?\s+\S+/i.test(rawGateRelease)) {
      failures.push('gate:release protected-area validator is present but failure is swallowed by newline chaining');
      failures.push('gate:release Storage bundle validator is present but failure is swallowed by newline chaining');
      failures.push('gate:release v3 gate validator is present but failure is swallowed by newline chaining');
    }
    if (/\bnpm\s+run(\-script)?\s+\S+\s*\|\|\s*true/i.test(rawGateRelease)
      || /!\s*npm\s+run(\-script)?\s+\S+/i.test(rawGateRelease)
      || /\bnpm\s+run(\-script)?\s+\S+\s*\|\s*\w+/i.test(rawGateRelease)
      || /\bnpm\s+run(\-script)?\s+\S+\s*&\s*\w+/i.test(rawGateRelease)) {
      failures.push('gate:release protected-area validator is present but failure is swallowed');
      failures.push('gate:release Storage bundle validator is present but failure is swallowed');
      failures.push('gate:release v3 gate validator is present but failure is swallowed');
    }
    if (/npm\s+run(\-script)?\s+.*gate:protected.*(\|\||;|\|)/i.test(rawGateRelease)) failures.push('gate:release protected-area validator is present but failure is swallowed');
    if (/npm\s+run(\-script)?\s+.*gate:storage.*(\|\||;|\|)/i.test(rawGateRelease)) failures.push('gate:release Storage bundle validator is present but failure is swallowed');
    if (/npm\s+run(\-script)?\s+.*gate:v3.*(\|\||;|\|)/i.test(rawGateRelease)) failures.push('gate:release v3 gate validator is present but failure is swallowed');
    if (/!\s*npm\s+run(\-script)?\s+.*gate:protected/i.test(rawGateRelease)) failures.push('gate:release protected-area validator is present but failure is swallowed');
    if (/!\s*npm\s+run(\-script)?\s+.*gate:storage/i.test(rawGateRelease)) failures.push('gate:release Storage bundle validator is present but failure is swallowed');
    if (/!\s*npm\s+run(\-script)?\s+.*gate:v3/i.test(rawGateRelease)) failures.push('gate:release v3 gate validator is present but failure is swallowed');
  }

  if (gatekeeperWorkflow) {
    const steps = extractRunSteps(gatekeeperWorkflow);
    if (!workflowHasPullRequestTrigger(gatekeeperWorkflow)) failures.push('gatekeeper workflow missing pull_request trigger');
    if (!hasExecutableRunStep(steps, /npm run gate:release/)) failures.push('gatekeeper workflow missing npm run gate:release');
    if (!workflowHasCheckoutFetchDepthZero(gatekeeperWorkflow)) failures.push('gatekeeper workflow missing checkout fetch-depth: 0');
    const gateStep = steps.find((s) => /npm run gate:release/.test(s.run) && !/^\s*echo\b/i.test(s.run));
    if (!gateStep || (!('GITHUB_PR_NUMBER' in gateStep.env) && !('PR_NUMBER' in gateStep.env))) failures.push('gatekeeper workflow missing PR number env for gate:release');
    if (gateStep && ('PROTECTED_AREA_EXCEPTIONS_FILE' in gateStep.env || 'PROTECTED_AREA_EXCEPTIONS_JSON' in gateStep.env)) {
      failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
    }
    if (gateStep && !isFailurePropagatingRun(gateStep.run)) failures.push('gatekeeper workflow gate:release run step is failure-swallowing');
    if (steps.some((s) => s.run === '__UNSUPPORTED_MULTILINE__')) failures.push('gatekeeper workflow uses unsupported multiline run format');
    if (/continue-on-error:\s*true/i.test(gatekeeperWorkflow)) failures.push('gatekeeper workflow gate:release step must not use continue-on-error: true');
    if (/if:\s*(false|\$\{\{\s*false\s*\}\})/i.test(gatekeeperWorkflow)) failures.push('gatekeeper workflow gate:release step must not be disabled by if:false');
  }
  if (contractsWorkflow) {
    const steps = extractRunSteps(contractsWorkflow);
    if (!workflowHasPullRequestTrigger(contractsWorkflow)) failures.push('contracts workflow missing pull_request trigger');
    const step = steps.find((s) => /npm run test:contracts/.test(s.run) && !/^\s*echo\b/i.test(s.run));
    if (!step) failures.push('contracts workflow missing npm run test:contracts');
    else if (!isFailurePropagatingRun(step.run)) failures.push('contracts workflow test:contracts run step is failure-swallowing');
    if (/continue-on-error:\s*true/i.test(contractsWorkflow)) failures.push('contracts workflow critical steps must not use continue-on-error: true');
    if (/if:\s*(false|\$\{\{\s*false\s*\}\})/i.test(contractsWorkflow)) failures.push('contracts workflow critical steps must not be disabled by if:false');
    if (steps.some((s) => s.run === '__UNSUPPORTED_MULTILINE__')) failures.push('contracts workflow uses unsupported multiline run format');
  }
  if (buildWorkflow) {
    const steps = extractRunSteps(buildWorkflow);
    if (!workflowHasPullRequestTrigger(buildWorkflow)) failures.push('build workflow missing pull_request trigger');
    const step = steps.find((s) => /npm run build/.test(s.run) && !/^\s*echo\b/i.test(s.run));
    if (!step) failures.push('build workflow missing npm run build');
    else if (!isFailurePropagatingRun(step.run)) failures.push('build workflow build run step is failure-swallowing');
    if (/continue-on-error:\s*true/i.test(buildWorkflow)) failures.push('build workflow critical steps must not use continue-on-error: true');
    if (/if:\s*(false|\$\{\{\s*false\s*\}\})/i.test(buildWorkflow)) failures.push('build workflow critical steps must not be disabled by if:false');
    if (steps.some((s) => s.run === '__UNSUPPORTED_MULTILINE__')) failures.push('build workflow uses unsupported multiline run format');
  }

  for (const phrase of ['Level 2 remains `not_accepted`', 'production-safe, public-scoring and public-technique-authority gates remain blocked']) {
    if (!readme.includes(phrase)) failures.push(`README controlling phrase not found: ${phrase}`);
  }

  return failures;
}

function isDirectCliInvocation() {
  const modulePath = path.resolve(fileURLToPath(import.meta.url));
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return Boolean(invokedPath) && modulePath === invokedPath;
}

function runCli() {
  const failures = validateV3Gates();
  if (failures.length) {
    console.error('v3 gate validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log('v3 gate validation passed');
}

if (isDirectCliInvocation()) {
  runCli();
}
