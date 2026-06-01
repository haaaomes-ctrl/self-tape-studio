import { describe, expect, it } from "vitest";
import {
  buildEvidencePassRequestBodyForProvider,
  filterRunEvidencePassForStep1,
  normaliseCompactStep1EvidenceForEvidencePass,
  normaliseS10ComponentVerifications,
  parseCompactStep1EvidenceContent,
  projectFilteredStep1EvidenceForPolish,
} from "@/server/evidence-pass.server";
import { S10_OBSERVATION_PROMPT_VERSION } from "@/server/s10-report-prompt-map.server";

function canaryAObservationPayload() {
  return {
    evidence_version: "1",
    audition_type: "musical_theatre",
    detected_components: [
      { type: "acting_scene", weight: 0.5, score: 100, note: "Legacy false positive" },
    ],
    observed_tape_sequence: [
      {
        id: "section_intro",
        label: "Intro first",
        component_type: "ident",
        linked_requirement_ids: [],
        start_time: "00:00",
        end_time: "00:08",
        present_status: "present",
        completion_status: "complete",
        evidence_summary: "The performer is visible and audible at the start of the tape.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        confidence: "high",
        assessability_notes: "",
      },
      {
        id: "section_song",
        label: "Partial song section",
        component_type: "song",
        linked_requirement_ids: ["req_song"],
        start_time: "00:09",
        end_time: "01:42",
        present_status: "partially_present",
        completion_status: "cut_off",
        evidence_summary:
          "The performer is heard singing, then the submitted video cuts off before the song completion is observable.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        confidence: "high",
        assessability_notes: "",
      },
    ],
    component_verifications: [
      {
        requirement_id: "req_side_1",
        requirement_summary: "Side 1 acting scene",
        observed_status: "absent",
        completion_status: "not_applicable",
        evidence_summary:
          "No acting scene section is observed before the song section or before the video ends.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        timestamp_refs: [],
        confidence: "high",
        cannot_infer_from_brief_only: true,
        assessability_notes: "",
      },
      {
        requirement_id: "req_song",
        requirement_summary: "Contemporary legit MT song",
        observed_status: "partially_present",
        completion_status: "cut_off",
        evidence_summary:
          "The performer is heard singing, but the media cuts off before a complete song ending is observed.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        timestamp_refs: ["00:09"],
        confidence: "high",
        cannot_infer_from_brief_only: true,
        assessability_notes: "",
      },
      {
        requirement_id: "req_continuous_video",
        requirement_summary: "One continuous video containing the full package",
        observed_status: "partially_present",
        completion_status: "incomplete",
        evidence_summary:
          "The media is observed as one submitted clip, but the required package is incomplete because Side 1 is not observed and the song cuts off.",
        observed_from_media: true,
        evidence_basis: "observed_audio_video",
        timestamp_refs: [],
        confidence: "medium",
        cannot_infer_from_brief_only: true,
        assessability_notes: "One-file upload still needs final package check.",
      },
    ],
    media_observation_summary: {
      audio_assessable: true,
      video_assessable: true,
      framing_assessable: true,
      continuity_assessable: true,
      abrupt_cutoff_detected: true,
      one_continuous_video_observed: true,
      duration_summary: "Submitted media is around 01:42 and ends during the song section.",
      uncertainties: ["One-file upload packaging is not proven by media observation alone."],
    },
  };
}

