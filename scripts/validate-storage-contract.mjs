import fs from 'node:fs';

const readme = fs.readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const requiredPaths = [
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
  'qa/acceptance_metrics.json'
];
const missing = requiredPaths.filter((p) => !readme.includes(p));
if (missing.length) {
  console.error(JSON.stringify({ ok: false, code: 's9_storage_contract_missing_paths', missing }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, code: 's9_storage_contract_verified', fileCount: requiredPaths.length }));
