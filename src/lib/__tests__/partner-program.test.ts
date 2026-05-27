import { describe, expect, it } from "vitest";
import {
  buildPartnerCodeDraft,
  buildPartnerDraft,
  buildPartnerMembershipCreditGrantInput,
  creditSourceForPartnerType,
  normaliseAllowedEmailDomains,
  normalisePartnerCode,
  partnerCodeDisplayHint,
  PARTNER_CODE_STATUSES,
  PARTNER_TYPES,
} from "@/lib/partner-program";
import { buildPartnerCodeSecretFields, hashPartnerCode } from "@/server/partner-program.server";

describe("partner programme foundation", () => {
  it("defines DS-05 partner types and maps each to a funded credit source", () => {
    expect(PARTNER_TYPES).toEqual(["school", "coach", "agent", "sponsor", "platform"]);
    expect(creditSourceForPartnerType("school")).toBe("school_funded");
    expect(creditSourceForPartnerType("coach")).toBe("coach_funded");
    expect(creditSourceForPartnerType("agent")).toBe("agent_funded");
    expect(creditSourceForPartnerType("sponsor")).toBe("sponsor_campaign");
    expect(creditSourceForPartnerType("platform")).toBe("platform_funded");
  });

  it("tracks controllable partner code lifecycle states", () => {
    expect(PARTNER_CODE_STATUSES).toEqual(["active", "paused", "revoked", "rotated", "expired"]);
  });

  it("normalises codes for hashing without storing raw code text", () => {
    expect(normalisePartnerCode(" tc-school 2026 ")).toBe("TCSCHOOL2026");
    expect(partnerCodeDisplayHint("tc-school-2026")).toBe("TCSC...2026");

    const compactHash = hashPartnerCode("tc-school-2026");
    expect(compactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashPartnerCode("TC SCHOOL 2026")).toBe(compactHash);
    expect(buildPartnerCodeSecretFields("tc-school-2026")).toEqual({
      code_hash: compactHash,
      code_display_hint: "TCSC...2026",
    });
  });

  it("builds admin-created partner drafts with normalised allowed domains", () => {
    expect(
      buildPartnerDraft({
        type: "school",
        name: "Royal MT College",
        primary_contact_email: "ADMIN@School.Example",
        allowed_email_domains: ["School.Example", "@students.school.example", "school.example"],
        metadata: { pilot: true },
      }),
    ).toEqual({
      type: "school",
      name: "Royal MT College",
      slug: "school-royal-mt-college",
      status: "active",
      primary_contact_email: "admin@school.example",
      allowed_email_domains: ["school.example", "students.school.example"],
      metadata: { pilot: true },
      created_by_user_id: null,
    });
  });

  it("builds partner code drafts with version, expiry, max activation and domain controls", () => {
    expect(
      buildPartnerCodeDraft({
        partner_id: "partner-1",
        code_hash: "a".repeat(64),
        code_display_hint: "TCSC...2026",
        allowance_credits: 12,
        valid_from: "2026-05-27T10:00:00.000Z",
        expires_at: "2026-08-27T10:00:00.000Z",
        max_activations: 25,
        allowed_email_domains: ["school.example"],
        idempotency_key: "partner-code:school:1",
      }),
    ).toEqual({
      partner_id: "partner-1",
      partner_credit_pool_id: null,
      code_hash: "a".repeat(64),
      code_display_hint: "TCSC...2026",
      version: 1,
      status: "active",
      allowance_credits: 12,
      valid_from: "2026-05-27T10:00:00.000Z",
      expires_at: "2026-08-27T10:00:00.000Z",
      max_activations: 25,
      allowed_email_domains: ["school.example"],
      created_by_user_id: null,
      metadata: {},
      idempotency_key: "partner-code:school:1",
    });
  });

  it("builds partner membership credit grants with code version attribution", () => {
    expect(
      buildPartnerMembershipCreditGrantInput({
        user_id: "user-1",
        partner_type: "school",
        partner_name: "Royal MT College",
        partner_membership_id: "membership-1",
        code_version: 2,
        allowance_credits: 12,
        activated_at: "2026-05-27T10:00:00.000Z",
        expires_at: "2026-08-27T10:00:00.000Z",
      }),
    ).toMatchObject({
      user_id: "user-1",
      source: "school_funded",
      credit_amount: 12,
      source_reference_type: "partner_membership",
      source_reference_id: "membership-1",
      source_label: "Royal MT College code v2",
      idempotency_key: "partner-membership-credit:membership-1",
    });
  });

  it("fails closed on malformed domains, codes and code hashes", () => {
    expect(() => normaliseAllowedEmailDomains(["not a domain"])).toThrow(/valid domain/i);
    expect(() => normalisePartnerCode("abc")).toThrow(/6-64/);
    expect(() =>
      buildPartnerCodeDraft({
        partner_id: "partner-1",
        code_hash: "not-a-hash",
        code_display_hint: "bad",
        allowance_credits: 1,
      }),
    ).toThrow(/sha256/);
  });
});
