import { describe, expect, it } from 'vitest';
import { findProtectedViolations } from '../../../scripts/validate-protected-areas.mjs';

function isFlagged(path: string) {
  return findProtectedViolations([path]).length > 0;
}

function categoriesFor(path: string) {
  return findProtectedViolations([path])[0]?.categories ?? [];
}

describe('protected-area matchers', () => {
  it('flags report/public output protected paths', () => {
    const protectedPaths = [
      'src/components/report/Report.tsx',
      'src/server/v3/s5-public-report.ts',
      'src/server/v3/s5-internal-renderer.ts',
      'src/server/v3/report-v3-render.server.ts',
      'src/server/v2-report-builder.server.ts',
      'src/server/report-output-enforcement.server.ts',
      'src/server/report-polish.server.ts',
      'src/server/report-quality.server.ts',
      'src/routes/index.tsx',
      'src/routes/about.tsx',
      'src/routes/dashboard.tsx',
      'src/routes/audition.$auditionId.tsx',
      'src/routes/new.tsx',
    ];

    for (const path of protectedPaths) {
      expect(isFlagged(path), path).toBe(true);
    }
  });

  it('flags Mux protected paths including prefixed mux basenames', () => {
    const protectedPaths = [
      'src/routes/api/public/mux-webhook.ts',
      'src/routes/api/public/diag-mux-probe.ts',
      'src/server/mux-upload.ts',
      'src/server/some-mux-helper.ts',
      'src/server-fns/mux.functions.ts',
      'src/lib/mux-client.ts',
      'src/utils/video-mux-helper.ts',
      'src/server-fns/mux.functions.js',
      'src/server-fns/mux.functions.jsx',
      'src/server-fns/mux.functions.mjs',
      'src/server-fns/mux.functions.cjs',
      'src\\server-fns\\mux.functions.ts',
      'src\\routes\\api\\public\\diag-mux-probe.ts',
    ];

    for (const path of protectedPaths) {
      expect(isFlagged(path), path).toBe(true);
    }
  });

  it('does not flag unrelated files by report/mux matchers alone', () => {
    const unrelatedPaths = [
      'src/server/v3/brief-achievement.server.ts',
      'src/server/v3/technique-standards.server.ts',
      'src/server-fns/brief.functions.ts',
      'src/lib/video-client.ts',
      'src/components/demo-mux-label.tsx',
      'src/server/v3/contracts/report-v3-contracts.ts',
      'src/server/__tests__/v3-r10-public-report-v3a.test.ts',
    ];

    for (const path of unrelatedPaths) {
      expect(isFlagged(path), path).toBe(false);
    }
  });

  it('deduplicates rows and keeps multiple categories on one file entry', () => {
    const violations = findProtectedViolations(['src/routes/api/public/mux-webhook.ts']);
    expect(violations).toHaveLength(1);
    expect(violations[0].file).toBe('src/routes/api/public/mux-webhook.ts');
    expect(new Set(categoriesFor('src/routes/api/public/mux-webhook.ts'))).toEqual(new Set(['Mux', 'webhook']));
  });

  it('flags client-only mux basename when file content is mux-sensitive', () => {
    const violations = findProtectedViolations(
      ['src/components/demo-mux-sensitive.tsx'],
      {
        contentByPath: {
          'src/components/demo-mux-sensitive.tsx': "export const demo = { provider: '@mux/video', widget: 'MuxUploader' };",
        },
      },
    );
    expect(violations).toHaveLength(1);
    expect(violations[0].categories).toContain('Mux');
  });

  it('flags backend/function path without mux basename when mux-sensitive content is present', () => {
    const violations = findProtectedViolations(
      ['src/server-fns/delete.functions.ts'],
      {
        contentByPath: {
          'src/server-fns/delete.functions.ts': "import { getMux } from './mux'; const client = Mux.Video;",
        },
      },
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].categories).toContain('Mux');
  });

  it('does not flag backend/function path without mux basename or sensitive content', () => {
    const violations = findProtectedViolations(
      ['src/server-fns/delete.functions.ts'],
      {
        contentByPath: {
          'src/server-fns/delete.functions.ts': 'export const prune = () => true;',
        },
      },
    );

    expect(violations).toHaveLength(0);
  });
});
