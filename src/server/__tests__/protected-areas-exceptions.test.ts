import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

const baseException = {
  schema_version: 'tapecoach_protected_area_exceptions_v1',
  approval_source: 'operator',
  approved_by: 'op',
  approved_at: '2026-05-17T12:00:00.000Z',
  expires_at: '2099-01-01T00:00:00.000Z',
  reason: 'approved',
  exceptions: [
    { file: 'src/server/webhook-handler.ts', categories: ['webhook'], reason: 'ok' },
  ],
};

function runWithExceptionConfig(config: Record<string, unknown>, env: Record<string, string> = {}) {
  const cmd = `import { findProtectedViolations } from './scripts/validate-protected-areas.mjs';\nimport process from 'node:process';\nconst v=findProtectedViolations(['src/server/webhook-handler.ts']);\nconst ex=${JSON.stringify(config)};\nconst map=new Map((ex.exceptions||[]).map(e=>[e.file,new Set(e.categories)]));\nlet ok=true; for (const row of v) {const allow=map.get(row.file); if (!allow || !row.categories.every(c=>allow.has(c)||allow.has('*'))) ok=false;}\nif(!ok) process.exit(3);\nprocess.exit(0);`;

  const check = spawnSync('node', ['--input-type=module', '-e', cmd], { cwd: process.cwd(), encoding: 'utf8' });
  expect(check.status).toBe(0);

  return spawnSync('node', ['scripts/validate-protected-areas.mjs'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PROTECTED_AREA_EXCEPTIONS_JSON: JSON.stringify(config), ...env },
  });
}

describe('protected-area exception validation', () => {
  it('fails malformed JSON', () => {
    const r = spawnSync('node', ['scripts/validate-protected-areas.mjs'], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PROTECTED_AREA_EXCEPTIONS_JSON: '{bad' } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('invalid protected-area exception JSON');
  });

  it('fails missing approved_at', () => {
    const { approved_at, ...cfg } = baseException;
    const r = runWithExceptionConfig(cfg);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing approved_at');
  });

  it('fails missing expires_at', () => {
    const { expires_at, ...cfg } = baseException;
    const r = runWithExceptionConfig(cfg);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('missing expires_at');
  });

  it('fails expired approval', () => {
    const r = runWithExceptionConfig({ ...baseException, expires_at: '2000-01-01T00:00:00.000Z' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('is expired');
  });

  it('fails invalid approval_source', () => {
    const r = runWithExceptionConfig({ ...baseException, approval_source: 'bad_source' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('approval_source is invalid');
  });

  it('fails wrong pr_number when PR_NUMBER is set', () => {
    const r = runWithExceptionConfig({ ...baseException, pr_number: '50' }, { PR_NUMBER: '49' });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('pr_number does not match current PR');
  });

  it('passes valid pr_number when PR_NUMBER matches', () => {
    const r = runWithExceptionConfig({ ...baseException, pr_number: '49' }, { PR_NUMBER: '49' });
    expect(r.status).toBe(0);
  });

  it('does not auto-read committed repo file without env var', () => {
    const r = spawnSync('node', ['scripts/validate-protected-areas.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});
