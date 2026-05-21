import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterRunEvidencePassForStep1 } from '@/server/evidence-pass.server';
import {
  emitAnalysisEvidenceStatePrerequisite,
  emitEvidenceAnchorsFirstPass,
  emitQAManifestForAnalysisRun,
} from '@/server/v3/qa-artifacts-wiring.server';

function ordinaryEvidencePassFixture() {
  return {
    timestamped_evidence: [
      { timestamp: '00:04', observation: 'Head and shoulders framing remains visible before the first line.', linked_category: 'technical' },
      { timestamp: '00:08', observation: 'Audio consonants are audible during the final phrase.', linked_category: 'audio' },
      { timestamp: '00:12', observation: 'Supplied material page reference is visible in the runtime context.', linked_category: 'brief_adherence' },
      { timestamp: '00:16', observation: 'Performer turns toward the reader before the pause.', linked_category: 'acting' },
      { timestamp: '00:20', observation: 'Ready to submit because the performance is strong.', linked_category: 'acting' },
    ],
    presentation_evidence: ['Framing keeps the performer visible from shoulders up.'],
    candidate_technique_evidence: [
      { label: 'Internal shadow candidate: eyeline shift noted as an observation.', modality: 'video' },
      { label: 'Technique demonstrated with professional quality.', modality: 'video' },
    ],
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      movement_assessable: true,
      notes: 'Assessability notes only',
    },
    overall_score: 91,
    fix_first_evidence: 'Fix first: make the objective stronger.',
    role_fit_evidence: 'Perfect role fit for this casting brief.',
  };
}

