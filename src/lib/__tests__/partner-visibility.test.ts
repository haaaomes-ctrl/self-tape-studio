import { describe, expect, it } from "vitest";
import {
  assertPartnerVisibilityScopeAllowed,
  buildPartnerVisibilityAcceptanceDraft,
  defaultPartnerDataVisibilityPolicy,
  PARTNER_VISIBILITY_POLICY_VERSION,
  redactPartnerProgressDashboardDisclosure,
} from "@/lib/partner-program";

describe("partner data visibility foundation", () => {
  it("keeps sponsor access aggregate-only and blocks individual progress scopes", () => {
    expect(defaultPartnerDataVisibilityPolicy("sponsor")).toMatchObject({
      default_scope: "aggregate_only",
      requires_member_acceptance: false,
      allows_named_progress: false,
      allows_limited_usage_readiness: false,
      full_report_visible_by_default: false,
      uploaded_media_visible_by_default: false,
      brief_visible_by_default: false,
      leaderboard_allowed: false,
    });
    expect(() => assertPartnerVisibilityScopeAllowed("sponsor", "named_progress")).toThrow(
      /named progress/i,
    );
    expect(() => assertPartnerVisibilityScopeAllowed("sponsor", "limited_usage_readiness")).toThrow(
      /limited usage\/readiness/i,
    );
  });

  it("allows school and coach named progress only after an explicit acceptance record", () => {
    expect(defaultPartnerDataVisibilityPolicy("school")).toMatchObject({
      default_scope: "named_progress",
      requires_member_acceptance: true,
      allows_named_progress: true,
      full_report_visible_by_default: false,
      uploaded_media_visible_by_default: false,
      brief_visible_by_default: false,
      leaderboard_allowed: false,
    });

    expect(
      buildPartnerVisibilityAcceptanceDraft({
        partner_membership_id: "membership-1",
        partner_id: "partner-1",
        user_id: "user-1",
        partner_type: "coach",
        accepted_at: "2026-05-27T12:00:00.000Z",
        metadata: { performer_name: "Sam Student" },
      }),
    ).toMatchObject({
      partner_membership_id: "membership-1",
      partner_id: "partner-1",
      user_id: "user-1",
      partner_type: "coach",
      visibility_scope: "named_progress",
      status: "active",
      policy_version: PARTNER_VISIBILITY_POLICY_VERSION,
      full_report_sharing_enabled: false,
      uploaded_media_sharing_enabled: false,
      brief_sharing_enabled: false,
      leaderboard_enabled: false,
    });
  });

  it("keeps agent visibility to limited usage/readiness by default", () => {
    expect(defaultPartnerDataVisibilityPolicy("agent")).toMatchObject({
      default_scope: "limited_usage_readiness",
      allows_named_progress: false,
      allows_limited_usage_readiness: true,
    });
    expect(() => assertPartnerVisibilityScopeAllowed("agent", "named_progress")).toThrow(
      /named progress/i,
    );
  });

  it("requires parent or guardian confirmation for under-13 partner linking", () => {
    expect(() =>
      buildPartnerVisibilityAcceptanceDraft({
        partner_membership_id: "membership-1",
        partner_id: "partner-1",
        user_id: "user-1",
        partner_type: "school",
        account_route: "under_13",
      }),
    ).toThrow(/parent\/guardian confirmation/i);

    expect(
      buildPartnerVisibilityAcceptanceDraft({
        partner_membership_id: "membership-1",
        partner_id: "partner-1",
        user_id: "user-1",
        partner_type: "school",
        account_route: "under_13",
        parent_guardian_confirmed: true,
      }).parent_guardian_confirmed,
    ).toBe(true);
  });

  it("keeps uploaded video, brief and leaderboard access unavailable in DS-07", () => {
    expect(() =>
      buildPartnerVisibilityAcceptanceDraft({
        partner_membership_id: "membership-1",
        partner_id: "partner-1",
        user_id: "user-1",
        partner_type: "school",
        uploaded_media_sharing_enabled: true,
      }),
    ).toThrow(/video and brief sharing/i);

    expect(() =>
      buildPartnerVisibilityAcceptanceDraft({
        partner_membership_id: "membership-1",
        partner_id: "partner-1",
        user_id: "user-1",
        partner_type: "school",
        brief_sharing_enabled: true,
      }),
    ).toThrow(/video and brief sharing/i);
  });

  it("redacts dashboard fields according to the accepted visibility scope", () => {
    expect(
      redactPartnerProgressDashboardDisclosure({
        partner_type: "agent",
        visibility_scope: "limited_usage_readiness",
        performer_name: "Sam Student",
        latest_score: 88,
        score_trend: 4,
        readiness_band: "submit_if_deadline_is_close",
        fix_first_category: "brief_completion",
        latest_report_at: "2026-05-27T12:00:00.000Z",
        report_dates: ["2026-05-20T12:00:00.000Z", "2026-05-27T12:00:00.000Z"],
      }),
    ).toEqual({
      performer_name: null,
      latest_score: null,
      score_trend: null,
      readiness_band: "submit_if_deadline_is_close",
      fix_first_category: null,
      latest_report_at: "2026-05-27T12:00:00.000Z",
      report_dates: [],
      full_report_visible: false,
      uploaded_media_visible: false,
      brief_visible: false,
      leaderboard_visible: false,
    });

    expect(
      redactPartnerProgressDashboardDisclosure({
        partner_type: "school",
        visibility_scope: "named_progress",
        performer_name: "Sam Student",
        latest_score: 88,
        score_trend: 4,
        readiness_band: "submit_if_deadline_is_close",
        fix_first_category: "brief_completion",
        latest_report_at: "2026-05-27T12:00:00.000Z",
        report_dates: ["2026-05-27T12:00:00.000Z"],
      }),
    ).toMatchObject({
      performer_name: "Sam Student",
      latest_score: 88,
      score_trend: 4,
      readiness_band: "submit_if_deadline_is_close",
      fix_first_category: "brief_completion",
      report_dates: ["2026-05-27T12:00:00.000Z"],
      full_report_visible: false,
      uploaded_media_visible: false,
      brief_visible: false,
      leaderboard_visible: false,
    });
  });
});
