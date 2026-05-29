export const LAUNCH_GOVERNANCE_VERSION = "s10-1-ds-22-2026-05-29" as const;

export type LaunchChannel =
  | "paid_traffic"
  | "creator_outreach"
  | "b2b_pilot"
  | "weekly_launch_review";

export type LaunchGateId =
  | "report_usefulness_gate"
  | "tracking_and_claims_approved"
  | "campaign_approval_workflow"
  | "b2b_pilot_approval_workflow"
  | "support_admin_ready"
  | "non_goals_confirmed"
  | "weekly_review_ready"
  | "rollback_condition_ready";

export type LaunchNonGoalId =
  | "mobile_app_deferred"
  | "no_adsense"
  | "no_ads_inside_reports"
  | "no_subscriptions"
  | "no_unlimited_reports"
  | "no_public_report_sharing"
  | "no_b2b_leaderboard"
  | "no_personalised_ads_under_18"
  | "no_sponsor_dependency";

export type LaunchReadinessGate = {
  id: LaunchGateId;
  title: string;
  owner: "founder" | "engineering" | "marketing" | "compliance";
  required_for: LaunchChannel[];
  evidence: string[];
  blocks_when_missing: string;
};

export type LaunchApprovalWorkflow = {
  id: "campaign_approval" | "b2b_pilot_approval";
  title: string;
  required_before: LaunchChannel[];
  required_evidence: string[];
  rejection_conditions: string[];
};

export type LaunchNonGoal = {
  id: LaunchNonGoalId;
  title: string;
  reason: string;
};

export type LaunchRollbackCondition = {
  id: "report_value_regression" | "privacy_or_consent_regression" | "credit_or_payment_regression";
  trigger: string;
  action: string;
};

export type LaunchGateCompletion = Partial<Record<LaunchGateId, boolean>>;

export type LaunchReadinessEvaluation = {
  version: typeof LAUNCH_GOVERNANCE_VERSION;
  checklist_complete: boolean;
  paid_traffic_allowed: boolean;
  creator_outreach_allowed: boolean;
  b2b_pilot_allowed: boolean;
  weekly_launch_review_ready: boolean;
  incomplete_gate_ids: LaunchGateId[];
  prohibited_goal_ids: LaunchNonGoalId[];
  missing_by_channel: Record<LaunchChannel, LaunchGateId[]>;
};

const ALL_CHANNELS: LaunchChannel[] = [
  "paid_traffic",
  "creator_outreach",
  "b2b_pilot",
  "weekly_launch_review",
];

export const LAUNCH_READINESS_GATES: LaunchReadinessGate[] = [
  {
    id: "report_usefulness_gate",
    title: "Report usefulness gate remains mandatory",
    owner: "founder",
    required_for: ALL_CHANNELS,
    evidence: [
      "Authenticated report route/PDF remains useful and specific.",
      "Known thin-shell regressions are not present in current release proof.",
      "No DS-22 change alters blocked S10 report intelligence or prompt logic.",
    ],
    blocks_when_missing: "No launch channel may start while report usefulness is unverified.",
  },
  {
    id: "tracking_and_claims_approved",
    title: "Tracking and public claims are approved",
    owner: "marketing",
    required_for: ["paid_traffic", "creator_outreach", "weekly_launch_review"],
    evidence: [
      "UTM, creator and partner attribution are working where consent allows.",
      "Public copy avoids casting, callback, job, school or agency outcome promises.",
      "Support follow-up path is monitored for B2B interest submissions.",
    ],
    blocks_when_missing:
      "Paid traffic and creator outreach cannot start until tracking and claims are approved.",
  },
  {
    id: "campaign_approval_workflow",
    title: "Campaign approval workflow is complete",
    owner: "marketing",
    required_for: ["paid_traffic", "creator_outreach", "weekly_launch_review"],
    evidence: [
      "Campaign owner, source, landing route and claim set are documented.",
      "Audience age-safety and no personalised under-18 ad rule are checked.",
      "Rollback owner and pause condition are named before spend or outreach.",
    ],
    blocks_when_missing: "Paid traffic cannot start without campaign approval.",
  },
  {
    id: "b2b_pilot_approval_workflow",
    title: "B2B pilot approval workflow is complete",
    owner: "founder",
    required_for: ["b2b_pilot", "weekly_launch_review"],
    evidence: [
      "Partner type, cohort size, credit cap and visibility scope are recorded.",
      "No leaderboard, sponsor dependency or unlimited-report promise is made.",
      "Consent and support ownership are confirmed before pilot activation.",
    ],
    blocks_when_missing: "B2B pilots cannot start without pilot approval.",
  },
  {
    id: "support_admin_ready",
    title: "Support and admin operations are ready",
    owner: "engineering",
    required_for: ALL_CHANNELS,
    evidence: [
      "Admin operations console can inspect users, credits, partners and reports.",
      "Credit adjustments require a reason and write an audit record.",
      "CRM/support queue path is monitored for launch and pilot contacts.",
    ],
    blocks_when_missing: "Launch cannot start without support/admin recovery paths.",
  },
  {
    id: "non_goals_confirmed",
    title: "Release non-goals are confirmed",
    owner: "compliance",
    required_for: ALL_CHANNELS,
    evidence: [
      "Mobile app, AdSense, report ads, subscriptions and unlimited reports remain out of scope.",
      "Public report sharing, B2B leaderboards and sponsor dependency remain out of scope.",
      "No personalised ads to under-18s are planned.",
    ],
    blocks_when_missing: "Launch cannot start until non-goals are explicitly confirmed.",
  },
  {
    id: "weekly_review_ready",
    title: "Weekly launch review template is ready",
    owner: "founder",
    required_for: ["weekly_launch_review"],
    evidence: [
      "Review covers report value, funnel performance, support load and regressions.",
      "Review records go/no-go decision and owner for any blocker.",
      "Review includes decision on whether to pause spend, outreach or pilots.",
    ],
    blocks_when_missing: "Launch review cannot operate without the review template.",
  },
  {
    id: "rollback_condition_ready",
    title: "Rollback conditions are ready",
    owner: "engineering",
    required_for: ALL_CHANNELS,
    evidence: [
      "Report-value regression triggers pause or rollback.",
      "Privacy, consent, credit, payment and support regressions have named actions.",
      "Rollback preserves useful infrastructure where report generation must be paused.",
    ],
    blocks_when_missing: "Launch cannot start without rollback conditions.",
  },
];

