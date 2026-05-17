#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function file(relativePath) {
  return path.join(root, relativePath);
}

function requireFile(relativePath) {
  if (!existsSync(file(relativePath))) failures.push(`missing required file: ${relativePath}`);
}

function read(relativePath) {
  return readFileSync(file(relativePath), 'utf8');
}

[
  'AGENTS.md',
  'env-vars.md',
  '.github/ISSUE_TEMPLATE/release-slice.yml',
  '.github/ISSUE_TEMPLATE/protected-area-exception.yml',
  '.github/pull_request_template.md',
  '.github/workflows/contracts.yml',
  '.github/workflows/build.yml',
  '.github/workflows/gatekeeper.yml',
  'src/server/v3/contracts/release-gates.ts',
  'src/server/v3/contracts/storage-bundle.ts',
  'src/server/__tests__/v3-contracts.test.ts',
].forEach(requireFile);

const releaseGates = read('src/server/v3/contracts/release-gates.ts');
const storageContract = read('src/server/v3/contracts/storage-bundle.ts');
const packageJson = JSON.parse(read('package.json'));
const readme = read('README.md');

const requiredGateLiterals = [
  "level2_status: 'not_accepted'",
  "production_safe_status: 'blocked'",
  "public_scoring_status: 'blocked'",
  "public_technique_authority_status: 'blocked'",
  'public_output_unchanged_required: true',
  'upload_changes_allowed: false',
  'mux_changes_allowed: false',
  'webhook_changes_allowed: false',
];

for (const literal of requiredGateLiterals) {
  if (!releaseGates.includes(literal)) failures.push(`release gate contract missing ${literal}`);
}

for (const required of ['manifest.json', 'qa/acceptance_metrics.json']) {
  if (!storageContract.includes(`'${required}'`)) failures.push(`storage contract missing ${required}`);
}

if (!storageContract.includes('expected_file_count_when_technique_and_score_sources_exist: 12')) {
  failures.push('storage contract must keep the current 12-file validation target');
}

if (!packageJson.scripts?.['test:contracts']) failures.push('package.json missing test:contracts script');
if (!packageJson.scripts?.['gate:release']) failures.push('package.json missing gate:release script');

for (const phrase of [
  'Level 2 remains `not_accepted`',
  'production-safe, public-scoring and public-technique-authority gates remain blocked',
]) {
  if (!readme.includes(phrase)) failures.push(`README controlling phrase not found: ${phrase}`);
}

if (failures.length) {
  console.error('v3 gate validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('v3 gate validation passed');
