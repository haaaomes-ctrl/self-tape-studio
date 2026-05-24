import { describe, expect, it } from "vitest";
import type { BriefRequirement } from "@/lib/audition-rules";
import type { ComponentVerification, ObservedTapeSequence } from "@/server/evidence-pass.server";
import {
  applyBriefAchievementCompatibilityCaps,
  normaliseBriefAchievementMatrix,
} from "@/server/s10-brief-achievement-matrix.server";

function requirement(
  id: string,
  summary: string,
  category: BriefRequirement["category"],
  importance: BriefRequirement["importance"] = "mandatory",
): BriefRequirement {
  return {
    id,
    brief_text: summary,
    summary,
    category,
    importance,
    expected_evidence_in_tape: `Media evidence for ${summary}`,
    achievement_test: `Check whether ${summary} is observed and complete.`,
    submission_impact_if_missing:
      importance === "mandatory" ? "Blocks readiness." : "Optional polish.",
    report_destination: "brief_achievement_matrix",
    confidence: "high",
  };
}

const CANARY_REQUIREMENTS: BriefRequirement[] = [
  requirement("req_side_1", "Side 1 acting scene", "material"),
  requirement("req_song", "Contemporary legit MT song", "material"),
  requirement(
    "req_continuous_video",
    "One continuous video containing the full package",
    "technical",
  ),
  requirement("req_one_file", "One final upload file", "admin_process"),
  requirement("req_landscape", "Landscape head-and-shoulders framing", "technical"),
];

function verification(
  requirementId: string,
  requirementSummary: string,
  observed_status: ComponentVerification["observed_status"],
  completion_status: ComponentVerification["completion_status"],
  evidence_summary: string,
): ComponentVerification {
  return {
    requirement_id: requirementId,
    requirement_summary: requirementSummary,
    observed_status,
    completion_status,
    evidence_summary,
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    timestamp_refs: [],
    confidence: "high",
    cannot_infer_from_brief_only: true,
    assessability_notes: "",
  };
}

const CANARY_VERIFICATIONS: ComponentVerification[] = [
  verification(
    "req_side_1",
    "Side 1 acting scene",
    "absent",
    "not_applicable",
    "No acting scene section is observed before the song section or before the video ends.",
  ),
  verification(
    "req_song",
    "Contemporary legit MT song",
    "partially_present",
    "cut_off",
    "The performer is heard singing, but the media cuts off before a complete song ending is observed.",
  ),
  verification(
    "req_continuous_video",
    "One continuous video containing the full package",
    "partially_present",
    "incomplete",
    "The clip appears continuous, but the required package is incomplete because Side 1 is missing and the song cuts off.",
  ),
  verification(
    "req_landscape",
    "Landscape head-and-shoulders framing",
    "present",
    "complete",
    "The performer remains visible in a stable landscape head-and-shoulders frame.",
  ),
];

const CANARY_SEQUENCE: ObservedTapeSequence[] = [
  {
    id: "section_song",
    label: "Partial song section",
    component_type: "song",
    linked_requirement_ids: ["req_song"],
    start_time: "00:09",
    end_time: "01:42",
    present_status: "partially_present",
    completion_status: "cut_off",
    evidence_summary: "The song begins after the intro and the media cuts off.",
    observed_from_media: true,
    evidence_basis: "observed_audio_video",
    confidence: "high",
    assessability_notes: "",
  },
];

