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
  let stepIndent = 0;
  let inEnvBlock = false;
  let inWithBlock = false;
  let blockIndent = 0;
  const flush = () => {
    if (current) steps.push(current);
    current = null;
    inEnvBlock = false;
    inWithBlock = false;
    blockIndent = 0;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*#/.test(line)) continue;
    const lineIndent = (line.match(/^\s*/) ?? [''])[0].length;
    const stepStart = line.match(/^(\s*)-\s+(.*)$/);
    if (stepStart) {
      flush();
      current = { name: '', run: '', uses: '', env: {}, with: {}, if: '', continueOnError: '' };
      stepIndent = stepStart[1].length;
      const rest = stepStart[2].trim();
      if (!rest) continue;
      const keyVal = rest.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (!keyVal) continue;
      const [, key, value] = keyVal;
      if (key === 'name') current.name = value;
      else if (key === 'uses') current.uses = value;
      else if (key === 'run') current.run = /[>|]-?\s*$/.test(value) ? '__UNSUPPORTED_MULTILINE__' : value;
      else if (key === 'if') current.if = value;
      else if (key === 'continue-on-error') current.continueOnError = value;
      else if (key === 'env') { inEnvBlock = true; blockIndent = stepIndent; }
      else if (key === 'with') { inWithBlock = true; blockIndent = stepIndent; }
      continue;
    }
    if (!current) continue;
    if (lineIndent <= stepIndent) {
      flush();
      continue;
    }
    const keyVal = line.match(/^\s*([a-zA-Z_-]+):\s*(.*)$/);
    if (keyVal && lineIndent <= stepIndent + 2) {
      const [, key, value] = keyVal;
      inEnvBlock = false;
      inWithBlock = false;
      if (key === 'name') current.name = value;
      else if (key === 'run') current.run = /[>|]-?\s*$/.test(value) ? '__UNSUPPORTED_MULTILINE__' : value;
      else if (key === 'uses') current.uses = value;
      else if (key === 'if') current.if = value;
      else if (key === 'continue-on-error') current.continueOnError = value;
      else if (key === 'env') { inEnvBlock = true; blockIndent = lineIndent; }
      else if (key === 'with') { inWithBlock = true; blockIndent = lineIndent; }
      continue;
    }
    const nested = line.match(/^\s+([A-Za-z0-9_.-]+):\s*(.+)\s*$/);
    if (nested && inEnvBlock && lineIndent > blockIndent) {
      current.env[nested[1]] = nested[2];
      continue;
    }
    if (nested && inWithBlock && lineIndent > blockIndent) {
      current.with[nested[1]] = nested[2];
    }
  }
  flush();
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
    || /(?:^|\n)\s*on:\s*(?:\n[^\n]*)*?\n\s*pull_request_target\s*:/m.test(workflowText)
    || /(?:^|\n)\s*on:\s*\[[^\]]*\bpull_request\b[^\]]*\]/m.test(workflowText)
    || /(?:^|\n)\s*on:\s*\[[^\]]*\bpull_request_target\b[^\]]*\]/m.test(workflowText)
    || /(?:^|\n)\s*on:\s*['"]?(pull_request|pull_request_target)['"]?\s*$/m.test(workflowText);
}

function workflowHasCheckoutFetchDepthZero(workflowText) {
  const steps = extractRunSteps(workflowText);
  return steps.some((s) => /actions\/checkout@/i.test(s.uses) && String(s.with?.['fetch-depth'] ?? '').trim() === '0');
}

function stripWorkflowComments(workflowText) {
  return workflowText
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*#.*$/, ''))
    .join('\n');
}

