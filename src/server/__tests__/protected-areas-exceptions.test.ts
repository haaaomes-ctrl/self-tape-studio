import { describe, expect, it } from 'vitest';
import { evaluateProtectedAreaGate } from '../../../scripts/validate-protected-areas.mjs';

const baseException = {
  schema_version: 'tapecoach_protected_area_exceptions_v1',
  approval_source: 'operator',
  approved_by: 'op',
  approved_at: '2026-05-17T12:00:00.000Z',
  expires_at: '2099-01-01T00:00:00.000Z',
  reason: 'approved',
  pr_number: '49',
  exceptions: [
    { file: 'src/server/webhook-handler.ts', categories: ['webhook'], reason: 'ok' },
  ],
};

function withEnv(key: string, value: string | undefined, fn: () => void) {
  const prior = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  try { fn(); } finally {
    if (prior === undefined) delete process.env[key];
    else process.env[key] = prior;
  }
}

describe('protected-area exception validation (controlled)', () => {
  it('protected file without exception remains unapproved', () => {
    const result = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], null as any);
    expect(result.unapproved.length).toBeGreaterThan(0);
  });

  it('exact file/category exception approves', () => {
    withEnv('PR_NUMBER', '49', () => {
      const result = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], baseException as any);
      expect(result.configFailures).toHaveLength(0);
      expect(result.unapproved).toHaveLength(0);
    });
  });

  it('missing file/category/reason and invalid category produce configFailures and block approval', () => {
    withEnv('PR_NUMBER', '49', () => {
      const cfg = {
        ...baseException,
        exceptions: [
          { categories: ['webhook'], reason: 'x' },
          { file: 'src/server/webhook-handler.ts', reason: 'x' },
          { file: 'src/server/webhook-handler.ts', categories: ['bad'], reason: 'x' },
          { file: 'src/server/webhook-handler.ts', categories: ['webhook'] },
        ],
      };
      const result = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], cfg as any);
      expect(result.configFailures.join('\n')).toContain('entry missing file');
      expect(result.configFailures.join('\n')).toContain('entry missing categories');
      expect(result.configFailures.join('\n')).toContain('invalid category');
      expect(result.configFailures.join('\n')).toContain('entry missing reason');
      expect(result.unapproved.length).toBeGreaterThan(0);
    });
  });

  it('missing pr_number fails whether PR env exists or not', () => {
    const { pr_number, ...cfg } = baseException as any;
    withEnv('PR_NUMBER', '49', () => {
      const r = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], cfg);
      expect(r.configFailures.join('\n')).toContain('missing pr_number');
    });
    withEnv('PR_NUMBER', undefined, () => {
      const r = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], cfg);
      expect(r.configFailures.join('\n')).toContain('missing pr_number');
    });
  });

  it('future approved_at fails deterministically', () => {
    withEnv('PR_NUMBER', '49', () => {
      const r = evaluateProtectedAreaGate(['src/server/webhook-handler.ts'], { ...baseException, approved_at: '2999-01-01T00:00:00.000Z' } as any, { nowMs: Date.parse('2026-05-17T00:00:00.000Z') });
      expect(r.configFailures.join('\n')).toContain('must not be in the future');
    });
  });
});
