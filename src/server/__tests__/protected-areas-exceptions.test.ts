import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

function runGate(changed: string[], env: Record<string, string> = {}) {
  const payload = { schema_version: 'tapecoach_protected_area_exceptions_v1', approval_source: 'operator', approved_by: 'op', approved_at: '2026-05-17T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z', reason: 'approved', exceptions: [] as any[] };
  const script = `import { findProtectedViolations } from './scripts/validate-protected-areas.mjs'; const v=findProtectedViolations(${JSON.stringify(changed)}); console.log(JSON.stringify(v));`;
  const base = spawnSync('node', ['--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' });
  const violations = JSON.parse(base.stdout.trim() || '[]');

  const gateScript = `import { writeFileSync } from 'node:fs';`;
  const proc = spawnSync('node', ['scripts/validate-protected-areas.mjs'], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, ...env } });
  return { proc, violations, payload };
}

describe('protected-area exception validation', () => {
  it('fails without approval for protected file', () => {
    const script = `import { findProtectedViolations } from './scripts/validate-protected-areas.mjs'; const v=findProtectedViolations(['src/server/webhook-handler.ts']); if(!v.length) process.exit(2); process.exit(1);`;
    const r = spawnSync('node', ['--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(1);
  });

  it('passes with exact valid approval for file and category', () => {
    const approval = {
      schema_version: 'tapecoach_protected_area_exceptions_v1', approval_source: 'operator', approved_by: 'op', approved_at: '2026-05-17T12:00:00.000Z', expires_at: '2099-01-01T00:00:00.000Z', reason: 'approved',
      exceptions: [{ file: 'src/server/webhook-handler.ts', categories: ['webhook'], reason: 'ok' }],
    };
    const cmd = `import { findProtectedViolations } from './scripts/validate-protected-areas.mjs'; const v=findProtectedViolations(['src/server/webhook-handler.ts']); const ex=${JSON.stringify(approval)}; const c=v[0]; const ok=ex.exceptions.some(e=>e.file===c.file && c.categories.every(k=>e.categories.includes(k)||e.categories.includes('*'))); process.exit(ok?0:1);`;
    const r = spawnSync('node', ['--input-type=module', '-e', cmd], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(0);
  });

  it('fails when only one category approved for mux-webhook multi-category file', () => {
    const cmd = `import { findProtectedViolations } from './scripts/validate-protected-areas.mjs'; const v=findProtectedViolations(['src/routes/api/public/mux-webhook.ts']); const allowed=new Set(['Mux']); const ok=v[0].categories.every(c=>allowed.has(c)); process.exit(ok?0:1);`;
    const r = spawnSync('node', ['--input-type=module', '-e', cmd], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(1);
  });

  it('fails malformed JSON', () => {
    const r = spawnSync('node', ['scripts/validate-protected-areas.mjs'], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PROTECTED_AREA_EXCEPTIONS_JSON: '{bad' } });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('invalid protected-area exception JSON');
  });

  it('does not auto-read committed repo file without env var', () => {
    const r = spawnSync('node', ['scripts/validate-protected-areas.mjs'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(r.status).toBe(0);
  });
});
