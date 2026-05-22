import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  filterRunEvidencePassForStep1,
  normaliseCompactStep1EvidenceForEvidencePass,
  parseCompactStep1EvidenceContent,
} from '@/server/evidence-pass.server';
import {
  emitAnalysisEvidenceStatePrerequisite,
  emitClaimCandidateTrace,
  emitEvidenceAnchorsFirstPass,
  emitPublicClaimTraceFirstPass,
  emitResolverOutputAndTruthStateMap,
  emitTechniqueObservationTraceFirstPass,
} from '@/server/v3/qa-artifacts-wiring.server';

function compactStep1Fixture() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      {
        family: 'video_observable',
        kind: 'framing_visible',
        summary: 'Head and shoulders framing remains visible.',
        timestamp_start_sec: 1,
        timestamp_end_sec: null,
        source_basis: 'observed_video',
        confidence: 'high',
        limitations: [],
      },
      {
        family: 'audio_observable',
        kind: 'voice_audible',
        summary: 'The spoken line is audible through the phrase.',
        timestamp_start_sec: 4,
        timestamp_end_sec: null,
        source_basis: 'observed_audio',
        confidence: 'high',
        limitations: [],
      },
      {
        family: 'material_specific_performance',
        kind: 'scene_component_occurs',
        summary: 'The scene section is performed before the pause.',
        timestamp_start_sec: 8,
        timestamp_end_sec: null,
        source_basis: 'observed_video',
        confidence: 'medium',
        limitations: [],
      },
      {
        family: 'performance_observable',
        kind: 'pause_event_observed',
        summary: 'A pause occurs before the next line.',
        timestamp_start_sec: 12,
        timestamp_end_sec: null,
        source_basis: 'observed_video',
        confidence: 'medium',
        limitations: [],
      },
      {
        family: 'candidate_technique',
        kind: 'public_safe_descriptor_candidate',
        summary: 'Internal descriptor candidate only: eyeline shifts toward the reader before the pause.',
        timestamp_start_sec: 14,
        timestamp_end_sec: null,
        source_basis: 'internal_shadow',
        confidence: 'low',
        limitations: [],
      },
      {
        family: 'material_specific',
        kind: 'supplied_task_reference',
        summary: 'The supplied task references a scene.',
        timestamp_start_sec: null,
        timestamp_end_sec: null,
        source_basis: 'supplied_context',
        confidence: 'medium',
        limitations: [],
      },
    ],
    unavailable_families: [],
    rejected_or_uncertain: [
      { reason: 'unsafe_judgement_only', summary: 'Strong performance.' },
    ],
  };
}

function completeCommon(root: string, run: string, take: string, filteredStep1: Record<string, unknown>) {
  return {
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919i',
    take_id: take,
    compared_take_ids: [take],
    source_stage: 'unit',
    source_module: 'v3-s9-step1-family-projection-test',
    analysis_route: 'ordinary_single_take',
    route_or_model_marker: 'ordinary_single_take',
    audition_type: 'screen',
    selected_level: 'pro',
    brief_presence: 'supplied' as const,
    brief_presence_source: 'audition.brief' as const,
    material_presence: 'supplied' as const,
    material_presence_source: 'loaded_runtime_field' as const,
    original_upload_file_hash: 'sha256:s919i-test-upload',
    original_upload_file_hash_source_stage: 'client_pre_upload',
    upload_identity_capture_status: 'captured',
    mux_playback_id: 'safe-playback-ref',
    mux_asset_or_upload_id_present: true,
    take_created_at: '2026-05-22T09:00:00.000Z',
    take_updated_at: '2026-05-22T09:01:00.000Z',
    take_index: 1,
    take_index_source: 'loaded_take_row',
    component_or_task_declaration_status: 'supplied' as const,
    component_or_task_declaration_source: 'audition.brief' as const,
    media_readiness_state: 'ready',
    video_duration_seconds: 42,
    media_duration_seconds: 42,
    duration_confidence: 'known',
    unavailable_fields: [],
    filtered_run_evidence_pass_step1: filteredStep1,
    root_dir: root,
    internal_qa_emit: true,
  };
}

