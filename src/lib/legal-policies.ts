export const LEGAL_POLICY_VERSION = "2026-05-27";
export const LEGAL_CONTACT_EMAIL = "support@tapecoach.co.uk";

export const LEGAL_POLICY_SLUGS = [
  "terms",
  "privacy",
  "cookies",
  "ai-report-disclaimer",
  "refund-credit-policy",
] as const;

export type LegalPolicySlug = (typeof LEGAL_POLICY_SLUGS)[number];

export interface LegalPolicySection {
  heading: string;
  body?: string[];
  bullets?: string[];
}

export interface LegalPolicy {
  slug: LegalPolicySlug;
  title: string;
  shortTitle: string;
  description: string;
  effectiveDate: string;
  sections: LegalPolicySection[];
}

export const LEGAL_POLICY_LINKS: Array<{
  slug: LegalPolicySlug;
  label: string;
  to: `/legal/${LegalPolicySlug}`;
}> = [
  { slug: "terms", label: "Terms", to: "/legal/terms" },
  { slug: "privacy", label: "Privacy", to: "/legal/privacy" },
  { slug: "cookies", label: "Cookies", to: "/legal/cookies" },
  {
    slug: "ai-report-disclaimer",
    label: "Disclaimer",
    to: "/legal/ai-report-disclaimer",
  },
  {
    slug: "refund-credit-policy",
    label: "Refund and credit policy",
    to: "/legal/refund-credit-policy",
  },
];

