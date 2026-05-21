import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  emitModelRunTraceFirstPass,
  emitScoreTraceFirstPass,
  emitTechniqueObservationTraceFirstPass,
} from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('v3 s9 score technique model-run proof bundle', () => {
  it('promotes structured Step 2 score projection to internal score proof while public scoring stays blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19c-score-'));
    const run = 'r19c-score';
    const out = await emitScoreTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 's',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      internal_qa_emit: true,
      root_dir: root,
      structured_step2_score_data: {
        source_artefact_id: 'structured_step2_score_projection',
        selected_level: 'advanced',
        audition_type: 'monologue',
        score_entries: [{
          score_name: 'acting',
          score_scope: 'discipline_attribute',
          score_value: 88,
          source_path: 'structured_step2_score_data.score_entries[0]',
          linked_evidence_anchor_ids: ['ea-score-1'],
          linked_truth_state_ids: [`${run}:truth_state:selected_level`, `${run}:truth_state:audition_type`],
        }],
      },
      evidence_anchors_data: {
        anchors: [{
          evidence_anchor_id: 'ea-score-1',
          source_family: 'real_runtime_v3',
          cannot_satisfy_v3_gate: false,
          linked_truth_state_ids: [`${run}:truth_state:selected_level`, `${run}:truth_state:audition_type`],
        }],
      },
      truth_state_map_data: {
        truth_state_entries: [
          { truth_state_entry_id: `${run}:truth_state:selected_level`, key: 'selected_level', state: 'known' },
          { truth_state_entry_id: `${run}:truth_state:audition_type`, key: 'audition_type', state: 'known' },
        ],
      },
    });

    expect(out.written).toBe(true);
    expect(out.source_classification).toBe('real_runtime_v3_internal_score_proof');
    expect(out.level2_satisfies).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'ScoreTrace.json'), 'utf8'));
    expect(payload.score_trace_summary.score_trace_gate_status).toBe('satisfied');
    expect(payload.score_entries[0].source_family).toBe('real_runtime_v3_internal_score_proof');
    expect(payload.score_entries[0].linked_evidence_anchor_ids).toEqual(['ea-score-1']);
    expect(payload.score_entries[0].linked_truth_state_ids).toEqual([`${run}:truth_state:selected_level`, `${run}:truth_state:audition_type`]);
    expect(payload.score_entries[0].public_scoring_status).toBe('blocked');
    expect(payload.overall_readiness_public_score_status).toBe('blocked');
  });

  it('keeps raw-report score fields legacy-only even when structured proof is absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19c-score-'));
    const out = await emitScoreTraceFirstPass({
      run_id: 'r19c-legacy-score',
      analysis_run_id: 'r19c-legacy-score',
      submission_id: 's',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { report_data: { overall_score: 91, scores: { acting: 88 } } },
      internal_qa_emit: true,
      root_dir: root,
    });

    expect(out.written).toBe(true);
    expect(out.source_classification).toBe('legacy_adapter');
    expect(out.level2_satisfies).toBe(false);
  });

  it('promotes Step1 candidate-technique evidence to internal technique proof while public technique authority stays blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19c-tech-'));
    const run = 'r19c-tech';
    const truthId = `${run}:truth_state:candidate_technique_internal_shadow_001`;
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 's',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      internal_qa_emit: true,
      root_dir: root,
      analysis_evidence_state_data: {
        run_id: run,
        analysis_run_id: run,
        take_id: 't1',
        candidate_technique_evidence: [{
          evidence_family: 'candidate_technique',
          evidence_kind: 'candidate_technique_internal_shadow',
          source_artefact_id: 'run_evidence_pass',
          safe_evidence_summary: 'Internal shadow candidate technique descriptor observed.',
          linked_truth_state_ids: [truthId],
          blocker_codes: [],
        }],
      },
      evidence_anchors_data: {
        anchors: [{
          evidence_anchor_id: 'ea-tech-1',
          source_family: 'real_runtime_v3',
          source_artefact_id: 'analysis_evidence_state',
          source_path: 'candidate_technique_evidence[0]',
          cannot_satisfy_v3_gate: false,
          linked_truth_state_ids: [truthId],
        }],
      },
      truth_state_map_data: {
        truth_state_entries: [{ truth_state_entry_id: truthId, key: 'candidate_technique_internal_shadow', state: 'observed' }],
      },
    });

    expect(out.written).toBe(true);
    expect(out.source_classification).toBe('real_runtime_v3_internal_technique_observation');
    expect(out.level2_satisfies).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    expect(payload.technique_observation_trace_gate_status).toBe('satisfied');
    expect(payload.public_technique_authority_status).toBe('blocked');
    expect(payload.observations[0].source_family).toBe('real_runtime_v3_internal_technique_observation');
    expect(payload.observations[0].linked_evidence_anchor_ids).toEqual(['ea-tech-1']);
    expect(payload.observations[0].linked_truth_state_ids).toEqual([truthId]);
    expect(payload.observations[0].public_display_status).toBe('internal_only');
  });

  it('emits per-stage ModelRunTrace proof metadata without prompts, responses or secrets', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19c-model-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'r19c-model',
      analysis_run_id: 'r19c-model',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      analysis_route: 'two_step',
      internal_qa_emit: true,
      root_dir: root,
      model_run_entries: [
        {
          model_run_id: 'mr-step1',
          stage: 'analysis_step_1_evidence_pass',
          invocation_status: 'invoked',
          model_provider: 'openai',
          model_name: 'safe-step1-model',
          request_status: 'completed',
          parse_status: 'completed',
          input_artifact_refs: ['inputs/input_record.json'],
          output_artifact_refs: ['analysis/Step1ObservableEvidence.json'],
          raw_prompt_or_response_stored: false,
          secrets_or_signed_urls_stored: false,
        },
        {
          model_run_id: 'mr-step2',
          stage: 'analysis_step_2_judgement_or_report_polish',
          invocation_status: 'invoked',
          model_provider: 'openai',
          model_name: 'safe-step2-model',
          request_status: 'completed',
          parse_status: 'completed',
          input_artifact_refs: ['analysis/AnalysisEvidenceState.json'],
          output_artifact_refs: ['reports/raw_report.json'],
          raw_prompt_or_response_stored: false,
          secrets_or_signed_urls_stored: false,
        },
      ],
    });

    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r19c-model', 'takes', 'take-t1', 'analysis-r19c-model', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.source_classification).toBe('model_run_metadata_partial');
    expect(payload.independent_model_proof_status).toBe('independent_model_proof_partial');
    expect(payload.per_stage_model_proof_status).toBe('per_stage_model_proof_partial');
    expect(payload.model_run_entries.map((entry: any) => entry.stage)).toEqual(expect.arrayContaining([
      'analysis_step_1_evidence_pass',
      'analysis_step_2_judgement_or_report_polish',
      'validator',
    ]));
    expect(payload.raw_prompt_or_response_stored).toBe(false);
    expect(payload.secrets_or_signed_urls_stored).toBe(false);
    expect(payload.model_run_trace_summary.model_run_trace_gate_status).toBe('insufficient');
  });

  it('surfaces S9-19C classifications in metrics without unblocking public or production gates', () => {
    const metrics = buildQAAcceptanceMetrics({
      run_id: 'r19c-metrics',
      analysis_run_id: 'r19c-metrics',
      submission_id: 'sub',
      take_id: 't1',
      compared_take_ids: ['t1'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      required_artifacts: [],
      emitted_artifacts: ['score_trace', 'technique_observation_trace', 'model_run_trace'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: [],
      blocker_codes: [],
      artefact_status_by_id: {
        score_trace: 'emitted',
        technique_observation_trace: 'emitted',
        model_run_trace: 'emitted',
      },
      artefact_source_classification_by_id: {
        score_trace: 'real_runtime_v3_internal_score_proof',
        technique_observation_trace: 'real_runtime_v3_internal_technique_observation',
        model_run_trace: 'model_run_metadata_partial',
      },
      artefact_level2_spine_satisfaction_by_id: {
        score_trace: true,
        technique_observation_trace: true,
        model_run_trace: false,
      },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
      score_trace_summary: {
        score_count: 1,
        overall_count: 0,
        discipline_attribute_count: 1,
        component_score_count: 0,
        component_weight_count: 0,
        brief_adherence_subscore_count: 0,
        assessment_confidence_count: 0,
        calibration_modifier_count: 0,
        calibration_metadata_count: 0,
        source_family_summary: { legacy_adapter: 0, report_snapshot: 0, real_runtime_v3: 1, input_artifact: 0, resolver_truth_state: 0 },
        real_runtime_v3_internal_score_entry_count: 1,
        overall_readiness_public_score_status: 'blocked',
        discipline_attribute_score_trace_status: 'real_runtime_v3_internal_trace',
        score_trace_gate_status: 'satisfied',
        score_trace_gate_reason: 'real_runtime_v3_internal_score_projection_linked',
      },
      technique_observation_trace_summary: {
        legacy_adapter: 0,
        report_snapshot: 0,
        real_runtime_v3: 1,
        input_artifact: 0,
        resolver_truth_state: 0,
        technique_observation_trace_gate_status: 'satisfied',
        technique_observation_trace_gate_reason: 'real_runtime_v3_internal_technique_observations_linked',
        real_runtime_v3_internal_technique_observation_count: 1,
        satisfying_internal_technique_observation_count: 1,
        public_technique_authority_status: 'blocked',
      },
      model_run_trace_summary: {
        model_run_count: 3,
        model_run_completed_count: 2,
        model_run_failed_count: 0,
        model_run_timeout_count: 0,
        model_run_fallback_count: 0,
        invoked_stage_count: 2,
        skipped_stage_count: 1,
        not_applicable_stage_count: 0,
        model_run_trace_gate_status: 'insufficient',
        independent_model_proof_status: 'independent_model_proof_partial',
        per_stage_model_proof_status: 'per_stage_model_proof_partial',
        raw_prompt_or_response_stored: false,
        secrets_or_signed_urls_stored: false,
        forbidden_payload_fields_absent: true,
      },
    } as any);

    expect(metrics.score_trace_gate_status).toBe('satisfied');
    expect(metrics.score_trace_internal_proof_status).toBe('real_runtime_v3_internal_score_proof');
    expect(metrics.technique_observation_gate_status).toBe('satisfied');
    expect(metrics.technique_observation_internal_proof_status).toBe('real_runtime_v3_internal_technique_proof');
    expect(metrics.model_run_trace_independent_model_proof_status).toBe('independent_model_proof_partial');
    expect(metrics.model_run_trace_gate_status).toBe('insufficient');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
  });
});
