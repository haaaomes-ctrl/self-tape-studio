import { describe, expect, it } from "vitest";
import {
  buildS10RoleMaterialContext,
  validateS10RoleMaterialContext,
} from "@/server/s10-role-material-context.server";
import {
  s10StrongCompleteProfessionalBriefContext,
  s10StrongCompleteProfessionalBriefRequirements,
} from "@/test-fixtures/s10-strong-complete-professional";

describe("S10-08 role/material research bridge", () => {
  it("carries brief-primary known-material context with source basis and bounded demands", () => {
    const context = buildS10RoleMaterialContext({
      report: {
        role_material_context: {
          applies: true,
          project_name: "Wicked",
          role_name: "Elphaba",
          source_basis: ["brief_supplied", "official_source_researched"],
          primary_standard: "supplied_brief",
          source_summary: [
            {
              source_type: "brief",
              source_label: "Supplied audition brief",
              truth_state: "brief_supplied",
              confidence: "high",
              public_usable: true,
            },
            {
              source_type: "official_source",
              source_label: "Official production synopsis",
              truth_state: "official_source_researched",
              confidence: "medium",
              public_usable: true,
            },
          ],
          secondary_context:
            "Known-material context supports moral conviction and outsider pressure as secondary nuance.",
          demands: [
            {
              id: "known-elphaba-conviction",
              label: "Moral conviction under pressure",
              description:
                "Use this only as role/material nuance where the observed tape supports it.",
              source_truth_state: "official_source_researched",
              importance: "known_material_context_only",
              observable_evidence_needed: [
                "Story-led vocal or acting choices are visible/audible.",
              ],
              scoring_use: "can_nuance_score",
              unsafe_if_used_for: ["mandatory blocker", "appearance/type judgement"],
            },
          ],
          confidence: "medium",
          uncertainty_notes: ["Known-material context is secondary to the supplied brief."],
        },
      },
      briefContext: s10StrongCompleteProfessionalBriefContext,
      briefRequirements: [...s10StrongCompleteProfessionalBriefRequirements],
    });

    expect(context).toMatchObject({
      applies: true,
      project_name: "Wicked",
      role_name: "Elphaba",
      source_basis: ["brief_supplied", "official_source_researched"],
      primary_standard: "supplied_brief",
      confidence: "medium",
    });
    expect(context.demands[0]).toMatchObject({
      importance: "known_material_context_only",
      scoring_use: "can_nuance_score",
    });
    expect(context.blocked_inferences.join(" ")).toMatch(/casting outcomes/i);
    expect(validateS10RoleMaterialContext(context)).toEqual({ ok: true });
  });

  it("derives supplied role context from the brief without treating it as a hidden requirement", () => {
    const context = buildS10RoleMaterialContext({
      report: {},
      briefContext: s10StrongCompleteProfessionalBriefContext,
      briefRequirements: [...s10StrongCompleteProfessionalBriefRequirements],
    });

    expect(context.applies).toBe(true);
    expect(context.source_basis).toContain("brief_supplied");
    expect(context.demands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_truth_state: "brief_supplied",
          importance: "ambiguous",
          scoring_use: "report_context_only",
        }),
      ]),
    );
    expect(validateS10RoleMaterialContext(context)).toEqual({ ok: true });
  });

  it("marks absent role/material context as not available rather than inventing research", () => {
    const context = buildS10RoleMaterialContext({
      report: {},
      briefContext: null,
      briefRequirements: [],
    });

    expect(context).toMatchObject({
      applies: false,
      source_basis: ["not_available"],
      primary_standard: "selected_level_observed_tape",
      confidence: "low",
    });
    expect(context.uncertainty_notes[0]).toMatch(/No supplied or confidently resolved/i);
    expect(validateS10RoleMaterialContext(context)).toEqual({ ok: true });
  });

  it("rejects known-material context that tries to create a mandatory brief blocker", () => {
    const context = buildS10RoleMaterialContext({
      report: {
        role_material_context: {
          applies: true,
          source_basis: ["official_source_researched"],
          demands: [
            {
              id: "hidden-blocker",
              label: "Fan-expected interpretation",
              description: "A known-material preference that was not in the brief.",
              source_truth_state: "official_source_researched",
              importance: "mandatory_from_brief",
              observable_evidence_needed: [],
              scoring_use: "can_drive_brief_achievement",
              unsafe_if_used_for: ["hidden mandatory requirement"],
            },
          ],
        },
      },
      briefContext: null,
      briefRequirements: [],
    });

    expect(validateS10RoleMaterialContext(context)).toEqual({
      ok: false,
      reason: "known_material_mandatory_blocker",
    });
  });
});
