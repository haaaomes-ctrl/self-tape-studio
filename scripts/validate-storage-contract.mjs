import fs from 'node:fs';
import path from 'node:path';

const contractPath = new URL('../src/server/v3/contracts/setup-task1-storage-contract.ts', import.meta.url);
const source = fs.readFileSync(contractPath, 'utf8');

function fail(code, details) {
  console.error(JSON.stringify({ ok: false, code, ...details }, null, 2));
  process.exit(1);
}

function parseRequiredFiles() {
  const block = source.match(/required_files:\s*\[([\s\S]*?)\]/);
  if (!block) fail('setup_task1_storage_contract_missing_required_files', { runtimeArtifactsValidated: false });
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parseExpectedCount() {
  const m = source.match(/expected_file_count_when_technique_and_score_sources_exist:\s*(\d+)/);
  if (!m) fail('setup_task1_storage_contract_missing_expected_count', { runtimeArtifactsValidated: false });
  return Number(m[1]);
}

function validateBlockedStatesIfPresent(obj, fileLabel) {
  const checks = {
    level2_status: 'not_accepted',
    production_safe_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    comparison_public_winner_status: 'blocked',
    customer_facing_release_status: 'blocked',
  };
  const mismatches = [];
  for (const [k, expected] of Object.entries(checks)) {
    if (k in obj && obj[k] !== expected) mismatches.push({ key: k, expected, actual: obj[k] });
  }
  if (mismatches.length) fail('setup_task1_bundle_blocked_state_mismatch', { runtimeArtifactsValidated: true, file: fileLabel, mismatches });
}

const requiredFiles = parseRequiredFiles();
const expectedCount = parseExpectedCount();

if (!requiredFiles.includes('manifest.json')) fail('setup_task1_storage_contract_missing_manifest', { runtimeArtifactsValidated: false });
if (!requiredFiles.includes('qa/acceptance_metrics.json')) fail('setup_task1_storage_contract_missing_acceptance_metrics', { runtimeArtifactsValidated: false });

if (requiredFiles.length !== expectedCount) {
  fail('setup_task1_storage_contract_wrong_file_count', {
    runtimeArtifactsValidated: false,
    expectedCount,
    requiredFilesCount: requiredFiles.length,
  });
}

const bundlePath = process.argv[2];
if (!bundlePath) {
  console.log(
    JSON.stringify({
      ok: true,
      code: 'setup_task1_s9_storage_contract_verified',
      runtimeArtifactsValidated: false,
      contractPath: contractPath.pathname,
      expectedCount,
    }),
  );
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
  fail('setup_task1_bundle_strict_file_count_mismatch', {
    runtimeArtifactsValidated: true,
    expectedCount,
    foundCount: foundFiles.length,
    extraFiles: extras,
  });
}

for (const jsonFile of ['manifest.json', 'qa/acceptance_metrics.json']) {
  const filePath = path.join(bundlePath, jsonFile);
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    validateBlockedStatesIfPresent(parsed, jsonFile);
  } catch (error) {
    fail('setup_task1_bundle_invalid_json', { runtimeArtifactsValidated: true, file: jsonFile, message: String(error.message || error) });
  }
}

console.log(JSON.stringify({ ok: true, code: 'setup_task1_s9_storage_bundle_validated', runtimeArtifactsValidated: true, bundlePath, strict }));