export const LAUNCH_APPROVAL_WORKFLOWS: LaunchApprovalWorkflow[] = [
  {
    id: "campaign_approval",
    title: "Campaign approval workflow",
    required_before: ["paid_traffic", "creator_outreach"],
    required_evidence: [
      "Campaign source, route and claim set are documented.",
      "Attribution and support notification path have been checked.",
      "No prohibited launch goal appears in public copy or briefing notes.",
      "Report usefulness gate has current evidence.",
    ],
    rejection_conditions: [
      "Any casting, callback, booking, agency, school or employment promise.",
      "Any paid traffic without attribution or consent handling.",
      "Any personalised advertising plan for under-18 performers.",
    ],
  },
  {
    id: "b2b_pilot_approval",
    title: "B2B pilot approval workflow",
    required_before: ["b2b_pilot"],
    required_evidence: [
      "Partner type, cohort size, credit cap and visibility policy are confirmed.",
      "Support/admin owner is named for credit or report failures.",
      "No leaderboard, sponsor dependency or unlimited report promise is made.",
      "Full reports, videos and briefs remain private unless explicit sharing is enabled later.",
    ],
    rejection_conditions: [
      "Pilot depends on sponsors as the primary release condition.",
      "Pilot promises full report visibility to partners by default.",
      "Pilot bypasses the report usefulness gate.",
    ],
  },
];

export const LAUNCH_NON_GOALS: LaunchNonGoal[] = [
  {
    id: "mobile_app_deferred",
    title: "Mobile app remains deferred",
    reason: "S10.1 is a web launch and B2B-funded readiness slice.",
  },
  {
    id: "no_adsense",
    title: "No AdSense",
    reason: "S10.1 must not monetise performer reports with advertising.",
  },
  {
    id: "no_ads_inside_reports",
    title: "No ads inside reports",
    reason: "The performer-facing report is the product and must stay focused.",
  },
  {
    id: "no_subscriptions",
    title: "No subscriptions",
    reason: "Release 1 uses credits and funded pilots, not recurring subscriptions.",
  },
  {
    id: "no_unlimited_reports",
    title: "No unlimited reports",
    reason: "Credit metering protects cost and partner budgets.",
  },
  {
    id: "no_public_report_sharing",
    title: "No public report sharing",
    reason:
      "Full reports, videos and briefs stay private unless a later explicit share route is approved.",
  },
  {
    id: "no_b2b_leaderboard",
    title: "No B2B leaderboard",
    reason: "B2B progress reporting must not rank performers publicly.",
  },
  {
    id: "no_personalised_ads_under_18",
    title: "No personalised ads to under-18s",
    reason: "The launch model must remain age-safe and consent-conscious.",
  },
  {
    id: "no_sponsor_dependency",
    title: "No sponsor dependency",
    reason:
      "S10.1 should work through schools, coaches, agents and platform funding without sponsor lock-in.",
  },
];

