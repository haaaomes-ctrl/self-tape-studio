import { mkdtemp, readFile } from 'node:fs/promises';
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
  emitComparisonParityProof,
  emitEvidenceAnchorsFirstPass,
  emitPublicClaimTraceFirstPass,
  emitQAManifestForAnalysisRun,
  emitResolverOutputAndTruthStateMap,
} from '@/server/v3/qa-artifacts-wiring.server';

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function compactStep1MaterialPerformanceOnly() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', timestamp_start_sec: 1, source_basis: 'observed_video', confidence: 'high' },
      { family: 'audio_observable', kind: 'voice_audible', summary: 'The spoken line is audible through the phrase.', timestamp_start_sec: 4, source_basis: 'observed_audio', confidence: 'high' },
      { family: 'material_specific_performance', kind: 'scene_segment_occurs', summary: 'The scene segment occurs before the pause.', timestamp_start_sec: 8, source_basis: 'observed_video', confidence: 'medium' },
      { family: 'candidate_technique', kind: 'public_safe_descriptor_candidate', summary: 'Internal descriptor candidate only: eyeline shifts toward the reader before the pause.', timestamp_start_sec: 12, source_basis: 'internal_shadow', confidence: 'low' },
    ],
    unavailable_families: [],
    rejected_or_uncertain: [],
  };
}

