import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const releaseContractPath = 'src/server/v3/contracts/setup-task1-release-state-contract.ts';
const storageContractPath = 'src/server/v3/contracts/setup-task1-storage-contract.ts';

function run(cmd: string) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function mustFail(cmd: string, expected: RegExp) {
  expect(() => run(cmd)).toThrowError(expected);
}

function withFileMutation(filePath: string, mutate: (src: string) => string, fn: () => void) {
  const original = fs.readFileSync(filePath, 'utf8');
  fs.writeFileSync(filePath, mutate(original));
  try { fn(); } finally { fs.writeFileSync(filePath, original); }
}

function writeBundle(base: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const out = path.join(base, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
  }
}

describe('setup task 1 source-contract validators', () => {
  it('A: correct exported release contract passes', () => {
    const out = run('node scripts/check-blocked-states.mjs');
    expect(out).toContain('setup_task1_blocked_state_contract_verified');
    expect(out).toContain('"runtimeValidated":false');
  });

  it('B/C: comments and dead const values do not satisfy blocked-state validation', () => {
    withFileMutation(
      releaseContractPath,
      (src) => `// level2_status: 'not_accepted'\nconst dead={level2_status:'not_accepted',production_safe_status:'blocked',public_scoring_status:'blocked',public_technique_authority_status:'blocked',comparison_public_winner_status:'blocked',customer_facing_release_status:'blocked'};\n${src.replace("level2_status: 'not_accepted'", "level2_status: 'accepted'")}`,
      () => mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
  });

  it('D-I: missing/changed required blocked statuses fail', () => {
    withFileMutation(releaseContractPath, (s) => s.replace("customer_facing_release_status: 'blocked',\n", ''), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
    withFileMutation(releaseContractPath, (s) => s.replace("production_safe_status: 'blocked'", "production_safe_status: 'approved'"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
    withFileMutation(releaseContractPath, (s) => s.replace("public_scoring_status: 'blocked'", "public_scoring_status: 'enabled'"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
    withFileMutation(releaseContractPath, (s) => s.replace("public_technique_authority_status: 'blocked'", "public_technique_authority_status: 'enabled'"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
    withFileMutation(releaseContractPath, (s) => s.replace("comparison_public_winner_status: 'blocked'", "comparison_public_winner_status: 'enabled'"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
    withFileMutation(releaseContractPath, (s) => s.replace("customer_facing_release_status: 'blocked'", "customer_facing_release_status: 'enabled'"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_mismatch/),
    );
  });

  it('J: dynamic expression in exported release contract fails closed', () => {
    withFileMutation(releaseContractPath, (s) => s.replace("level2_status: 'not_accepted'", "level2_status: `not_${'accepted'}`"), () =>
      mustFail('node scripts/check-blocked-states.mjs', /setup_task1_blocked_state_contract_parse_error/),
    );
  });

  it('A/F/G: correct storage contract passes and expected count must be 12', () => {
    const out = run('node scripts/validate-storage-contract.mjs');
    expect(out).toContain('setup_task1_s9_storage_contract_verified');
    expect(out).toContain('"runtimeArtifactsValidated":false');

    withFileMutation(storageContractPath, (s) => s.replace('expected_file_count_when_technique_and_score_sources_exist: 12', 'expected_file_count_when_technique_and_score_sources_exist: 11'), () =>
      mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_invalid_expected_count/),
    );
    withFileMutation(storageContractPath, (s) => s.replace("'qa/acceptance_metrics.json',\n", ''), () =>
      mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_missing_acceptance_metrics/),
    );
  });

  it('B/C/D/E/F/H: comments/dead constants do not satisfy storage contract and dynamic expressions fail', () => {
    withFileMutation(
      storageContractPath,
      (src) => `// required_files:['manifest.json']\nconst dead={required_files:['inputs/input_record.json','manifest.json','qa/acceptance_metrics.json'],expected_file_count_when_technique_and_score_sources_exist:12};\n${src.replace("'manifest.json',\n", '')}`,
      () => mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_missing_manifest/),
    );

    withFileMutation(storageContractPath, (s) => s.replace("'qa/acceptance_metrics.json',\n", ''), () =>
      mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_missing_acceptance_metrics/),
    );

    withFileMutation(storageContractPath, (s) => s.replace("'traces/ScoreTrace.json',\n", ''), () =>
      mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_wrong_file_count/),
    );

    withFileMutation(storageContractPath, (s) => s.replace("'inputs/take.json'", "`inputs/${'take'}.json`"), () =>
      mustFail('node scripts/validate-storage-contract.mjs', /setup_task1_storage_contract_parse_error/),
    );
  });

  it('I/J/K/L/M: explicit bundle validation works and fails correctly', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-task1-bundle-'));
    const base = {
      'inputs/input_record.json': '{}','inputs/submission.json': '{}','inputs/take.json': '{}',
      'reports/raw_report.json': '{}','resolver/resolver_output.json': '{}','resolver/TruthStateMap.json': '{}',
      'traces/EvidenceAnchors.json': '{}','traces/PublicClaimTrace.json': '{}','traces/TechniqueObservationTrace.json': '{}','traces/ScoreTrace.json': '{}',
      'manifest.json': JSON.stringify({ level2_status: 'not_accepted' }),
      'qa/acceptance_metrics.json': JSON.stringify({ production_safe_status: 'blocked' }),
    };
    writeBundle(dir, base);
    expect(run(`node scripts/validate-storage-contract.mjs ${dir}`)).toContain('setup_task1_s9_storage_bundle_validated');

    fs.rmSync(path.join(dir, 'manifest.json'));
    mustFail(`node scripts/validate-storage-contract.mjs ${dir}`, /setup_task1_bundle_missing_required_files/);
    writeBundle(dir, { 'manifest.json': '{bad' });
    mustFail(`node scripts/validate-storage-contract.mjs ${dir}`, /setup_task1_bundle_invalid_json/);
    writeBundle(dir, { 'manifest.json': JSON.stringify({ level2_status: 'not_accepted' }) });

    fs.rmSync(path.join(dir, 'qa/acceptance_metrics.json'));
    mustFail(`node scripts/validate-storage-contract.mjs ${dir}`, /setup_task1_bundle_missing_required_files/);
    writeBundle(dir, { 'qa/acceptance_metrics.json': JSON.stringify({ production_safe_status: 'blocked' }) });

    fs.writeFileSync(path.join(dir, 'extra.json'), '{}');
    mustFail(`node scripts/validate-storage-contract.mjs ${dir}`, /setup_task1_bundle_strict_file_count_mismatch/);
  });
});
