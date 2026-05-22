import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { emitAnalysisInputArtefacts, emitQAManifestForAnalysisRun, emitRawReportArtefact, emitResolverOutputAndTruthStateMap } from '@/server/v3/qa-artifacts-wiring.server';
import * as qaArtifactsModule from '@/server/v3/qa-artifacts.server';
import * as qaSinkModule from '@/server/v3/qa-artifact-sink.server';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('v3 s9 qa acceptance metrics', () => {
  it('populates score trace counters from manifest score_trace_summary', () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report','score_trace'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted', score_trace: 'emitted' }, artefact_source_classification_by_id: { score_trace: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { score_trace: false }, legacy_adapter_artefact_ids: ['raw_report','score_trace'], real_v3_spine_artefact_ids: [], score_trace_summary: { score_count: 8, overall_count: 3, discipline_attribute_count: 2, component_score_count: 1, component_weight_count: 0, brief_adherence_subscore_count: 1, assessment_confidence_count: 1, calibration_modifier_count: 1, calibration_metadata_count: 2, source_family_summary: { legacy_adapter: 8, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 }, overall_readiness_public_score_status: 'blocked', discipline_attribute_score_trace_status: 'internal_trace_only', score_trace_gate_status: 'insufficient', score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace' } };
    const m = qaArtifactsModule.buildQAAcceptanceMetrics(manifest as any);
    expect(m.score_trace_status).toBe('emitted');
    expect(m.score_trace_count).toBe(8);
    expect(m.score_trace_overall_count).toBe(3);
    expect(m.score_trace_discipline_attribute_count).toBe(2);
    expect(m.score_trace_component_score_count).toBe(1);
    expect(m.score_trace_brief_adherence_subscore_count).toBe(1);
    expect(m.score_trace_calibration_metadata_count).toBe(2);
    expect(m.score_trace_gate_status).toBe('insufficient');
    expect(m.score_trace_gate_reason).toBe('legacy_report_snapshot_not_real_runtime_score_trace');
    expect(m.overall_readiness_public_score_status).toBe('blocked');
    expect(m.public_scoring_status).toBe('blocked');
    expect(m.level2_status).toBe('not_accepted');
  });

  it('keeps emitted legacy score and technique traces insufficient in acceptance metrics', () => {
    const manifest = {
      run_id: 'r',
      analysis_run_id: 'r',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      emitted_artifacts: ['score_trace', 'technique_observation_trace'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      blocker_codes: [],
      required_artifacts: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: [],
      artefact_status_by_id: { score_trace: 'emitted', technique_observation_trace: 'emitted' },
      artefact_source_classification_by_id: { score_trace: 'legacy_adapter', technique_observation_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { score_trace: false, technique_observation_trace: false },
      legacy_adapter_artefact_ids: ['score_trace', 'technique_observation_trace'],
      real_v3_spine_artefact_ids: [],
      score_trace_summary: {
        score_count: 1,
        overall_count: 1,
        discipline_attribute_count: 0,
        component_score_count: 0,
        component_weight_count: 0,
        brief_adherence_subscore_count: 0,
        assessment_confidence_count: 0,
        calibration_modifier_count: 0,
        calibration_metadata_count: 0,
        source_family_summary: { legacy_adapter: 1, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 },
        overall_readiness_public_score_status: 'blocked',
        discipline_attribute_score_trace_status: 'internal_trace_only',
        score_trace_gate_status: 'insufficient',
        score_trace_gate_reason: 'legacy_report_snapshot_not_real_runtime_score_trace',
      },
      technique_observation_trace_summary: { legacy_adapter: 1, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0 },
    };
    const metrics = qaArtifactsModule.buildQAAcceptanceMetrics(manifest as any);
    expect(metrics.score_trace_status).toBe('emitted');
    expect(metrics.score_trace_gate_status).toBe('insufficient');
    expect(metrics.technique_observation_trace_status).toBe('emitted');
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.technique_observation_gate_reason).toBe('legacy_report_snapshot_not_real_runtime_technique_evidence');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('distinguishes missing validator/gate traces from emitted-but-insufficient follow-up tasks', () => {
    const base: any = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], generated_at: new Date().toISOString(), qa_artifact_root: 'x', required_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], blocker_codes: [], artefact_source_classification_by_id: {}, artefact_level2_spine_satisfaction_by_id: {}, legacy_adapter_artefact_ids: [], real_v3_spine_artefact_ids: [], artefact_status_by_id: { evidence_anchors: 'missing', public_claim_trace: 'missing', technique_observation_trace: 'missing', score_trace: 'missing', validator_trace: 'missing', gate_trace: 'missing' }, emitted_artifacts: [], missing_artifacts: ['validator_trace', 'gate_trace'] };
    const missing = qaArtifactsModule.buildQAAcceptanceMetrics(base);
    expect(missing.next_required_engineering_tasks).toContain('ValidatorTrace');
    expect(missing.next_required_engineering_tasks).toContain('GateTrace');

    const emitted = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base,
      emitted_artifacts: ['validator_trace', 'gate_trace'],
      missing_artifacts: [],
      artefact_status_by_id: { ...base.artefact_status_by_id, validator_trace: 'emitted', gate_trace: 'emitted' },
      validator_trace_summary: { validation_count: 2, pass_count: 1, warning_count: 1, fail_count: 0, blocked_count: 0 },
      gate_trace_summary: { gate_count: 2, passed_gate_count: 0, blocked_gate_count: 1, insufficient_gate_count: 1, missing_gate_count: 0, not_applicable_gate_count: 0 },
    });
    expect(emitted.next_required_engineering_tasks).not.toContain('ValidatorTrace');
    expect(emitted.next_required_engineering_tasks).not.toContain('GateTrace');
    expect(emitted.next_required_engineering_tasks).toContain('independent runtime validator proof chain');
    expect(emitted.next_required_engineering_tasks).toContain('independent runtime gate proof chain');
    expect(emitted.next_required_engineering_tasks).toContain('ModelRunTrace');
  });

  it('derives model run counters and tasks from manifest model_run_trace_summary', () => {
    const base: any = {
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], generated_at: new Date().toISOString(), qa_artifact_root: 'x',
      required_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [],
      artefact_source_classification_by_id: { model_run_trace: 'internal_model_run_trace' }, artefact_level2_spine_satisfaction_by_id: { model_run_trace: false }, legacy_adapter_artefact_ids: [], real_v3_spine_artefact_ids: [],
    };
    const emitted = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base, emitted_artifacts: ['model_run_trace'], missing_artifacts: [], blocker_codes: [],
      artefact_status_by_id: { model_run_trace: 'emitted' },
      model_run_trace_summary: { model_run_count: 2, model_run_completed_count: 1, model_run_failed_count: 1, model_run_timeout_count: 0, model_run_fallback_count: 1, model_run_trace_gate_reason: 'runtime_metadata_without_independent_model_proof_chain' },
    });
    expect(emitted.model_run_trace_status).toBe('emitted');
    expect(emitted.model_run_trace_gate_status).toBe('insufficient');
    expect(emitted.model_run_count).toBe(2);
    expect(emitted.model_run_completed_count).toBe(1);
    expect(emitted.model_run_failed_count).toBe(1);
    expect(emitted.model_run_fallback_count).toBe(1);
    expect(emitted.next_required_engineering_tasks).toContain('independent model-run proof chain');
    expect(emitted.next_required_engineering_tasks).not.toContain('ModelRunTrace');

    const missing = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base, emitted_artifacts: [], missing_artifacts: ['model_run_trace'], blocker_codes: ['ModelRunTrace_missing'], artefact_status_by_id: { model_run_trace: 'missing' },
    });
    expect(missing.model_run_trace_status).toBe('missing');
    expect(missing.model_run_count).toBe(0);
    expect(missing.next_required_engineering_tasks).toContain('ModelRunTrace');
  });

  it('derives report parity status and follow-up tasks from the final parity artefact state', () => {
    const base: any = {
      run_id: 'r',
      analysis_run_id: 'r',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      required_artifacts: [],
      emitted_artifacts: ['no_export_proof'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: [],
      blocker_codes: [],
      artefact_source_classification_by_id: { parity_report: 'internal_report_parity_proof' },
      artefact_level2_spine_satisfaction_by_id: {},
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
      no_export_status: 'no_export_proof_complete',
    };

    const passed = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base,
      emitted_artifacts: ['no_export_proof', 'parity_report'],
      artefact_status_by_id: { parity_report: 'emitted' },
      artefact_level2_spine_satisfaction_by_id: { parity_report: true },
      report_parity_summary: { parity_status: 'passed' },
    });
    expect(passed.render_parity_status).toBe('passed');
    expect(passed.report_parity_status).toBe('passed');
    expect(passed.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(passed.next_required_engineering_tasks).not.toContain('report parity proof');
    expect(passed.next_required_engineering_tasks).not.toContain('parity and no-export proof');
    expect(passed.level2_status).toBe('not_accepted');
    expect(passed.production_safe_status).toBe('blocked');
    expect(passed.public_scoring_status).toBe('blocked');
    expect(passed.public_technique_authority_status).toBe('blocked');

    const failed = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base,
      emitted_blocked_artefact_ids: ['parity_report'],
      blocker_codes: ['parity_artefacts_missing'],
      artefact_status_by_id: { parity_report: 'emitted_blocked' },
      artefact_level2_spine_satisfaction_by_id: { parity_report: false },
      report_parity_summary: { parity_status: 'failed' },
    });
    expect(failed.render_parity_status).toBe('failed');
    expect(failed.report_parity_status).toBe('failed');
    expect(failed.blocker_codes).toContain('parity_artefacts_missing');
    expect(failed.next_required_engineering_tasks).toContain('report parity proof');

    const insufficient = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base,
      emitted_blocked_artefact_ids: ['parity_report'],
      blocker_codes: ['parity_artefacts_missing'],
      artefact_status_by_id: { parity_report: 'emitted_blocked' },
      artefact_level2_spine_satisfaction_by_id: { parity_report: false },
      report_parity_summary: { parity_status: 'insufficient' },
    });
    expect(insufficient.render_parity_status).toBe('insufficient');
    expect(insufficient.report_parity_status).toBe('insufficient');
    expect(insufficient.blocker_codes).toContain('parity_artefacts_missing');

    const missing = qaArtifactsModule.buildQAAcceptanceMetrics({
      ...base,
      missing_artifacts: ['parity_report'],
      blocker_codes: ['parity_artefacts_missing'],
      artefact_status_by_id: { parity_report: 'missing' },
    });
    expect(missing.render_parity_status).toBe('missing');
    expect(missing.report_parity_status).toBe('missing');
    expect(missing.blocker_codes).toContain('parity_artefacts_missing');
  });

  it('keeps fallback AnalysisEvidenceState summary truthful for emitted and blocked statuses', () => {
    const base: any = {
      run_id: 'r',
      analysis_run_id: 'r',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      required_artifacts: [],
      emitted_artifacts: [],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: [],
      blocker_codes: [],
      artefact_source_classification_by_id: { analysis_evidence_state: 'real_runtime_v3_partial' },
      artefact_level2_spine_satisfaction_by_id: { analysis_evidence_state: false },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
    };
    const cases = [
      ['emitted', 'partial', 'insufficient'],
      ['emitted_blocked', 'blocked', 'insufficient'],
      ['failed_emission', 'failed', 'insufficient'],
      ['missing', 'unavailable', 'missing'],
    ] as const;

    for (const [artefactStatus, evidenceStateStatus, gateStatus] of cases) {
      const metrics = qaArtifactsModule.buildQAAcceptanceMetrics({
        ...base,
        artefact_status_by_id: { analysis_evidence_state: artefactStatus },
      });
      expect(metrics.analysis_evidence_state_status).toBe(artefactStatus);
      expect(metrics.analysis_evidence_state_summary.evidence_state_status).toBe(evidenceStateStatus);
      expect(metrics.analysis_evidence_state_gate_status).toBe(gateStatus);
      expect(metrics.level2_status).toBe('not_accepted');
      expect(metrics.production_safe_status).toBe('blocked');
      if (artefactStatus !== 'missing') {
        expect(metrics.analysis_evidence_state_summary.evidence_state_status).not.toBe('unavailable');
      }
    }
  });

  it('labels emitted-blocked partial AnalysisEvidenceState as insufficient rather than missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s916e-aes-partial-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-s916e-aes-partial',
      analysis_run_id: 'run-s916e-aes-partial',
      take_id: 't-aes',
      compared_take_ids: ['t-aes'],
      comparison_run_id: null,
      submission_id: 'sub-aes',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
      emitted_blocked_artefact_ids: ['analysis_evidence_state'],
      artefact_source_classification_by_id: {
        raw_report: 'legacy_adapter',
        analysis_evidence_state: 'real_runtime_v3_partial',
      },
      artefact_level2_spine_satisfaction_by_id: {
        raw_report: false,
        analysis_evidence_state: false,
      },
      analysis_evidence_state_summary: {
        evidence_state_status: 'partial',
        source_classification: 'real_runtime_v3_partial',
        observable_evidence_item_count: 2,
        unsupported_or_unavailable_evidence_count: 1,
        analysis_evidence_state_gate_status: 'insufficient',
        analysis_evidence_state_gate_reason: 'partial_runtime_evidence_not_level2_satisfying',
      },
    });

    const manifest = JSON.parse(await readFile(path.join(root, 'run-s916e-aes-partial', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-s916e-aes-partial', 'qa', 'acceptance_metrics.json'), 'utf8'));
    const required = manifest.required_artifacts.find((artefact: any) => artefact.artefact_id === 'analysis_evidence_state');

    expect(required?.status).toBe('emitted_blocked');
    expect(required?.blocker_code).toBe('AnalysisEvidenceState_insufficient');
    expect(manifest.blocker_codes).toContain('AnalysisEvidenceState_insufficient');
    expect(manifest.blocker_codes).not.toContain('AnalysisEvidenceState_missing');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.blocker_codes).not.toContain('AnalysisEvidenceState_missing');
    expect(metrics.analysis_evidence_state_status).toBe('emitted_blocked');
    expect(metrics.analysis_evidence_state_summary.evidence_state_status).toBe('partial');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('keeps truly missing AnalysisEvidenceState labelled as missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s916e-aes-missing-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-s916e-aes-missing',
      analysis_run_id: 'run-s916e-aes-missing',
      take_id: 't-aes-missing',
      compared_take_ids: ['t-aes-missing'],
      comparison_run_id: null,
      submission_id: 'sub-aes',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false },
    });

    const manifest = JSON.parse(await readFile(path.join(root, 'run-s916e-aes-missing', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-s916e-aes-missing', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.required_artifacts.find((artefact: any) => artefact.artefact_id === 'analysis_evidence_state')?.blocker_code).toBe('AnalysisEvidenceState_missing');
    expect(manifest.blocker_codes).toContain('AnalysisEvidenceState_missing');
    expect(metrics.blocker_codes).toContain('AnalysisEvidenceState_missing');
  });

  it('reports partial real-runtime EvidenceAnchors in metrics without satisfying the gate', () => {
    const metrics = qaArtifactsModule.buildQAAcceptanceMetrics({
      run_id: 'r',
      analysis_run_id: 'r',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      emitted_artifacts: ['evidence_anchors'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      blocker_codes: [],
      required_artifacts: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: ['evidence_anchors'],
      artefact_status_by_id: { evidence_anchors: 'emitted' },
      artefact_source_classification_by_id: { evidence_anchors: 'real_runtime_v3_partial_non_satisfying' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: false },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
    } as any);

    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBe(1);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(0);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('uses EvidenceAnchors runtime count fields when nested source family summary is absent', () => {
    const metrics = qaArtifactsModule.buildQAAcceptanceMetrics({
      run_id: 'r-counts',
      analysis_run_id: 'r-counts',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      emitted_artifacts: ['evidence_anchors'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      blocker_codes: [],
      required_artifacts: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: ['evidence_anchors'],
      artefact_status_by_id: { evidence_anchors: 'emitted' },
      artefact_source_classification_by_id: { evidence_anchors: 'real_runtime_v3_partial_non_satisfying' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: false },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
      evidence_anchor_trace_summary: {
        evidence_anchor_gate_status: 'insufficient',
        real_runtime_anchor_count: 4,
        legacy_adapter_anchor_count: 0,
        report_snapshot_anchor_count: 0,
        input_artifact_anchor_count: 1,
        resolver_truth_state_anchor_count: 1,
        source_scaffold_anchor_count: 0,
      },
    } as any);

    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBe(4);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(0);
    expect(metrics.evidence_anchor_source_family_summary.input_artifact).toBe(1);
    expect(metrics.evidence_anchor_source_family_summary.resolver_truth_state).toBe(1);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('partial_runtime_facts_present_but_extractor_coverage_incomplete');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('prefers EvidenceAnchors nested real-runtime source family summary over classification fallback', () => {
    const metrics = qaArtifactsModule.buildQAAcceptanceMetrics({
      run_id: 'r-source-summary',
      analysis_run_id: 'r-source-summary',
      submission_id: 's',
      take_id: 't',
      compared_take_ids: ['t'],
      comparison_run_id: null,
      generated_at: new Date().toISOString(),
      qa_artifact_root: 'x',
      emitted_artifacts: ['evidence_anchors'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      blocker_codes: [],
      required_artifacts: [],
      runtime_evidence_accepted_by_id: [],
      runtime_evidence_blocked_by_id: ['evidence_anchors'],
      artefact_status_by_id: { evidence_anchors: 'emitted' },
      artefact_source_classification_by_id: { evidence_anchors: 'real_runtime_v3_partial_non_satisfying' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: false },
      legacy_adapter_artefact_ids: [],
      real_v3_spine_artefact_ids: [],
      evidence_anchor_trace_summary: {
        evidence_anchor_gate_status: 'insufficient',
        evidence_anchor_gate_reason: 'partial_runtime_facts_present_but_extractor_coverage_incomplete',
        real_runtime_anchor_count: 8,
        source_family_summary: {
          real_runtime_v3: 8,
          legacy_adapter: 0,
          report_snapshot: 0,
          input_artifact: 3,
          resolver_truth_state: 2,
        },
      },
    } as any);

    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBe(8);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(0);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('partial_runtime_facts_present_but_extractor_coverage_incomplete');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('emits qa/acceptance_metrics.json and marks manifest emitted without changing L2 acceptance', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s905-'));
    const run = 'run-s905'; const take = 'tk1';
    const input = await emitAnalysisInputArtefacts({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    const resolver = await emitResolverOutputAndTruthStateMap({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', brief_presence: 'supplied', material_presence: 'unknown', internal_qa_emit: true, root_dir: root });
    await emitRawReportArtefact({ run_id: run, take_id: take, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: { schema_version: 'v1-legacy', fix_first: '', priority_fixes: ['a'], strengths: ['Technically'], casting_headline: '', overall_score: 88 }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', ...input.emitted_artefact_ids, ...resolver.emitted_artefact_ids], legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [...input.emitted_artefact_ids, ...resolver.emitted_artefact_ids], defect_risk_ids: ['legacy_schema_snapshot', 'legacy_numeric_score_snapshot', 'legacy_report_used_as_v3_spine_proxy', 'legacy_fix_first_field_present', 'priority_fixes_missing', 'legacy_next_take_plan_field_present', 'action_plan_missing', 'malformed_strength_entry', 'empty_casting_headline', 'v3_claim_fields_null', 'public_output_snapshot_missing'] });

    const base = path.join(root, run);
    const metrics = JSON.parse(await readFile(path.join(base, 'qa/acceptance_metrics.json'), 'utf8'));
    const manifest = JSON.parse(await readFile(path.join(base, 'manifest.json'), 'utf8'));
    expect(metrics.artefact_type).toBe('qa_acceptance_metrics');
    expect(metrics.internal_only).toBe(true);
    expect(metrics.qa_spine_reconciliation_version).toBe('s9_19o_minimum_v1');
    expect(manifest.qa_spine_reconciliation_version).toBe('s9_19o_minimum_v1');
    expect(manifest.qa_acceptance_metrics.qa_spine_reconciliation_version).toBe('s9_19o_minimum_v1');
    expect(manifest.ordinary_internal_proof_status).toBe(metrics.ordinary_internal_proof_status);
    expect(manifest.ordinary_internal_blockers).toEqual(metrics.ordinary_internal_blockers);
    expect(manifest.release_blockers).toEqual(metrics.release_blockers);
    expect(manifest.comparison_blockers).toEqual(metrics.comparison_blockers);
    expect(manifest.acceptance_decision).toBe(metrics.acceptance_decision);
    expect(metrics.required_artefact_counts.emitted).toBe(manifest.emitted_artifacts.length);
    expect(manifest.artefact_status_by_id.qa_acceptance_metrics).toBe('emitted');
    expect(manifest.emitted_artifacts).toContain('qa_acceptance_metrics');
    expect(manifest.missing_artifacts).not.toContain('qa_acceptance_metrics');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.acceptance_decision).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.gf01_rt15_status).toBe('not_applicable');
    expect(metrics.legacy_adapter_artefacts).toContain('raw_report');
    expect(metrics.output_quality_defects).toEqual(expect.arrayContaining(['legacy_schema_snapshot', 'legacy_numeric_score_snapshot', 'legacy_report_used_as_v3_spine_proxy', 'legacy_fix_first_field_present', 'priority_fixes_missing', 'legacy_next_take_plan_field_present', 'action_plan_missing', 'malformed_strength_entry', 'empty_casting_headline', 'v3_claim_fields_null', 'public_output_snapshot_missing']));
    const txt = JSON.stringify(metrics).toLowerCase();
    for (const blocked of ['reconciler_secret', 'anon_session_secret', 'mux_token_secret', 'mux_webhook_secret', 'token_secret', 'webhook_secret', 'session_secret']) expect(txt).not.toContain(blocked);
  });

  

  it('preserves sink-specific warning when initial manifest write fails', async () => {
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest').mockResolvedValueOnce({ written: false, warning: 'storage upload failed: bucket/path unavailable' });
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(false);
    expect(out.warning).toContain('storage upload failed: bucket/path unavailable');
    expect(out.warning).not.toBeNull();
  });

  it('returns fallback warning when initial manifest write fails without warning text', async () => {
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest').mockResolvedValueOnce({ written: false });
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(false);
    expect(out.warning).toContain('internal_qa_manifest_sink_write_failed');
  });


  it('continues final manifest emission when initial qa_acceptance_metrics write fails and preserves warning', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    const emitSpy = vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact')
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: false, warning: 'metrics storage write failed' } as any)
      .mockResolvedValueOnce({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(true);
    expect(out.warning).toContain('metrics storage write failed');
    expect(out.warning).toContain('pre_final qa_acceptance_metrics write failed before final manifest emission');
    expect(emitSpy).toHaveBeenCalledTimes(2);
  });

  it('continues final manifest emission when initial qa_acceptance_metrics write fails without warning text', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact')
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: false } as any)
      .mockResolvedValueOnce({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(true);
    expect(out.warning).toContain('pre_final qa_acceptance_metrics write failed before final manifest emission');
  });
it('returns warning from final manifest write failure and never returns written:false with warning:null', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    const emitSpy = vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: false, warning: 'storage final manifest failure' });
    vi.spyOn(qaSinkModule, 'writeQAArtifact').mockResolvedValue({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(emitSpy).toHaveBeenCalledTimes(2);
    expect(out.written).toBe(false);
    expect(out.warning).toContain('storage final manifest failure');
    expect(out.warning).not.toBeNull();
  });

  it('returns fallback warning when final manifest write fails without warning text', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: false });
    vi.spyOn(qaSinkModule, 'writeQAArtifact').mockResolvedValue({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(false);
    expect(out.warning).toContain('final QA manifest write failed after parity/no-export classification');
  });

  

  it('surfaces warning when final qa_acceptance_metrics rewrite fails', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact')
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: false, warning: 'final metrics storage failure' } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.warning).toContain('final metrics storage failure');
    expect(out.warning).not.toBeNull();
    expect(!(out.written === true && out.warning === null)).toBe(true);
  });

  it('returns fallback warning when final qa_acceptance_metrics rewrite fails without warning text', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact')
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: false } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.warning).toContain('final qa_acceptance_metrics rewrite failed after final manifest emission');
    expect(out.warning).not.toBeNull();
  });
it('keeps warning null when final manifest succeeds without warnings', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact').mockResolvedValue({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(true);
    expect(out.warning).toBeNull();
  });

  it('preserves metrics write warning when available', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', compared_take_ids: ['t'], comparison_run_id: null, generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['raw_report'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { raw_report: 'emitted' }, legacy_adapter_artefact_ids: ['raw_report'], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest });
    vi.spyOn(qaSinkModule, 'writeQAArtifact')
      .mockResolvedValueOnce({ written: true, warning: null } as any)
      .mockResolvedValueOnce({ written: true, warning: 'metrics sink warn' } as any)
      .mockResolvedValueOnce({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', take_id: 't', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(true);
    expect(out.warning).toContain('metrics sink warn');
  });

  it('does not fail when take_id is unavailable in storage-mode first-pass trace stage', async () => {
    const manifest = { run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: null, compared_take_ids: [], comparison_run_id: 'cmp-1', generated_at: new Date().toISOString(), qa_artifact_root: 'x', emitted_artifacts: ['comparison_raw'], missing_artifacts: [], emitted_blocked_artefact_ids: [], deferred_artifact_ids: [], not_applicable_artifact_ids: [], blocker_codes: [], required_artifacts: [], runtime_evidence_accepted_by_id: [], runtime_evidence_blocked_by_id: [], artefact_status_by_id: { comparison_raw: 'emitted' }, legacy_adapter_artefact_ids: [], real_v3_spine_artefact_ids: [] };
    vi.spyOn(qaArtifactsModule, 'emitInternalQAArtifactManifest')
      .mockResolvedValueOnce({ written: true, manifest })
      .mockResolvedValueOnce({ written: true, manifest: { ...manifest, emitted_artifacts: ['comparison_raw', 'qa_acceptance_metrics'] } } as any);
    vi.spyOn(qaSinkModule, 'writeQAArtifact').mockResolvedValue({ written: true, warning: null } as any);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'r', analysis_run_id: 'r', comparison_run_id: 'cmp-1', submission_id: 's', internal_qa_emit: true });
    expect(out.written).toBe(true);
    expect(out.warning).toBeNull();
  });
});
