import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const releaseContractPath = 'src/server/v3/contracts/setup-task1-release-state-contract.ts';
const storageContractPath = 'src/server/v3/contracts/setup-task1-storage-contract.ts';

function run(cmd: string) {
  return execSync(cmd, { encoding: 'utf8' });
}

function writeBundle(base: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    const out = path.join(base, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, content);
  }
}

describe('setup task 1 source-contract validators', () => {
  it('blocked-state contract validator passes for canonical source contract', () => {
    const out = run('node scripts/check-blocked-states.mjs');
    expect(out).toContain('setup_task1_blocked_state_contract_verified');
    expect(out).toContain('"runtimeValidated":false');
  });

  it('blocked-state contract validator fails when level2_status is changed', () => {
    const original = fs.readFileSync(releaseContractPath, 'utf8');
    fs.writeFileSync(releaseContractPath, original.replace("level2_status: 'not_accepted'", "level2_status: 'accepted'"));
    try {
      expect(() => run('node scripts/check-blocked-states.mjs')).toThrowError(/setup_task1_blocked_state_contract_mismatch/);
    } finally {
      fs.writeFileSync(releaseContractPath, original);
    }
  });

  it('storage contract validator passes in source-contract mode', () => {
    const out = run('node scripts/validate-storage-contract.mjs');
    expect(out).toContain('setup_task1_s9_storage_contract_verified');
    expect(out).toContain('"runtimeArtifactsValidated":false');
  });

  it('storage contract validator fails when manifest is removed from source contract', () => {
    const original = fs.readFileSync(storageContractPath, 'utf8');
    fs.writeFileSync(storageContractPath, original.replace("'manifest.json',\n", ''));
    try {
      expect(() => run('node scripts/validate-storage-contract.mjs')).toThrowError(/setup_task1_storage_contract_missing_manifest/);
    } finally {
      fs.writeFileSync(storageContractPath, original);
    }
  });

  it('bundle mode validates exact 12-file bundle and strict extra-file failures', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-task1-bundle-'));
    const manifest = JSON.stringify({ level2_status: 'not_accepted', production_safe_status: 'blocked' });
    const metrics = JSON.stringify({ public_scoring_status: 'blocked', public_technique_authority_status: 'blocked' });
    writeBundle(dir, {
      'inputs/input_record.json': '{}',
      'inputs/submission.json': '{}',
      'inputs/take.json': '{}',
      'reports/raw_report.json': '{}',
      'resolver/resolver_output.json': '{}',
      'resolver/TruthStateMap.json': '{}',
      'traces/EvidenceAnchors.json': '{}',
      'traces/PublicClaimTrace.json': '{}',
      'traces/TechniqueObservationTrace.json': '{}',
      'traces/ScoreTrace.json': '{}',
      'manifest.json': manifest,
      'qa/acceptance_metrics.json': metrics,
    });
    const pass = run(`node scripts/validate-storage-contract.mjs ${dir}`);
    expect(pass).toContain('setup_task1_s9_storage_bundle_validated');

    fs.writeFileSync(path.join(dir, 'extra.json'), '{}');
    expect(() => run(`node scripts/validate-storage-contract.mjs ${dir}`)).toThrowError(/setup_task1_bundle_strict_file_count_mismatch/);
  });
});
