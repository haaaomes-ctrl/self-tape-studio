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
  if (NO_OP_PATTERNS.some((p) => p.test(trimmed)) && !/validate-|vitest|node\s+scripts\//i.test(trimmed)) {
    return true;
  }
  return false;
}

const SEPARATORS = new Set(['&&', '||', ';', '|']);
const RUN_FLAGS_WITH_VALUE = new Set(['--workspace', '-w']);

function tokenizeCommand(command) {
  return command
    .replace(/([;|])/g, ' $1 ')
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
  return /\|\|\s*(true|:|echo\b|exit\s+0|node\s+-e\s+['\"]\s*process\.exit\(0\)\s*['\"])/i.test(command)
    || /;\s*(true|echo\b|exit\s+0)/i.test(command)
    || /\|\s*\w+/i.test(command);
}

function hasFailurePropagatingValidator(expandedCommand, validatorRegex) {
  return expandedCommand
    .split(/&&/)
    .some((segment) => validatorRegex.test(segment) && !commandContainsNoOpGuard(segment));
}

function hasFailureSwallowedValidator(expandedCommand, validatorRegex) {
  return expandedCommand
    .split(/&&/)
    .some((segment) => validatorRegex.test(segment) && commandContainsNoOpGuard(segment));
}

export function collectScriptExpansion(scripts, start, visited = new Set()) {
  if (!scripts[start] || visited.has(start)) return '';
  visited.add(start);

  const command = scripts[start];
  let expanded = command;
  const runRefs = extractNpmRunTargets(command);

  for (const ref of runRefs) {
    expanded += ` ; ${collectScriptExpansion(scripts, ref, visited)}`;
  }

  return expanded;
}

export function validateV3Gates({ cwd = process.cwd(), packageJsonOverride } = {}) {
  const root = cwd;
  const failures = [];
  const file = (relativePath) => path.join(root, relativePath);
  const read = (relativePath) => readFileSync(file(relativePath), 'utf8');

  const requiredFiles = [
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
  const packageJson = packageJsonOverride ?? JSON.parse(read('package.json'));
  const scripts = packageJson.scripts ?? {};
  const readme = read('README.md');

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
    const expandedTest = collectScriptExpansion(scripts, 'test:contracts');
    if (hasNoOpOnly(expandedTest)) failures.push('test:contracts appears to be a no-op');
    if (!/vitest|test:contracts|v3-contracts\.test\.ts/i.test(expandedTest)) failures.push('test:contracts missing contract test execution coverage');
  }

  if (scripts['gate:release']) {
    const expandedRelease = collectScriptExpansion(scripts, 'gate:release');
    if (hasNoOpOnly(expandedRelease)) failures.push('gate:release appears to be a no-op');
    const protectedMatcher = /validate-protected-areas\.mjs|gate:protected/i;
    const storageMatcher = /validate-storage-bundle\.mjs|gate:storage/i;
    const v3Matcher = /validate-v3-gates\.mjs|gate:v3/i;

    if (!hasFailurePropagatingValidator(expandedRelease, protectedMatcher)) failures.push('gate:release missing protected-area validation coverage');
    if (!hasFailurePropagatingValidator(expandedRelease, storageMatcher)) failures.push('gate:release missing Storage bundle validation coverage');
    if (!hasFailurePropagatingValidator(expandedRelease, v3Matcher)) failures.push('gate:release missing v3 gate validation coverage');

    if (hasFailureSwallowedValidator(expandedRelease, protectedMatcher)) failures.push('gate:release protected-area validator is present but failure is swallowed');
    if (hasFailureSwallowedValidator(expandedRelease, storageMatcher)) failures.push('gate:release Storage bundle validator is present but failure is swallowed');
    if (hasFailureSwallowedValidator(expandedRelease, v3Matcher)) failures.push('gate:release v3 gate validator is present but failure is swallowed');
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