export const LEGAL_POLICIES: Record<LegalPolicySlug, LegalPolicy> = {
  terms: {
    slug: "terms",
    title: "Terms of Service",
    shortTitle: "Terms",
    description:
      "The terms for creating a TapeCoach account, uploading self-tapes, using credits and receiving AI-led reports.",
    effectiveDate: LEGAL_POLICY_VERSION,
    sections: [
      {
        heading: "What TapeCoach provides",
        body: [
          "TapeCoach provides private, AI-led self-tape critique and audition-readiness reports for performers, parents/guardians and partner-funded users.",
          "Reports are coaching guidance based on supplied brief/context, selected performer level, video/audio evidence and assessable task information. They are not casting decisions, employment advice, medical advice or legal advice.",
        ],
      },
      {
        heading: "No guaranteed outcomes",
        bullets: [
          "TapeCoach does not guarantee casting, callback, booking, job, employment, agent or school outcomes.",
          "A report can assess submission readiness from available evidence; it cannot predict what a casting team, agent, school or employer will decide.",
        ],
      },
      {
        heading: "Accounts, parent/guardian route and consent",
        bullets: [
          "At launch, TapeCoach uses account-route and age-band declarations only. We do not ask for exact/full date of birth, passport details or identity verification.",
          "Users select 13+ self-service, parent/guardian, or under-13 performer route.",
          "Under-13 standalone use is blocked. Under-13 use must be parent/guardian managed with parent/guardian attestation.",
          "Terms, Privacy Policy and Disclaimer acceptance are required before report-generating use.",
          "Marketing consent is separate, optional and off by default.",
        ],
      },
      {
        heading: "Uploads and report inputs",
        body: [
          "When you upload a self-tape, you confirm that you have the right to submit that video/audio and any brief, sides, copy, song, role, production or material context you provide.",
          "TapeCoach may process uploaded video/audio, supplied brief/context, selected level, upload metadata and report outputs to prepare, persist, troubleshoot and improve the private report experience.",
        ],
      },
      {
        heading: "Credits and partner-funded use",
        bullets: [
          "One TapeCoach credit equals one self-tape report unless a later product page clearly says otherwise.",
          "Credits may come from free signup, free monthly allowance, school-funded, coach-funded, agent-funded, platform-funded, sponsor campaign, user-paid or admin-grant sources.",
          "Partner-funded credits may be subject to partner allowance, per-user caps, expiry and visibility notices.",
          "Failed reports are handled under the Refund and Credit Policy.",
        ],
      },
      {
        heading: "Partner visibility",
        bullets: [
          "Full reports, uploaded videos and supplied briefs are private by default unless the performer or account manager explicitly shares them or a clearly accepted cohort setting enables sharing.",
          "Schools and coaches may see named progress data only after partner-code activation and visibility acceptance.",
          "Agents receive limited usage/readiness visibility by default unless a performer chooses to share more.",
          "Sponsors receive aggregate data only and cannot see names, individual scores, reports, videos or briefs.",
          "TapeCoach does not provide B2B leaderboards or ranking views.",
        ],
      },
      {
        heading: "Contact",
        body: [`For questions about these terms, contact ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
  privacy: {
    slug: "privacy",
    title: "Privacy Policy",
    shortTitle: "Privacy",
    description:
      "How TapeCoach handles account data, uploads, brief/context, reports, credits, partner visibility and retention.",
    effectiveDate: LEGAL_POLICY_VERSION,
    sections: [
      {
        heading: "Information we collect",
        bullets: [
          "Account details such as email, account route, age-band declaration, parent-managed status, parent/guardian attestation and policy acceptance timestamps/versions.",
          "Optional marketing consent, which is separate from service messages.",
          "Audition details such as title, selected performer level, supplied brief/context, role/material notes, video/audio upload metadata and report status.",
          "Uploaded video/audio, generated report content, scores where enabled, QA/admin diagnostics and support communications.",
          "Credit, funding-source, partner-code, partner-membership, payment and refund data where those features are active.",
          "Basic analytics and attribution data needed to understand signup, upload, report completion, return use and B2B interest, subject to cookie consent where required.",
        ],
      },
      {
        heading: "How we use information",
        bullets: [
          "To create and display private self-tape reports.",
          "To process video/audio, brief/context and selected-level inputs.",
          "To manage credits, partner-funded access, failed-report restoration and support.",
          "To keep accounts secure, enforce account-route and parent/guardian requirements, and send service emails.",
          "To produce internal/admin QA artefacts and diagnostics that prove what happened without replacing the performer-facing report.",
          "To show permitted partner progress data under the visibility rules accepted by the user or account manager.",
        ],
      },
      {
        heading: "Video, brief and report retention",
        bullets: [
          "Uploaded video/audio is processed to produce the report and is deleted from active media storage after report completion where the product no longer needs the raw media.",
          "If automatic media cleanup fails, TapeCoach may retry cleanup and keep safe operational metadata so the report and admin status remain understandable.",
          "Report text, report model data, score/recommendation data, credit history, consent records and safe QA/admin diagnostics may be retained while the account, audit, support or legal need remains.",
          "Previous take versions and QA proof may remain inspectable to admins subject to retention, privacy and deletion policy.",
          "Deleting an audition or take removes the visible record and triggers best-effort external media cleanup.",
        ],
      },
      {
        heading: "Partner and sponsor visibility",
        bullets: [
          "Sponsors see aggregate reporting only. They cannot see performer names, individual scores, full reports, videos or briefs.",
          "Schools and coaches can see named progress data only after partner-code activation and visibility acceptance.",
          "Named progress data may include name, credits used, latest score, score trend, readiness band, fix-first category and report dates.",
          "Uploaded video and supplied brief are not visible to partners by default.",
          "Full reports remain private unless explicitly shared or clearly enabled by accepted cohort settings.",
        ],
      },
      {
        heading: "Service and marketing messages",
        bullets: [
          "Service messages such as email verification, credit availability, report started, report ready, failed report and credit restored may be sent without marketing consent.",
          "Marketing or launch emails require separate consent and can be withdrawn.",
          "Under-18 marketing defaults off. Under-13 account messages should go to the parent/guardian account route.",
        ],
      },
      {
        heading: "Contact",
        body: [`For privacy questions, contact ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
  cookies: {
    slug: "cookies",
    title: "Cookie Policy",
    shortTitle: "Cookies",
    description:
      "How TapeCoach uses essential cookies and consent-gated analytics for the web app.",
    effectiveDate: LEGAL_POLICY_VERSION,
    sections: [
      {
        heading: "Essential cookies and storage",
        body: [
          "TapeCoach uses essential cookies or browser storage for authentication, security, session continuity, account-route completion and upload/report workflow state.",
          "These are needed for the service to work and are not used for personalised advertising.",
        ],
      },
      {
        heading: "Analytics and attribution",
        bullets: [
          "Non-essential analytics, UTM attribution, creator-code attribution and habit tracking should be consent-gated where required.",
          "Analytics are used to understand report completion, return use, free/partner-funded access and B2B interest.",
          "TapeCoach does not use personalised ads for under-18s and does not place ads inside private reports.",
        ],
      },
      {
        heading: "Partner and sponsor reporting",
        body: [
          "Cookie or attribution data may support aggregate partner/sponsor reporting where permitted, but sponsors do not receive individual performer data.",
        ],
      },
      {
        heading: "Contact",
        body: [`For cookie questions, contact ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
  "ai-report-disclaimer": {
    slug: "ai-report-disclaimer",
    title: "AI Report Disclaimer",
    shortTitle: "AI disclaimer",
    description:
      "What TapeCoach's AI-led report can assess, what it cannot assess and how to read its recommendations.",
    effectiveDate: LEGAL_POLICY_VERSION,
    sections: [
      {
        heading: "AI-led professional critique",
        body: [
          "TapeCoach uses AI analysis to produce structured self-tape critique. The report is generated from supplied brief/context, selected performer level, observable video/audio evidence, role/material context where available, and internal report-quality checks.",
          "The report is designed to help you decide whether to submit, retake or review carefully. It is not a promise of casting, callback, booking, job, employment, agent, school or audition outcome.",
        ],
      },
      {
        heading: "What the report can assess",
        bullets: [
          "Observable performance, voice/singing, movement/dance, musical-theatre package, commercial/screen task and self-tape presentation where evidence is visible or audible.",
          "Supplied-brief requirements, upload instructions and role/material context where the source basis is clear.",
          "Selected performer-level readiness and score language where scores are visible.",
          "Professional 90+ competitive calibration where applicable.",
        ],
      },
      {
        heading: "What the report cannot safely assess",
        bullets: [
          "Hidden casting preferences, callback likelihood, marketability, bookability or guaranteed outcome.",
          "Protected characteristics, body or appearance judgement, medical diagnosis or vocal-health diagnosis.",
          "Brief, deadline, upload, file naming, page/side or role-specific compliance where no brief/context was supplied.",
          "Anything that is not visible, audible, supplied or reliably inferred from the available evidence.",
        ],
      },
      {
        heading: "No-brief baseline mode",
        body: [
          "If no brief is supplied, the report can only assess baseline observable performance, setup and selected-level readiness. It cannot claim brief achievement, page/side compliance, role-specific fit, deadline compliance or submission-package completeness.",
        ],
      },
      {
        heading: "Repair, red-line and QA handling",
        body: [
          "TapeCoach may validate AI output, ask targeted repair questions for missing/thin/contradictory modules, and apply narrow red-line filtering for unsafe claims. Internal QA artefacts prove the report process and are not performer-facing critique.",
        ],
      },
    ],
  },
  "refund-credit-policy": {
    slug: "refund-credit-policy",
    title: "Refund and Credit Policy",
    shortTitle: "Refunds",
    description:
      "How TapeCoach handles paid credits, partner-funded credits, failed reports and duplicate credit events.",
    effectiveDate: LEGAL_POLICY_VERSION,
    sections: [
      {
        heading: "Credit basics",
        bullets: [
          "One TapeCoach credit equals one self-tape report unless a product page clearly says otherwise.",
          "Credits may be free, partner-funded, platform-funded, sponsor-funded, user-paid or admin-granted.",
          "Free monthly credits do not roll over unless a later offer clearly says otherwise.",
          "Paid credits roll over unless a later product page or refund event clearly changes that balance.",
        ],
      },
      {
        heading: "Failed reports",
        bullets: [
          "A credit should be consumed only when a report is persisted and viewable.",
          "If TapeCoach fails to generate a report after reserving or consuming a credit, the credit should be restored automatically.",
          "Cancelling before analysis starts should release the reserved credit.",
          "Replacement takes consume a new funded credit when they generate a fresh report.",
        ],
      },
      {
        heading: "Paid credit refunds",
        bullets: [
          "Payment success grants credits; payment failure grants no credits.",
          "Checkout and webhook processing should be idempotent so refreshing a success page cannot duplicate credits.",
          "Refunds, chargebacks or disputes may reverse, freeze or flag the relevant paid credits and revenue ledger records.",
        ],
      },
      {
        heading: "Partner-funded credits",
        bullets: [
          "Partner-funded credits are governed by the partner allowance, period, per-user caps and accepted visibility notice.",
          "Unused partner-funded credits may expire or return to the partner pool according to that partner setup.",
          "Sponsors fund aggregate-only campaigns and do not receive individual performer reports or data.",
        ],
      },
      {
        heading: "Contact",
        body: [`For refund or credit support, contact ${LEGAL_CONTACT_EMAIL}.`],
      },
    ],
  },
};

export function getLegalPolicy(slug: LegalPolicySlug): LegalPolicy {
  return LEGAL_POLICIES[slug];
}

export function legalPolicyText(policy: LegalPolicy): string {
  return [
    policy.title,
    policy.description,
    ...policy.sections.flatMap((section) => [
      section.heading,
      ...(section.body ?? []),
      ...(section.bullets ?? []),
    ]),
  ].join("\n");
}