function common(root: string, run: string, take: string, filteredStep1: Record<string, unknown>) {
  return {
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919k',
    take_id: take,
    compared_take_ids: [take],
    source_stage: 'unit',
    source_module: 'v3-s9-performance-observable-closeout-test',
    analysis_route: 'ordinary_single_take',
    route_or_model_marker: 'ordinary_single_take',
    audition_type: 'screen',
    selected_level: 'pro',
    brief_presence: 'supplied' as const,
    brief_presence_source: 'audition.brief' as const,
    material_presence: 'supplied' as const,
    material_presence_source: 'loaded_runtime_field' as const,
    original_upload_file_hash: 'sha256:s919k-test-upload',
    original_upload_file_hash_source_stage: 'client_pre_upload',
    upload_identity_capture_status: 'captured',
    mux_playback_id: 'safe-playback-ref',
    mux_asset_or_upload_id_present: true,
    take_created_at: '2026-05-22T09:00:00.000Z',
    take_updated_at: '2026-05-22T09:01:00.000Z',
    take_index: 1,
    take_index_source: 'loaded_take_index' as const,
    component_or_task_declaration_status: 'supplied' as const,
    component_or_task_declaration_source: 'loaded_runtime_field' as const,
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

function sameVideoSuppressedPayloadWithoutExplicitPublicSurface() {
  return {
    public_output_unchanged: true,
    comparison_raw: {
      comparison_execution_status: 'executed',
      comparison_decision_status: 'suppressed_same_video',
      recommendation_suppressed: true,
      selected_take_id_internal_only: null,
      forbidden_fields_absent: true,
      public_output_unchanged: true,
    },
    comparison_report_internal: {
      recommendation_suppressed: true,
      selected_take_id_internal_only: null,
      forbidden_fields_absent: true,
      public_output_unchanged: true,
    },
    duplicate_detection_trace: {
      duplicate_detection_status: 'detected',
      duplicate_detection_confidence: 100,
      suppression_applied: true,
      same_video_detected: true,
      repeated_input_detected: true,
      no_material_difference: true,
      suppression_required: true,
    },
    same_video_repeatability_trace: {
      same_video_detected: true,
      repeated_input_detected: true,
      same_video_suppression_status: 'suppressed',
      forced_winner_risk: true,
      false_winner_risk: true,
    },
    comparison_suppression_trace: {
      comparison_decision_status: 'suppressed_same_video',
      recommendation_suppressed: true,
      selected_take_id_internal_only: null,
      same_video_suppression_status: 'suppressed',
      false_winner_prevention_status: 'active',
      public_winner_absent: true,
      public_recommendation_absent: true,
      public_output_unchanged: true,
    },
    route_variance_trace: {
      route_variance_status: 'not_detected',
      route_mismatch_detected: false,
      route_variance_detected: false,
      route_variance_mitigation_status: 'not_required',
    },
  };
}

describe('S9-19K performance observable, public claim, comparison parity closeout', () => {
  it('derives performance_observable from safe material-specific performance events with truth and anchors', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19k-performance-'));
    const run = `run-s919k-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919k';
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(compactStep1MaterialPerformanceOnly()))),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;
    expect((filteredStep1.performance_observable_evidence_items as unknown[])).toHaveLength(0);

    const base = common(root, run, take, filteredStep1);
    const resolver = await emitResolverOutputAndTruthStateMap(base);
    const analysis = await emitAnalysisEvidenceStatePrerequisite({
      ...base,
      resolver_output_available: true,
      truth_state_map_available: true,
    });
    const anchors = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919k',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-performance-observable-closeout-test',
      raw_report_data: {},
      analysis_evidence_state_data: analysis.payload,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });

    expect(analysis.payload?.performance_observable_evidence_count).toBe(1);
    expect(analysis.payload?.performance_observable_derivation_count).toBe(1);
    expect(analysis.payload?.performance_observable_evidence[0]).toMatchObject({
      evidence_family: 'performance_observable',
      derived_from_family: 'material_specific_performance',
      can_satisfy_family_gate: true,
    });
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.status).toBe('complete');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(anchors.evidence_anchor_gate_status).toBe('sufficient');
    expect((anchors.anchors ?? []).some((anchor) => anchor.evidence_family === 'performance_observable' && anchor.cannot_satisfy_v3_gate === false)).toBe(true);
  });

  it('excludes not-rendered internal candidates from public claim gate failure', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19k-claims-'));
    const run = `run-s919k-claims-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919k';
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(compactStep1MaterialPerformanceOnly()))),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;
    const base = common(root, run, take, filteredStep1);
    const resolver = await emitResolverOutputAndTruthStateMap(base);
    const analysis = await emitAnalysisEvidenceStatePrerequisite({ ...base, resolver_output_available: true, truth_state_map_available: true });
    const anchors = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919k',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-performance-observable-closeout-test',
      raw_report_data: {},
      analysis_evidence_state_data: analysis.payload,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });
    const claimCandidates = await emitClaimCandidateTrace({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919k',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-performance-observable-closeout-test',
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
      submission_id: 'sub-s919k',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-performance-observable-closeout-test',
      raw_report_data: {},
      claim_candidate_trace_data: claimCandidates,
      evidence_anchors_data: anchors,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });

    const claimCandidateSummary = claimCandidates.summary as { claim_candidate_gate_status?: string } | undefined;
    const candidateItems = claimCandidates.claim_candidates ?? [];
    const publicClaimSummary = publicClaims.summary as {
      public_claim_gate_status?: string;
      not_rendered_internal_trace_count?: number;
      required_rendered_public_claim_count?: number;
      unsupported_rendered_claim_count?: number;
    } | undefined;
    expect(claimCandidateSummary?.claim_candidate_gate_status).toBe('satisfied');
    expect(candidateItems.some((candidate) => candidate.excluded_from_public_claim_gate === true)).toBe(true);
    expect(candidateItems.some((candidate) => candidate.required_for_public_claim_gate === true)).toBe(false);
    expect(publicClaimSummary?.public_claim_gate_status).toBe('sufficient');
    expect(publicClaimSummary?.not_rendered_internal_trace_count).toBeGreaterThan(0);
    expect(publicClaimSummary?.unsupported_rendered_claim_count).toBe(0);
  });

  it('classifies intentionally absent same-video public output as suppressed without parity_artefacts_missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19k-comparison-'));
    const out = await emitComparisonParityProof({
      run_id: 'run-s919k-comparison',
      analysis_run_id: 'run-s919k-comparison',
      take_id: 'ta',
      comparison_run_id: 'cmp-ta-tb',
      compared_take_ids: ['ta', 'tb'],
      root_dir: root,
      internal_qa_emit: true,
      comparison_invoked: true,
      comparison_evidence_status: {
        comparison_raw: true,
        comparison_report_internal: true,
        same_video_repeatability_trace: true,
        duplicate_detection_trace: true,
        comparison_suppression_trace: true,
        route_variance_trace: true,
      },
      comparison_payloads: sameVideoSuppressedPayloadWithoutExplicitPublicSurface(),
    });

    expect(out.written).toBe(true);
    expect(out.blocker_codes).toEqual(['duplicate_same_video_suppressed_without_decisive_evidence_delta']);
    expect(out.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(out.comparison_parity_summary?.comparison_public_output_status).toBe('not_emitted_suppressed');
    expect(out.comparison_parity_summary?.comparison_public_output_absence_proof_status).toBe('satisfied');
    expect(out.comparison_parity_summary?.comparison_suppression_safety_status).toBe('satisfied_suppressed');
    expect(out.comparison_parity_summary?.comparison_public_winner_absent).toBe(true);
    expect(out.comparison_parity_summary?.comparison_public_recommendation_absent).toBe(true);
    expect(out.comparison_parity_summary?.comparison_recommendation_permission).toBe(false);
    expect(out.comparison_parity_summary?.evidence_delta_or_no_material_difference_status).toBe('non_decisive');
  });

  it('emits RuntimeVerificationTrace by default as required when no fresh runtime proof is supplied', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19k-runtime-trace-'));
    const out = await emitQAManifestForAnalysisRun({
      run_id: 'run-s919k-runtime',
      analysis_run_id: 'run-s919k-runtime',
      take_id: 'ta',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: [],
    });

    expect(out.written).toBe(true);
    const trace = await readJson(path.join(root, 'run-s919k-runtime', 'takes', 'take-ta', 'analysis-run-s919k-runtime', 'analysis', 'RuntimeVerificationTrace.json'));
    expect(trace.runtime_operator_verification_status).toBe('required');
    expect(trace.deployment_provenance_status).toBe('unknown_no_safe_env_var_found');
    expect(trace.production_safe_status).toBe('blocked');
    expect(trace.raw_prompt_or_response_stored).toBe(false);
    expect(trace.secrets_or_signed_urls_stored).toBe(false);
  });
});
