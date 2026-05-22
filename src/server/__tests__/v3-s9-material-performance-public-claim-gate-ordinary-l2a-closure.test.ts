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
  emitEvidenceAnchorsFirstPass,
  emitPublicClaimTraceFirstPass,
  emitQAManifestForAnalysisRun,
  emitResolverOutputAndTruthStateMap,
} from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

async function readJson(filePath: string) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function compactStep1GenericMaterialEvent() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', timestamp_start_sec: 1, source_basis: 'observed_video', confidence: 'high' },
      { family: 'audio_observable', kind: 'voice_audible', summary: 'The spoken line is audible through the phrase.', timestamp_start_sec: 4, source_basis: 'observed_audio', confidence: 'high' },
      { family: 'material_specific', kind: 'scene_segment_occurs', summary: 'The scene segment occurs before the pause.', timestamp_start_sec: 8, source_basis: 'observed_video', confidence: 'medium' },
      { family: 'candidate_technique', kind: 'public_safe_descriptor_candidate', summary: 'Internal descriptor candidate only: eyeline shifts toward the reader before the pause.', timestamp_start_sec: 12, source_basis: 'internal_shadow', confidence: 'low' },
    ],
    unavailable_families: [],
    rejected_or_uncertain: [],
  };
}

function compactStep1ContextOnlyMaterial() {
  return {
    schema_version: 'tapecoach_step1_observable_evidence_v2',
    observations: [
      { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', timestamp_start_sec: 1, source_basis: 'observed_video', confidence: 'high' },
      { family: 'audio_observable', kind: 'voice_audible', summary: 'The spoken line is audible through the phrase.', timestamp_start_sec: 4, source_basis: 'observed_audio', confidence: 'high' },
      { family: 'material_specific', kind: 'material_presence', summary: 'Material presence is unknown from supplied context.', source_basis: 'supplied_context', confidence: 'low' },
      { family: 'material_specific_performance', kind: 'material_specific_performance_context_reference', summary: 'The supplied task references a scene.', source_basis: 'supplied_context', confidence: 'low' },
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
    submission_id: 'sub-s919l',
    take_id: take,
    compared_take_ids: [take],
    source_stage: 'unit',
    source_module: 'v3-s9-material-performance-public-claim-gate-test',
    analysis_route: 'ordinary_single_take',
    route_or_model_marker: 'ordinary_single_take',
    audition_type: 'screen',
    selected_level: 'pro',
    brief_presence: 'supplied' as const,
    brief_presence_source: 'audition.brief' as const,
    material_presence: 'unknown' as const,
    material_presence_source: 'not_loaded' as const,
    original_upload_file_hash: 'sha256:s919l-test-upload',
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
    filtered_run_evidence_pass_step1: filteredStep1,
    root_dir: root,
    internal_qa_emit: true,
  };
}

async function emitOrdinaryChain(root: string, run: string, take: string, filteredStep1: Record<string, unknown>) {
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
    submission_id: 'sub-s919l',
    take_id: take,
    source_stage: 'unit',
    source_module: 'v3-s9-material-performance-public-claim-gate-test',
    raw_report_data: {},
    analysis_evidence_state_data: analysis.payload,
    truth_state_map_data: resolver.truth_state_map,
    root_dir: root,
    internal_qa_emit: true,
  });
  return { base, resolver, analysis, anchors };
}

