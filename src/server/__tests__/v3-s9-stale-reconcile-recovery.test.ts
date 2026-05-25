import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyStaticRenditionReadyTake } from '@/routes/api/public/mux-webhook';
import { isAuthorisedReconcilerRequest } from '@/routes/api/public/reconcile-stale-takes';

describe('v3 s9 stale reconcile recovery guardrails', () => {
  it('authorises the internal reconciler via custom or bearer secret only', () => {
    const env = { RECONCILER_SECRET: 'expected-secret' };
    const customHeader = new Request('https://example.test/api/public/reconcile-stale-takes', {
      method: 'POST',
      headers: { 'x-reconciler-secret': 'expected-secret' },
    });
    const bearerHeader = new Request('https://example.test/api/public/reconcile-stale-takes', {
      method: 'POST',
      headers: { authorization: 'Bearer expected-secret' },
    });
    const anonymous = new Request('https://example.test/api/public/reconcile-stale-takes', { method: 'POST' });

    expect(isAuthorisedReconcilerRequest(customHeader, env)).toBe('authorised');
    expect(isAuthorisedReconcilerRequest(bearerHeader, env)).toBe('authorised');
    expect(isAuthorisedReconcilerRequest(anonymous, env)).toBe('unauthorised');
    expect(isAuthorisedReconcilerRequest(customHeader, {} as any)).toBe('not_configured');
  });

  it('static rendition ready skips fresh in-flight work but recovers stale analysing takes', () => {
    expect(classifyStaticRenditionReadyTake({
      status: 'processing',
      processing_phase: 'analysing',
      stale_heartbeat_ms: 5_000,
    })).toBe('skip_fresh_inflight');

    expect(classifyStaticRenditionReadyTake({
      status: 'processing',
      processing_phase: 'analysing',
      stale_heartbeat_ms: 45_000,
    })).toBe('recover_stale_analysing');

    expect(classifyStaticRenditionReadyTake({
      status: 'complete',
      processing_phase: 'complete',
      stale_heartbeat_ms: 45_000,
    })).toBe('skip_terminal');
  });

  it('persists completion before optional QA artefact emission', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/process-take.server.ts'), 'utf8');
    const persistIndex = source.indexOf('analysis_persist_completed');
    const qaIndex = source.indexOf('emitQAManifestForAnalysisRun_start');
    expect(persistIndex).toBeGreaterThan(0);
    expect(qaIndex).toBeGreaterThan(0);
    expect(persistIndex).toBeLessThan(qaIndex);
    expect(source).toContain("} catch (qaErr) {");
    expect(source).toContain("internal_qa_emit_warning");
  });

  it('classifies provider contract failures without Mux URL retry loops and emits failure QA context', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/process-take.server.ts'), 'utf8');
    expect(source).toContain('provider_request_contract_error');
    expect(source).toContain('shouldRetryWithFreshMuxUrl');
    expect(source).toContain('didMuxUrlRecoveryRetry');
    expect(source).toContain('emitPreReportFailureManifest');
    expect(source).toContain('pre_report_failure_qa_manifest_emitted');
    expect(source).not.toContain('urlForCall === resolvedProbeUrl');
  });

  it('reconciler reschedules stale analysing rows instead of leaving them stranded', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/reconcile-stale-takes.ts'), 'utf8');
    expect(source).toContain('.eq("processing_phase", "analysing")');
    expect(source).toContain('status: "pending"');
    expect(source).toContain('processing_phase: "analysis_pending"');
    expect(source).toContain('runProcessTake(take.id)');
  });

  it('reconciler force-errors stale finalising rows and keeps the cron endpoint authenticated', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/reconcile-stale-takes.ts'), 'utf8');
    expect(source).toContain('FINALISING_ORPHAN_MINUTES');
    expect(source).toContain('.eq("processing_phase", "finalising")');
    expect(source).toContain('finalising_orphan_forced_error');
    expect(source).toContain('x-reconciler-secret');
    expect(source).toContain('Authorization: Bearer <secret>');
  });

  it('mux webhook logs a safe body summary instead of signed raw upload URLs', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/mux-webhook.ts'), 'utf8');
    expect(source).toContain('MUX WEBHOOK BODY SUMMARY');
    expect(source).not.toContain('MUX WEBHOOK RAW BODY');
    expect(source).not.toContain('body: rawBody');
  });

  it('cron migration targets the canonical production reconciler URL with the secret header', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'supabase/migrations/20260525143000_reconcile_stale_takes_canonical_url.sql'),
      'utf8',
    );
    expect(source).toContain('https://tapecoach.co.uk/api/public/reconcile-stale-takes');
    expect(source).toContain("'x-reconciler-secret'");
    expect(source).toContain("vault.decrypted_secrets");
  });
});
