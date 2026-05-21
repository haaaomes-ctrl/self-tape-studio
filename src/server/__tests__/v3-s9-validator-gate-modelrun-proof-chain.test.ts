import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitGateTraceFirstPass, emitModelRunTraceFirstPass, emitValidatorTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('v3 s9 validator gate model-run proof-chain posture', () => {
  const baseSnapshot = {
    run_id: 'run-proof-chain',
    analysis_run_id: 'run-proof-chain',
    take_id: 'take-a',
    source_module: 'test',
    source_stage: 'unit',
    manifest_snapshot: {
      level2_qa_acceptance: 'not_accepted',
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
    },
    acceptance_metrics_snapshot: {
      level2_status: 'not_accepted',
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
    },
    emitted_artefact_ids: ['validator_trace', 'model_run_trace'],
    internal_qa_emit: true,
  } as const;

  it('keeps internal ValidatorTrace insufficient without independent proof-chain validation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-validator-'));
    const out = await emitValidatorTraceFirstPass({ ...baseSnapshot, root_dir: root });
    expect(out.written).toBe(true);

    const payload = JSON.parse(await readFile(path.join(root, 'run-proof-chain', 'takes', 'take-take-a', 'analysis-run-proof-chain', 'traces', 'ValidatorTrace.json'), 'utf8'));
    expect(payload.source_classification).toBe('internal_validator');
    expect(payload.validator_trace_gate_status).toBe('insufficient');
    expect(payload.independent_validation_status).toBe('independent_validation_partial');
    expect(payload.referential_integrity_status).toBe('partial_snapshot_checks');
    expect(payload.cannot_satisfy_level2_validator_gate).toBe(true);
    expect(payload.blocker_codes).toContain('ValidatorTrace_internal_only');
    expect(payload.public_scoring_status).toBe('blocked');
    expect(payload.public_technique_authority_status).toBe('blocked');
    expect(payload.production_safe_status).toBe('blocked');
    expect(payload.validation_entries.map((entry: any) => entry.validation_rule_version)).toEqual(expect.arrayContaining([
      's9-18h-internal-snapshot-v1',
      's9-19b-ordinary-analysis-proof-chain-v1',
    ]));
  });

  it('keeps internal GateTrace insufficient and blocks public output permissions', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-gate-'));
    const out = await emitGateTraceFirstPass({ ...baseSnapshot, root_dir: root });
    expect(out.written).toBe(true);

    const payload = JSON.parse(await readFile(path.join(root, 'run-proof-chain', 'takes', 'take-take-a', 'analysis-run-proof-chain', 'traces', 'GateTrace.json'), 'utf8'));
    expect(payload.source_classification).toBe('internal_gate_trace');
    expect(payload.gate_trace_gate_status).toBe('insufficient');
    expect(payload.independent_gate_decision_status).toBe('independent_gate_partial');
    expect(payload.cannot_satisfy_level2_gate_trace_gate).toBe(true);
    expect(payload.blocker_codes).toContain('GateTrace_internal_only');
    expect(payload.level2_status).toBe('not_accepted');
    expect(payload.production_safe_status).toBe('blocked');
    expect(payload.public_output_permissions).toEqual({
      show_overall_score: false,
      show_public_technique_names: false,
      show_repertoire_claims: false,
      show_comparison_recommendation: false,
      show_public_report: false,
    });
    expect(payload.gate_entries.map((entry: any) => entry.gate_id)).toEqual(expect.arrayContaining([
      'public_scoring_gate',
      'public_technique_authority_gate',
      'public_comparison_recommendation_gate',
      'production_safe_gate',
      'ordinary_analysis_step1_evidence_gate',
      'analysis_evidence_state_gate',
      'evidence_anchor_aggregate_gate',
      'public_claim_support_gate',
      'score_trace_gate',
      'technique_observation_trace_gate',
      'report_parity_gate',
      'no_export_gate',
      'ordinary_comparison_not_applicable_gate',
    ]));
  });

  it('keeps partial ModelRunTrace insufficient and stores no raw prompts or responses', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-modelrun-'));
    const out = await emitModelRunTraceFirstPass({
      run_id: 'run-proof-chain',
      analysis_run_id: 'run-proof-chain',
      take_id: 'take-a',
      source_module: 'test',
      source_stage: 'analysis_step_2',
      analysis_route: 'runProcessTake',
      internal_qa_emit: true,
      root_dir: root,
      model_run_entries: [{
        model_run_id: 'mr-1',
        model_provider: 'openai',
        model_name: 'safe-model-ref',
        source_stage: 'analysis_step_2',
        request_status: 'completed',
        parse_status: 'completed',
        duration_ms: 1234,
        timeout_ms: 30000,
      }],
    });
    expect(out.written).toBe(true);

    const payload = JSON.parse(await readFile(path.join(root, 'run-proof-chain', 'takes', 'take-take-a', 'analysis-run-proof-chain', 'traces', 'ModelRunTrace.json'), 'utf8'));
    expect(payload.source_classification).toBe('model_run_metadata_partial');
    expect(payload.model_run_trace_summary.model_run_trace_gate_status).toBe('insufficient');
    expect(payload.independent_model_proof_status).toBe('independent_model_proof_partial');
    expect(payload.per_stage_model_proof_status).toBe('per_stage_model_proof_partial');
    expect(payload.raw_prompt_or_response_stored).toBe(false);
    expect(payload.secrets_or_signed_urls_stored).toBe(false);
    expect(payload.forbidden_fields_absent).toBe(true);
    expect(payload.model_run_entries.some((entry: any) => 'raw_prompt' in entry || 'raw_response' in entry || 'request_body' in entry)).toBe(false);
    expect(payload.model_run_entries.every((entry: any) => entry.raw_prompt_or_response_stored === false)).toBe(true);
    expect(payload.model_run_entries.map((entry: any) => entry.stage)).toEqual(expect.arrayContaining([
      'analysis_step_1_evidence_pass',
      'analysis_step_2_judgement_or_report_polish',
      'validator',
    ]));
    expect(payload.model_run_entries.some((entry: any) => entry.independent_model_proof_status === 'per_stage_metadata_partial')).toBe(true);
    expect(payload.cannot_satisfy_model_run_gate).toBe(true);
  });

  it('surfaces proof-chain posture in metrics without accepting Level 2', () => {
    const metrics = buildQAAcceptanceMetrics({
      run_id: 'run-proof-chain',
      analysis_run_id: 'run-proof-chain',
      submission_id: 'sub',
      take_id: 'take-a',
      compared_take_ids: ['take-a'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      required_artifacts: [],
      emitted_artifacts: ['validator_trace', 'gate_trace', 'model_run_trace'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: [],
      blocker_codes: [],
      artefact_status_by_id: { validator_trace: 'emitted', gate_trace: 'emitted', model_run_trace: 'emitted' },
      artefact_source_classification_by_id: {
        validator_trace: 'internal_validator',
        gate_trace: 'internal_gate_trace',
        model_run_trace: 'internal_model_run_trace',
      },
      artefact_level2_spine_satisfaction_by_id: {
        validator_trace: false,
        gate_trace: false,
        model_run_trace: false,
      },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
      validator_trace_summary: {
        validation_count: 4,
        pass_count: 4,
        warning_count: 0,
        fail_count: 0,
        blocked_count: 0,
        independent_validation_status: 'internal_snapshot_only_insufficient',
        referential_integrity_status: 'not_run',
      },
      gate_trace_summary: {
        gate_count: 7,
        passed_gate_count: 0,
        blocked_gate_count: 5,
        insufficient_gate_count: 2,
        missing_gate_count: 0,
        not_applicable_gate_count: 0,
        independent_gate_decision_status: 'internal_snapshot_only_insufficient',
        public_output_permissions: {
          show_overall_score: false,
          show_public_technique_names: false,
          show_repertoire_claims: false,
          show_comparison_recommendation: false,
          show_public_report: false,
        },
      },
      model_run_trace_summary: {
        model_run_count: 1,
        model_run_completed_count: 1,
        model_run_failed_count: 0,
        model_run_timeout_count: 0,
        model_run_fallback_count: 0,
        independent_model_proof_status: 'metadata_only_insufficient',
        per_stage_model_proof_status: 'partial_metadata_only',
        raw_prompt_or_response_stored: false,
        secrets_or_signed_urls_stored: false,
        forbidden_payload_fields_absent: true,
      },
    } as any);

    expect(metrics.validator_trace_gate_status).toBe('insufficient');
    expect(metrics.validator_trace_independent_validation_status).toBe('internal_snapshot_only_insufficient');
    expect(metrics.validator_trace_referential_integrity_status).toBe('not_run');
    expect(metrics.gate_trace_gate_status).toBe('insufficient');
    expect(metrics.gate_trace_independent_gate_decision_status).toBe('internal_snapshot_only_insufficient');
    expect(metrics.gate_trace_public_output_permissions.show_overall_score).toBe(false);
    expect(metrics.gate_trace_public_output_permissions.show_public_technique_names).toBe(false);
    expect(metrics.gate_trace_public_output_permissions.show_comparison_recommendation).toBe(false);
    expect(metrics.model_run_trace_gate_status).toBe('insufficient');
    expect(metrics.model_run_trace_independent_model_proof_status).toBe('metadata_only_insufficient');
    expect(metrics.model_run_raw_prompt_or_response_stored).toBe(false);
    expect(metrics.model_run_secrets_or_signed_urls_stored).toBe(false);
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});
