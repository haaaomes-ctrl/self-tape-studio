import { describe, expect, it } from "vitest";
import {
  B2B_INTEREST_CONTACT_EMAIL,
  EXAMPLE_REPORT_SUMMARY,
  LAUNCH_ASSET_ROUTES,
  LAUNCH_B2B_CTA,
  LAUNCH_PRIMARY_CTA,
  LAUNCH_PRIMARY_MESSAGE,
  findLaunchOutcomeGuaranteeClaims,
  launchPublicCopyCorpus,
} from "@/lib/launch-assets";
import {
  B2BInterestValidationError,
  buildB2BInterestAnalyticsProperties,
  buildB2BInterestEmailDraft,
  buildB2BInterestLeadDraft,
} from "@/lib/b2b-interest";

describe("DS-20 launch assets", () => {
  it("declares the required launch and trust routes", () => {
    expect(LAUNCH_ASSET_ROUTES).toEqual([
      "/",
      "/example-report",
      "/demo",
      "/trust",
      "/faq",
      "/b2b-interest",
    ]);
    expect(LAUNCH_PRIMARY_MESSAGE).toBe("Free self-tape sanity checks before you submit.");
    expect(LAUNCH_PRIMARY_CTA).toBe("Create account and claim free report");
    expect(LAUNCH_B2B_CTA).toBe("Fund TapeCoach reports for your students/clients");
  });

  it("keeps public launch copy free from casting-outcome guarantees", () => {
    expect(findLaunchOutcomeGuaranteeClaims(launchPublicCopyCorpus())).toEqual([]);
    expect(EXAMPLE_REPORT_SUMMARY.limitations).toContain(
      "Casting outcome is outside what TapeCoach can assess",
    );
  });

  it("normalises B2B interest submissions for first-party follow-up", () => {
    const draft = buildB2BInterestLeadDraft(
      {
        partnerType: "School",
        organisation: "  Example MT College  ",
        contactName: "  Sam Lead  ",
        contactRole: "Course director",
        email: "SAM@EXAMPLE.ORG",
        cohortSize: "26-60",
        message: "Interested in a term pilot.",
        contactConsent: true,
        sourcePath: "/b2b-interest",
        analyticsConsentState: "analytics_granted",
        analyticsAttribution: {
          schema_version: "tapecoach_analytics_attribution_v1",
          attribution_available: true,
          consent_state: "analytics_granted",
          utm_source: "school-newsletter",
          utm_campaign: "launch",
        },
      },
      "2026-05-28T12:00:00.000Z",
    );

    expect(draft).toMatchObject({
      partner_type: "school",
      organisation: "Example MT College",
      contact_name: "Sam Lead",
      email: "sam@example.org",
      cohort_size: "26-60",
      source_path: "/b2b-interest",
    });
    expect(buildB2BInterestAnalyticsProperties(draft!).lead_type).toBe("school");
  });

  it("routes B2B interest notifications to support without leaking unsafe markup", () => {
    const draft = buildB2BInterestLeadDraft({
      partnerType: "coach",
      organisation: "<Studio>",
      contactName: "Alex",
      email: "alex@example.org",
      cohortSize: "1-10",
      message: "<script>alert('x')</script>",
      contactConsent: true,
    });

    const email = buildB2BInterestEmailDraft(draft!);
    expect(email.to).toBe(B2B_INTEREST_CONTACT_EMAIL);
    expect(email.html).not.toContain("<script>");
    expect(email.text).toContain("Organisation: Studio");
  });

  it("rejects incomplete B2B interest submissions", () => {
    expect(() =>
      buildB2BInterestLeadDraft({
        partnerType: "school",
        organisation: "",
        contactName: "",
        email: "not-an-email",
        contactConsent: false,
      }),
    ).toThrow(B2BInterestValidationError);
  });
});
