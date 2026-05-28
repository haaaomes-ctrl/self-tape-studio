import { LEGAL_CONTACT_EMAIL } from "@/lib/legal-policies";

export const LAUNCH_ASSETS_VERSION = "s10-1-ds-20-2026-05-28" as const;

export const LAUNCH_ASSET_ROUTES = [
  "/",
  "/example-report",
  "/demo",
  "/trust",
  "/faq",
  "/b2b-interest",
] as const;

export const LAUNCH_PRIMARY_MESSAGE = "Free self-tape sanity checks before you submit." as const;

export const LAUNCH_PRIMARY_CTA = "Create account and claim free report" as const;
export const LAUNCH_B2B_CTA = "Fund TapeCoach reports for your students/clients" as const;

export const LAUNCH_NO_OUTCOME_PROMISE =
  "TapeCoach helps performers assess the tape they are about to submit. It cannot promise casting, school, agency or employment decisions." as const;

export const LAUNCH_TRUST_ASSETS = [
  {
    title: "Private by default",
    body: "Full reports, uploaded video and supplied briefs stay in the performer account unless an explicit share route is enabled.",
  },
  {
    title: "Brief-aware when supplied",
    body: "Reports separate supplied-brief requirements from observable performance and setup feedback.",
  },
  {
    title: "Clear about limits",
    body: "No-brief reports are baseline assessments only, and not-assessable evidence is labelled instead of criticised.",
  },
  {
    title: "Partner visibility is limited",
    body: "Schools and coaches can see permitted progress data after code activation and visibility acceptance. Sponsors see aggregate data only.",
  },
] as const;

export const LAUNCH_B2B_AUDIENCES = [
  {
    type: "school",
    title: "Schools and MT colleges",
    body: "Run a capped term pilot so students can review self-tapes between classes without creating an unlimited usage pool.",
    metric: "Term pilots from 25 students",
  },
  {
    type: "coach",
    title: "Acting, singing and self-tape coaches",
    body: "Fund structured report credits for performers between sessions, with monthly caps that protect the studio budget.",
    metric: "Monthly performer caps",
  },
  {
    type: "agent",
    title: "Agents and agencies",
    body: "Trial limited usage for clients while keeping full reports private unless the performer explicitly shares more.",
    metric: "Restricted visibility by default",
  },
] as const;

export const EXAMPLE_REPORT_SUMMARY = {
  label: "Fictional example report",
  scoringBasis: "brief_supplied",
  judgedAgainst: "emerging_training",
  recommendation: "Submit if deadline is close",
  scoreMeaning:
    "Submission-supporting evidence against the supplied brief, with one practical fix before upload.",
  headline:
    "The tape communicates the scene clearly and meets the supplied task; tighten the opening eyeline and final audio level before submitting.",
  briefSnapshot: [
    "Side 1 acting scene requested",
    "Single continuous video requested",
    "Landscape framing requested",
  ],
  observed: [
    "Acting scene is present and complete",
    "Audio remains assessable throughout",
    "Opening slate is slightly quiet",
  ],
  fixFirst:
    "Re-record the slate or lift the input gain so the first five seconds match the scene level.",
  preserve: [
    "Keep the stillness before the final line",
    "Keep the clear eyeline relationship once the scene begins",
    "Keep the current pacing through the middle beat",
  ],
  limitations: [
    "This is a product example, not an assessment of a real performer",
    "Casting outcome is outside what TapeCoach can assess",
  ],
} as const;

export const DEMO_VIDEO_STEPS = [
  {
    timestamp: "0:00",
    title: "Add the task",
    body: "Paste the brief where available, choose the performer level, then upload the tape.",
  },
  {
    timestamp: "0:18",
    title: "TapeCoach separates evidence",
    body: "The report distinguishes supplied instructions, observed tape evidence and what could not be assessed.",
  },
  {
    timestamp: "0:38",
    title: "Review the fix hierarchy",
    body: "The top recommendation, priority fixes, preserve notes and next action are grouped for a retake or final upload.",
  },
  {
    timestamp: "0:54",
    title: "Share only by choice",
    body: "The performer keeps the full report private unless a later explicit share route is used.",
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "Is TapeCoach a casting decision?",
    answer:
      "No. TapeCoach reviews the submitted tape against the available evidence. It cannot predict or promise external decisions.",
  },
  {
    question: "Can I use it without a brief?",
    answer:
      "Yes. A no-brief report gives baseline performance and setup feedback only. It does not claim brief achievement or file compliance.",
  },
  {
    question: "What does one credit buy?",
    answer:
      "One TapeCoach credit equals one self-tape report. Failed reports restore the credit automatically where the system cannot complete the report.",
  },
  {
    question: "Can schools or coaches see full reports?",
    answer:
      "Full reports are private by default. Schools and coaches can see permitted progress data after code activation and visibility acceptance.",
  },
  {
    question: "What happens to long videos?",
    answer:
      "Videos over five minutes show guidance. Videos over ten minutes are blocked before report generation unless the product limit changes.",
  },
] as const;

export const B2B_INTEREST_CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;

const OUTCOME_GUARANTEE_PATTERNS = [
  /\bguarantees?\s+(?:a\s+)?(?:casting|recall|callback|booking|job|employment|place|role|outcome)s?\b/i,
  /\bwill\s+(?:get|secure|book|win)\s+(?:you\s+)?(?:a\s+)?(?:role|job|callback|recall|place|booking)\b/i,
  /\bright\s+for\s+this\s+role\b/i,
  /\bnot\s+bookable\b/i,
];

export function findLaunchOutcomeGuaranteeClaims(copy: string): string[] {
  return OUTCOME_GUARANTEE_PATTERNS.filter((pattern) => pattern.test(copy)).map((pattern) =>
    pattern.toString(),
  );
}

export function launchPublicCopyCorpus(): string {
  return [
    LAUNCH_PRIMARY_MESSAGE,
    LAUNCH_PRIMARY_CTA,
    LAUNCH_B2B_CTA,
    LAUNCH_NO_OUTCOME_PROMISE,
    ...LAUNCH_TRUST_ASSETS.flatMap((item) => [item.title, item.body]),
    ...LAUNCH_B2B_AUDIENCES.flatMap((item) => [item.title, item.body, item.metric]),
    EXAMPLE_REPORT_SUMMARY.headline,
    EXAMPLE_REPORT_SUMMARY.scoreMeaning,
    EXAMPLE_REPORT_SUMMARY.fixFirst,
    ...EXAMPLE_REPORT_SUMMARY.briefSnapshot,
    ...EXAMPLE_REPORT_SUMMARY.observed,
    ...EXAMPLE_REPORT_SUMMARY.preserve,
    ...EXAMPLE_REPORT_SUMMARY.limitations,
    ...DEMO_VIDEO_STEPS.flatMap((item) => [item.timestamp, item.title, item.body]),
    ...FAQ_ITEMS.flatMap((item) => [item.question, item.answer]),
  ].join("\n");
}
