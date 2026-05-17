#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

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
const failures = [];

function readJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    failures.push(`invalid JSON: ${filePath} (${error.message})`);
    return null;
  }
}

if (!bundleRoot) {
  const contractText = readFileSync(path.join(process.cwd(), 'src/server/v3/contracts/storage-bundle.ts'), 'utf8');
  for (const expectedFile of expectedFiles) {
    if (!contractText.includes(`'${expectedFile}'`)) failures.push(`contract missing ${expectedFile}`);
  }
  if (!contractText.includes('expected_file_count_when_technique_and_score_sources_exist: 12')) {
    failures.push('contract missing 12-file target');
  }
} else {
  const resolvedRoot = path.resolve(bundleRoot);
  for (const expectedFile of expectedFiles) {
    const candidate = path.join(resolvedRoot, expectedFile);
    if (!existsSync(candidate)) failures.push(`missing bundle file: ${expectedFile}`);
  }

  const manifestPath = path.join(resolvedRoot, 'manifest.json');
  const metricsPath = path.join(resolvedRoot, 'qa/acceptance_metrics.json');
  const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
  const metrics = existsSync(metricsPath) ? readJson(metricsPath) : null;

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

if (failures.length) {
  console.error('Storage validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(bundleRoot ? 'Storage validation passed' : 'Storage contract validation passed');