async function emitOrdinaryAnalysisBundle() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s919a-'));
  const run = `run-s919a-${Math.random().toString(36).slice(2)}`;
  const take = 'take-s919a';
  const filtered = filterRunEvidencePassForStep1(ordinaryEvidencePassFixture(), { model: 'unit-model', durationSeconds: 45 });
  const analysis = await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919a',
    take_id: take,
    source_module: 'test',
    source_stage: 'analysis_step_1_evidence_mapping',
    selected_level: 'advanced',
    audition_type: 'monologue',
    brief_presence: 'supplied',
    brief_presence_source: 'audition.brief',
    material_presence: 'supplied',
    material_presence_source: 'loaded_runtime_field',
    component_or_task_declaration_status: 'unknown',
    component_or_task_declaration_source: 'not_loaded',
    media_readiness_state: 'ready',
    media_duration_seconds: 45,
    duration_confidence: 'known',
    resolver_output_available: true,
    truth_state_map_available: true,
    filtered_run_evidence_pass_step1: filtered,
    root_dir: root,
    internal_qa_emit: true,
  } as any);
  expect(analysis.written).toBe(true);
  const base = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`);
  const step1 = JSON.parse(await readFile(path.join(base, 'analysis', 'Step1ObservableEvidence.json'), 'utf8'));
  const aes = JSON.parse(await readFile(path.join(base, 'analysis', 'AnalysisEvidenceState.json'), 'utf8'));
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub-s919a',
    take_id: take,
    source_module: 'test',
    source_stage: 'analysis_step_1_evidence_mapping',
    analysis_evidence_state_data: aes,
    raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:01', note: 'Legacy report note cannot support the gate.' }] } },
    root_dir: root,
    internal_qa_emit: true,
  });
  expect(anchorsOut.written).toBe(true);
  expect(analysis.step1_observable_evidence_source_classification).toBeDefined();
  if (!analysis.step1_observable_evidence_source_classification) {
    throw new Error('step1_observable_evidence_source_classification_missing');
  }
  const step1ObservableEvidenceSourceClassification = analysis.step1_observable_evidence_source_classification;
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub-s919a',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: [...analysis.emitted_artefact_ids, ...anchorsOut.emitted_artefact_ids],
    emitted_blocked_artefact_ids: analysis.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: {
      step1_observable_evidence: step1ObservableEvidenceSourceClassification,
      analysis_evidence_state: analysis.source_classification,
      evidence_anchors: anchorsOut.source_classification,
    },
    artefact_level2_spine_satisfaction_by_id: {
      step1_observable_evidence: false,
      analysis_evidence_state: analysis.level2_satisfies,
      evidence_anchors: anchorsOut.level2_satisfies,
    },
    step1_observable_evidence_summary: analysis.step1_observable_evidence_summary,
    analysis_evidence_state_summary: analysis.summary,
    evidence_anchor_trace_summary: anchorsOut.evidence_anchor_trace_summary,
  });
  const anchors = JSON.parse(await readFile(path.join(base, 'traces', 'EvidenceAnchors.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { filtered, step1, aes, anchors, metrics };
}

describe('S9-19 ordinary analysis proof bundle', () => {
  it('projects safe ordinary Step 1 observations while rejecting judgement and authority fields', async () => {
    const { filtered, step1, aes, metrics } = await emitOrdinaryAnalysisBundle();

    expect(filtered.performance_observable_evidence_items.length).toBeGreaterThan(0);
    expect(filtered.material_observable_evidence_items.length).toBeGreaterThan(0);
    expect(filtered.candidate_technique_evidence.length).toBe(1);
    expect(filtered.rejected_or_filtered_fields).toContain('timestamped_evidence[4].observation');
    expect(filtered.rejected_or_filtered_fields).toContain('candidate_technique_evidence[1]');

    expect(step1.performance_observable_evidence_count).toBeGreaterThan(0);
    expect(step1.material_specific_performance_evidence_count).toBeGreaterThan(0);
    expect(step1.candidate_technique_evidence_count).toBeGreaterThan(0);
    expect(step1.evidence_family_status_by_id.performance_observable).toBe('complete');
    expect(step1.evidence_family_status_by_id.candidate_technique).toBe('complete');
    expect(step1.ordinary_analysis_family_completion_by_id.performance_observable.can_satisfy_family_gate).toBe(true);
    expect(step1.ordinary_analysis_family_completion_by_id.candidate_technique.can_satisfy_family_gate).toBe(true);
    expect(step1.cannot_satisfy_v3_gate).toBe(true);

    expect(aes.performance_observable_evidence_count).toBeGreaterThan(0);
    expect(aes.candidate_technique_evidence_count).toBeGreaterThan(0);
    expect(aes.evidence_state_status).toBe('complete');
    expect(aes.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(aes.cannot_satisfy_v3_gate).toBe(false);
    expect(aes.ordinary_analysis_proof_bundle_status).toBe('step1_families_complete_proof_chain_blocked');
    expect(aes.ordinary_analysis_proof_bundle_gate_status).toBe('insufficient');

    expect(metrics.analysis_evidence_state_gate_status).toBe('satisfied');
    expect(metrics.ordinary_analysis_proof_bundle_status).toBe('step1_families_complete_proof_chain_blocked');
    expect(metrics.ordinary_analysis_proof_bundle_gate_status).toBe('insufficient');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('promotes only item-level real runtime anchors and keeps the aggregate gate insufficient', async () => {
    const { anchors, metrics } = await emitOrdinaryAnalysisBundle();
    const performanceAnchor = anchors.anchors.find((anchor: any) => anchor.source_path === 'performance_observable_evidence_items[0]');
    const techniqueAnchor = anchors.anchors.find((anchor: any) => anchor.source_path === 'candidate_technique_evidence[0]');

    expect(performanceAnchor).toMatchObject({ source_family: 'real_runtime_v3', cannot_satisfy_v3_gate: false });
    expect(techniqueAnchor).toMatchObject({ source_family: 'real_runtime_v3', cannot_satisfy_v3_gate: false });
    expect(anchors.evidence_anchor_trace_summary.real_runtime_anchor_count).toBeGreaterThan(0);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.evidence_anchor_trace_summary.blocker_codes).not.toContain('partial_step1_evidence_coverage');
    expect(anchors.evidence_anchor_trace_summary.blocker_codes).toContain('anchor_cannot_satisfy_v3_gate');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).not.toBe('sufficient');
  });
});