describe("S10.4 brief achievement matrix", () => {
  it("marks Canary A mandatory material as incomplete and blocks achieved aggregate status", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
        requirement_results: [
          {
            requirement_id: "req_side_1",
            achievement_status: "achieved",
            evidence_summary: "Legacy detected_components says acting_scene present.",
            submission_impact: "supports_submission",
            fix_category: "preserve",
          },
          {
            requirement_id: "req_song",
            achievement_status: "achieved",
            evidence_summary: "Legacy material_compliance=100 says song present.",
            submission_impact: "supports_submission",
            fix_category: "preserve",
          },
        ],
      },
      briefRequirements: CANARY_REQUIREMENTS,
      componentVerifications: CANARY_VERIFICATIONS,
      observedTapeSequence: CANARY_SEQUENCE,
      mediaObservationSummary: {
        audio_assessable: true,
        video_assessable: true,
        framing_assessable: true,
        continuity_assessable: true,
        abrupt_cutoff_detected: true,
        one_continuous_video_observed: true,
        duration_summary: "Around 01:42 and ends during the song.",
        uncertainties: [],
      },
    });

    const byId = new Map(matrix.requirement_results.map((item) => [item.requirement_id, item]));

    expect(byId.get("req_side_1")).toMatchObject({
      achievement_status: "not_achieved",
      submission_impact: "submission_blocker",
      fix_category: "must_fix",
      cannot_infer_from_brief_only: true,
    });
    expect(byId.get("req_song")).toMatchObject({
      achievement_status: "partly_achieved",
      completion_status: "cut_off",
      submission_impact: "material_gap",
    });
    expect(byId.get("req_continuous_video")).toMatchObject({
      achievement_status: "partly_achieved",
      completion_status: "incomplete",
    });
    expect(byId.get("req_one_file")).toMatchObject({
      achievement_status: "partly_achieved",
      submission_impact: "final_check",
      fix_category: "final_check",
    });
    expect(byId.get("req_landscape")).toMatchObject({
      achievement_status: "achieved",
      submission_impact: "supports_submission",
    });
    expect(matrix.overall_status).not.toBe("achieved");
    expect(matrix.mandatory_status).not.toBe("clear");
    expect(["material_gap", "submission_blocker"]).toContain(matrix.readiness_impact);
    expect(matrix.missing_or_incomplete_requirements).toEqual(
      expect.arrayContaining(["req_side_1", "req_song", "req_continuous_video"]),
    );
  });

  it("allows a strong complete fixture when S10.3 verification supports mandatory requirements", () => {
    const requirements = [
      requirement("req_scene", "Full acting scene", "material"),
      requirement("req_song", "Full song", "material"),
      requirement("req_optional_polish", "Optional tighter eyeline", "performance", "optional"),
    ];
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
        requirement_results: [
          {
            requirement_id: "req_optional_polish",
            observed_status: "uncertain",
            completion_status: "uncertain",
            achievement_status: "partly_achieved",
            submission_impact: "optional_polish",
            fix_category: "optional_polish",
            evidence_summary: "Optional eyeline polish could be refined.",
          },
        ],
      },
      briefRequirements: requirements,
      componentVerifications: [
        verification(
          "req_scene",
          "Full acting scene",
          "present",
          "complete",
          "The full acting scene is observed from start to finish in the media.",
        ),
        verification(
          "req_song",
          "Full song",
          "present",
          "complete",
          "The full song is heard and reaches a clear ending in the media.",
        ),
      ],
      observedTapeSequence: [],
    });

    expect(matrix.mandatory_status).toBe("clear");
    expect(matrix.readiness_impact).toBe("supports_submission");
    expect(matrix.missing_or_incomplete_requirements).not.toEqual(
      expect.arrayContaining(["req_scene", "req_song"]),
    );
    const optional = matrix.requirement_results.find(
      (item) => item.requirement_id === "req_optional_polish",
    );
    expect(optional).toMatchObject({
      submission_impact: "optional_polish",
      fix_category: "optional_polish",
    });
  });

  it("does not let brief text, score traces, detected components or previous prose prove achievement", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {
        overall_status: "achieved",
        mandatory_status: "clear",
        readiness_impact: "supports_submission",
        requirement_results: [
          {
            requirement_id: "req_side_1",
            observed_status: "present",
            completion_status: "complete",
            achievement_status: "achieved",
            evidence_summary:
              "The brief requests Side 1; raw_report.detected_components and score_trace.brief_adherence=100 say it is present.",
            submission_impact: "supports_submission",
            fix_category: "preserve",
          },
        ],
      },
      briefRequirements: [CANARY_REQUIREMENTS[0]],
      componentVerifications: [],
      observedTapeSequence: [],
    });

    expect(matrix.requirement_results[0]).toMatchObject({
      achievement_status: "not_assessable",
      submission_impact: "not_assessable",
      cannot_infer_from_brief_only: true,
    });
    expect(matrix.overall_status).not.toBe("achieved");
  });

  it("fills missing AI rows as not-assessable or final-check rows instead of achieved rows", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: { requirement_results: [] },
      briefRequirements: CANARY_REQUIREMENTS,
      componentVerifications: [],
      observedTapeSequence: [],
    });

    expect(matrix.requirement_results).toHaveLength(CANARY_REQUIREMENTS.length);
    for (const result of matrix.requirement_results) {
      expect(result.achievement_status).not.toBe("achieved");
      expect(result.cannot_infer_from_brief_only).toBe(true);
    }
    expect(
      matrix.requirement_results.find((item) => item.requirement_id === "req_one_file"),
    ).toMatchObject({
      submission_impact: "final_check",
      fix_category: "final_check",
    });
  });

  it("caps effective legacy brief-adherence fields without mutating raw_report", () => {
    const matrix = normaliseBriefAchievementMatrix({
      matrix: {},
      briefRequirements: CANARY_REQUIREMENTS,
      componentVerifications: CANARY_VERIFICATIONS,
      observedTapeSequence: CANARY_SEQUENCE,
    });
    const rawReport = {
      brief_adherence_breakdown: { material_compliance: 100 },
      detected_components: [{ type: "acting_scene" }],
    };
    const report: Record<string, unknown> = {
      raw_report: rawReport,
      scores: { brief_adherence: 100, acting: 96 },
      brief_adherence_breakdown: { material_compliance: 100, note: "Legacy complete." },
    };

    const cap = applyBriefAchievementCompatibilityCaps(report, matrix);

    expect(cap.capped).toBe(true);
    expect((report.scores as Record<string, unknown>).brief_adherence).toBeLessThan(100);
    expect(
      (report.brief_adherence_breakdown as Record<string, unknown>).material_compliance,
    ).toBeLessThan(100);
    expect(report.raw_report).toBe(rawReport);
    expect(rawReport.brief_adherence_breakdown.material_compliance).toBe(100);
  });
});