function workflowContainsProtectedExceptionRunInjection(workflowText) {
  const stripped = stripWorkflowComments(workflowText);
  const writesGithubEnv = /\b(?:echo|printf)\b[\s\S]*?\bPROTECTED_AREA_EXCEPTIONS_(?:FILE|JSON)\s*=.*?>>\s*(?:"?\$GITHUB_ENV"?|'?\$GITHUB_ENV'?|\$\{GITHUB_ENV\}|'?\$\{GITHUB_ENV\}'?)/i;
  const exportsVar = /\bexport\s+PROTECTED_AREA_EXCEPTIONS_(FILE|JSON)\s*=/i;
  const inlineAssignmentRun = /\bPROTECTED_AREA_EXCEPTIONS_(FILE|JSON)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s]+)\s+(?:npm|node|pnpm|yarn)\b/i;
  const deprecatedSetEnv = /::set-env\s+name=PROTECTED_AREA_EXCEPTIONS_(FILE|JSON)::/i;
  return writesGithubEnv.test(stripped)
    || exportsVar.test(stripped)
    || inlineAssignmentRun.test(stripped)
    || deprecatedSetEnv.test(stripped);
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
  const canonicalScripts = {
    'gate:protected': 'node scripts/validate-protected-areas.mjs',
    'gate:storage': 'node scripts/validate-storage-bundle.mjs',
    'gate:v3': 'node scripts/validate-v3-gates.mjs',
    'gate:release': 'node scripts/validate-v3-gates.mjs && node scripts/validate-storage-bundle.mjs && node scripts/validate-protected-areas.mjs',
  };
  for (const [name, expected] of Object.entries(canonicalScripts)) {
    if (!scripts[name]) failures.push(`package.json missing ${name} script`);
    else if (String(scripts[name]).trim() !== expected) failures.push(`${name} must match canonical Task 1A command`);
  }

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
    if (/\bnpm\s+run(\-script)?\b/i.test(rawGateRelease)) failures.push('gate:release must not use npm run indirection for Task 1A canonical closure');
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
    const strippedGatekeeperWorkflow = stripWorkflowComments(gatekeeperWorkflow);
    if (workflowContainsProtectedExceptionRunInjection(gatekeeperWorkflow)) failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
    if (/(^|\n)\s*PROTECTED_AREA_EXCEPTIONS_FILE\s*:/m.test(strippedGatekeeperWorkflow)) failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
    if (/(^|\n)\s*env:\s*(?:\n\s+[^\n]*)*?\n\s*PROTECTED_AREA_EXCEPTIONS_JSON\s*:/m.test(strippedGatekeeperWorkflow)
      && !steps.some((s) => Object.prototype.hasOwnProperty.call(s.env, 'PROTECTED_AREA_EXCEPTIONS_JSON'))) failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
    for (const step of steps) {
      if (!Object.prototype.hasOwnProperty.call(step.env, 'PROTECTED_AREA_EXCEPTIONS_JSON')) continue;
      const isGateReleaseStep = /npm run gate:release/.test(step.run) && !/^\s*echo\b/i.test(step.run);
      if (!isGateReleaseStep) {
        failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
        break;
      }
    }
    if (gateStep && Object.prototype.hasOwnProperty.call(gateStep.env, 'PROTECTED_AREA_EXCEPTIONS_JSON')) failures.push('gatekeeper workflow must not set protected-area exception env vars from PR-controlled workflow text');
    if (gateStep && !isFailurePropagatingRun(gateStep.run)) failures.push('gatekeeper workflow gate:release run step is failure-swallowing');
    if (steps.some((s) => s.run === '__UNSUPPORTED_MULTILINE__')) failures.push('gatekeeper workflow uses unsupported multiline run format');
    if (gateStep && String(gateStep.continueOnError).trim()) failures.push('gatekeeper workflow gate:release step must not define continue-on-error');
    if (gateStep && String(gateStep.if).trim()) failures.push('gatekeeper workflow gate:release step must not define if');
  }
  if (contractsWorkflow) {
    const steps = extractRunSteps(contractsWorkflow);
    if (!workflowHasPullRequestTrigger(contractsWorkflow)) failures.push('contracts workflow missing pull_request trigger');
    const step = steps.find((s) => /npm run test:contracts/.test(s.run) && !/^\s*echo\b/i.test(s.run));
    if (!step) failures.push('contracts workflow missing npm run test:contracts');
    else if (!isFailurePropagatingRun(step.run)) failures.push('contracts workflow test:contracts run step is failure-swallowing');
    if (step && String(step.continueOnError).trim()) failures.push('contracts workflow critical steps must not define continue-on-error');
    if (step && String(step.if).trim()) failures.push('contracts workflow critical steps must not define if');
    if (steps.some((s) => s.run === '__UNSUPPORTED_MULTILINE__')) failures.push('contracts workflow uses unsupported multiline run format');
  }
  if (buildWorkflow) {
    const steps = extractRunSteps(buildWorkflow);
    if (!workflowHasPullRequestTrigger(buildWorkflow)) failures.push('build workflow missing pull_request trigger');
    const step = steps.find((s) => /npm run build/.test(s.run) && !/^\s*echo\b/i.test(s.run));
    if (!step) failures.push('build workflow missing npm run build');
    else if (!isFailurePropagatingRun(step.run)) failures.push('build workflow build run step is failure-swallowing');
    if (step && String(step.continueOnError).trim()) failures.push('build workflow critical steps must not define continue-on-error');
    if (step && String(step.if).trim()) failures.push('build workflow critical steps must not define if');
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