describe("S10.3 tape observation and component verification", () => {
  it("represents Canary A as missing Side 1 with partial/cut-off song and incomplete package", () => {
    const filtered = filterRunEvidencePassForStep1(canaryAObservationPayload(), {
      model: "unit-s10",
      durationSeconds: 102,
    });

    const side1 = filtered.component_verifications.find(
      (item) => item.requirement_id === "req_side_1",
    );
    const song = filtered.component_verifications.find(
      (item) => item.requirement_id === "req_song",
    );
    const continuous = filtered.component_verifications.find(
      (item) => item.requirement_id === "req_continuous_video",
    );

    expect(side1).toMatchObject({
      observed_status: "absent",
      completion_status: "not_applicable",
      observed_from_media: true,
      evidence_basis: "observed_audio_video",
      cannot_infer_from_brief_only: true,
    });
    expect(song?.observed_status).toMatch(/present|partially_present/);
    expect(song?.completion_status).not.toBe("complete");
    expect(["incomplete", "cut_off", "uncertain"]).toContain(song?.completion_status);
    expect(continuous).toMatchObject({
      observed_status: "partially_present",
      completion_status: "incomplete",
    });
    expect(filtered.media_observation_summary).toMatchObject({
      audio_assessable: true,
      abrupt_cutoff_detected: true,
    });
    expect(
      filtered.material_observable_evidence_items.some(
        (item) => item.component_id === "req_side_1",
      ),
    ).toBe(true);
  });

  it("downgrades acting-scene presence and song completion when evidence is brief-only", () => {
    const [actingScene, song] = normaliseS10ComponentVerifications([
      {
        requirement_id: "req_side_1",
        requirement_summary: "Side 1 acting scene",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "The brief requires Side 1.",
        observed_from_media: false,
        evidence_basis: "brief_text_only",
        timestamp_refs: [],
        confidence: "high",
        cannot_infer_from_brief_only: false,
      },
      {
        requirement_id: "req_song",
        requirement_summary: "Contemporary legit MT song",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "The brief asks for a contemporary legit MT song.",
        observed_from_media: false,
        evidence_basis: "brief_text_only",
        timestamp_refs: [],
        confidence: "high",
        cannot_infer_from_brief_only: false,
      },
    ]);

    expect(actingScene).toMatchObject({
      observed_status: "uncertain",
      completion_status: "uncertain",
      cannot_infer_from_brief_only: true,
    });
    expect(song).toMatchObject({
      observed_status: "uncertain",
      completion_status: "uncertain",
      cannot_infer_from_brief_only: true,
    });
  });

  it("keeps raw report detected components diagnostic-only for S10 component truth", () => {
    const filtered = filterRunEvidencePassForStep1(
      {
        detected_components: [
          { type: "acting_scene", score: 100, weight: 0.5, note: "Legacy complete" },
          { type: "song", score: 100, weight: 0.5, note: "Legacy complete" },
        ],
      },
      { model: "unit-s10" },
    );

    expect(filtered.component_verifications).toHaveLength(0);
    expect(
      filtered.material_observable_evidence_items.some(
        (item) => item.evidence_kind === "material_component_presence_observed",
      ),
    ).toBe(false);
    expect(filtered.material_observable_evidence_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_kind: "legacy_detected_component_diagnostic_only",
          blocker_codes: ["legacy_detected_components_not_s10_component_verification"],
        }),
      ]),
    );
  });

  it("blocks requested-material performance observations from satisfying observed presence", () => {
    const compact = {
      schema_version: "tapecoach_step1_observable_evidence_v3",
      observations: [
        {
          family: "material_specific_performance",
          kind: "performance_observable_derived_from_material_specific_requested_material",
          summary: "The supplied context asks for a Side 1 scene.",
          source_basis: "supplied_context",
          confidence: "low",
        },
      ],
      component_verifications: [
        {
          requirement_id: "req_side_1",
          requirement_summary: "Side 1 acting scene",
          observed_status: "present",
          completion_status: "complete",
          evidence_summary: "The supplied context asks for a Side 1 scene.",
          observed_from_media: false,
          evidence_basis: "brief_text_only",
          timestamp_refs: [],
          confidence: "low",
          cannot_infer_from_brief_only: false,
        },
      ],
    };
    const filtered = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(
        parseCompactStep1EvidenceContent(JSON.stringify(compact)),
      ),
    );

    expect(filtered.component_verifications[0]).toMatchObject({
      observed_status: "uncertain",
      completion_status: "uncertain",
    });
    expect(filtered.material_observable_evidence_items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_kind:
            "material_specific_performance_performance_observable_derived_from_material_specific_requested_material",
          blocker_codes: expect.arrayContaining([
            "requested_material_cannot_satisfy_observed_component_presence",
          ]),
        }),
        expect.objectContaining({
          evidence_kind: "s10_component_verification_diagnostic_blocked",
          blocker_codes: expect.arrayContaining(["brief_text_only_not_component_presence"]),
        }),
      ]),
    );
  });

  it("allows duration/readiness as assessability context but not component completion proof", () => {
    const [verification] = normaliseS10ComponentVerifications([
      {
        requirement_id: "req_song",
        requirement_summary: "Complete song",
        observed_status: "present",
        completion_status: "complete",
        evidence_summary: "Duration metadata is 01:42 and upload state is available.",
        observed_from_media: false,
        evidence_basis: "deterministic_metadata",
        timestamp_refs: [],
        confidence: "medium",
        cannot_infer_from_brief_only: false,
      },
    ]);

    expect(verification).toMatchObject({
      observed_status: "uncertain",
      completion_status: "uncertain",
      evidence_basis: "deterministic_metadata",
    });
  });

  it("keeps exact timestamps optional while preserving component-level observations", () => {
    const filtered = filterRunEvidencePassForStep1({
      component_verifications: [
        {
          requirement_id: "req_side_1",
          requirement_summary: "Side 1 acting scene",
          observed_status: "absent",
          completion_status: "not_applicable",
          evidence_summary: "No acting scene section is observed in the media.",
          observed_from_media: true,
          evidence_basis: "observed_audio_video",
          timestamp_refs: [],
          confidence: "medium",
          cannot_infer_from_brief_only: true,
        },
      ],
    });

    expect(filtered.component_verifications).toHaveLength(1);
    expect(filtered.material_observable_evidence_items[0]).toMatchObject({
      component_id: "req_side_1",
      timestamp: null,
      timestamp_source: "not_timestamped_observation",
      blocker_codes: [],
    });
  });

  it("keeps the active Step 1 prompt on the S10 observation version, not evidence_pass_current", () => {
    const request = buildEvidencePassRequestBodyForProvider({
      model: "google/gemini-3-flash-preview",
      contextText: "S10.3 prompt assertion",
      videoUrl: "https://example.invalid/video.mp4",
      providerContract: "plain_json_observations",
    });
    const serialised = JSON.stringify(request);

    expect(serialised).toContain(S10_OBSERVATION_PROMPT_VERSION);
    expect(serialised).toContain("component_verifications");
    expect(serialised).toContain("observed_tape_sequence");
    expect(serialised).toContain("raw_report.detected_components");
    expect(serialised).not.toMatch(/prompt version['"]?:\s*['"]?evidence_pass_current/i);
    // The Step 1 output cap is sized for the 10-minute product maximum (18-36
    // timestamped notes + up to 30 sequence / 40 verification entries), not the
    // ~4-minute test fixture, so Step 1 does not under-produce on long tapes.
    expect(typeof request.max_tokens).toBe("number");
    expect(request.max_tokens as number).toBeGreaterThanOrEqual(49152);
  });

  it("mandates timestamps and solicits candidate_technique in the compact Step 1 prompt", () => {
    // Fix A: the compact (live Gemini) Step-1 prompt must mandate per-observation
    // timestamps and explicitly solicit candidate_technique, so Step 1 stops
    // emitting 0 timestamps / 0 technique and starving the Step-2 modules.
    const request = buildEvidencePassRequestBodyForProvider({
      model: "google/gemini-3-flash-preview",
      contextText: "S10.3 timestamp + technique mandate assertion",
      videoUrl: "https://example.invalid/video.mp4",
      providerContract: "plain_json_observations",
    });
    const serialised = JSON.stringify(request);

    // Timestamp mandate + duration-scaled density target (previously only in the
    // unused tool_call schema).
    expect(serialised).toMatch(/Timestamp requirements \(MANDATORY/i);
    expect(serialised).toMatch(/you MUST set timestamp_start_sec/i);
    expect(serialised).toContain("10+ min = 18-36");
    // candidate_technique is now expected, not just permitted, with red-lines kept.
    expect(serialised).toMatch(/Candidate-technique requirements \(EXPECTED/i);
    expect(serialised).toMatch(/you MUST emit a candidate_technique observation/i);
    expect(serialised).toMatch(/never name a public technique\/method\/authority/i);
  });

  it("routes S9-filtered Step 1 evidence into the polish timestamped + technique fields", () => {
    // The polish reads the raw EvidencePass, where the compact path leaves
    // timestamped_evidence + candidate_technique_evidence empty. This projection
    // carries the already-suppressed filtered evidence into those fields so Step 2
    // can build the timestamped/technique modules instead of dropping to the shell.
    const item = (over: Record<string, unknown>) => ({
      evidence_item_id: "id",
      evidence_family: "performance",
      evidence_modality: "video",
      evidence_kind: "acting scene",
      safe_evidence_summary: "summary",
      source_artefact_id: "run_evidence_pass",
      source_path: "p",
      timestamp: null,
      timestamp_range: null,
      timestamp_source: "x",
      component_id: null,
      linked_truth_state_ids: [],
      ...over,
    });
    const filtered = {
      observable_evidence_items: [
        item({
          evidence_modality: "video",
          evidence_kind: "acting",
          safe_evidence_summary: "Clear objective through the scene.",
          timestamp: "0:18",
        }),
        item({
          evidence_family: "audio",
          evidence_modality: "audio",
          evidence_kind: "vocal",
          safe_evidence_summary: "Song stays audible and supported.",
          timestamp: "2:05",
        }),
      ],
      candidate_technique_evidence: [
        item({
          evidence_family: "candidate_technique",
          evidence_modality: "video",
          evidence_kind: "breath",
          safe_evidence_summary: "Visible breath resets the thought before the final line.",
          timestamp: "1:40",
        }),
      ],
      video_observable_evidence_items: [],
      audio_observable_evidence_items: [],
      material_observable_evidence_items: [],
      performance_observable_evidence_items: [],
    } as unknown as Parameters<typeof projectFilteredStep1EvidenceForPolish>[0];

    const projected = projectFilteredStep1EvidenceForPolish(filtered);

    expect(projected.timestamped_evidence.length).toBe(2);
    expect(projected.timestamped_evidence[0]).toMatchObject({
      timestamp: "0:18",
      observation: "Clear objective through the scene.",
      linked_category: "acting",
    });
    expect(projected.timestamped_evidence[1].linked_category).toBe("vocal");
    expect(projected.candidate_technique_evidence.length).toBe(1);
    expect(projected.candidate_technique_evidence[0]).toMatchObject({
      label: "breath",
      safe_evidence_summary: "Visible breath resets the thought before the final line.",
      timestamp: "1:40",
    });
  });
});
