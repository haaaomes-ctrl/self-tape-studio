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
  emitEvidenceAnchorsFirstPass,
  emitGateTraceFirstPass,
  emitResolverOutputAndTruthStateMap,
  emitValidatorTraceFirstPass,
} from '@/server/v3/qa-artifacts-wiring.server';

function compactStep1WithMaterialSectionEvent() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', timestamp_start_sec: 1, source_basis: 'observed_video', confidence: 'high' },
      { family: 'audio_observable', kind: 'voice_audible', summary: 'The spoken line is audible through the phrase.', timestamp_start_sec: 4, source_basis: 'observed_audio', confidence: 'high' },
      { family: 'material_specific', kind: 'audition_material_section_observed', summary: 'The audition material section is present in the take.', timestamp_start_sec: 8, source_basis: 'observed_video', confidence: 'medium' },
      { family: 'candidate_technique', kind: 'public_safe_descriptor_candidate', summary: 'Internal descriptor candidate only: eyeline shifts toward the reader before the pause.', timestamp_start_sec: 12, source_basis: 'internal_shadow', confidence: 'low' },
    ],
    unavailable_families: [],
    rejected_or_uncertain: [],
  };
}

function compactStep1WithoutMaterialEvent() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', timestamp_start_sec: 1, source_basis: 'observed_video', confidence: 'high' },
      { family: 'audio_observable', kind: 'voice_audible', summary: 'The spoken line is audible through the phrase.', timestamp_start_sec: 4, source_basis: 'observed_audio', confidence: 'high' },
      { family: 'material_specific', kind: 'material_presence', summary: 'The audition material is supplied in context.', source_basis: 'supplied_context', confidence: 'low' },
      { family: 'candidate_technique', kind: 'public_safe_descriptor_candidate', summary: 'Internal descriptor candidate only: eyeline shifts toward the reader before the pause.', timestamp_start_sec: 12, source_basis: 'internal_shadow', confidence: 'low' },
    ],
    unavailable_families: [],
    rejected_or_uncertain: [],
  };
}

function filteredStep1(payload: Record<string, unknown>) {
  return filterRunEvidencePassForStep1(
    normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(payload))),
    { model: 'unit-openrouter-gemini' },
  ) as unknown as Record<string, unknown>;
}

function baseInput(root: string, run: string, take: string, step1: Record<string, unknown>) {
  return {
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919m',
    take_id: take,
    compared_take_ids: [take],
    source_stage: 'unit',
    source_module: 'v3-s9-ordinary-l2a-consistency-test',
    analysis_route: 'ordinary_single_take',
    route_or_model_marker: 'ordinary_single_take',
    audition_type: 'screen',
    selected_level: 'pro',
    brief_presence: 'supplied' as const,
    brief_presence_source: 'audition.brief' as const,
    material_presence: 'unknown' as const,
    material_presence_source: 'not_loaded' as const,
    original_upload_file_hash: 'sha256:s919m-test-upload',
    original_upload_file_hash_source_stage: 'client_pre_upload',
    upload_identity_capture_status: 'captured',
    mux_playback_id: 'safe-playback-ref',
    mux_asset_or_upload_id_present: true,
    take_created_at: '2026-05-22T09:00:00.000Z',
    take_updated_at: '2026-05-22T09:01:00.000Z',
    take_index: 1,
    take_index_source: 'loaded_take_index' as const,
    component_or_task_declaration_status: 'unknown' as const,
    component_or_task_declaration_source: 'not_loaded' as const,
    media_readiness_state: 'ready',
    video_duration_seconds: 42,
    media_duration_seconds: 42,
    duration_confidence: 'known',
    unavailable_fields: [],
    filtered_run_evidence_pass_step1: step1,
    root_dir: root,
    internal_qa_emit: true,
  };
}

async function emitOrdinaryEvidence(root: string, run: string, take: string, step1: Record<string, unknown>) {
  const base = baseInput(root, run, take, step1);
  const resolver = await emitResolverOutputAndTruthStateMap(base);
  const analysis = await emitAnalysisEvidenceStatePrerequisite({
    ...base,
    resolver_output_available: true,
    truth_state_map_available: true,
  });
  const anchors = await emitEvidenceAnchorsFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919m',
    take_id: take,
    source_stage: 'unit',
    source_module: 'v3-s9-ordinary-l2a-consistency-test',
    raw_report_data: {},
    analysis_evidence_state_data: analysis.payload,
    truth_state_map_data: resolver.truth_state_map,
    root_dir: root,
    internal_qa_emit: true,
  });
  return { analysis, anchors };
}