export const LAUNCH_WEEKLY_REVIEW_TEMPLATE = [
  "Report usefulness evidence and regressions",
  "Paid traffic or creator outreach status",
  "B2B pilot approvals, caps and support load",
  "Attribution, claims and consent checks",
  "Credit, payment, CRM and admin incidents",
  "Go, pause or rollback decision with owner",
] as const;

export const LAUNCH_ROLLBACK_CONDITIONS: LaunchRollbackCondition[] = [
  {
    id: "report_value_regression",
    trigger:
      "Authenticated report becomes thin, generic, contradictory or less useful than the approved baseline.",
    action:
      "Pause launch channels and rollback report-generation/rendering path while preserving useful infrastructure.",
  },
  {
    id: "privacy_or_consent_regression",
    trigger:
      "Private report/video/brief data, consent state or partner visibility behaves outside the approved policy.",
    action:
      "Pause B2B and campaign activity, revoke affected access and record the incident for review.",
  },
  {
    id: "credit_or_payment_regression",
    trigger: "Credits, payments, refunds, reservations or support adjustments cannot be trusted.",
    action:
      "Pause paid/partner activation and use admin audit trails to reconcile affected accounts.",
  },
];

const PROHIBITED_LAUNCH_GOAL_PATTERNS: Array<{ id: LaunchNonGoalId; pattern: RegExp }> = [
  { id: "mobile_app_deferred", pattern: /\bmobile\s+app\b/i },
  { id: "no_adsense", pattern: /\badsense\b/i },
  { id: "no_ads_inside_reports", pattern: /\bads?\s+(?:inside|in|on)\s+(?:the\s+)?reports?\b/i },
  { id: "no_subscriptions", pattern: /\bsubscriptions?\b/i },
  { id: "no_unlimited_reports", pattern: /\bunlimited\s+reports?\b/i },
  { id: "no_public_report_sharing", pattern: /\bpublic\s+report\s+sharing\b/i },
  { id: "no_b2b_leaderboard", pattern: /\b(?:b2b\s+)?leaderboard\b/i },
  {
    id: "no_personalised_ads_under_18",
    pattern: /\bpersonal(?:ised|ized)\s+ads?\s+(?:to|for)\s+under-?18s?\b/i,
  },
  { id: "no_sponsor_dependency", pattern: /\bsponsor\s+dependenc(?:y|ies)\b/i },
];

export function findProhibitedLaunchGoalClaims(copy: string): LaunchNonGoalId[] {
  const matches = new Set<LaunchNonGoalId>();
  for (const { id, pattern } of PROHIBITED_LAUNCH_GOAL_PATTERNS) {
    if (pattern.test(copy)) matches.add(id);
  }
  return [...matches];
}

function missingForChannel(
  completed: LaunchGateCompletion,
  channel: LaunchChannel,
): LaunchGateId[] {
  return LAUNCH_READINESS_GATES.filter(
    (gate) => gate.required_for.includes(channel) && completed[gate.id] !== true,
  ).map((gate) => gate.id);
}

export function evaluateLaunchReadiness(
  completed: LaunchGateCompletion = {},
  candidateCopy = "",
): LaunchReadinessEvaluation {
  const incompleteGateIds = LAUNCH_READINESS_GATES.filter(
    (gate) => completed[gate.id] !== true,
  ).map((gate) => gate.id);
  const prohibitedGoalIds = findProhibitedLaunchGoalClaims(candidateCopy);
  const missingByChannel: Record<LaunchChannel, LaunchGateId[]> = {
    paid_traffic: missingForChannel(completed, "paid_traffic"),
    creator_outreach: missingForChannel(completed, "creator_outreach"),
    b2b_pilot: missingForChannel(completed, "b2b_pilot"),
    weekly_launch_review: missingForChannel(completed, "weekly_launch_review"),
  };
  const noProhibitedGoals = prohibitedGoalIds.length === 0;

  return {
    version: LAUNCH_GOVERNANCE_VERSION,
    checklist_complete: incompleteGateIds.length === 0 && noProhibitedGoals,
    paid_traffic_allowed: missingByChannel.paid_traffic.length === 0 && noProhibitedGoals,
    creator_outreach_allowed: missingByChannel.creator_outreach.length === 0 && noProhibitedGoals,
    b2b_pilot_allowed: missingByChannel.b2b_pilot.length === 0 && noProhibitedGoals,
    weekly_launch_review_ready:
      missingByChannel.weekly_launch_review.length === 0 && noProhibitedGoals,
    incomplete_gate_ids: incompleteGateIds,
    prohibited_goal_ids: prohibitedGoalIds,
    missing_by_channel: missingByChannel,
  };
}

export function createCompleteLaunchGateRecord(): Record<LaunchGateId, true> {
  return LAUNCH_READINESS_GATES.reduce(
    (record, gate) => {
      record[gate.id] = true;
      return record;
    },
    {} as Record<LaunchGateId, true>,
  );
}
