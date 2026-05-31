import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildEvidencePassRequestBodyForProvider } from "@/server/evidence-pass.server";
import { POLISH_SYSTEM_PROMPT } from "@/server/report-polish.server";
import {
  LEGACY_S9_EVIDENCE_PASS_PROMPT_VERSION,
  LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
  LEGACY_S9_SINGLE_PASS_PROMPT_VERSION,
  LEGACY_S9_TWO_STEP_POLISH_PROMPT_VERSION,
  S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION,
  S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
  S10_CANARY_A_PROMPT_REQUIREMENT,
  S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION,
  S10_MODULE_COMPLETENESS_STATUSES,
  S10_MODULE_REPAIR_TRIGGER_STATUSES,
  S10_MODULE_REPAIR_PROMPT_VERSION,
  S10_MODULE_REPAIR_PROMPTS,
  S10_OBSERVATION_PROMPT_VERSION,
  S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
  S10_PROMPT_INVENTORY,
  S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION,
  S10_REPORT_MODULE_COVERAGE,
  S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
  S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION,
  S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION,
  listS10RouteSectionsMissingPromptCoverage,
} from "@/server/s10-report-prompt-map.server";
import { S10_ROUTE_REQUIRED_SECTION_KEYS } from "@/lib/audition-rules";

function read(p: string): string {
  return fs.readFileSync(path.join(process.cwd(), p), "utf8");
}

