import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = path.join(
  process.cwd(),
  "supabase/migrations/20260529070000_s10_bug_audit_reconciliation_fixes.sql",
);

describe("S10 bug-audit regressions", () => {
  it("keeps Supabase generated views from breaking typed clients", async () => {
    const compatibilitySource = await readFile(
      path.join(process.cwd(), "src/integrations/supabase/client-database.ts"),
      "utf8",
    );
    const serverClientSource = await readFile(
      path.join(process.cwd(), "src/integrations/supabase/client.server.ts"),
      "utf8",
    );
    const browserClientSource = await readFile(
      path.join(process.cwd(), "src/integrations/supabase/client.ts"),
      "utf8",
    );
    const authMiddlewareSource = await readFile(
      path.join(process.cwd(), "src/integrations/supabase/auth-middleware.ts"),
      "utf8",
    );

    expect(compatibilitySource).toContain("Insert: never");
    expect(compatibilitySource).toContain("Update: never");
    expect(serverClientSource).toContain("createClient<SupabaseClientDatabase>");
    expect(browserClientSource).toContain("createClient<SupabaseClientDatabase>");
    expect(authMiddlewareSource).toContain("createClient<SupabaseClientDatabase>");
  });

  it("reconciles Stripe checkout sessions that arrive after payment intents", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toContain(
      "stripe_checkout_session_id = COALESCE(p_checkout_session_id, stripe_checkout_session_id)",
    );
    expect(migration).toContain("checkout_session_completed_after_payment_intent_succeeded");
    expect(migration).toContain("payment_intent_succeeded_after_checkout_session_completed");
    expect(migration).toContain("merged_into_payment_id");
    expect(migration).toContain("WHEN payment.status = 'payment_succeeded'");
  });

  it("preserves partner credit pool linkage when rotating codes", async () => {
    const migration = await readFile(migrationPath, "utf8");

    expect(migration).toMatch(/partner_credit_pool_id,\s+code_hash/s);
    expect(migration).toMatch(/existing_code\.partner_credit_pool_id,\s+p_new_code_hash/s);
  });

  it("returns reserved report credits when Mux upload setup fails", async () => {
    const muxUploadSource = await readFile(
      path.join(process.cwd(), "src/server-fns/mux.functions.ts"),
      "utf8",
    );

    expect(muxUploadSource).toContain("releaseUploadReservationAfterFailure");
    expect(muxUploadSource).toContain("releaseReportCreditForTake");
    expect(muxUploadSource).toContain("mux_returned_no_url");
    expect(muxUploadSource).toContain("take_update_failed_after_upload_created");
    expect(muxUploadSource).toContain("TAKE_UPDATE_FAILED");
  });

  it("blocks over-hard-cap Mux videos before report generation", async () => {
    const hardCapSource = await readFile(
      path.join(process.cwd(), "src/server/video-duration-hard-cap.server.ts"),
      "utf8",
    );
    const muxWebhookSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );
    const reconcilerSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    const processTakeSource = await readFile(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );

    expect(hardCapSource).toContain("VIDEO_DURATION_HARD_CAP_COPY");
    expect(hardCapSource).toContain("releaseReportCreditForTake");
    expect(hardCapSource).toContain("video_duration_hard_cap_blocked");
    expect(muxWebhookSource).toContain('source: "mux_webhook_asset_ready"');
    expect(muxWebhookSource).toContain('source: "mux_webhook_static_rendition_ready"');
    expect(reconcilerSource).toContain('source: "reconciler_transcoding_recovery"');
    expect(processTakeSource).toContain('source: "run_process_take_entry"');
  });

  it("returns reserved credits on Mux and reconciler terminal failures", async () => {
    const muxWebhookSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/mux-webhook.ts"),
      "utf8",
    );
    const reconcilerSource = await readFile(
      path.join(process.cwd(), "src/routes/api/public/reconcile-stale-takes.ts"),
      "utf8",
    );
    const recoverySource = await readFile(
      path.join(process.cwd(), "src/server/finalising-recovery.server.ts"),
      "utf8",
    );
    const analysisQueueSource = await readFile(
      path.join(process.cwd(), "src/server/analysis-job-queue.server.ts"),
      "utf8",
    );

    expect(muxWebhookSource).toContain("releaseReservedCreditAfterMuxTerminalFailure");
    expect(muxWebhookSource).toContain('failureCode: "mux_transcoding_error"');
    expect(reconcilerSource).toContain("releaseReservedCreditForReconcilerFailure");
    expect(reconcilerSource).toContain('failureCode: "upload_abandoned"');
    expect(reconcilerSource).toContain('trigger: "reconciler_analysis_give_up"');
    expect(recoverySource).toContain("refundReportCreditAfterRecoveryForcedError");
    expect(recoverySource).toContain('failureCode: "finalising_orphan"');
    expect(recoverySource).toContain('failureCode: "analysing_orphan"');
    expect(analysisQueueSource).toContain("analysis_queue_dispatch_failure");
    expect(analysisQueueSource).toContain("releaseReportCreditForTake");
  });
});
