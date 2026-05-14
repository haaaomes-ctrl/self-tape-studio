import { describe, expect, it } from 'vitest';
import { resolveRunDir } from '@/server/v3/qa-artifacts.server';

describe('v3 s9 storage path layout', () => {
  it('avoids duplicated nested take segments', () => {
    const out = resolveRunDir('qa-artifacts', 'take-123', 'take', '123', 'take-123');
    expect(out).not.toContain('v3/take-123/takes/take-123');
    expect(out).not.toContain('takes/take-123/takes/take-123');
  });
});