describe("S10.1 AI prompt map", () => {
  it("inventories active report-affecting prompt paths and marks S9 labels legacy-only", () => {
    expect(S10_PROMPT_INVENTORY).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promptVersion: S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
          sourceFile: "src/server/extract-brief.server.ts",
          runtimeStage: "preflight_brief_extraction",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_OBSERVATION_PROMPT_VERSION,
          sourceFile: "src/server/evidence-pass.server.ts",
          runtimeStage: "analysis_step_1_evidence_mapping",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_pre_score_brief_achievement",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_post_matrix_readiness_score",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_post_readiness_fix_action",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_post_fix_professional_critique",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_post_professional_critique_technique",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION,
          runtimeStage: "analysis_step_2_post_technique_timestamped_commentary",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
          sourceFile: "src/server/report-polish.server.ts",
          runtimeStage: "analysis_step_2_judgement_or_report_generation",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION,
          sourceFile: "src/server/process-take.server.ts",
          runtimeStage: "fallback_single_pass_report_generation",
          status: "active",
        }),
        expect.objectContaining({
          promptVersion: "legacy_brief_adherence_material_compliance_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          promptVersion: "legacy_score_readiness_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          promptVersion: "legacy_fix_action_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          promptVersion: "legacy_strengths_professional_critique_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          promptVersion: "legacy_technique_commentary_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          promptVersion: "legacy_timestamped_notes_diagnostic_only",
          status: "diagnostic_only",
        }),
        expect.objectContaining({
          sourceFile: "src/server/dimensions/*",
          status: "legacy_only",
        }),
        expect.objectContaining({
          promptVersion: "no_active_s10_comparison_model_prompt",
          status: "not_present",
        }),
      ]),
    );

    for (const legacyVersion of [
      LEGACY_S9_EVIDENCE_PASS_PROMPT_VERSION,
      LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
      LEGACY_S9_SINGLE_PASS_PROMPT_VERSION,
      LEGACY_S9_TWO_STEP_POLISH_PROMPT_VERSION,
    ]) {
      const entry = S10_PROMPT_INVENTORY.find((item) => item.promptVersion === legacyVersion);
      expect(entry?.status).toBe("legacy_only");
    }
  });

  it("defines exact module completeness statuses and repair prompts", () => {
    expect(S10_MODULE_COMPLETENESS_STATUSES).toEqual([
      "complete",
      "missing",
      "thin",
      "generic",
      "contradictory",
      "unsupported",
      "not_assessable",
    ]);
    expect(S10_MODULE_REPAIR_PROMPT_VERSION).toBe("s10_module_repair_v1");
    for (const status of S10_MODULE_COMPLETENESS_STATUSES) {
      expect(S10_MODULE_REPAIR_PROMPTS[status]).toEqual(expect.any(String));
      expect(S10_MODULE_REPAIR_PROMPTS[status].length).toBeGreaterThan(40);
    }
    expect(S10_MODULE_REPAIR_TRIGGER_STATUSES).toEqual([
      "missing",
      "thin",
      "generic",
      "contradictory",
      "unsupported",
    ]);
  });

  it("covers every visible report module with an AI question and repair prompt", () => {
    const requiredModules = [
      "take slot/version context",
      "scoring basis",
      "overall readiness",
      "score/chip",
      "verdict",
      "performer level calibration",
      "brief intelligence",
      "brief context",
      "brief requirements",
      "observed tape",
      "prioritised fixes",
      "fix-first",
      "why this score",
      "category scores",
      "component breakdown",
      "brief achievement",
      "brief adherence/material compliance",
      "strengths",
      "professional critique",
      "preserve/do-not-overfix",
      "improvements",
      "technique commentary",
      "timestamped notes",
      "next action",
      "submission risk",
      "role/material context",
      "role fit",
      "professional competitive calibration",
      "comparison",
      "same-video status",
      "presentation notes",
      "not-assessable limitations",
      "diagnostic chips",
    ];

    expect(S10_REPORT_MODULE_COVERAGE.map((entry) => entry.reportModule)).toEqual(
      expect.arrayContaining(requiredModules),
    );

    for (const moduleName of requiredModules) {
      const entry = S10_REPORT_MODULE_COVERAGE.find((item) => item.reportModule === moduleName);
      expect(entry?.aiQuestion).toEqual(expect.any(String));
      expect(entry?.structuredOutputField).toEqual(expect.any(String));
      expect(entry?.uiDestination).toEqual(expect.any(String));
      expect(entry?.repairPrompt).toEqual(expect.any(String));
      expect(entry?.repairTriggerStatuses).toEqual(
        expect.arrayContaining([...S10_MODULE_REPAIR_TRIGGER_STATUSES]),
      );
      expect(entry?.deterministicInputsAllowed.length).toBeGreaterThan(0);
      expect(entry?.codeGeneratedContentForbidden.length).toBeGreaterThan(0);
    }
  });

  it("maps every required S10 route/PDF section back to at least one AI module question", () => {
    expect(listS10RouteSectionsMissingPromptCoverage()).toEqual([]);

    for (const section of S10_ROUTE_REQUIRED_SECTION_KEYS) {
      const entries = S10_REPORT_MODULE_COVERAGE.filter((entry) =>
        entry.routeSectionKeys.includes(section),
      );
      expect(entries.length, section).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(entry.aiQuestion.length, entry.reportModule).toBeGreaterThan(40);
        expect(entry.structuredOutputField.length, entry.reportModule).toBeGreaterThan(3);
        expect(entry.uiDestination.length, entry.reportModule).toBeGreaterThan(3);
      }
    }
  });

  it("uses S10 prompt versions in Step 1 and Step 2 active request prompts", () => {
    const plainJsonRequest = buildEvidencePassRequestBodyForProvider({
      model: "google/gemini-3-flash-preview",
      contextText: "S10 prompt contract check.",
      videoUrl: "https://example.invalid/video.mp4",
      providerContract: "plain_json_observations",
    });
    const toolCallRequest = buildEvidencePassRequestBodyForProvider({
      model: "openai/gpt-4.1-mini",
      contextText: "S10 prompt contract check.",
      videoUrl: "https://example.invalid/video.mp4",
      providerContract: "tool_call",
    });

    for (const request of [plainJsonRequest, toolCallRequest]) {
      const step1 = JSON.stringify(request);
      expect(step1).toContain(S10_OBSERVATION_PROMPT_VERSION);
      expect(step1).toContain("Side 1");
      expect(step1).toContain("abrupt");
      expect(step1).toContain("module-readiness support");
    }
    expect(JSON.stringify(plainJsonRequest)).toContain("material_specific_performance");
    expect(JSON.stringify(toolCallRequest)).toContain("collect_audition_evidence");

    expect(POLISH_SYSTEM_PROMPT).toContain(S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain(S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain(S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain(S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain(
      S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION,
    );
    expect(POLISH_SYSTEM_PROMPT).toContain(S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain(S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION);
    expect(POLISH_SYSTEM_PROMPT).toContain("verify required brief components");
    expect(POLISH_SYSTEM_PROMPT).toContain("brief_achievement_matrix");
    expect(POLISH_SYSTEM_PROMPT).toContain("readiness_score_judgement");
    expect(POLISH_SYSTEM_PROMPT).toContain("s10_fix_hierarchy");
    expect(POLISH_SYSTEM_PROMPT).toContain("readiness-before-action-plan");
    expect(POLISH_SYSTEM_PROMPT).toContain("verification before strengths");
    expect(POLISH_SYSTEM_PROMPT).toContain("s10_professional_critique");
    expect(POLISH_SYSTEM_PROMPT).toContain(
      "verified component evidence before technique commentary",
    );
    expect(POLISH_SYSTEM_PROMPT).toContain("s10_technique_commentary");
    expect(POLISH_SYSTEM_PROMPT).toContain(
      "verified component evidence before timestamped commentary",
    );
    expect(POLISH_SYSTEM_PROMPT).toContain("s10_timestamped_commentary");
    expect(POLISH_SYSTEM_PROMPT).toContain("public_technique_authority_status");
    expect(POLISH_SYSTEM_PROMPT).toContain("performance_quality_score");
    expect(POLISH_SYSTEM_PROMPT).toContain("observed_tape_sequence");
    expect(POLISH_SYSTEM_PROMPT).toContain("component_verifications");
    expect(POLISH_SYSTEM_PROMPT).toContain("category_rationale");
    expect(POLISH_SYSTEM_PROMPT).toContain("self-check each module");
    expect(POLISH_SYSTEM_PROMPT).toContain(
      "missing, thin, generic, contradictory, unsupported and not_assessable",
    );
  });

  it("uses S10 prompt version constants in process-take metadata instead of active S9 labels", () => {
    const processSrc = read("src/server/process-take.server.ts");
    expect(processSrc).toContain("S10_OBSERVATION_PROMPT_VERSION");
    expect(processSrc).toContain("S10_PROFESSIONAL_JUDGEMENT_PROMPT_VERSION");
    expect(processSrc).toContain("S10_BRIEF_ACHIEVEMENT_MATRIX_PROMPT_VERSION");
    expect(processSrc).toContain("S10_READINESS_SCORE_SEMANTICS_PROMPT_VERSION");
    expect(processSrc).toContain("S10_FIX_HIERARCHY_NEXT_ACTION_PROMPT_VERSION");
    expect(processSrc).toContain("S10_STRENGTHS_PRESERVE_PROFESSIONAL_CRITIQUE_PROMPT_VERSION");
    expect(processSrc).toContain("S10_TECHNIQUE_LIBRARY_COMMENTARY_PROMPT_VERSION");
    expect(processSrc).toContain("S10_TIMESTAMPED_COMMENTARY_PROMPT_VERSION");
    expect(processSrc).toContain("Produce brief_achievement_matrix before any score");
    expect(processSrc).toContain("readiness_score_judgement");
    expect(processSrc).toContain("matrix-before-fixes");
    expect(processSrc).toContain("verification before strengths");
    expect(processSrc).toContain("verified component evidence before technique commentary");
    expect(processSrc).toContain("s10_technique_commentary");
    expect(processSrc).toContain("verified component evidence before timestamped commentary");
    expect(processSrc).toContain("s10_timestamped_commentary");
    expect(processSrc).toContain("evaluateS10ModuleReadiness");
    expect(processSrc).toContain("s10_module_repair_actions");
    expect(processSrc).not.toMatch(/prompt_version:\s*['"]evidence_pass_current['"]/);
    expect(processSrc).not.toMatch(/prompt_version:\s*['"]single_pass_analysis_current['"]/);
    expect(processSrc).not.toMatch(/prompt_version:\s*['"]two_step_report_polish_current['"]/);
  });

  it("passes S10.3 observation fields through the locked Step 2 evidence block", () => {
    const polishSrc = read("src/server/report-polish.server.ts");
    expect(polishSrc).toContain("brief_requirements");
    expect(polishSrc).toContain("brief_context");
    expect(polishSrc).toContain("observed_tape_sequence");
    expect(polishSrc).toContain("component_verifications");
    expect(polishSrc).toContain("media_observation_summary");
    expect(polishSrc).toContain("Matrix-before-scoring");
    expect(polishSrc).toContain("readiness_score_judgement");
    expect(polishSrc).toContain("s10_fix_hierarchy");
  });

  it("represents Canary A component checks before score or recommendation", () => {
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("Side 1");
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("song completion");
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("one continuous video");
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("abrupt cut-off");
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("Before scoring or recommending");
    expect(S10_CANARY_A_PROMPT_REQUIREMENT).toContain("must not infer");
  });
});
