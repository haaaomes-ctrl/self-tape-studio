#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const expectedFiles = [
  'inputs/input_record.json',
  'inputs/submission.json',
  'inputs/take.json',
  'reports/raw_report.json',
  'resolver/resolver_output.json',
  'resolver/TruthStateMap.json',
  'traces/EvidenceAnchors.json',
  'traces/PublicClaimTrace.json',
  'traces/TechniqueObservationTrace.json',
  'traces/ScoreTrace.json',
  'manifest.json',
  'qa/acceptance_metrics.json',
];

const bundleRoot = process.argv[2];
const strictS9Mode = process.env.STORAGE_BUNDLE_MODE !== 'future_expanded';

function listFilesRecursively(root, current = '') {
  const target = path.join(root, current);
  const entries = readdirSync(target, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const rel = current ? `${current}/${entry.name}` : entry.name;
    const full = path.join(root, rel);
    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(root, rel));
    } else if (entry.isFile() || statSync(full).isFile()) {
      files.push(rel.replace(/\\/g, '/'));
    }
  }

  return files;
}

function readJson(filePath, failures) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    failures.push(`invalid JSON: ${filePath} (${error.message})`);
    return null;
  }
}

export function validateStorageBundle({ cwd = process.cwd(), bundleRootArg = bundleRoot, strictMode = strictS9Mode } = {}) {
  const failures = [];
  if (!bundleRootArg) {
    const contractPath = path.join(cwd, 'src/server/v3/contracts/storage-bundle.ts');
    if (!existsSync(contractPath)) {
      failures.push('missing required storage contract: src/server/v3/contracts/storage-bundle.ts');
    }
    if (existsSync(contractPath)) {
      const contractText = readFileSync(contractPath, 'utf8');
      for (const expectedFile of expectedFiles) {
        if (!contractText.includes(`'${expectedFile}'`)) failures.push(`contract missing ${expectedFile}`);
      }
      if (!contractText.includes('expected_file_count_when_technique_and_score_sources_exist: 12')) {
        failures.push('contract missing 12-file target');
      }
    }
  } else {
    const resolvedRoot = path.resolve(cwd, bundleRootArg);
    let observedFiles = [];
    if (existsSync(resolvedRoot)) observedFiles = listFilesRecursively(resolvedRoot);

  for (const expectedFile of expectedFiles) {
    const candidate = path.join(resolvedRoot, expectedFile);
    if (!existsSync(candidate)) failures.push(`missing bundle file: ${expectedFile}`);
  }

  if (strictMode) {
    const expectedSet = new Set(expectedFiles);
    const unexpectedFiles = observedFiles.filter((file) => !expectedSet.has(file));

    if (observedFiles.length !== expectedFiles.length) {
      failures.push(`expected exactly ${expectedFiles.length} files in current_s9_analysis_bundle_strict mode, found ${observedFiles.length}`);
    }
    if (unexpectedFiles.length) {
      failures.push(`unexpected bundle files: ${unexpectedFiles.sort().join(', ')}`);
    }
  }

  const manifestPath = path.join(resolvedRoot, 'manifest.json');
  const metricsPath = path.join(resolvedRoot, 'qa/acceptance_metrics.json');
    const manifest = existsSync(manifestPath) ? readJson(manifestPath, failures) : null;
    const metrics = existsSync(metricsPath) ? readJson(metricsPath, failures) : null;

  if (manifest) {
    if (manifest.level2_qa_acceptance !== 'not_accepted') failures.push('manifest.level2_qa_acceptance must remain not_accepted');
    if (manifest.production_safe_status !== 'blocked') failures.push('manifest.production_safe_status must remain blocked');
    if (manifest.public_scoring_status !== 'blocked') failures.push('manifest.public_scoring_status must remain blocked');
    if (manifest.public_technique_authority_status !== 'blocked') failures.push('manifest.public_technique_authority_status must remain blocked');
  }

  if (metrics) {
    if (metrics.level2_status !== 'not_accepted') failures.push('metrics.level2_status must remain not_accepted');
    if (metrics.production_safe_status !== 'blocked') failures.push('metrics.production_safe_status must remain blocked');
    if (metrics.public_scoring_status !== 'blocked') failures.push('metrics.public_scoring_status must remain blocked');
    if (metrics.public_technique_authority_status !== 'blocked') failures.push('metrics.public_technique_authority_status must remain blocked');
  }
  }

  return failures;
}

function isDirectCliInvocation() {
  const modulePath = path.resolve(fileURLToPath(import.meta.url));
  const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
  return Boolean(invokedPath) && modulePath === invokedPath;
}

if (isDirectCliInvocation()) {
  const failures = validateStorageBundle();
  if (failures.length) {
    console.error('Storage validation failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log(bundleRoot ? 'Storage validation passed' : 'Storage contract validation passed');
}
