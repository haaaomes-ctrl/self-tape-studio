import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_DASHBOARD_VERSION,
  analyticsSourceLabel,
  normaliseAnalyticsRate,
} from "../analytics-dashboard.server";

describe("analytics dashboard foundations", () => {
  it("keeps the DS-18 dashboard version and rate helpers stable", () => {
    expect(ANALYTICS_DASHBOARD_VERSION).toBe("s10-1-ds-18-2026-05-27");
    expect(normaliseAnalyticsRate(0.87654)).toBe(0.8765);
    expect(normaliseAnalyticsRate(null)).toBeNull();
    expect(analyticsSourceLabel({ utm_source: "instagram" })).toBe("instagram");
    expect(analyticsSourceLabel({ partner_code_hint: "SCH...123" })).toBe("partner_code");
    expect(analyticsSourceLabel({ creator_code: "coach_a" })).toBe("creator_code");
    expect(analyticsSourceLabel({})).toBe("direct_or_unknown");
  });

  it("creates private analytics ledgers, RPC and dashboard views", () => {
    const sql = readFileSync(
      "supabase/migrations/20260527165000_analytics_attribution_habit_tracking.sql",
      "utf8",
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.analytics_events");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.analytics_user_attribution");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.record_analytics_event");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS analytics_attribution JSONB");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.analytics_funnel_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.analytics_report_completion_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.analytics_habit_dashboard");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.analytics_attribution_dashboard");
    expect(sql).toContain("take.analytics_attribution->>'creator_code'");
    expect(sql).toContain("payment.metadata #>> '{analytics_attribution,creator_code}'");
    expect(sql).toContain("CREATE OR REPLACE VIEW public.analytics_b2b_leads_dashboard");
    expect(sql).toContain("'landing_view'");
    expect(sql).toContain("'signup'");
    expect(sql).toContain("'free_credit_grant'");
    expect(sql).toContain("'partner_code_activation'");
    expect(sql).toContain("'upload'");
    expect(sql).toContain("'report_started'");
    expect(sql).toContain("'report_completed'");
    expect(sql).toContain("'report_viewed'");
    expect(sql).toContain("'second_report'");
    expect(sql).toContain("'return_7d'");
    expect(sql).toContain("'return_30d'");
    expect(sql).toContain("'b2b_lead'");
    expect(sql).toContain("'creator_code_capture'");
    expect(sql).toContain("'partner_code_capture'");
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.record_analytics_event");
    expect(sql).toContain("TO anon, authenticated");
    expect(sql).toContain(
      "REVOKE ALL ON TABLE public.analytics_events FROM PUBLIC, anon, authenticated",
    );
    expect(sql).toContain(
      "GRANT SELECT ON TABLE public.analytics_report_completion_dashboard TO service_role",
    );
  });

  it("red-lines unsafe analytics payload fields before storage", () => {
    const sql = readFileSync(
      "supabase/migrations/20260527165000_analytics_attribution_habit_tracking.sql",
      "utf8",
    );

    for (const unsafeKey of [
      "raw_prompt",
      "system_prompt",
      "raw_response",
      "video_url",
      "signed_url",
      "authorization",
      "api_key",
      "cookie",
      "session",
    ]) {
      expect(sql).toContain(`- '${unsafeKey}'`);
    }
  });
});
