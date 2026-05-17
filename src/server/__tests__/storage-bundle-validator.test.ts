import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

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

const createdDirs: string[] = [];

function createBundle(extraFiles: string[] = [], omitFiles: string[] = []) {
  const root = mkdtempSync(path.join(tmpdir(), 'storage-bundle-'));
  createdDirs.push(root);

  for (const relPath of expectedFiles.filter((p) => !omitFiles.includes(p))) {
    const fullPath = path.join(root, relPath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    if (relPath === 'manifest.json') {
      writeFileSync(fullPath, JSON.stringify({ level2_qa_acceptance: 'not_accepted', production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked' }));
    } else if (relPath === 'qa/acceptance_metrics.json') {
      writeFileSync(fullPath, JSON.stringify({ level2_status: 'not_accepted', production_safe_status: 'blocked', public_scoring_status: 'blocked', public_technique_authority_status: 'blocked' }));
    } else {
      writeFileSync(fullPath, '{}');
    }
  }

  for (const relPath of extraFiles) {
    const fullPath = path.join(root, relPath);
    mkdirSync(path.dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, '{}');
  }

  return root;
}

function runValidator(bundlePath: string, mode?: string) {
  const env = { ...process.env } as Record<string, string>;
  if (mode) env.STORAGE_BUNDLE_MODE = mode;
  return spawnSync('node', ['scripts/validate-storage-bundle.mjs', bundlePath], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env,
  });
}

afterEach(() => {
  for (const dir of createdDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('storage bundle strict validator', () => {
  it('fails with structured error when storage contract file is missing in no-bundle mode', () => {
    const temp = mkdtempSync(path.join(tmpdir(), 'storage-contract-missing-'));
    createdDirs.push(temp);
    const result = spawnSync('node', [path.join(process.cwd(), 'scripts/validate-storage-bundle.mjs')], {
      cwd: temp,
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing required storage contract');
  });
  it('passes exact current s9 12-file bundle', () => {
    const bundle = createBundle();
    const result = runValidator(bundle);
    expect(result.status).toBe(0);
  });

  it('fails when a required file is missing', () => {
    const bundle = createBundle([], ['traces/ScoreTrace.json']);
    const result = runValidator(bundle);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing bundle file: traces/ScoreTrace.json');
  });

  it('fails strict mode when unexpected extra files are present', () => {
    const bundle = createBundle(['traces/UnexpectedTrace.json']);
    const result = runValidator(bundle);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unexpected bundle files: traces/UnexpectedTrace.json');
    expect(result.stderr).toContain('expected exactly 12 files');
  });

  it('allows expanded bundles in future mode', () => {
    const bundle = createBundle(['extra/debug.json']);
    const result = runValidator(bundle, 'future_expanded');
    expect(result.status).toBe(0);
  });
});
