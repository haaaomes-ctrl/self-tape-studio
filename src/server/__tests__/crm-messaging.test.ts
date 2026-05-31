import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CRM_DASHBOARD_VERSION } from "../crm-messaging.server";

describe("CRM service and lifecycle messaging foundations", () => {
  const sql = readFileSync(
    "supabase/migrations/20260528125200_crm_service_lifecycle_messaging.sql",
    "utf8",
  );
  const smokeCleanupSql = readFileSync(
    "supabase/migrations/20260530152500_cleanup_smoke_test_tech_debt.sql",
    "utf8",
  );
  const dispatcherGuardrailSql = readFileSync(
    "supabase/migrations/20260531090000_email_dispatcher_brevo_runtime_guardrails.sql",
    "utf8",
  );

  it("creates the CRM contact store and private dashboards", () => {
    expect(CRM_DASHBOARD_VERSION).toBe("s10-1-ds-19-2026-05-28");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.crm_contacts");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.crm_contact_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.crm_email_delivery_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.crm_lifecycle_messaging_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.crm_b2b_leads_dashboard");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.crm_contacts FROM PUBLIC, anon, authenticated",
    );
  });

  it("routes CRM emails through the Brevo-owned transactional queue", () => {
    expect(sql).toContain("public.enqueue_email('transactional_emails', payload)");
    expect(sql).toContain("'report_ready'");
    expect(sql).toContain("'failed_report_credit_restored'");
    expect(sql).toContain("'b2b_follow_up'");
    expect(dispatcherGuardrailSql).toContain("'provider', 'brevo'");
    expect(dispatcherGuardrailSql).toContain("'message_id', message_id");
    expect(dispatcherGuardrailSql).toContain("'idempotency_key', message_id");
    expect(dispatcherGuardrailSql).not.toContain("'run_id', message_id");
  });

  it("keeps consent and suppression rules explicit", () => {
    expect(sql).toContain("p_category IN ('lifecycle', 'marketing')");
    expect(sql).toContain("marketing_consent_required");
    expect(sql).toContain("hard_suppressed_email");
    expect(sql).toContain("service_messages_disabled");
    expect(sql).toContain("public.crm_get_unsubscribe_token(contact.email)");
    expect(sql).toContain("public.crm_build_unsubscribe_url");
  });

  it("sanitises unsafe template data before queueing", () => {
    expect(sql).toContain("- 'brief'");
    expect(sql).toContain("- 'raw_report'");
    expect(sql).toContain("- 'signed_url'");
    expect(sql).toContain("- 'token'");
    expect(sql).toContain("- 'secret'");
  });

  it("reasserts CRM account-compliance sync RPC and refreshes PostgREST after smoke-test drift", () => {
    expect(smokeCleanupSql).toContain(
      "CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance(p_user_id UUID)",
    );
    expect(smokeCleanupSql).toContain(
      "CREATE OR REPLACE FUNCTION public.sync_crm_contact_from_account_compliance_trigger()",
    );
    expect(smokeCleanupSql).toContain(
      "DROP TRIGGER IF EXISTS account_compliance_sync_crm_contact ON public.account_compliance",
    );
    expect(smokeCleanupSql).toContain(
      "GRANT EXECUTE ON FUNCTION public.sync_crm_contact_from_account_compliance(UUID) TO service_role",
    );
    expect(smokeCleanupSql).toContain("NOTIFY pgrst, 'reload schema'");
    expect(smokeCleanupSql).not.toContain("raw_report =");
    expect(smokeCleanupSql).not.toContain("runProcessTake");
  });
});