describe('S9-19L material performance, public claim gate, ordinary L2-A closure', () => {
  it('promotes safe generic material task events to material_specific_performance and derives performance_observable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19l-material-event-'));
    const run = `run-s919l-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919l';
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(compactStep1GenericMaterialEvent()))),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;

    expect((filteredStep1.material_observable_evidence_items as unknown[])).toHaveLength(1);
    expect((filteredStep1.performance_observable_evidence_items as unknown[])).toHaveLength(0);

    const { analysis, anchors } = await emitOrdinaryChain(root, run, take, filteredStep1);
    const materialItem = analysis.payload?.material_specific_performance_evidence[0];
    const performanceItem = analysis.payload?.performance_observable_evidence[0];

    expect(analysis.payload?.material_specific_performance_evidence_count).toBe(1);
    expect(materialItem).toMatchObject({
      evidence_family: 'material_specific_performance',
      can_satisfy_family_gate: true,
    });
    expect(String(materialItem?.linked_truth_state_ids?.[0])).toContain(':truth_state:');
    expect(analysis.payload?.performance_observable_evidence_count).toBe(1);
    expect(analysis.payload?.performance_observable_derivation_count).toBe(1);
    expect(performanceItem).toMatchObject({
      evidence_family: 'performance_observable',
      derived_from_family: 'material_specific_performance',
      can_satisfy_family_gate: true,
    });
    expect(String(performanceItem?.linked_truth_state_ids?.[0])).toContain(':truth_state:');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.status).toBe('complete');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.status).toBe('complete');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(anchors.evidence_anchor_gate_status).toBe('sufficient');
    expect((anchors.anchors ?? []).some((anchor) => anchor.evidence_family === 'material_specific_performance' && anchor.cannot_satisfy_v3_gate === false)).toBe(true);
    expect((anchors.anchors ?? []).some((anchor) => anchor.evidence_family === 'performance_observable' && anchor.cannot_satisfy_v3_gate === false)).toBe(true);
  });

  it('keeps context-only material observations out of material/performance gates with exact blockers', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19l-material-context-'));
    const run = `run-s919l-context-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919l';
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(compactStep1ContextOnlyMaterial()))),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;

    const { analysis } = await emitOrdinaryChain(root, run, take, filteredStep1);

    expect(analysis.payload?.material_specific_evidence_count).toBeGreaterThan(0);
    expect(analysis.payload?.material_specific_performance_evidence_count).toBe(0);
    expect(analysis.payload?.performance_observable_evidence_count).toBe(0);
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.material_specific_performance.blocker_codes).toContain('material_specific_performance_requires_safe_step1_event_observation');
    expect(analysis.payload?.ordinary_analysis_family_completion_by_id.performance_observable.blocker_codes).toContain('performance_observable_requires_safe_step1_event_observation');
    expect(analysis.payload?.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('excludes internal claim candidates and traces from required public claim gates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19l-claims-'));
    const run = `run-s919l-claims-${Math.random().toString(36).slice(2)}`;
    const take = 'take-s919l';
    const filteredStep1 = filterRunEvidencePassForStep1(
      normaliseCompactStep1EvidenceForEvidencePass(parseCompactStep1EvidenceContent(JSON.stringify(compactStep1GenericMaterialEvent()))),
      { model: 'unit-openrouter-gemini' },
    ) as unknown as Record<string, unknown>;
    const { resolver, analysis, anchors } = await emitOrdinaryChain(root, run, take, filteredStep1);
    const claimCandidates = await emitClaimCandidateTrace({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub-s919l',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-material-performance-public-claim-gate-test',
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
      submission_id: 'sub-s919l',
      take_id: take,
      source_stage: 'unit',
      source_module: 'v3-s9-material-performance-public-claim-gate-test',
      raw_report_data: {},
      claim_candidate_trace_data: claimCandidates,
      evidence_anchors_data: anchors,
      truth_state_map_data: resolver.truth_state_map,
      root_dir: root,
      internal_qa_emit: true,
    });
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: take,
      root_dir: root,
      emitted_artefact_ids: ['claim_candidate_trace', 'public_claim_trace'],
      artefact_source_classification_by_id: {
        claim_candidate_trace: 'real_runtime_v3_candidate_source',
        public_claim_trace: 'real_runtime_v3_claim_support',
      },
      artefact_level2_spine_satisfaction_by_id: {
        claim_candidate_trace: false,
        public_claim_trace: true,
      },
      claim_candidate_trace_summary: claimCandidates.summary,
      public_claim_trace_summary: publicClaims.summary,
      public_output_unchanged: true,
      internal_qa_emit: true,
    });
    const manifestPath = path.join(root, run, 'manifest.json');
    const manifest = await readJson(manifestPath);
    const metrics = buildQAAcceptanceMetrics(manifest);

    expect(claimCandidates.summary?.claim_candidate_gate_status).toBe('satisfied');
    expect(claimCandidates.summary?.required_rendered_public_claim_count).toBe(0);
    expect(claimCandidates.summary?.excluded_internal_claim_count).toBeGreaterThan(0);
    expect(claimCandidates.claim_candidates?.every((candidate) => candidate.public_display_status !== 'not_rendered_internal_candidate' || (
      candidate.eligible_for_public_claim_trace_support_check === false
      && candidate.public_claim_support_required === false
      && candidate.required_for_public_claim_gate === false
      && candidate.excluded_from_public_claim_gate === true
      && candidate.cannot_satisfy_public_claim_gate === false
    ))).toBe(true);
    expect(publicClaims.summary?.public_claim_gate_status).toBe('sufficient');
    expect(publicClaims.summary?.required_rendered_public_claim_count).toBe(0);
    expect(publicClaims.summary?.excluded_internal_claim_count).toBeGreaterThan(0);
    expect(metrics.claim_candidate_gate_status).toBe('satisfied');
    expect(metrics.claim_candidate_gate_reason).toBe('not_rendered_internal_candidates_excluded_from_public_claim_gate');
    expect(metrics.blocker_codes).not.toContain('claim_candidate_trace_internal_only_not_public_claim_gate_evidence');
  });
});
