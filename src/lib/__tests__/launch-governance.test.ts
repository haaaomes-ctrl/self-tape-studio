import { describe, expect, it } from "vitest";
import {
  LAUNCH_APPROVAL_WORKFLOWS,
  LAUNCH_NON_GOALS,
  LAUNCH_READINESS_GATES,
  LAUNCH_ROLLBACK_CONDITIONS,
  LAUNCH_WEEKLY_REVIEW_TEMPLATE,
  createCompleteLaunchGateRecord,
  evaluateLaunchReadiness,
  findProhibitedLaunchGoalClaims,
} from "@/lib/launch-governance";

describe("DS-22 launch governance", () => {
  it("blocks paid traffic until the full launch checklist is complete", () => {
    const defaultStatus = evaluateLaunchReadiness();

    expect(defaultStatus.checklist_complete).toBe(false);
    expect(defaultStatus.paid_traffic_allowed).toBe(false);
    expect(defaultStatus.incomplete_gate_ids).toContain("report_usefulness_gate");
    expect(defaultStatus.missing_by_channel.paid_traffic).toEqual(
      expect.arrayContaining([
        "report_usefulness_gate",
        "tracking_and_claims_approved",
        "campaign_approval_workflow",
        "non_goals_confirmed",
        "rollback_condition_ready",
      ]),
    );

    const completeStatus = evaluateLaunchReadiness(createCompleteLaunchGateRecord());
    expect(completeStatus.checklist_complete).toBe(true);
    expect(completeStatus.paid_traffic_allowed).toBe(true);
  });

  it("blocks creator outreach until tracking and claims approval is confirmed", () => {
    const completedWithoutClaims = {
      ...createCompleteLaunchGateRecord(),
      tracking_and_claims_approved: false,
    };
    const status = evaluateLaunchReadiness(completedWithoutClaims);

    expect(status.creator_outreach_allowed).toBe(false);
    expect(status.missing_by_channel.creator_outreach).toContain("tracking_and_claims_approved");
  });

  it("keeps B2B pilots behind the approval workflow", () => {
    const completedWithoutPilotApproval = {
      ...createCompleteLaunchGateRecord(),
      b2b_pilot_approval_workflow: false,
    };
    const status = evaluateLaunchReadiness(completedWithoutPilotApproval);

    expect(status.b2b_pilot_allowed).toBe(false);
    expect(status.missing_by_channel.b2b_pilot).toContain("b2b_pilot_approval_workflow");
    expect(
      LAUNCH_APPROVAL_WORKFLOWS.find((workflow) => workflow.id === "b2b_pilot_approval")
        ?.rejection_conditions,
    ).toContain("Pilot bypasses the report usefulness gate.");
  });

  it("documents the required non-goals, weekly review and rollback condition", () => {
    expect(LAUNCH_NON_GOALS.map((goal) => goal.id)).toEqual([
      "mobile_app_deferred",
      "no_adsense",
      "no_ads_inside_reports",
      "no_subscriptions",
      "no_unlimited_reports",
      "no_public_report_sharing",
      "no_b2b_leaderboard",
      "no_personalised_ads_under_18",
      "no_sponsor_dependency",
    ]);
    expect(LAUNCH_WEEKLY_REVIEW_TEMPLATE).toContain("Go, pause or rollback decision with owner");
    expect(LAUNCH_ROLLBACK_CONDITIONS.map((condition) => condition.id)).toContain(
      "report_value_regression",
    );
    expect(
      LAUNCH_READINESS_GATES.find((gate) => gate.id === "report_usefulness_gate")?.evidence,
    ).toContain("Authenticated report route/PDF remains useful and specific.");
  });

  it("rejects campaign copy containing prohibited launch goals", () => {
    const prohibited = findProhibitedLaunchGoalClaims(
      "Start AdSense, public report sharing and unlimited reports for a B2B leaderboard.",
    );

    expect(prohibited).toEqual(
      expect.arrayContaining([
        "no_adsense",
        "no_public_report_sharing",
        "no_unlimited_reports",
        "no_b2b_leaderboard",
      ]),
    );
    expect(
      evaluateLaunchReadiness(createCompleteLaunchGateRecord(), "offer subscriptions"),
    ).toMatchObject({
      checklist_complete: false,
      paid_traffic_allowed: false,
      prohibited_goal_ids: ["no_subscriptions"],
    });
  });
});