function completeOrdinaryMetricsSelfBlocked() {
  return {
    level2_status: 'not_accepted',
    production_safe_status: 'blocked',
    customer_release_status: 'blocked',
    public_scoring_status: 'blocked',
    public_technique_authority_status: 'blocked',
    ordinary_l2a_analysis_proof_status: 'insufficient',
    ordinary_l2a_unsatisfied_gate_ids: ['validator_trace_gate', 'gate_trace_gate'],
    ordinary_l2a_public_release_dependency_status: 'blocked',
    ordinary_analysis_proof_bundle_status: 'step1_families_complete_proof_chain_blocked',
    analysis_evidence_state_gate_status: 'satisfied',
    evidence_anchor_gate_status: 'sufficient',
    public_claim_gate_status: 'sufficient',
    score_trace_gate_status: 'satisfied',
    score_trace_internal_proof_status: 'real_runtime_v3_internal_score_proof',
    technique_observation_gate_status: 'satisfied',
    technique_observation_internal_proof_status: 'real_runtime_v3_internal_technique_proof',
    model_run_trace_gate_status: 'satisfied',
    model_run_trace_per_stage_model_proof_status: 'independent_model_proof_satisfying',
    model_run_raw_prompt_or_response_stored: false,
    model_run_secrets_or_signed_urls_stored: false,
    report_parity_status: 'passed',
    no_export_status: 'no_export_proof_complete',
    comparison_status: 'not_applicable',
    public_scoring_suppression_proof_status: 'satisfied',
    public_score_gate_permission: false,
    public_score_fields_absent_from_public_payload: true,
    public_score_claims_suppressed: true,
    public_technique_authority_suppression_proof_status: 'satisfied',
    public_technique_gate_permission: false,
    public_named_technique_fields_absent_from_public_payload: true,
    public_named_technique_claims_suppressed: true,
    public_technique_authority_content_scan_status: 'satisfied',
    public_comparison_recommendation_suppression_proof_status: 'not_applicable',
    comparison_recommendation_gate_permission: false,
    public_winner_absent: true,
    public_recommendation_absent: true,
    global_level2_evidence_status: 'insufficient',
    global_level2_release_status: 'blocked',
    global_level2_acceptance_status: 'not_accepted',
    runtime_operator_verification_status: 'required',
    runtime_bundle_freshness_status: 'unknown',
    runtime_bundle_matches_current_commit_status: 'unknown',
    runtime_bundle_matches_current_implementation_status: 'unknown',
    deployment_provenance_status: 'unknown_no_safe_env_var_found',
    operator_confirmation_status: 'missing',
    production_safe_readiness_status: 'blocked',
    customer_release_readiness_status: 'blocked',
    duplicate_same_video_safety_status: 'not_applicable',
    comparison_public_output_absence_proof_status: 'not_applicable',
    comparison_suppression_safety_status: 'not_applicable',
    comparison_parity_status: 'not_applicable',
    evidence_delta_or_no_material_difference_status: 'not_applicable',
  };
}