describe('S9-19I Step 1 family projection, truth linkage, and ordinary L2-A closure', () => {
  it('parses the compact v2 response and keeps material context separate from material performance', () => {
    const compact = parseCompactStep1EvidenceContent(JSON.stringify(compactStep1Fixture()));
    const evidencePass = normaliseCompactStep1EvidenceForEvidencePass(compact);
    const filtered = filterRunEvidencePassForStep1(evidencePass, { model: 'unit-openrouter-gemini' });

    expect(filtered.video_observable_evidence_items).toHaveLength(1);
    expect(filtered.audio_observable_evidence_items).toHaveLength(1);
    expect(filtered.performance_observable_evidence_items).toHaveLength(1);
    expect(filtered.candidate_technique_evidence).toHaveLength(1);
    expect(filtered.material_observable_evidence_items).toHaveLength(2);
    expect(filtered.material_observable_evidence_items.some((item) => item.evidence_kind.startsWith('material_specific_performance_'))).toBe(true);
    expect(filtered.material_observable_evidence_items.some((item) => item.evidence_kind.startsWith('material_specific_'))).toBe(true);
    expect(filtered.rejected_or_filtered_fields).not.toContain('step1_observations[0]');
  });

  it('links accepted Step 1 families through TruthStateMap, EvidenceAnchors, PublicClaimTrace and TechniqueObservationTrace', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s919i-family-'));
    const run = `run-s919i-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919i';
    const compact = parseCompactStep1EvidenceContent(JSON.stringify(compactStep1Fixture()));
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(compact),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;
    const common = completeCommon(root, run, take, filteredStep1);

    const resolver = await emitResolverOutputAndTruthStateMap(common);
    const analysis = await emitAnalysisEvidenceStatePrerequisite({
      ...common,
      resolver_output_available: true,
      truth_state_map_available: true,
    });
    const anchors = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919i',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-step1-family-projection-test',
      raw_report_data: {},
      analysis_evidence_state_data: analysis.payload,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });
    const claimCandidates = await emitClaimCandidateTrace({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919i',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-step1-family-projection-test',
      raw_report_data: {},
      analysis_evidence_state_data: analysis.payload,
      evidence_anchors_data: anchors,
      resolver_output_data: resolver.resolver_output,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });
    const publicClaims = await emitPublicClaimTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919i',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-step1-family-projection-test',
      raw_report_data: {},
      claim_candidate_trace_data: claimCandidates,
      evidence_anchors_data: anchors,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });
    const technique = await emitTechniqueObservationTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919i',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-step1-family-projection-test',
      raw_report_data: {},
      analysis_evidence_state_data: analysis.payload,
      evidence_anchors_data: anchors,
      public_claim_trace_data: publicClaims,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });

    expect(analysis.payload?.step1_media_input_status).toBe('media_observable_input_available');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.video_observable.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.audio_observable.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.candidate_technique.status).toBe('complete');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(analysis.payload?.material_specific_evidence.length).toBeGreaterThanOrEqual(1);
    expect(analysis.payload?.material_specific_performance_evidence).toHaveLength(1);
    expect(analysis.payload?.candidate_technique_evidence[0].linked_truth_state_ids[0]).toContain(':truth_state:');

    expect(anchors.evidence_anchor_gate_status).toBe('sufficient');
    expect(anchors.anchors.some((anchor) => anchor.evidence_family === 'candidate_technique')).toBe(true);
    expect(publicClaims.summary?.public_claim_gate_status).toBe('sufficient');
    expect(technique.technique_observation_trace_summary?.technique_observation_trace_gate_status).toBe('satisfied');
    expect(technique.technique_observation_trace_summary?.public_technique_authority_status).toBe('blocked');
  });
});
