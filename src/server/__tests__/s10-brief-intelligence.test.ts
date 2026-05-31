import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BRIEF_INTELLIGENCE_SYSTEM_PROMPT,
  buildBriefExtractionRequestBody,
  deriveS10BriefRuntimeFacts,
  extractBriefFromText,
  normaliseS10BriefIntelligence,
} from "@/server/extract-brief.server";
import {
  LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
  S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
  S10_PROMPT_INVENTORY,
} from "@/server/s10-report-prompt-map.server";

const CANARY_A_BRIEF = `
Project: New MT Workshop
Role: Nina, a bright young performer preparing for a high-stakes recall.
Please prepare Side 1, pages 85-87, from "I waited all night" to "that's the choice".
Please also include a contemporary legit musical theatre song.
Record both pieces in one continuous video, landscape, close-up/head-and-shoulders.
Submit one file only named SURNAME_FIRSTNAME_NINA.mp4 by Friday 5pm via the upload link.
`;

const canaryAExtraction = {
  audition_type: "musical_theatre",
  role_name: "Nina",
  show_or_project: "New MT Workshop",
  material_requested: "Side 1 acting scene and contemporary legit musical theatre song",
  orientation_required: "landscape",
  framing_required: "close-up/head-and-shoulders",
  explicit_instructions: [
    "Side 1, pages 85-87",
    "contemporary legit musical theatre song",
    "one continuous video",
    "landscape",
    "close-up/head-and-shoulders",
    "one file only",
    "SURNAME_FIRSTNAME_NINA.mp4",
    "Friday 5pm upload link",
  ],
  brief_context: {
    project_name: "New MT Workshop",
    role_name: "Nina",
    discipline: "musical theatre",
    audition_type: "acting scene plus song package",
    material_package_summary:
      "Side 1 acting scene plus a contemporary legit musical theatre song in one continuous video.",
    role_description_summary:
      "Nina is described as a bright young performer preparing for a high-stakes recall.",
    deadline_summary: "Friday 5pm.",
    upload_summary: "Submit via the upload link.",
    file_naming_summary: "SURNAME_FIRSTNAME_NINA.mp4.",
  },
  brief_requirements: [
    {
      id: "side_1",
      brief_text: 'Side 1, pages 85-87, from "I waited all night" to "that\'s the choice".',
      summary: "Perform the required Side 1 acting scene.",
      category: "material",
      importance: "mandatory",
      expected_evidence_in_tape: "An acting scene matching Side 1 is visible/audible in the tape.",
      achievement_test:
        "Tape observation must identify Side 1 acting-scene evidence before marking it achieved.",
      submission_impact_if_missing:
        "Missing Side 1 makes the required material package incomplete.",
      report_destination: "brief_achievement",
      confidence: "high",
    },
    {
      id: "song",
      brief_text: "contemporary legit musical theatre song",
      summary: "Include a contemporary legit musical theatre song.",
      category: "material",
      importance: "mandatory",
      expected_evidence_in_tape: "A song section is audible and can be checked for completion.",
      achievement_test:
        "Tape observation must identify the song and whether it completes or cuts off.",
      submission_impact_if_missing:
        "Missing or incomplete song makes the required MT package incomplete.",
      report_destination: "component_breakdown",
      confidence: "high",
    },
    {
      id: "continuous_video",
      brief_text: "Record both pieces in one continuous video",
      summary: "Record the acting scene and song in one continuous video.",
      category: "admin_process",
      importance: "mandatory",
      expected_evidence_in_tape:
        "The observed tape sequence contains both required pieces without an unexplained break.",
      achievement_test:
        "Tape observation must classify whether the package appears continuous or cut off.",
      submission_impact_if_missing:
        "The submission package cannot be treated as complete if continuity is not achieved.",
      report_destination: "submission_risk",
      confidence: "high",
    },
    {
      id: "landscape",
      brief_text: "landscape",
      summary: "Use landscape orientation.",
      category: "technical",
      importance: "mandatory",
      expected_evidence_in_tape: "Video orientation is landscape.",
      achievement_test: "Technical/tape observation confirms landscape orientation.",
      submission_impact_if_missing: "Incorrect orientation may breach the submission brief.",
      report_destination: "presentation_notes",
      confidence: "high",
    },
    {
      id: "head_shoulders",
      brief_text: "close-up/head-and-shoulders",
      summary: "Use close-up/head-and-shoulders framing.",
      category: "technical",
      importance: "mandatory",
      expected_evidence_in_tape: "The performer is framed close-up/head-and-shoulders.",
      achievement_test: "Tape observation confirms close-up/head-and-shoulders framing.",
      submission_impact_if_missing: "Incorrect framing may reduce brief compliance.",
      report_destination: "presentation_notes",
      confidence: "high",
    },
    {
      id: "one_file",
      brief_text: "Submit one file only",
      summary: "Submit exactly one final file.",
      category: "admin_process",
      importance: "mandatory",
      expected_evidence_in_tape:
        "Package check shows a single final upload file for the full submission.",
      achievement_test:
        "Submission/package context must confirm one file; tape observation alone may not fully prove it.",
      submission_impact_if_missing: "Multiple files would breach the admin instruction.",
      report_destination: "submission_risk",
      confidence: "high",
    },
    {
      id: "file_name",
      brief_text: "named SURNAME_FIRSTNAME_NINA.mp4",
      summary: "Use the required file naming format.",
      category: "admin_process",
      importance: "mandatory",
      expected_evidence_in_tape: "Upload metadata shows the required file name format.",
      achievement_test: "Upload/file metadata is checked against SURNAME_FIRSTNAME_NINA.mp4.",
      submission_impact_if_missing: "Incorrect naming may create an admin submission risk.",
      report_destination: "submission_risk",
      confidence: "high",
    },
    {
      id: "role_context",
      brief_text: "Nina, a bright young performer preparing for a high-stakes recall",
      summary: "Nina's role context should inform calibration but is not a performed task.",
      category: "role_context",
      importance: "ambiguous",
      expected_evidence_in_tape:
        "Performance choices can be compared against this role context where material is present.",
      achievement_test:
        "Do not treat the role description itself as required material unless a task is stated.",
      submission_impact_if_missing: "No direct material blocker.",
      report_destination: "role_context",
      confidence: "high",
    },
  ],
  brief_intelligence_prompt_version: S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
  extraction_confidence: "high",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("S10.2 brief intelligence", () => {
  it("builds the active S10 brief intelligence request with requirement extraction instructions", () => {
    const body = buildBriefExtractionRequestBody(CANARY_A_BRIEF);
    const serialised = JSON.stringify(body);
    expect(serialised).toContain(S10_BRIEF_INTELLIGENCE_PROMPT_VERSION);
    expect(serialised).toContain("BriefRequirement");
    expect(serialised).toContain("Side 1");
    expect(serialised).toContain("contemporary legit MT song");
    expect(serialised).toContain("one continuous video");
    expect(serialised).toContain("one file only");
    expect(serialised).toContain("file naming");
    expect(serialised).toContain("before scoring or recommending");
    expect(BRIEF_INTELLIGENCE_SYSTEM_PROMPT).not.toContain(
      LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
    );
  });

  it("extracts Canary A brief requirements as separate mandatory testable items", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.stringify(init?.body)).toContain(S10_BRIEF_INTELLIGENCE_PROMPT_VERSION);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [{ function: { arguments: JSON.stringify(canaryAExtraction) } }],
              },
            },
          ],
        }),
      } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractBriefFromText(CANARY_A_BRIEF);
    expect(result?.source).toBe("ai");
    expect(result?.brief.brief_intelligence_prompt_version).toBe(
      S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
    );
    expect(result?.brief.brief_context?.role_description_summary).toContain("bright young");

    const requirements = result?.brief.brief_requirements ?? [];
    expect(requirements.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "side_1",
        "song",
        "continuous_video",
        "landscape",
        "head_shoulders",
        "one_file",
        "file_name",
        "role_context",
      ]),
    );

    const side = requirements.find((item) => item.id === "side_1");
    const song = requirements.find((item) => item.id === "song");
    const continuous = requirements.find((item) => item.id === "continuous_video");
    const oneFile = requirements.find((item) => item.id === "one_file");
    const roleContext = requirements.find((item) => item.id === "role_context");

    expect(side).toMatchObject({ category: "material", importance: "mandatory" });
    expect(side?.brief_text).toContain("pages 85-87");
    expect(side?.achievement_test).toContain("Side 1");
    expect(song).toMatchObject({ category: "material", importance: "mandatory" });
    expect(song?.achievement_test).toContain("completes or cuts off");
    expect(continuous).toMatchObject({ category: "admin_process", importance: "mandatory" });
    expect(oneFile).toMatchObject({ category: "admin_process", importance: "mandatory" });
    expect(roleContext).toMatchObject({ category: "role_context" });
    expect(roleContext?.submission_impact_if_missing).toBe("No direct material blocker.");

    for (const requirement of requirements) {
      expect(requirement.brief_text.length).toBeGreaterThan(3);
      expect(requirement.achievement_test.length).toBeGreaterThan(12);
      expect(requirement.report_destination.length).toBeGreaterThan(3);
    }
  });

  it("derives loaded material and component declaration facts from S10 AI requirements", () => {
    const intelligence = normaliseS10BriefIntelligence(canaryAExtraction);
    const facts = deriveS10BriefRuntimeFacts({
      brief_requirements: intelligence.brief_requirements,
    });

    expect(facts.material_presence).toBe("supplied");
    expect(facts.material_presence_source).toBe("loaded_runtime_field");
    expect(facts.component_or_task_declaration_status).toBe("supplied");
    expect(facts.component_or_task_declaration_source).toBe("loaded_runtime_field");
    expect(facts.component_or_task_declaration).toEqual(
      expect.arrayContaining([
        expect.stringContaining("side_1:"),
        expect.stringContaining("song:"),
      ]),
    );
    expect(facts.component_or_task_declaration).not.toEqual(
      expect.arrayContaining([expect.stringContaining("role_context:")]),
    );
  });

  it("does not invent requirements when no brief intelligence requirements are present", () => {
    const intelligence = normaliseS10BriefIntelligence({
      audition_type: "unknown",
      extraction_confidence: "low",
      brief_context: {},
      brief_requirements: [],
    });
    const facts = deriveS10BriefRuntimeFacts({
      brief_requirements: intelligence.brief_requirements,
    });

    expect(intelligence.brief_requirements).toEqual([]);
    expect(facts).toEqual({
      material_presence: "unknown",
      material_presence_source: "not_loaded",
      component_or_task_declaration: null,
      component_or_task_declaration_status: "unknown",
      component_or_task_declaration_source: "not_loaded",
    });
  });

  it("preserves partial supplied brief context without inventing requirement rows", () => {
    const intelligence = normaliseS10BriefIntelligence({
      audition_type: "unknown",
      extraction_confidence: "low",
      show_or_project: "Workshop recall",
      role_name: "Mina",
      brief_context: {
        deadline_summary: "Submit by Thursday 10am.",
        upload_summary: "Upload via the casting portal.",
      },
      brief_requirements: [],
    });

    expect(intelligence.brief_context).toMatchObject({
      project_name: "Workshop recall",
      role_name: "Mina",
      audition_type: "unknown",
      deadline_summary: "Submit by Thursday 10am.",
      upload_summary: "Upload via the casting portal.",
    });
    expect(intelligence.brief_requirements).toEqual([]);
    expect(
      deriveS10BriefRuntimeFacts({ brief_requirements: intelligence.brief_requirements }),
    ).toMatchObject({
      material_presence: "unknown",
      component_or_task_declaration_status: "unknown",
    });
  });

  it("preserves explicit requirement importance and defaults conflicting metadata to ambiguous", () => {
    const requirementBase = {
      brief_text: "Supplied brief wording.",
      summary: "Supplied brief item.",
      expected_evidence_in_tape: "Observable evidence from the tape or upload package.",
      achievement_test: "Check the item against observed or uploaded evidence.",
      submission_impact_if_missing: "Missing item affects submission readiness.",
      report_destination: "brief_achievement",
    };

    const intelligence = normaliseS10BriefIntelligence({
      audition_type: "musical_theatre",
      extraction_confidence: "medium",
      brief_context: {},
      brief_requirements: [
        { ...requirementBase, id: "mandatory", category: "material", importance: "mandatory" },
        { ...requirementBase, id: "preferred", category: "technical", importance: "preferred" },
        { ...requirementBase, id: "optional", category: "logistics", importance: "optional" },
        { ...requirementBase, id: "ambiguous", category: "role_context", importance: "ambiguous" },
        { ...requirementBase, id: "conflicting", category: "hidden_fit", importance: "must" },
      ],
    });

    const requirements = intelligence.brief_requirements ?? [];

    expect(requirements.map((item) => item.importance)).toEqual([
      "mandatory",
      "preferred",
      "optional",
      "ambiguous",
      "ambiguous",
    ]);
    expect(requirements.at(-1)).toMatchObject({
      id: "conflicting",
      category: "role_context",
      importance: "ambiguous",
      confidence: "medium",
    });
  });

  it("drops incomplete requirement rows instead of inventing missing achievement criteria", () => {
    const intelligence = normaliseS10BriefIntelligence({
      audition_type: "unknown",
      extraction_confidence: "low",
      brief_context: {},
      brief_requirements: [
        {
          id: "deadline",
          brief_text: "Submit by Friday.",
          summary: "Deadline instruction.",
          category: "deadline",
          importance: "mandatory",
          expected_evidence_in_tape: "Upload timestamp or operator package evidence.",
        },
      ],
    });

    expect(intelligence.brief_requirements).toEqual([]);
  });

  it("keeps S10 brief intelligence active and legacy prompt paths unable to override it", () => {
    const active = S10_PROMPT_INVENTORY.find(
      (entry) => entry.promptVersion === S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
    );
    const legacy = S10_PROMPT_INVENTORY.find(
      (entry) => entry.promptVersion === LEGACY_S9_BRIEF_EXTRACTION_PROMPT_VERSION,
    );

    expect(active).toMatchObject({
      sourceFile: "src/server/extract-brief.server.ts",
      status: "active",
    });
    expect(legacy).toMatchObject({
      sourceFile: "src/server/extract-brief.server.ts",
      status: "legacy_only",
    });
    expect(normaliseS10BriefIntelligence(canaryAExtraction).brief_intelligence_prompt_version).toBe(
      S10_BRIEF_INTELLIGENCE_PROMPT_VERSION,
    );
  });

  it("guards process-take from scoring supplied-brief runs before S10 requirements exist", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/server/process-take.server.ts"),
      "utf8",
    );

    expect(source).toContain("cachedHasS10BriefRequirements");
    expect(source).toContain("s10BriefRequirementsReady");
    expect(source).toContain("brief_intelligence_unavailable");
    expect(source).toContain("deriveS10BriefRuntimeFacts(extractedBrief)");
  });
});