describe('S9-19M ordinary L2-A consistency and internal gate reconciliation', () => {
  it('keeps b464-like complete audio/video/candidate runs insufficient when no safe material event exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19m-no-material-event-'));
    const run = `run-s919m-no-event-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919m';
    const { analysis } = await emitOrdinaryEvidence(root, run, take, filteredStep1(compactStep1WithoutMaterialEvent()));

    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.video_observable.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.audio_observable.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.candidate_technique.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.status).toBe('not_extracted');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.status).toBe('not_extracted');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.blocker_codes).toContain('material_specific_performance_requires_safe_step1_event_observation');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.blocker_codes).toContain('performance_observable_requires_safe_step1_event_observation');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('stabilises 85e-like material/performance completion when event wording is broader than scene/song/slate', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19m-material-event-'));
    const run = `run-s919m-event-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919m';
    const { analysis, anchors } = await emitOrdinaryEvidence(root, run, take, filteredStep1(compactStep1WithMaterialSectionEvent()));

    expect(analysis.payload?.material_specific_performance_evidence_count).toBe(1);
    expect(analysis.payload?.performance_observable_evidence_count).toBe(1);
    expect(analysis.payload?.performance_observable_derivation_count).toBe(1);
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.status).toBe('complete');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(analysis.payload?.material_specific_performance_evidence[0].linked_truth_state_ids[0]).toContain(':truth_state:');
    expect(analysis.payload?.performance_observable_evidence[0].linked_truth_state_ids[0]).toContain(':truth_state:');
    expect(anchors.evidence_anchor_gate_status).toBe('sufficient');
    expect((anchors.anchors ?? []).some((anchor) => anchor.evidence_family === 'material_specific_performance' && anchor.cannot_satisfy_v3_gate === false)).toBe(true);
    expect((anchors.anchors ?? []).some((anchor) => anchor.evidence_family === 'performance_observable' && anchor.cannot_satisfy_v3_gate === false)).toBe(true);
  });

  it('reconciles ValidatorTrace and GateTrace self-blockers for a complete ordinary internal chain', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19m-gate-reconcile-'));
    const metrics = completeOrdinaryMetricsSelfBlocked();
    const manifest = {
      level2_qa_acceptance: 'not_accepted',
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
    };
    const validator = await emitValidatorTraceFirstPass({
      run_id: 'run-s919m-gate',
      analysis_run_id: 'run-s919m-gate',
      take_id: 'take-s919m',
      source_module: 'v3-s9-ordinary-l2a-consistency-test',
      source_stage: 'unit',
      manifest_snapshot: manifest,
      acceptance_metrics_snapshot: metrics,
      emitted_artefact_ids: ['validator_trace', 'model_run_trace', 'score_trace', 'technique_observation_trace', 'evidence_anchors', 'public_claim_trace'],
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(validator.validator_trace_summary?.validator_trace_gate_status).toBe('satisfied');
    expect(validator.validator_trace_summary?.validator_trace_internal_proof_status).toBe('satisfied');
    expect(validator.validator_trace_summary?.validator_trace_public_release_status).toBe('blocked');

    const gate = await emitGateTraceFirstPass({
      run_id: 'run-s919m-gate',
      analysis_run_id: 'run-s919m-gate',
      take_id: 'take-s919m',
      source_module: 'v3-s9-ordinary-l2a-consistency-test',
      source_stage: 'unit',
      manifest_snapshot: manifest,
      acceptance_metrics_snapshot: metrics,
      emitted_artefact_ids: ['validator_trace', 'gate_trace', 'model_run_trace'],
      validator_trace_summary: validator.validator_trace_summary,
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(gate.gate_trace_summary?.gate_trace_gate_status).toBe('satisfied');
    expect(gate.gate_trace_summary?.gate_trace_internal_l2a_status).toBe('satisfied');
    expect(gate.gate_trace_summary?.ordinary_l2a_analysis_proof_status).toBe('satisfied');
    expect(gate.gate_trace_summary?.gate_trace_release_status).toBe('blocked');

    const gatePayload = JSON.parse(await readFile(path.join(root, 'run-s919m-gate', 'takes', 'take-take-s919m', 'analysis-run-s919m-gate', 'traces', 'GateTrace.json'), 'utf8'));
    const noExportGate = gatePayload.gate_entries.find((entry: Record<string, unknown>) => entry.gate_id === 'no_export_gate');
    const ordinaryComparisonGate = gatePayload.gate_entries.find((entry: Record<string, unknown>) => entry.gate_id === 'ordinary_comparison_not_applicable_gate');
    const step1Gate = gatePayload.gate_entries.find((entry: Record<string, unknown>) => entry.gate_id === 'ordinary_analysis_step1_evidence_gate');
    expect(noExportGate.status).toBe('passed');
    expect(ordinaryComparisonGate.status).toBe('not_applicable');
    expect(step1Gate.status).toBe('passed');
    expect(gatePayload.production_safe_status).toBe('blocked');
    expect(gatePayload.public_scoring_status).toBe('blocked');
    expect(gatePayload.public_technique_authority_status).toBe('blocked');
    expect(gatePayload.level2_status).toBe('not_accepted');
  });
});
