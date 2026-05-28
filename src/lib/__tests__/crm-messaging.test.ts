import { describe, expect, it } from "vitest";
import {
  CRM_MESSAGE_DEFINITIONS,
  buildCrmMessageDraft,
  crmCategoryRequiresMarketingConsent,
  normaliseCrmEmail,
  resolveCrmRecipientRole,
  resolveCrmUserSegment,
  sanitiseCrmTemplateData,
} from "@/lib/crm-messaging";

describe("CRM messaging helpers", () => {
  it("keeps service messages separate from consent-gated lifecycle messages", () => {
    expect(CRM_MESSAGE_DEFINITIONS.report_ready.category).toBe("service");
    expect(CRM_MESSAGE_DEFINITIONS.failed_report_credit_restored.category).toBe("service");
    expect(CRM_MESSAGE_DEFINITIONS.monthly_free_report.category).toBe("lifecycle");
    expect(CRM_MESSAGE_DEFINITIONS.b2b_follow_up.category).toBe("marketing");
    expect(crmCategoryRequiresMarketingConsent("service")).toBe(false);
    expect(crmCategoryRequiresMarketingConsent("lifecycle")).toBe(true);
    expect(crmCategoryRequiresMarketingConsent("marketing")).toBe(true);
  });

  it("routes parent-managed and under-13 account emails to the parent or guardian", () => {
    expect(
      resolveCrmRecipientRole({
        account_route: "under_13",
        account_type: "parent_guardian_managed",
        parent_managed: true,
      }),
    ).toBe("parent_guardian");
    expect(
      resolveCrmUserSegment({
        account_route: "parent_guardian",
        account_type: "parent_guardian_managed",
        parent_managed: true,
      }),
    ).toBe("parent_guardian");
    expect(resolveCrmRecipientRole({ account_type: "self_service_performer" })).toBe("performer");
  });

  it("normalises emails and strips unsafe template data", () => {
    expect(normaliseCrmEmail(" Performer@Example.COM ")).toBe("performer@example.com");
    expect(normaliseCrmEmail("not-an-email")).toBeNull();

    const safe = sanitiseCrmTemplateData({
      object_id: "take-1",
      video_url: "https://private.example/video",
      prompt: "raw prompt",
      nested: { signed_url: "https://private.example/signed", status: "ready" },
    });

    expect(safe).toEqual({ object_id: "take-1", nested: { status: "ready" } });
  });

  it("builds non-empty email drafts with support contact copy", () => {
    const draft = buildCrmMessageDraft({
      messageKey: "report_ready",
      templateData: {
        account_label: "Audition take",
        context_line: "Your report is ready.",
      },
    });

    expect(draft.subject).toContain("Your TapeCoach report is ready");
    expect(draft.html).toContain("support@tapecoach.co.uk");
    expect(draft.text).toContain("Your report is ready.");
    expect(draft.template_data).toMatchObject({ account_label: "Audition take" });
  });
});
