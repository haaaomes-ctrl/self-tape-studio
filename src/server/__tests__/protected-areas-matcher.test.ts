import { describe, expect, it } from 'vitest';
import { findProtectedViolations } from '../../../scripts/validate-protected-areas.mjs';

function isFlagged(path: string) {
  return findProtectedViolations([path]).length > 0;
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
    ];

    for (const path of protectedPaths) {
      expect(isFlagged(path), path).toBe(true);
    }
  });

  it('does not flag unrelated files by report/mux matchers alone', () => {
    const unrelatedPaths = [
      'src/server/v3/brief-achievement.server.ts',
      'src/server/v3/technique-standards.server.ts',
      'src/server/v3/contracts/brief-contracts.ts',
      'src/server/v3/contracts/technique-contracts.ts',
    ];

    for (const path of unrelatedPaths) {
      expect(isFlagged(path), path).toBe(false);
    }
  });
});
