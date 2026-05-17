import { describe, expect, it } from 'vitest';
import { findProtectedViolations, findProtectedViolationsFromEntries } from '../../../scripts/validate-protected-areas.mjs';

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
      'src/lib/report-schema.ts',
      'src/lib/report-renderer.ts',
      'src/lib/report-renderer.js',
      'src/lib/report-renderer.mjs',
      'src/lib/report-output.ts',
      'src/lib/public-report-schema.ts',
      'src/utils/report-schema.ts',
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
      'src/routes/api/public/stripe-webhook.ts',
      'src/routes/api/public/webhook.ts',
      'src/server/webhook-handler.ts',
      'src/server/webhook-utils.ts',
      'src/server-fns/webhook.functions.ts',
      'api/webhook.ts',
      'app/routes/webhook.ts',
      'src\\server\\webhook-utils.ts',
    ];

    for (const path of protectedPaths) {
      expect(isFlagged(path), path).toBe(true);
    }
  });

  it('flags upload protected runtime paths', () => {
    const protectedPaths = [
      'src/routes/new.tsx',
      'src/server/mux-upload.ts',
      'src/server/upload-errors.ts',
      'src/lib/upload-errors.ts',
      'src/server-fns/process-take.functions.ts',
      'src/server-fns/upload.functions.ts',
      'src/server-fns/direct-upload.functions.ts',
      'src/server/upload-handler.ts',
      'src/routes/api/public/upload.ts',
      'api/upload.ts',
      'app/routes/upload.ts',
      'src\\server-fns\\process-take.functions.ts',
    ];

    for (const path of protectedPaths) {
      expect(isFlagged(path), path).toBe(true);
    }
  });

  it('does not flag upload docs/tests/fixtures/contracts and take-only files', () => {
    const unprotectedPaths = [
      'src/lib/helper.ts',
      'src/lib/video-client.ts',
      'src/server/__tests__/upload-utils.test.ts',
      'src/server/__tests__/upload-utils.spec.ts',
      'src/server/__tests__/fixtures/upload-payload.fixture.json',
      'src/server/v3/contracts/upload-policy-contracts.ts',
      'docs/upload-migration.md',
      'docs/tapecoach/v3/upload-policy.md',
      'src/server/v3/contracts/release-gates.ts',
      'src/server/v3/contracts/take-contracts.ts',
      'src/server/__tests__/take-contracts.test.ts',
      'docs/take-notes.md',
    ];
    const contentByPath = {
      'src/server/v3/contracts/release-gates.ts': 'export const releasePolicy = { upload_changes_allowed: false, upload_policy: "locked", upload_gate: "on" };',
    };

    for (const path of unprotectedPaths) {
      const violations = findProtectedViolations([path], { contentByPath });
      expect(violations, path).toHaveLength(0);
    }
  });



  it('flags webhook-sensitive runtime content in neutral filenames', () => {
    const violations = findProtectedViolations(['src/server/event-handler.ts', 'src/server-fns/process-event.functions.ts'], {
      contentByPath: {
        'src/server/event-handler.ts': 'const sig = req.headers["x-signature"]; verifyWebhook(sig);',
        'src/server-fns/process-event.functions.ts': 'const secret = process.env.MUX_WEBHOOK_SECRET;'
      }
    });
    expect(violations.find((v) => v.file === 'src/server/event-handler.ts')?.categories).toContain('webhook');
    expect(violations.find((v) => v.file === 'src/server-fns/process-event.functions.ts')?.categories).toContain('webhook');
  });

  it('keeps webhook docs/tests/contracts exempt including mjs/cjs tests', () => {
    const paths = [
      'docs/webhook-migration.md',
      'src/server/__tests__/webhook-utils.test.ts',
      'src/server/__tests__/webhook-utils.test.mjs',
      'src/server/__tests__/webhook-utils.spec.cjs',
      'src/server/v3/contracts/webhook-policy-contracts.ts',
      'src/server/__tests__/upload-utils.test.mjs',
      'src/server/__tests__/report-renderer.spec.cjs',
    ];
    for (const path of paths) {
      expect(findProtectedViolations([path]), path).toHaveLength(0);
    }
  });

  it('classifies deleted/renamed protected content from old blobs', () => {
    const violations = findProtectedViolationsFromEntries([
      { status: 'deleted', path: 'src/server-fns/event-handler.functions.ts', oldContent: 'const s = process.env.MUX_WEBHOOK_SECRET; constructEvent();' },
      { status: 'deleted', path: 'src/server-fns/process-video.functions.ts', oldContent: 'const x = getMux(); Mux.Video.Assets.list();' },
      { status: 'deleted', path: 'src/server-fns/start-upload.functions.ts', oldContent: 'await createUpload(); // direct upload' },
      { status: 'deleted', path: 'src/lib/schema-version-helper.ts', oldContent: 'readReportSchemaVersion(); PublicReportV3.render();' },
      { status: 'deleted', path: 'src/lib/plain-helper.ts', oldContent: 'export const ok = true;' },
      { status: 'renamed', previousPath: 'src/server/webhook-handler.ts', path: 'src/server/event-handler.ts', oldContent: 'verifyWebhook(req); webhook signature;' },
    ] as any);
    expect(violations.find((v) => v.file.includes('event-handler.functions.ts'))?.categories).toContain('webhook');
    expect(violations.find((v) => v.file.includes('process-video.functions.ts'))?.categories).toContain('Mux');
    expect(violations.find((v) => v.file.includes('start-upload.functions.ts'))?.categories).toContain('upload');
    expect(violations.find((v) => v.file.includes('schema-version-helper.ts'))?.categories).toContain('public output/report rendering');
    expect(violations.find((v) => v.file.includes('plain-helper.ts'))).toBeUndefined();
    expect(violations.find((v) => v.file === 'src/server/webhook-handler.ts' || v.file === 'src/server/event-handler.ts')?.categories).toContain('webhook');
  });
  it('does not flag unrelated files by report/mux matchers alone', () => {
    const unrelatedPaths = [
      'src/server/v3/brief-achievement.server.ts',
      'src/server/v3/technique-standards.server.ts',
      'src/server-fns/brief.functions.ts',
      'src/lib/video-client.ts',
      'src/components/demo-mux-label.tsx',
      'src/server/v3/contracts/report-v3-contracts.ts',
      'src/server/__tests__/fixtures/report-schema.fixture.json',
      'src/lib/report-schema.test.ts',
      'src/lib/report-schema.spec.ts',
      'src/server/__tests__/v3-r10-public-report-v3a.test.ts',
      'src/server/__tests__/webhook-utils.test.ts',
      'src/server/__tests__/webhook-utils.spec.ts',
      'src/server/__tests__/fixtures/webhook-payload.fixture.json',
      'src\\server\\__tests__\\webhook-utils.test.ts',
      'src/server/v3/contracts/webhook-policy-contracts.ts',
      'docs/webhook-migration.md',
      'docs/tapecoach/v3/webhook-policy.md',
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

  it('flags backend/function path without mux basename when Mux.Video usage is present', () => {
    const violations = findProtectedViolations(
      ['src/server-fns/delete.functions.ts'],
      {
        contentByPath: {
          'src/server-fns/delete.functions.ts': 'const result = Mux.Video.Assets.del("asset_123");',
        },
      },
    );

    expect(violations).toHaveLength(1);
    expect(violations[0].categories).toContain('Mux');
  });

  it('does not flag contract policy files with non-runtime mux policy keys alone', () => {
    const violations = findProtectedViolations(
      ['src/server/v3/contracts/release-gates.ts'],
      {
        contentByPath: {
          'src/server/v3/contracts/release-gates.ts': 'export const releasePolicy = { mux_changes_allowed: false };',
        },
      },
    );

    expect(violations).toHaveLength(0);
  });

  it('flags mux secret env/config names when content-sensitive detection applies', () => {
    const violations = findProtectedViolations(
      ['src/server-fns/delete.functions.ts'],
      {
        contentByPath: {
          'src/server-fns/delete.functions.ts': 'const c = { id: process.env.MUX_TOKEN_ID, secret: process.env.MUX_TOKEN_SECRET, hook: process.env.MUX_WEBHOOK_SECRET };',
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
