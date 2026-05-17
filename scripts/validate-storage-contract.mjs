import fs from 'node:fs';
import path from 'node:path';
import { readStaticExportedConstObject } from './read-static-ts-contract.mjs';

const contractPath = new URL('../src/server/v3/contracts/setup-task1-storage-contract.ts', import.meta.url).pathname;

function fail(code, details) {
  console.error(JSON.stringify({ ok: false, code, ...details }, null, 2));
  process.exit(1);
}

let contract;
try {
  contract = readStaticExportedConstObject({ filePath: contractPath, exportName: 'setupTask1StorageContract' });
} catch (error) {
  fail('setup_task1_storage_contract_parse_error', { runtimeArtifactsValidated: false, message: String(error.message || error) });
}

const requiredFiles = contract.required_files;
const expectedCount = contract.expected_file_count_when_technique_and_score_sources_exist;

if (!Array.isArray(requiredFiles) || requiredFiles.some((f) => typeof f !== 'string')) {
  fail('setup_task1_storage_contract_invalid_required_files', { runtimeArtifactsValidated: false });
}
if (expectedCount !== 12) {
  fail('setup_task1_storage_contract_invalid_expected_count', { runtimeArtifactsValidated: false, expectedCount });
}
if (!requiredFiles.includes('manifest.json')) fail('setup_task1_storage_contract_missing_manifest', { runtimeArtifactsValidated: false });
if (!requiredFiles.includes('qa/acceptance_metrics.json')) fail('setup_task1_storage_contract_missing_acceptance_metrics', { runtimeArtifactsValidated: false });
if (requiredFiles.length !== expectedCount) {
  fail('setup_task1_storage_contract_wrong_file_count', { runtimeArtifactsValidated: false, expectedCount, requiredFilesCount: requiredFiles.length });
}

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.log(JSON.stringify({ ok: true, code: 'setup_task1_s9_storage_contract_verified', runtimeArtifactsValidated: false, contractPath, expectedCount }));
  process.exit(0);
}

const strict = process.env.SETUP_TASK1_STORAGE_STRICT !== 'false';
const fullPaths = requiredFiles.map((p) => path.join(bundlePath, p));
const missingFiles = fullPaths.filter((p) => !fs.existsSync(p));
if (missingFiles.length) fail('setup_task1_bundle_missing_required_files', { runtimeArtifactsValidated: true, missingFiles });

const foundFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else foundFiles.push(path.relative(bundlePath, full).replaceAll('\\', '/'));
  }
}
walk(bundlePath);

if (strict && foundFiles.length !== expectedCount) {
  const extras = foundFiles.filter((f) => !requiredFiles.includes(f));
  fail('setup_task1_bundle_strict_file_count_mismatch', { runtimeArtifactsValidated: true, expectedCount, foundCount: foundFiles.length, extraFiles: extras });
}

const checks = {
  level2_status: 'not_accepted',
  production_safe_status: 'blocked',
  public_scoring_status: 'blocked',
  public_technique_authority_status: 'blocked',
  comparison_public_winner_status: 'blocked',
  customer_facing_release_status: 'blocked',
};

for (const jsonFile of ['manifest.json', 'qa/acceptance_metrics.json']) {
  const filePath = path.join(bundlePath, jsonFile);
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail('setup_task1_bundle_invalid_json', { runtimeArtifactsValidated: true, file: jsonFile, message: String(error.message || error) });
  }
  const mismatches = [];
  for (const [k, expected] of Object.entries(checks)) {
    if (k in parsed && parsed[k] !== expected) mismatches.push({ key: k, expected, actual: parsed[k] });
  }
  if (mismatches.length) fail('setup_task1_bundle_blocked_state_mismatch', { runtimeArtifactsValidated: true, file: jsonFile, mismatches });
}

console.log(JSON.stringify({ ok: true, code: 'setup_task1_s9_storage_bundle_validated', runtimeArtifactsValidated: true, bundlePath, strict }));
