import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_OPERATIONS_SECTIONS,
  ADMIN_OPERATIONS_VERSION,
  buildAdminCreditGrantDraft,
  deriveAdminOperationsCoverage,
  summarizeCoverage,
} from "@/lib/admin-operations";

describe("admin operations console foundations", () => {
  it("covers every DS-21 admin surface", () => {
    expect(ADMIN_OPERATIONS_VERSION).toBe("s10-1-ds-21-2026-05-29");
    expect(ADMIN_OPERATIONS_SECTIONS).toEqual([
      "user_credits",
      "credit_history",
      "partner_memberships",
      "partner_pools",
      "report_status",
      "failure_reason",
      "payment_events",
      "consent_records",
      "cost_estimates",
      "audit_log",
    ]);

    const coverage = deriveAdminOperationsCoverage({
      userCount: 0,
      creditHistoryCount: 0,
      partnerMembershipCount: 0,
      partnerPoolCount: 0,
      reportStatusCount: 0,
      reportFailureCount: 0,
      paymentEventCount: 0,
      consentRecordCount: 0,
      costEstimateCount: 0,
      auditLogCount: 0,
    });

    expect(summarizeCoverage(coverage)).toEqual({ ready: true, missing: [] });
  });

  it("requires credit grants to include a positive amount and a support reason", () => {
    expect(() =>
      buildAdminCreditGrantDraft({
        user_id: "00000000-0000-4000-8000-000000000001",
        credit_amount: 0,
        admin_reason: "Manual support correction",
      }),
    ).toThrow(/positive integer/i);

    expect(() =>
      buildAdminCreditGrantDraft({
        user_id: "00000000-0000-4000-8000-000000000001",
        credit_amount: 1,
        admin_reason: "too short",
      }),
    ).toThrow(/at least 12 characters/i);
  });

  it("builds a normalised admin credit grant draft", () => {
    expect(
      buildAdminCreditGrantDraft({
        user_id: "00000000-0000-4000-8000-000000000001",
        credit_amount: 3,
        admin_reason: "  Restored credits after failed report run.  ",
        source_label: "  Support restoration  ",
        idempotency_key: " admin-credit-1 ",
      }),
    ).toEqual({
      user_id: "00000000-0000-4000-8000-000000000001",
      credit_amount: 3,
      admin_reason: "Restored credits after failed report run.",
      source_label: "Support restoration",
      metadata: {
        operation_version: ADMIN_OPERATIONS_VERSION,
        support_surface: "admin_operations_console",
      },
      idempotency_key: "admin-credit-1",
    });
  });

  it("adds a private audit log table and atomic grant RPC", () => {
    const sql = readFileSync(
      "supabase/migrations/20260529060000_admin_operations_console.sql",
      "utf8",
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.admin_audit_log");
    expect(sql).toContain("ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.admin_audit_log FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.admin_grant_user_credits");
    expect(sql).toContain("admin credit grants require a reason");
    expect(sql).toContain("public.grant_funded_credits");
    expect(sql).toContain("'credit_grant_added'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.admin_grant_user_credits");
    expect(sql).toContain("TO service_role");
  });
});
