import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyStaticRenditionReadyTake } from '@/routes/api/public/mux-webhook';
import { isAuthorisedReconcilerRequest } from '@/routes/api/public/reconcile-stale-takes';
import {
  FINALISING_ORPHAN_MS,
  finalisingOrphanCutoffIso,
  isFinalisingHeartbeatStale,
} from '@/server/finalising-recovery.server';

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

  it('static rendition ready skips fresh in-flight work but recovers stale analysing/finalising takes', () => {
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
      status: 'processing',
      processing_phase: 'finalising',
      stale_heartbeat_ms: FINALISING_ORPHAN_MS - 1,
    })).toBe('skip_fresh_inflight');

    expect(classifyStaticRenditionReadyTake({
      status: 'processing',
      processing_phase: 'finalising',
      stale_heartbeat_ms: FINALISING_ORPHAN_MS,
    })).toBe('recover_stale_finalising');

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

  it('reconciler enqueues stale analysing rows instead of running analysis in request waitUntil', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/reconcile-stale-takes.ts'), 'utf8');
    expect(source).toContain('.eq("processing_phase", "analysing")');
    expect(source).toContain('status: "pending"');
    expect(source).toContain('processing_phase: "analysis_pending"');
    expect(source).toContain('enqueueAnalysisJobOrMarkFailed');
    expect(source).toContain('reconciler_stale_analysing');
    expect(source).not.toContain('scheduleBackground(');
    expect(source).not.toContain('runProcessTake(take.id)');
  });

  it('reconciler force-errors stale finalising rows and keeps the cron endpoint authenticated', async () => {
    const reconciler = await readFile(path.join(process.cwd(), 'src/routes/api/public/reconcile-stale-takes.ts'), 'utf8');
    const recovery = await readFile(path.join(process.cwd(), 'src/server/finalising-recovery.server.ts'), 'utf8');
    const source = `${reconciler}\n${recovery}`;
    expect(reconciler).toContain('FINALISING_ORPHAN_WINDOW_SECONDS');
    expect(reconciler).toContain('finalisingOrphanCutoffIso(now)');
    expect(reconciler).toContain('.eq("processing_phase", "finalising")');
    expect(reconciler).toContain('recoverFinalisingTake');
    expect(source).toContain('finalising_orphan_recovered_complete');
    expect(source).toContain('reason: "report_present"');
    expect(source).toContain('finalising_orphan_forced_error');
    expect(source).toContain('[failure_code:finalising_orphan]');
    expect(reconciler).toContain('x-reconciler-secret');
    expect(reconciler).toContain('Authorization: Bearer <secret>');
  });

  it('finalising orphan threshold is short enough for polling recovery', () => {
    expect(isFinalisingHeartbeatStale(FINALISING_ORPHAN_MS - 1)).toBe(false);
    expect(isFinalisingHeartbeatStale(FINALISING_ORPHAN_MS)).toBe(true);
    expect(finalisingOrphanCutoffIso(100_000 + FINALISING_ORPHAN_MS)).toBe(new Date(100_000).toISOString());
  });

  it('mux webhook enqueues analysis jobs instead of running analysis in waitUntil', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/mux-webhook.ts'), 'utf8');
    expect(source).toContain('enqueueAnalysisJobOrMarkFailed');
    expect(source).toContain('reason: "mux_asset_ready"');
    expect(source).toContain('reason: recoveryAction === "recover_stale_analysing"');
    expect(source).not.toContain('scheduleBackground(');
    expect(source).not.toContain('runProcessTake(takeId)');
  });

  it('worker queue consumer owns runProcessTake execution', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/worker-entry.ts'), 'utf8');
    expect(source).toContain('async queue(');
    expect(source).toContain('await import("@/server/process-take.server")');
    expect(source).toContain('runProcessTake(body.takeId)');
  });

  it('wrangler binds the durable analysis queue producer and consumer', async () => {
    const source = await readFile(path.join(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(source).toContain('"binding": "ANALYSIS_QUEUE"');
    expect(source).toContain('"queue": "tapecoach-analysis-jobs"');
    expect(source).toContain('"max_batch_size": 1');
  });

  it('finalising terminal writes only mark ownership after the DB update succeeds', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/process-take.server.ts'), 'utf8');
    const helperStart = source.indexOf('const markTerminalFailure = async');
    const helperEnd = source.indexOf('// Carries a failure_code', helperStart);
    const helper = source.slice(helperStart, helperEnd);

    expect(helperStart).toBeGreaterThan(0);
    expect(helper).toContain('status: "error"');
    expect(helper).toContain('processing_phase: "error"');
    expect(helper.indexOf('if (writeErr) throw writeErr')).toBeGreaterThan(0);
    expect(helper.indexOf('terminalWritten = true')).toBeGreaterThan(
      helper.indexOf('if (writeErr) throw writeErr'),
    );
  });

  it('mux webhook logs a safe body summary instead of signed raw upload URLs', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/routes/api/public/mux-webhook.ts'), 'utf8');
    expect(source).toContain('MUX WEBHOOK BODY SUMMARY');
    expect(source).not.toContain('MUX WEBHOOK RAW BODY');
    expect(source).not.toContain('body: rawBody');
  });

  it('cron migration targets the canonical production reconciler URL with the secret header', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'supabase/migrations/20260525162500_reconcile_stale_takes_canonical_repair.sql'),
      'utf8',
    );
    expect(source).toContain('https://tapecoach.co.uk/api/public/reconcile-stale-takes');
    expect(source).toContain("'x-reconciler-secret'");
    expect(source).toContain("vault.decrypted_secrets");
    expect(source).not.toContain('project--af0c387f-c90b-4efa-b943-dc325d1a44f5');
  });
});
