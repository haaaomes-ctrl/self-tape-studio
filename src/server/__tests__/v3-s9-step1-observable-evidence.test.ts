import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterRunEvidencePassForStep1 } from '@/server/evidence-pass.server';
import {
  emitAnalysisEvidenceStatePrerequisite,
  emitQAManifestForAnalysisRun,
  emitResolverOutputAndTruthStateMap,
} from '@/server/v3/qa-artifacts-wiring.server';

async function emitStep1Bundle(options: { filteredStep1?: Record<string, unknown> | null } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s918b-step1-'));
  const run = `run-s918b-${Math.random().toString(36).slice(2)}`;
  const take = 't1';
  const analysis = await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    compared_take_ids: [take],
    source_stage: 'unit',
    source_module: 'test',
    analysis_route: 'unit',
    route_or_model_marker: 'unit',
    audition_type: 'screen',
    selected_level: 'pro',
    brief_presence: 'supplied',
    brief_presence_source: 'audition.brief',
    material_presence: 'supplied',
    material_presence_source: 'loaded_runtime_field',
    original_upload_file_hash: 'sha256:test-upload-hash',
    original_upload_file_hash_source_stage: 'client_pre_upload',
    upload_identity_capture_status: 'captured',
    mux_playback_id: 'safe-playback-ref',
    mux_asset_or_upload_id_present: true,
    take_created_at: '2026-05-21T09:00:00.000Z',
    take_updated_at: '2026-05-21T09:01:00.000Z',
    component_or_task_declaration_status: 'unknown',
    component_or_task_declaration_source: 'not_loaded',
    media_readiness_state: 'ready',
    media_duration_seconds: 42,
    duration_confidence: 'known',
    resolver_output_available: true,
    truth_state_map_available: true,
    filtered_run_evidence_pass_step1: options.filteredStep1,
    root_dir: root,
    internal_qa_emit: true,
  });
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: analysis.emitted_artefact_ids,
    emitted_blocked_artefact_ids: analysis.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: {
      step1_observable_evidence: analysis.step1_observable_evidence_source_classification,
      analysis_evidence_state: analysis.source_classification,
    },
    artefact_level2_spine_satisfaction_by_id: {
      step1_observable_evidence: false,
      analysis_evidence_state: false,
    },
    step1_observable_evidence_summary: analysis.step1_observable_evidence_summary,
    analysis_evidence_state_summary: analysis.summary,
  });
  const base = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`);
  const step1 = JSON.parse(await readFile(path.join(base, 'analysis', 'Step1ObservableEvidence.json'), 'utf8'));
  const aes = JSON.parse(await readFile(path.join(base, 'analysis', 'AnalysisEvidenceState.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { analysis, step1, aes, manifest, metrics };
}

function filteredMediaProjection(overrides: Record<string, unknown> = {}) {
  return filterRunEvidencePassForStep1({
    presentation_evidence: ['Framing keeps the performer visible from shoulders up.'],
    timestamped_evidence: [
      { timestamp: '00:05', observation: 'Audio drops slightly on the opening word.', linked_category: 'audio' },
      { timestamp: '00:12', observation: 'Framing remains visible during the opening slate.', linked_category: 'technical' },
    ],
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: true,
      movement_assessable: true,
      brief_assessable: true,
      role_fit_assessable: false,
      notes: 'Assessability notes only',
    },
    ...overrides,
  }, { model: 'test-model', durationSeconds: 60 }) as unknown as Record<string, unknown>;
}

describe('S9-18B Step1ObservableEvidence container', () => {
  it('emits an internal-only partial Step1ObservableEvidence artefact without public gate promotion', async () => {
    const { step1 } = await emitStep1Bundle();
    expect(step1).toMatchObject({
      schema_version: 'tapecoach_v3_step1_observable_evidence_v1',
      artefact_type: 'step1_observable_evidence',
      internal_only: true,
      privacy_classification: 'internal_private',
      public_output_unchanged: true,
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
      public_comparison_output_status: 'blocked',
      extraction_status: 'partial',
      source_classification: 'real_runtime_v3_partial',
      cannot_satisfy_v3_gate: true,
    });
    expect(step1.observable_evidence_items.length).toBeGreaterThan(0);
    expect(step1.step1_observable_evidence_summary.step1_observable_evidence_gate_status).toBe('insufficient');
  });

  it('records unavailable extractor families and rejects forbidden satisfying sources', async () => {
    const { step1 } = await emitStep1Bundle();
    const unavailableKinds = step1.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind);
    expect(unavailableKinds).toEqual(expect.arrayContaining([
      'video_observable_performance_evidence_not_extracted',
      'audio_observable_performance_evidence_not_extracted',
      'material_specific_performance_evidence_not_extracted',
      'performance_observable_evidence_not_extracted',
      'candidate_technique_evidence_not_extracted',
    ]));
    expect(step1.anti_fake_evidence_guard).toMatchObject({
      raw_report_prose_rejected: true,
      render_payload_rejected: true,
      public_report_payload_rejected: true,
      report_parity_result_rejected: true,
      legacy_score_trace_rejected: true,
      legacy_technique_observation_trace_rejected: true,
      public_report_ui_rejected: true,
      model_text_without_structured_provenance_rejected: true,
    });
    const sourceIds = step1.observable_evidence_items.map((item: any) => item.source_artefact_id);
    expect(sourceIds).not.toEqual(expect.arrayContaining([
      'raw_report',
      'render_payload',
      'public_report_payload',
      'report_parity_result',
      'score_trace',
      'technique_observation_trace',
    ]));
  });

  it('emits deterministic metadata and supplied-context facts from allowed pre-Step 2 sources only', async () => {
    const { step1, aes, metrics } = await emitStep1Bundle();
    const kinds = step1.observable_evidence_items.map((item: any) => item.evidence_kind);
    expect(kinds).toEqual(expect.arrayContaining([
      'selected_level',
      'audition_type',
      'submission_identity_loaded',
      'take_identity_loaded',
      'brief_presence',
      'brief_presence_source_resolved',
      'extracted_brief_cache_status',
      'material_presence',
      'material_presence_source_resolved',
      'media_duration_known',
      'safe_upload_identity_available',
      'take_created_at_normalised',
      'take_updated_at_normalised',
      'component_or_task_declaration_unavailable',
    ]));
    const sourceIds = new Set(step1.observable_evidence_items.map((item: any) => item.source_artefact_id));
    expect([...sourceIds].sort()).toEqual([...new Set([...sourceIds])].sort());
    expect([...sourceIds]).toEqual(expect.arrayContaining(['analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'media_readiness']));
    expect([...sourceIds]).not.toEqual(expect.arrayContaining(['raw_report', 'render_payload', 'public_report_payload', 'report_parity_result', 'score_trace', 'technique_observation_trace']));
    expect(step1.evidence_family_coverage.material_specific).toBe('partial');
    expect(step1.step1_observable_evidence_summary.deterministic_runtime_evidence_count).toBeGreaterThan(0);
    expect(step1.step1_observable_evidence_summary.brief_material_evidence_count).toBeGreaterThan(0);
    expect(step1.deterministic_evidence_source_refs.allowed_source_artefact_ids).toEqual(expect.arrayContaining([
      'analysis_input_record',
      'analysis_submission',
      'analysis_take',
      'resolver_output',
      'truth_state_map',
      'media_readiness',
    ]));
    expect(aes.deterministic_runtime_evidence_count).toBe(step1.step1_observable_evidence_summary.deterministic_runtime_evidence_count);
    expect(aes.brief_material_evidence_count).toBe(step1.step1_observable_evidence_summary.brief_material_evidence_count);
    expect(aes.step1_observable_evidence_family_summary.material_specific).toBe('partial');
    expect(metrics.step1_observable_evidence_summary.brief_material_evidence_count).toBeGreaterThan(0);
  });

  it('keeps deterministic and brief/material evidence free of achievement, scoring, technique, and market-fit judgements', async () => {
    const { step1 } = await emitStep1Bundle();
    const serialised = JSON.stringify(step1.observable_evidence_items).toLowerCase();
    expect(serialised).not.toContain('brief achieved');
    expect(serialised).not.toContain('technique demonstrated');
    expect(serialised).not.toContain('public score');
    expect(serialised).not.toContain('castable');
    expect(serialised).not.toContain('marketable');
    expect(serialised).not.toContain('role fit');
    expect(serialised).not.toContain('winner');
    expect(serialised).not.toContain('recommendation');
  });

  it('emits first narrow video/audio media-observable items from safe filtered Step 1 projection only', async () => {
    const { step1, aes, metrics } = await emitStep1Bundle({ filteredStep1: filteredMediaProjection() });
    const mediaItems = step1.observable_evidence_items.filter((item: any) =>
      ['video_observable', 'audio_observable', 'assessability_limit'].includes(item.evidence_family)
      && ['video', 'audio'].includes(item.evidence_modality)
    );
    expect(mediaItems.map((item: any) => item.evidence_kind)).toEqual(expect.arrayContaining([
      'framing_state_observed',
      'timestamped_video_observation',
      'timestamped_audio_observation',
    ]));
    expect(mediaItems.every((item: any) => item.source_artefact_id === 'step1_observable_evidence')).toBe(true);
    expect(mediaItems.every((item: any) => String(item.source_path).startsWith('observable_evidence_items['))).toBe(true);
    expect(mediaItems.every((item: any) => item.linked_truth_state_ids.every((id: string) => id.includes(':truth_state:')))).toBe(true);
    expect(mediaItems.some((item: any) => item.blocker_codes.includes('missing_truth_state_linkage'))).toBe(false);
    expect(mediaItems.filter((item: any) => item.timestamp).map((item: any) => item.timestamp)).toEqual(['00:05', '00:12']);
    expect(step1.evidence_family_coverage.video_observable).toBe('partial');
    expect(step1.evidence_family_coverage.audio_observable).toBe('partial');
    expect(step1.evidence_family_coverage.performance_observable).toBe('not_extracted');
    expect(step1.evidence_family_coverage.candidate_technique).toBe('not_extracted');
    expect(step1.video_observable_evidence_count).toBeGreaterThan(0);
    expect(step1.audio_observable_evidence_count).toBeGreaterThan(0);
    expect(step1.timestamped_media_observation_count).toBe(2);
    expect(aes.media_observable_evidence_family_summary).toMatchObject({
      video_observable: 'partial',
      audio_observable: 'partial',
      performance_observable: 'not_extracted',
      candidate_technique: 'not_extracted',
    });
    expect(aes.cannot_satisfy_v3_gate).toBe(true);
    expect(metrics.step1_observable_evidence_summary.video_observable_evidence_count).toBeGreaterThan(0);
    expect(metrics.step1_observable_evidence_summary.audio_observable_evidence_count).toBeGreaterThan(0);
  });

  it('links Step1ObservableEvidence items only to explicit TruthStateMap IDs', async () => {
    const filteredStep1 = filteredMediaProjection();
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s918e-step1-truth-'));
    const run = `run-s918e-${Math.random().toString(36).slice(2)}`;
    const take = 't1';
    const common = {
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: take,
      compared_take_ids: [take],
      source_stage: 'unit',
      source_module: 'test',
      audition_type: 'screen',
      selected_level: 'pro',
      brief_presence: 'supplied' as const,
      brief_presence_source: 'audition.brief' as const,
      material_presence: 'supplied' as const,
      material_presence_source: 'loaded_runtime_field' as const,
      original_upload_file_hash: 'sha256:test-upload-hash',
      original_upload_file_hash_source_stage: 'client_pre_upload',
      upload_identity_capture_status: 'captured',
      mux_playback_id: 'safe-playback-ref',
      mux_asset_or_upload_id_present: true,
      take_created_at: '2026-05-21T09:00:00.000Z',
      take_updated_at: '2026-05-21T09:01:00.000Z',
      component_or_task_declaration_status: 'unknown' as const,
      component_or_task_declaration_source: 'not_loaded' as const,
      media_readiness_state: 'ready',
      video_duration_seconds: 42,
      media_duration_seconds: 42,
      duration_confidence: 'known',
      filtered_run_evidence_pass_step1: filteredStep1,
      root_dir: root,
      internal_qa_emit: true,
    };
    const resolver = await emitResolverOutputAndTruthStateMap({
      ...common,
      unavailable_fields: [],
    });
    const analysis = await emitAnalysisEvidenceStatePrerequisite({
      ...common,
      resolver_output_available: true,
      truth_state_map_available: true,
      unavailable_fields: [],
    });
    const base = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`);
    const step1 = JSON.parse(await readFile(path.join(base, 'analysis', 'Step1ObservableEvidence.json'), 'utf8'));
    const linkedIds = [...new Set(step1.observable_evidence_items.flatMap((item: any) => item.linked_truth_state_ids ?? []))].sort();
    const explicitIds = [...new Set((resolver.truth_state_map.truth_state_ids ?? []) as string[])].sort();
    const missingExplicitIds = linkedIds.filter((id) => !explicitIds.includes(id));
    expect(linkedIds.length).toBeGreaterThan(0);
    expect(missingExplicitIds).toEqual([]);
    expect(analysis.step1_observable_evidence_summary.step1_truth_unlinked_evidence_item_count).toBe(0);
    expect(step1.truth_state_linkage_status).toBe('partial');
  });

  it('rejects unsafe media-observable projection fields instead of promoting report-like judgement', async () => {
    const { step1 } = await emitStep1Bundle({
      filteredStep1: filteredMediaProjection({
        presentation_evidence: ['Strong performance with professional quality.'],
        timestamped_evidence: [
          { timestamp: '00:20', observation: 'Audio is audible before the line.', linked_category: 'audio' },
          { timestamp: '00:10', observation: 'Framing remains visible after the audio cue.', linked_category: 'technical' },
        ],
        evidence_sufficiency: {
          audio_assessable: true,
          video_assessable: true,
          acting_assessable: true,
          vocal_assessable: true,
          movement_assessable: true,
          brief_assessable: true,
          role_fit_assessable: true,
          notes: 'Assessability notes only',
        },
      }),
    });
    const serialisedMedia = JSON.stringify(step1.observable_evidence_items).toLowerCase();
    expect(serialisedMedia).not.toContain('strong performance');
    expect(serialisedMedia).not.toContain('professional quality');
    expect(serialisedMedia).not.toContain('ready to submit');
    expect(step1.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_family: 'runEvidencePass_filtered_media_observable' }),
    ]));
    expect(step1.step1_observable_evidence_summary.rejected_media_observable_source_count).toBeGreaterThan(0);
  });

  it('links Step1ObservableEvidence into AnalysisEvidenceState while keeping Step 2 limited and Level 2 blocked', async () => {
    const { aes } = await emitStep1Bundle();
    expect(aes.step1_observable_evidence_ref).toContain('/analysis/Step1ObservableEvidence.json');
    expect(aes.step1_observable_evidence_ref_status).toBe('written');
    expect(aes.step1_observable_evidence_source_classification).toBe('real_runtime_v3_partial');
    expect(aes.step1_observable_evidence_gate_status).toBe('insufficient');
    expect(aes.step1_observable_evidence_blocker_codes).toContain('step1_observable_evidence_partial');
    expect(aes.step2_dependency_status).toMatchObject({ status: 'ready_with_limitations', can_run_step2: true });
    expect(aes.evidence_state_status).toBe('partial');
    expect(aes.cannot_satisfy_v3_gate).toBe(true);
  });

  it('classifies the container in manifest and acceptance metrics without accepting Level 2', async () => {
    const { manifest, metrics } = await emitStep1Bundle();
    expect(manifest.emitted_artifacts).toContain('step1_observable_evidence');
    expect(manifest.artefact_status_by_id.step1_observable_evidence).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.step1_observable_evidence).toBe('real_runtime_v3_partial');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.step1_observable_evidence).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('step1_observable_evidence');
    expect(manifest.runtime_evidence_blocked_by_id).toContain('step1_observable_evidence');
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');

    expect(metrics.step1_observable_evidence_status).toBe('emitted');
    expect(metrics.step1_observable_evidence_gate_status).toBe('insufficient');
    expect(metrics.step1_observable_evidence_summary.forbidden_sources_rejected).toBe(true);
    expect(metrics.next_required_engineering_tasks).toContain('implement real Step1ObservableEvidence extractors and truth linkage');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
  });
});
