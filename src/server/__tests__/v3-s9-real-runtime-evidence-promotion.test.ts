import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { filterRunEvidencePassForStep1 } from '@/server/evidence-pass.server';
import { safeIsoTimestamp } from '@/server/v3/qa-safe-normalisation.server';
import { evaluateStep1EvidenceForStep2 } from '@/server/v3/qa-step2-dependency.server';
import { emitAnalysisEvidenceStatePrerequisite, emitClaimCandidateTrace, emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact } from '@/server/v3/qa-artifacts-wiring.server';

type LegacyBundleOptions = {
  run?: string;
  take?: string;
  report?: Record<string, unknown>;
  manifestSource?: Record<string, string>;
  manifestLevel2?: Record<string, boolean>;
  acceptedIds?: string[];
  blockedIds?: string[];
  realV3Ids?: string[];
  includeAnalysisEvidenceState?: boolean;
};

const defaultLegacyReport = {
  schema_version: 'v1-legacy',
  overall_score: 92,
  casting_headline: 'Perfect match for this role',
  fix_first: 'send with confidence',
  strengths: ['strong presence'],
  category_notes: ['Take 2 is the winner and recommended over Take 1'],
  timestamped_notes: [{ timestamp: '00:10', note: 'Grounded beat lands.' }],
};

async function emitLegacyBundle(options: LegacyBundleOptions = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-'));
  const run = options.run ?? `run-s914a-${Math.random().toString(36).slice(2)}`;
  const take = options.take ?? 't1';
  const report = options.report ?? defaultLegacyReport;
  await emitRawReportArtefact({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    source_stage: 'unit',
    source_module: 'test',
    report_data: report,
    root_dir: root,
    internal_qa_emit: true,
  });
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    raw_report_data: { artefact_type: 'raw_report', report_data: report },
    root_dir: root,
    internal_qa_emit: true,
  });
  const anchorsPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json');
  const anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  const claimsOut = await emitPublicClaimTraceFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    raw_report_data: { artefact_type: 'raw_report', report_data: report },
    evidence_anchors_data: anchors,
    root_dir: root,
    internal_qa_emit: true,
  });
  const claimsPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'PublicClaimTrace.json');
  const claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  const analysisEvidenceStateOut = options.includeAnalysisEvidenceState ? await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    media_readiness_state: 'ready',
    media_duration_seconds: null,
    duration_confidence: 'unknown',
    resolver_output_available: true,
    truth_state_map_available: true,
    root_dir: root,
    internal_qa_emit: true,
  }) : null;
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: ['raw_report', ...(analysisEvidenceStateOut?.emitted_artefact_ids ?? []), ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    emitted_blocked_artefact_ids: [...(analysisEvidenceStateOut?.emitted_blocked_artefact_ids ?? [])],
    artefact_source_classification_by_id: {
      raw_report: 'legacy_adapter',
      ...(analysisEvidenceStateOut?.written ? { analysis_evidence_state: analysisEvidenceStateOut.source_classification } : {}),
      ...(anchorsOut.written ? { evidence_anchors: 'legacy_adapter' } : {}),
      ...(claimsOut.written ? { public_claim_trace: 'legacy_adapter' } : {}),
      ...(options.manifestSource ?? {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      raw_report: false,
      ...(analysisEvidenceStateOut?.written ? { analysis_evidence_state: analysisEvidenceStateOut.level2_satisfies } : {}),
      ...(anchorsOut.written ? { evidence_anchors: false } : {}),
      ...(claimsOut.written ? { public_claim_trace: false } : {}),
      ...(options.manifestLevel2 ?? {}),
    },
    legacy_adapter_artefact_ids: ['raw_report', ...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut.written ? ['public_claim_trace'] : [])],
    runtime_evidence_accepted_by_id: options.acceptedIds,
    runtime_evidence_blocked_by_id: options.blockedIds,
    real_v3_spine_artefact_ids: options.realV3Ids,
    public_claim_trace_summary: claimsOut.summary,
    analysis_evidence_state_summary: analysisEvidenceStateOut?.written ? analysisEvidenceStateOut.summary : undefined,
  });
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  const analysisEvidenceStatePath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'analysis', 'AnalysisEvidenceState.json');
  const analysisEvidenceState = analysisEvidenceStateOut?.written ? JSON.parse(await readFile(analysisEvidenceStatePath, 'utf8')) : null;
  return { root, run, take, report, anchorsOut, anchors, claimsOut, claims, analysisEvidenceStateOut, analysisEvidenceState, manifest, metrics };
}

async function emitAnalysisEvidenceStateBundle(options: {
  run?: string;
  take?: string;
  resolver?: boolean;
  truth?: boolean;
  duration?: number | null;
  mediaState?: string | null;
  selectedLevel?: string | null;
  auditionType?: string | null;
  briefPresence?: 'supplied' | 'absent' | 'unknown';
  materialPresence?: 'supplied' | 'absent' | 'unknown';
  componentStatus?: 'unknown' | 'known_empty' | 'supplied';
  metadataOverrides?: Record<string, unknown>;
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914b-'));
  const run = options.run ?? `run-s914b-${Math.random().toString(36).slice(2)}`;
  const take = options.take ?? 't1';
  const out = await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    selected_level: options.selectedLevel === undefined ? 'advanced' : options.selectedLevel,
    audition_type: options.auditionType === undefined ? 'monologue' : options.auditionType,
    brief_presence: options.briefPresence ?? 'supplied',
    brief_presence_source: 'audition.brief',
    material_presence: options.materialPresence ?? 'supplied',
    material_presence_source: 'loaded_runtime_field',
    component_or_task_declaration_status: options.componentStatus ?? 'unknown',
    component_or_task_declaration_source: options.componentStatus === 'supplied' ? 'loaded_runtime_field' : 'not_loaded',
    media_readiness_state: options.mediaState ?? 'ready',
    media_duration_seconds: options.duration ?? null,
    duration_confidence: options.duration ? 'known' : 'unknown',
    resolver_output_available: options.resolver ?? true,
    truth_state_map_available: options.truth ?? true,
    metadata_overrides: options.metadataOverrides,
    raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:12', note: 'Forbidden downstream note' }], fix_first: 'Forbidden raw report field' } },
    root_dir: root,
    internal_qa_emit: true,
  } as any);
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: out.emitted_artefact_ids,
    emitted_blocked_artefact_ids: out.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: out.written ? { analysis_evidence_state: out.source_classification } : {},
    artefact_level2_spine_satisfaction_by_id: out.written ? { analysis_evidence_state: out.level2_satisfies } : {},
    analysis_evidence_state_summary: out.written ? out.summary : undefined,
  });
  const payloadPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'analysis', 'AnalysisEvidenceState.json');
  const payload = out.written ? JSON.parse(await readFile(payloadPath, 'utf8')) : null;
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { root, run, take, out, payload, manifest, metrics };
}

async function emitPromotedEvidenceAnchorsBundle(options: {
  rawReport?: Record<string, unknown> | null;
  transformAnalysisEvidenceState?: (payload: any) => void;
  includePublicClaimTrace?: boolean;
} = {}) {
  const base = await emitAnalysisEvidenceStateBundle({ duration: 42 });
  if (options.transformAnalysisEvidenceState) options.transformAnalysisEvidenceState(base.payload);
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: base.run,
    analysis_run_id: base.run,
    submission_id: 'sub1',
    take_id: base.take,
    source_module: 'test',
    source_stage: 'unit',
    analysis_evidence_state_data: base.payload,
    raw_report_data: options.rawReport === undefined ? null : options.rawReport,
    root_dir: base.root,
    internal_qa_emit: true,
  });
  const anchorsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'EvidenceAnchors.json');
  const anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  let claimsOut: any = null;
  let claims: any = null;
  if (options.includePublicClaimTrace) {
    claimsOut = await emitPublicClaimTraceFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { report_data: { strengths: ['grounded acting'] } },
      evidence_anchors_data: anchors,
      root_dir: base.root,
      internal_qa_emit: true,
    });
    const claimsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'PublicClaimTrace.json');
    claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  }
  await emitQAManifestForAnalysisRun({
    run_id: base.run,
    analysis_run_id: base.run,
    take_id: base.take,
    submission_id: 'sub1',
    root_dir: base.root,
    internal_qa_emit: true,
    emitted_artefact_ids: [...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut?.written ? ['public_claim_trace'] : [])],
    emitted_blocked_artefact_ids: base.out.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: {
      analysis_evidence_state: base.out.source_classification,
      ...(anchorsOut.written ? { evidence_anchors: anchorsOut.source_classification } : {}),
      ...(claimsOut?.written ? { public_claim_trace: 'legacy_adapter' } : {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      analysis_evidence_state: false,
      ...(anchorsOut.written ? { evidence_anchors: anchorsOut.level2_satisfies } : {}),
      ...(claimsOut?.written ? { public_claim_trace: false } : {}),
    },
    evidence_anchor_trace_summary: anchorsOut.written ? anchorsOut.evidence_anchor_trace_summary : undefined,
    analysis_evidence_state_summary: base.out.summary,
    public_claim_trace_summary: claimsOut?.summary,
    legacy_adapter_artefact_ids: claimsOut?.written ? ['public_claim_trace'] : [],
  });
  const manifest = JSON.parse(await readFile(path.join(base.root, base.run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(base.root, base.run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { ...base, anchorsOut, anchors, claimsOut, claims, manifest, metrics };
}

function sampleRunEvidencePass(overrides: Record<string, unknown> = {}) {
  return {
    evidence_version: '1',
    audition_type: 'monologue',
    detected_components: [{ type: 'monologue', weight: 1, score: 91, note: 'report-ready component judgement' }],
    raw_scores: { technical: 88, audio: 82, vocal: null, acting: 90, brief_adherence: 84, professional_presentation: 86 },
    core_strengths_evidence: [{ area: 'acting', evidence: 'report-ready strength prose' }],
    core_improvements_evidence: [{ area: 'pacing', evidence: 'report-ready improvement prose' }],
    fix_first_evidence: 'Fix first: choose a sharper objective',
    brief_adherence_evidence: {
      material_compliance: 'Material appears supplied',
      technical_compliance: 'Technical setup is visible',
      instruction_precision: 'Instruction judgement',
      professionalism_signals: 'Professionalism judgement',
      score_material: 80,
      score_technical: 82,
      score_instruction: 79,
      score_professional: 81,
    },
    category_notes_evidence: {
      technical: 'report-ready technical category note',
      audio: 'report-ready audio category note',
      vocal: '',
      acting: 'report-ready acting category note',
      brief_adherence: 'report-ready brief category note',
      professional_presentation: 'report-ready presentation category note',
    },
    role_fit_evidence: 'Perfect role fit for this casting brief',
    role_fit_modifier_suggested: 4,
    role_fit_confidence: 'high',
    presentation_evidence: ['Framing keeps the performer visible from shoulders up.'],
    risk_evidence: [{ severity: 'medium', flag: 'recall risk', why: 'may reduce recall', recall_impact: 'may_reduce' }],
    timestamped_evidence: [
      { timestamp: '00:08', observation: 'Performer shifts eyeline before the second phrase.', why_it_matters: 'Useful moment', linked_category: 'acting' },
      { timestamp: '00:14', observation: 'Audio drops slightly on the final word.', why_it_matters: 'Useful moment', linked_category: 'audio' },
      { timestamp: '00:18', observation: 'Supplied material text is visible in the runtime context.', why_it_matters: 'Material context', linked_category: 'brief_adherence' },
      { timestamp: '00:20', observation: 'Ready to submit because the scene is strong.', why_it_matters: 'Judgement', linked_category: 'acting' },
    ],
    evidence_sufficiency: {
      audio_assessable: true,
      video_assessable: true,
      acting_assessable: true,
      vocal_assessable: false,
      movement_assessable: true,
      brief_assessable: true,
      role_fit_assessable: false,
      notes: 'Assessability notes only',
    },
    ...overrides,
  };
}

async function emitFilteredRunEvidencePassAnalysisBundle(options: {
  evidence?: unknown;
  resolver?: boolean;
  truth?: boolean;
  rawReport?: Record<string, unknown>;
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914g-'));
  const run = `run-s914g-${Math.random().toString(36).slice(2)}`;
  const take = 't1';
  const filtered = filterRunEvidencePassForStep1(options.evidence ?? sampleRunEvidencePass(), { model: 'test-model', durationSeconds: 60 });
  const out = await emitAnalysisEvidenceStatePrerequisite({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
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
    media_duration_seconds: 60,
    duration_confidence: 'known',
    resolver_output_available: options.resolver ?? true,
    truth_state_map_available: options.truth ?? true,
    filtered_run_evidence_pass_step1: filtered,
    raw_report_data: options.rawReport ?? { report_data: { timestamped_notes: [{ timestamp: '00:01', note: 'Forbidden report note' }], strengths: ['Forbidden report strength'], fix_first: 'Forbidden fix first', category_notes: { acting: 'Forbidden category note' } } },
    root_dir: root,
    internal_qa_emit: true,
  } as any);
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: out.emitted_artefact_ids,
    emitted_blocked_artefact_ids: out.emitted_blocked_artefact_ids,
    artefact_source_classification_by_id: out.written ? { analysis_evidence_state: out.source_classification } : {},
    artefact_level2_spine_satisfaction_by_id: out.written ? { analysis_evidence_state: out.level2_satisfies } : {},
    analysis_evidence_state_summary: out.written ? out.summary : undefined,
  });
  const payloadPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'analysis', 'AnalysisEvidenceState.json');
  const payload = out.written ? JSON.parse(await readFile(payloadPath, 'utf8')) : null;
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { root, run, take, filtered, out, payload, manifest, metrics };
}

function completeAnalysisEvidenceStateForAggregate(payload: any, options: {
  familyStatus?: Record<string, string>;
  familyCoverage?: Record<string, unknown>;
  materialNotApplicable?: boolean;
} = {}) {
  payload.source_classification = 'real_runtime_v3';
  payload.evidence_state_status = 'complete';
  payload.cannot_satisfy_v3_gate = false;
  payload.unsupported_or_unavailable_evidence = [];
  payload.blocker_codes = [];
  payload.gate_satisfaction_reason = 'complete_step1_evidence_family_coverage';
  payload.assessability_limitations = [];
  payload.component_evidence = [{
    component_id: 'component_or_task_declaration',
    evidence_kind: 'component_or_task_declaration_status',
    status: 'supplied',
    source_artefact_id: 'analysis_submission',
    source_path: 'component_or_task_declaration_status',
    safe_evidence_summary: 'component/task declaration status is supplied',
    assessability_limitations: [],
    blocker_codes: [],
  }];
  payload.observable_evidence_items = (payload.observable_evidence_items ?? []).map((item: any, index: number) => ({
    ...item,
    linked_truth_state_ids: item.source_artefact_id === 'truth_state_map' || String(item.evidence_kind ?? '').includes('truth') ? ['truth-state-runtime-1'] : [],
    assessability_limitations: [],
    blocker_codes: [],
    analysis_evidence_state_source_path: item.analysis_evidence_state_source_path ?? `observable_evidence_items[${index}]`,
  }));
  const addFamilyItem = (field: string, item: any) => {
    payload[field] = [item];
    payload.observable_evidence_items.push({ ...item, analysis_evidence_state_source_path: `${field}[0]` });
  };
  addFamilyItem('video_observable_evidence_items', {
    evidence_item_id: 'aes-video-complete',
    evidence_family: 'video',
    evidence_modality: 'video',
    evidence_kind: 'video_visibility_observation',
    safe_evidence_summary: 'Framing and visibility are observable before judgement.',
    source_artefact_id: 'run_evidence_pass',
    source_path: 'video_observable_evidence_items[0]',
    timestamp: '00:08',
    timestamp_range: null,
    timestamp_source: 'runEvidencePass_timestamp',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_observation',
    public_display_status: 'internal_only',
    blocker_codes: [],
  });
  addFamilyItem('audio_observable_evidence_items', {
    evidence_item_id: 'aes-audio-complete',
    evidence_family: 'audio',
    evidence_modality: 'audio',
    evidence_kind: 'audio_presence_observation',
    safe_evidence_summary: 'Audio presence is observable before judgement.',
    source_artefact_id: 'run_evidence_pass',
    source_path: 'audio_observable_evidence_items[0]',
    timestamp: '00:14',
    timestamp_range: null,
    timestamp_source: 'runEvidencePass_timestamp',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_observation',
    public_display_status: 'internal_only',
    blocker_codes: [],
  });
  if (options.materialNotApplicable) {
    payload.material_observable_evidence_items = [];
  } else {
    addFamilyItem('material_observable_evidence_items', {
      evidence_item_id: 'aes-material-complete',
      evidence_family: 'material',
      evidence_modality: 'material',
      evidence_kind: 'material_presence_observation',
      safe_evidence_summary: 'Supplied material presence is observable before judgement.',
      source_artefact_id: 'run_evidence_pass',
      source_path: 'material_observable_evidence_items[0]',
      timestamp: null,
      timestamp_range: null,
      timestamp_source: 'not_timestamped_material_context',
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: [],
      confidence_or_strength: 'runtime_observation',
      public_display_status: 'internal_only',
      blocker_codes: [],
    });
  }
  addFamilyItem('performance_observable_evidence_items', {
    evidence_item_id: 'aes-performance-complete',
    evidence_family: 'performance',
    evidence_modality: 'video',
    evidence_kind: 'performance_observable_event',
    safe_evidence_summary: 'A pre-judgement observable performance event is recorded without score or verdict.',
    source_artefact_id: 'run_evidence_pass',
    source_path: 'performance_observable_evidence_items[0]',
    timestamp: '00:18',
    timestamp_range: null,
    timestamp_source: 'runEvidencePass_timestamp',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_observation',
    public_display_status: 'internal_only',
    blocker_codes: [],
  });
  payload.candidate_technique_evidence = [{
    evidence_item_id: 'aes-technique-complete',
    evidence_family: 'candidate_technique',
    evidence_modality: 'video',
    evidence_kind: 'candidate_technique_observation',
    safe_evidence_summary: 'Internal candidate technique observation recorded without public authority.',
    source_artefact_id: 'run_evidence_pass',
    source_path: 'candidate_technique_evidence[0]',
    timestamp: null,
    timestamp_range: null,
    timestamp_source: 'not_timestamped_candidate_technique',
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: 'runtime_observation',
    public_display_status: 'internal_only',
    blocker_codes: [],
  }];
  payload.evidence_family_coverage = {
    video: true,
    audio: true,
    material: options.materialNotApplicable ? 'not_applicable' : true,
    performance: true,
    candidate_technique: true,
    ...(options.familyCoverage ?? {}),
  };
  payload.evidence_family_status_by_id = {
    video: 'complete',
    audio: 'complete',
    material: options.materialNotApplicable ? 'not_applicable' : 'complete',
    performance: 'complete',
    candidate_technique: 'complete',
    ...(options.familyStatus ?? {}),
  };
}

async function emitAnchorsAndManifestFromAnalysisState(base: {
  root: string;
  run: string;
  take: string;
  payload: any;
  out?: any;
}, options: { rawReport?: Record<string, unknown> | null; includePublicClaimTrace?: boolean } = {}) {
  const anchorsOut = await emitEvidenceAnchorsFirstPass({
    run_id: base.run,
    analysis_run_id: base.run,
    submission_id: 'sub1',
    take_id: base.take,
    source_module: 'test',
    source_stage: 'unit',
    analysis_evidence_state_data: base.payload,
    raw_report_data: options.rawReport === undefined ? null : options.rawReport,
    root_dir: base.root,
    internal_qa_emit: true,
  });
  const anchorsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'EvidenceAnchors.json');
  const anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  let claimsOut: any = null;
  let claims: any = null;
  if (options.includePublicClaimTrace) {
    claimsOut = await emitPublicClaimTraceFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { report_data: { strengths: ['grounded acting'] } },
      evidence_anchors_data: anchors,
      root_dir: base.root,
      internal_qa_emit: true,
    });
    const claimsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'PublicClaimTrace.json');
    claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  }
  await emitQAManifestForAnalysisRun({
    run_id: base.run,
    analysis_run_id: base.run,
    take_id: base.take,
    submission_id: 'sub1',
    root_dir: base.root,
    internal_qa_emit: true,
    emitted_artefact_ids: [...(anchorsOut.written ? ['evidence_anchors'] : []), ...(claimsOut?.written ? ['public_claim_trace'] : [])],
    emitted_blocked_artefact_ids: base.out?.emitted_blocked_artefact_ids ?? [],
    artefact_source_classification_by_id: {
      analysis_evidence_state: base.payload?.source_classification ?? base.out?.source_classification ?? 'missing',
      ...(anchorsOut.written ? { evidence_anchors: anchorsOut.source_classification } : {}),
      ...(claimsOut?.written ? { public_claim_trace: 'legacy_adapter' } : {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      analysis_evidence_state: false,
      ...(anchorsOut.written ? { evidence_anchors: anchorsOut.level2_satisfies } : {}),
      ...(claimsOut?.written ? { public_claim_trace: false } : {}),
    },
    evidence_anchor_trace_summary: anchorsOut.written ? anchorsOut.evidence_anchor_trace_summary : undefined,
    analysis_evidence_state_summary: base.out?.summary,
    public_claim_trace_summary: claimsOut?.summary,
    legacy_adapter_artefact_ids: claimsOut?.written ? ['public_claim_trace'] : [],
  });
  const manifest = JSON.parse(await readFile(path.join(base.root, base.run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(base.root, base.run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { anchorsOut, anchors, claimsOut, claims, manifest, metrics };
}

describe('S9-14A legacy containment and current-state guardrail', () => {
  it('keeps legacy EvidenceAnchors emitted but non-satisfying', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_trace_status).toBe('emitted');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('legacy_or_non_v3_support_only');
    expect(anchors.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
    expect(anchors.anchors.every((anchor: any) => anchor.cannot_satisfy_v3_gate === true)).toBe(true);
    expect(anchors.blocker_codes).toEqual(expect.arrayContaining(['legacy_snapshot_insufficient_for_v3_evidence_anchor_gate']));
  });

  it('prevents raw_report-only EvidenceAnchors from becoming real_runtime_v3', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle({
      manifestSource: { evidence_anchors: 'legacy_adapter' },
      manifestLevel2: { evidence_anchors: true },
      acceptedIds: ['evidence_anchors'],
      realV3Ids: ['evidence_anchors'],
    });
    expect(anchors.anchors.every((anchor: any) => anchor.source_artefact_id === 'raw_report')).toBe(true);
    expect(anchors.anchors.every((anchor: any) => String(anchor.source_path).startsWith('report_data.timestamped_notes'))).toBe(true);
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).not.toBe('real_runtime_v3');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.anchors[0].cannot_satisfy_v3_gate).toBe(true);
  });

  it('keeps EvidenceAnchors without TruthStateMap linkage non-satisfying', async () => {
    const { anchors, manifest, metrics } = await emitLegacyBundle();
    expect(anchors.anchors[0].linked_truth_state_ids).toEqual([]);
    expect(anchors.anchors[0].blocker_codes).toEqual(expect.arrayContaining(['missing_truth_state_linkage']));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).not.toBe('real_runtime_v3');
  });

  it('keeps EvidenceAnchors without resolver or Step 1 provenance out of accepted gate evidence', async () => {
    const { anchors, manifest } = await emitLegacyBundle();
    expect(anchors.source_stage).toBe('unit');
    expect(anchors.gate_satisfaction_reason).toBe('forbidden_raw_report_anchor_source');
    expect(anchors.anchors[0].assessability_limitations).toContain('legacy_report_snapshot_not_v3_multimodal');
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(manifest.runtime_evidence_blocked_by_id).toContain('evidence_anchors');
  });

  it('does not let caller payload override canonical EvidenceAnchors metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-meta-'));
    const run = 'run-s914a-meta';
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      raw_report_data: {
        schema_version: 'attacker_schema',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong-run',
        analysis_run_id: 'wrong-analysis',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'real_runtime_v3',
        cannot_satisfy_v3_gate: false,
        blocker_codes: [],
        timestamped_notes: [{ timestamp: '00:11', note: 'Legacy note' }],
      },
    } as any);
    expect(out.source_classification).toBe('legacy_adapter');
    expect(out.level2_satisfies).toBe(false);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(payload.schema_version).toBe('tapecoach_v3_evidence_anchors_first_pass_v1');
    expect(payload.artefact_type).toBe('evidence_anchors');
    expect(payload.run_id).toBe(run);
    expect(payload.analysis_run_id).toBe(run);
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
    expect(payload.blocker_codes).toContain('legacy_snapshot_insufficient_for_v3_evidence_anchor_gate');
  });

  it('keeps legacy PublicClaimTrace emitted but non-satisfying', async () => {
    const { claims, manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_trace_status).toBe('emitted');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_reason).toBe('legacy_or_unsupported_claim_support_only');
  });

  it('keeps public claims with no evidence anchor support blocked for rewrite', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { strengths: ['grounded acting'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'grounded acting');
    expect(claim.linked_evidence_anchor_ids).toEqual([]);
    expect(['missing_evidence', 'blocked']).toContain(claim.support_status);
    expect(claim.blocker_codes).toContain('missing_evidence_anchor_support');
    expect(claim.rewrite_required).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps unsupported overclaims rewrite_required and unsupported', async () => {
    const { claims } = await emitLegacyBundle({ report: { casting_headline: 'Perfect match for this role' } });
    const claim = claims.claims.find((entry: any) => entry.source_path === 'report_data.casting_headline');
    expect(['unsafe_or_overclaim', 'needs_rewrite']).toContain(claim.public_safety_status);
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(claim.blocker_codes).toContain('unsupported_overclaim_requires_rewrite');
  });

  it('keeps score claims public_scoring_blocked', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { overall_score: 92, improvements: ['readiness score 92'] } });
    const overallScore = claims.claims.find((entry: any) => entry.source_path === 'report_data.overall_score');
    const scoreWording = claims.claims.find((entry: any) => entry.claim_text === 'readiness score 92');
    expect(overallScore.claim_type).toBe('score_or_verdict');
    expect(overallScore.score_scope).toBe('overall_readiness');
    expect(overallScore.blocker_codes).toContain('public_scoring_blocked');
    expect(scoreWording.blocker_codes).toContain('public_scoring_blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps public technique authority claims blocked from gate satisfaction', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { strengths: ['professional standard technique authority'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'professional standard technique authority');
    expect(claim.public_safety_status).toBe('unsafe_or_overclaim');
    expect(claim.rewrite_required).toBe(true);
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps castability bookability and marketability wording blocked or rewrite_required', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { casting_headline: 'Bookable and marketable casting choice' } });
    const claim = claims.claims.find((entry: any) => entry.source_path === 'report_data.casting_headline');
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(['needs_rewrite', 'unsafe_or_overclaim', 'blocked']).toContain(claim.public_safety_status);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps public comparison winner or recommendation wording blocked from public claim satisfaction', async () => {
    const { claims, metrics } = await emitLegacyBundle({ report: { category_notes: ['Take 2 is the winner and recommended over Take 1'] } });
    const claim = claims.claims.find((entry: any) => entry.claim_text === 'Take 2 is the winner and recommended over Take 1');
    expect(claim.rewrite_required).toBe(true);
    expect(claim.support_status).not.toBe('supported_by_evidence_anchor');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('aligns manifest and qa_acceptance_metrics for legacy containment', async () => {
    const { manifest, metrics, claims } = await emitLegacyBundle();
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(1);
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBe(0);
    expect(metrics.public_claim_trace_summary).toMatchObject(claimsOutSummary(claims));
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('does not treat emitted trace artefacts as satisfying or accepted gate evidence', async () => {
    const { manifest, metrics } = await emitLegacyBundle();
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
  });

  it('keeps malformed legacy anchors or claims from crashing finalisation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-malformed-'));
    const run = 'run-s914a-malformed';
    const anchors = await emitEvidenceAnchorsFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { timestamped_notes: [null, {}, { note: '' }] },
      root_dir: root,
      internal_qa_emit: true,
    });
    const claims = await emitPublicClaimTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { strengths: [null, '', 1] },
      evidence_anchors_data: { anchors: [{ source_family: 'legacy_adapter' }] },
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(anchors.written).toBe(false);
    expect(claims.written).toBe(false);
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_blocked_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true, public_claim_trace: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors', 'public_claim_trace'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.evidence_anchors).toBe('emitted_blocked');
    expect(manifest.artefact_status_by_id.public_claim_trace).toBe('emitted_blocked');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('prevents source_scaffold helper and local fixture classifications from satisfying gates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914a-scaffold-'));
    const run = 'run-s914a-scaffold';
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { evidence_anchors: 'source_scaffold', public_claim_trace: 'helper_test' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true, public_claim_trace: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors', 'public_claim_trace'],
      real_v3_spine_artefact_ids: ['evidence_anchors', 'public_claim_trace'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(manifest.real_v3_spine_artefact_ids).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace']));
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps global Level 2 public and production gates blocked', async () => {
    const { manifest, metrics } = await emitLegacyBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});

describe('S9-14C Step 1 observable evidence extractor', () => {
  it('emits AnalysisEvidenceState from input resolver truth and media artefact refs', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.artefact_type).toBe('analysis_evidence_state');
    expect(payload.schema_version).toBe('tapecoach_v3_analysis_evidence_state_v1');
    expect(payload.run_id).toBe(manifest.run_id);
    expect(payload.analysis_run_id).toBe(manifest.analysis_run_id);
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.input_artifact_refs.analysis_input_record).toContain('/inputs/input_record.json');
    expect(payload.input_artifact_refs.analysis_submission).toContain('/inputs/submission.json');
    expect(payload.input_artifact_refs.analysis_take).toContain('/inputs/take.json');
    expect(payload.resolver_output_ref).toContain('/resolver/resolver_output.json');
    expect(payload.truth_state_map_ref).toContain('/resolver/TruthStateMap.json');
    expect(payload.media_readiness_summary).toMatchObject({ media_readiness_state: 'ready' });
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe('emitted_blocked');
    expect(manifest.artefact_source_classification_by_id.analysis_evidence_state).toBe('real_runtime_v3');
    expect(metrics.analysis_evidence_state_status).toBe('emitted_blocked');
  });

  it('does not derive AnalysisEvidenceState from raw_report or report_data snapshots', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    expect(JSON.stringify(payload)).not.toContain('report_data.timestamped_notes');
    expect(JSON.stringify(payload)).not.toContain('Forbidden raw report field');
    expect(payload.observable_evidence_items.some((item: any) => item.source_artefact_id === 'raw_report')).toBe(false);
    expect(payload.observable_evidence_items.some((item: any) => String(item.source_path ?? '').startsWith('report_data'))).toBe(false);
  });

  it('records TruthStateMap known component and comparison truths without fake truth IDs', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const truthItems = payload.observable_evidence_items.filter((item: any) => item.source_artefact_id === 'truth_state_map');
    expect(truthItems.map((item: any) => item.evidence_kind)).toEqual(expect.arrayContaining(['known_truths', 'component_truths', 'comparison_truths']));
    expect(truthItems.every((item: any) => Array.isArray(item.linked_truth_state_ids) && item.linked_truth_state_ids.length === 0)).toBe(true);
    expect(payload.blocker_codes).toContain('structured_truth_state_ids_unavailable');
    expect(truthItems.some((item: any) => item.assessability_limitations.includes('structured_truth_state_ids_unavailable_in_current_truth_map_schema'))).toBe(true);
  });

  it('does not invent performance observations when no persisted extractor exists', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const performanceKinds = ['acting_performance', 'vocal_performance', 'movement_performance', 'technique_observation'];
    expect(payload.observable_evidence_items.some((item: any) => performanceKinds.includes(item.evidence_kind))).toBe(false);
    expect(payload.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind)).toEqual(expect.arrayContaining([
      'video_observable_performance_evidence_not_extracted',
      'audio_observable_performance_evidence_not_extracted',
      'material_specific_performance_evidence_not_extracted',
    ]));
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
  });

  it('keeps candidate brief evidence to presence facts only', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ briefPresence: 'supplied', materialPresence: 'supplied' });
    const serialised = JSON.stringify(payload.candidate_brief_evidence).toLowerCase();
    expect(payload.candidate_brief_evidence.length).toBeGreaterThan(0);
    expect(serialised).toContain('brief presence only');
    expect(serialised).not.toContain('brief achievement');
    expect(serialised).not.toContain('role fit');
    expect(serialised).not.toContain('casting suitability');
  });

  it('keeps candidate technique evidence unavailable when only legacy traces exist', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.candidate_technique_evidence).toEqual([]);
    expect(payload.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind)).toContain('candidate_technique_evidence_not_extracted');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('truthfully records unknown component or task declaration', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ componentStatus: 'unknown' });
    expect(payload.component_evidence[0]).toMatchObject({
      component_id: 'component_or_task_declaration',
      status: 'unknown',
      source_artefact_id: 'analysis_submission',
      source_path: 'component_or_task_declaration_status',
    });
    expect(payload.component_evidence[0].blocker_codes).toContain('component_or_task_declaration_unknown');
  });

  it('records selected_level audition_type and brief presence from runtime inputs or resolver', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ selectedLevel: 'professional', auditionType: 'song', briefPresence: 'supplied' });
    const selectedLevel = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'selected_level');
    const auditionType = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'audition_type');
    const briefPresence = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'brief_presence');
    expect(selectedLevel).toMatchObject({ source_artefact_id: 'analysis_submission', source_path: 'selected_level' });
    expect(auditionType).toMatchObject({ source_artefact_id: 'analysis_submission', source_path: 'audition_type' });
    expect(briefPresence).toMatchObject({ source_artefact_id: 'resolver_output', source_path: 'brief_presence' });
    expect(JSON.stringify(payload)).not.toContain('report_data');
  });

  it('records stable take identity from analysis_take without unsafe media refs', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle();
    const identity = payload.observable_evidence_items.find((item: any) => item.evidence_kind === 'stable_take_identity');
    expect(identity).toMatchObject({ source_artefact_id: 'analysis_take', source_path: 'stable_take_identity' });
    const serialized = JSON.stringify(identity).toLowerCase();
    expect(serialized).not.toContain('http://');
    expect(serialized).not.toContain('https://');
  });

  it('records partial real_runtime_v3 runtime facts but keeps the Step 1 gate non-satisfying', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.source_classification).toBe('real_runtime_v3');
    expect(payload.evidence_state_status).toBe('partial');
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    expect(payload.observable_evidence_items.length).toBeGreaterThan(0);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
    expect(metrics.analysis_evidence_state_gate_reason).toBe('partial_runtime_facts_present_but_performance_extractor_unavailable');
  });

  it('does not fake real_runtime_v3 Step 1 classification without a genuine source', async () => {
    const { payload, manifest } = await emitAnalysisEvidenceStateBundle({
      metadataOverrides: {
        source_classification: 'real_runtime_v3',
        cannot_satisfy_v3_gate: false,
        blocker_codes: [],
      },
    });
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('analysis_evidence_state');
  });

  it('records media readiness and resolver/truth refs safely without URL or token leakage', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ duration: 42 });
    expect(payload.resolver_output_ref).toContain('/resolver/resolver_output.json');
    expect(payload.truth_state_map_ref).toContain('/resolver/TruthStateMap.json');
    expect(payload.media_readiness_summary.media_readiness_state).toBe('ready');
    expect(payload.media_readiness_summary.media_duration_seconds).toBe(42);
    const serialized = JSON.stringify(payload).toLowerCase();
    expect(serialized).not.toContain('http://');
    expect(serialized).not.toContain('https://');
    expect(serialized).not.toContain('token');
    expect(serialized).not.toContain('signed');
  });

  it('blocks satisfaction when resolver_output is missing', async () => {
    const { payload, manifest, metrics } = await emitAnalysisEvidenceStateBundle({ resolver: false });
    expect(payload.resolver_output_ref).toBeNull();
    expect(payload.blocker_codes).toContain('resolver_output_missing');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('blocks satisfaction when TruthStateMap is missing', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle({ truth: false });
    expect(payload.truth_state_map_ref).toBeNull();
    expect(payload.blocker_codes).toContain('TruthStateMap_missing');
    expect(payload.observable_evidence_items.some((item: any) => item.blocker_codes.includes('TruthStateMap_missing'))).toBe(true);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
  });

  it('truthfully records missing media readiness duration without padded timestamps', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({ duration: null, mediaState: null });
    expect(payload.media_readiness_summary.media_duration_seconds).toBeNull();
    expect(payload.media_readiness_summary.duration_confidence).toBe('unknown');
    expect(payload.media_readiness_summary.timestamp_source).toBe('unavailable');
    expect(payload.assessability_limitations).toContain('media_duration_unavailable_no_timestamp_evidence_fabricated');
    expect(payload.observable_evidence_items.some((item: any) => item.blocker_codes.includes('media_duration_unavailable'))).toBe(true);
  });

  it('does not let caller metadata override canonical AnalysisEvidenceState fields', async () => {
    const { payload } = await emitAnalysisEvidenceStateBundle({
      metadataOverrides: {
        schema_version: 'attacker',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong',
        analysis_run_id: 'wrong',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'real_runtime_v3',
        blocker_codes: [],
      },
    });
    expect(payload.schema_version).toBe('tapecoach_v3_analysis_evidence_state_v1');
    expect(payload.artefact_type).toBe('analysis_evidence_state');
    expect(payload.run_id).not.toBe('wrong');
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.source_classification).toBe('real_runtime_v3');
    expect(payload.blocker_codes).toContain('analysis_evidence_state_partial_runtime_facts_only');
  });

  it('does not crash on partial prerequisite input and preserves blockers', async () => {
    const { out, payload, manifest } = await emitAnalysisEvidenceStateBundle({ run: 'run-s914b-malformed', take: 't1', resolver: false, truth: false, duration: null });
    expect(out.written).toBe(true);
    expect(payload.blocker_codes).toEqual(expect.arrayContaining(['resolver_output_missing', 'TruthStateMap_missing', 'media_duration_unavailable']));
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe('emitted_blocked');
  });

  it('keeps EvidenceAnchors legacy after AnalysisEvidenceState emits', async () => {
    const { manifest, metrics } = await emitLegacyBundle({ includeAnalysisEvidenceState: true });
    expect(manifest.artefact_source_classification_by_id.analysis_evidence_state).toBe('real_runtime_v3');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('keeps PublicClaimTrace legacy and non-satisfying after AnalysisEvidenceState emits', async () => {
    const { claims, manifest, metrics } = await emitLegacyBundle({ includeAnalysisEvidenceState: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('aligns manifest and qa_acceptance_metrics for AnalysisEvidenceState status and blockers', async () => {
    const { manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(metrics.analysis_evidence_state_status).toBe(manifest.artefact_status_by_id.analysis_evidence_state);
    expect(metrics.analysis_evidence_state_source_classification).toBe(manifest.artefact_source_classification_by_id.analysis_evidence_state);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.blocker_codes).toContain('AnalysisEvidenceState_missing');
  });

  it('keeps global gates blocked', async () => {
    const { manifest, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not change public output posture', async () => {
    const { payload, metrics } = await emitAnalysisEvidenceStateBundle();
    expect(payload.public_output_unchanged).toBe(true);
    expect(metrics.public_output_unchanged).toBe(true);
    expect(metrics.public_scoring_status).toBe('blocked');
  });
});

describe('S9-14D EvidenceAnchors real_runtime_v3 promotion', () => {
  it('promotes AnalysisEvidenceState observable evidence items to real_runtime_v3 anchors', async () => {
    const { payload, anchors } = await emitPromotedEvidenceAnchorsBundle();
    const selectedLevel = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'selected_level: advanced');
    expect(selectedLevel).toMatchObject({
      source_artefact_id: 'analysis_evidence_state',
      source_path: 'observable_evidence_items[0]',
      source_family: 'real_runtime_v3',
      source_classification: 'real_runtime_v3',
      cannot_satisfy_v3_gate: false,
    });
    expect(payload.observable_evidence_items[0].safe_evidence_summary).toBe(selectedLevel.evidence_text);
  });

  it('promotes selected_level and audition_type as factual deterministic anchors', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const texts = anchors.anchors.map((anchor: any) => anchor.evidence_text);
    expect(texts).toEqual(expect.arrayContaining(['selected_level: advanced', 'audition_type: monologue']));
    expect(JSON.stringify(anchors).toLowerCase()).not.toContain('raw_report');
    expect(JSON.stringify(anchors).toLowerCase()).not.toContain('report_data');
    const selectedAndAudition = anchors.anchors.filter((anchor: any) => ['selected_level: advanced', 'audition_type: monologue'].includes(anchor.evidence_text));
    expect(JSON.stringify(selectedAndAudition).toLowerCase()).not.toContain('readiness judgement');
  });

  it('promotes stable take identity and media readiness facts with safe refs only', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const identity = anchors.anchors.find((anchor: any) => anchor.evidence_text.includes('stable_take_identity'));
    const media = anchors.anchors.find((anchor: any) => anchor.evidence_text.includes('media_readiness_state'));
    expect(identity).toMatchObject({ source_artefact_id: 'analysis_evidence_state', source_family: 'real_runtime_v3' });
    expect(media).toMatchObject({ evidence_modality: 'media_readiness', source_family: 'real_runtime_v3' });
    const serialised = JSON.stringify([identity, media]).toLowerCase();
    expect(serialised).not.toContain('http://');
    expect(serialised).not.toContain('https://');
    expect(serialised).not.toContain('token');
    expect(serialised).not.toContain('signed');
  });

  it('promotes brief and material presence without achievement or suitability claims', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const briefAnchors = anchors.anchors.filter((anchor: any) => String(anchor.evidence_text).includes('presence'));
    const serialised = JSON.stringify(briefAnchors).toLowerCase();
    expect(serialised).toContain('brief_presence: supplied');
    expect(serialised).toContain('material_presence: supplied');
    expect(serialised).not.toContain('brief achievement');
    expect(serialised).not.toContain('role fit');
    expect(serialised).not.toContain('casting suitability');
  });

  it('promotes component declaration status as a fact or limitation only', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const component = anchors.anchors.find((anchor: any) => anchor.source_path === 'component_evidence[0]');
    expect(component).toMatchObject({
      source_artefact_id: 'analysis_evidence_state',
      source_path: 'component_evidence[0]',
      source_classification: 'real_runtime_v3_blocked',
      cannot_satisfy_v3_gate: true,
    });
    expect(component.blocker_codes).toContain('component_or_task_declaration_unknown');
    expect(String(component.evidence_text).toLowerCase()).not.toContain('performance');
  });

  it('records TruthStateMap anchors as blocked when structured truth IDs are unavailable', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const truthAnchors = anchors.anchors.filter((anchor: any) => anchor.evidence_modality === 'resolver_truth');
    expect(truthAnchors.length).toBeGreaterThan(0);
    expect(truthAnchors.every((anchor: any) => anchor.source_artefact_id === 'analysis_evidence_state')).toBe(true);
    expect(truthAnchors.every((anchor: any) => anchor.cannot_satisfy_v3_gate === true)).toBe(true);
    expect(truthAnchors.some((anchor: any) => anchor.blocker_codes.includes('missing_truth_state_linkage'))).toBe(true);
  });

  it('keeps raw_report timestamped notes as legacy_adapter even beside promoted anchors', async () => {
    const { anchors, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
    });
    const legacy = anchors.anchors.find((anchor: any) => anchor.source_artefact_id === 'raw_report');
    expect(legacy).toMatchObject({ source_family: 'legacy_adapter', cannot_satisfy_v3_gate: true });
    expect(anchors.anchors.some((anchor: any) => anchor.source_artefact_id === 'raw_report' && anchor.source_classification === 'real_runtime_v3')).toBe(false);
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('mixed_real_and_legacy_non_satisfying');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('does not promote a legacy report snapshot because public_safe is true', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy public-safe note', public_safe: true }] } },
    });
    const legacy = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'Legacy public-safe note');
    expect(legacy.public_safe).toBe(true);
    expect(legacy.source_family).toBe('legacy_adapter');
    expect(legacy.cannot_satisfy_v3_gate).toBe(true);
  });

  it('blocks promotion when the AnalysisEvidenceState source path is unresolved', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.observable_evidence_items[0].analysis_evidence_state_source_path = 'observable_evidence_items[99]';
      },
    });
    const blocked = anchors.anchors.find((anchor: any) => anchor.source_path === 'observable_evidence_items[99]');
    expect(blocked.cannot_satisfy_v3_gate).toBe(true);
    expect(blocked.blocker_codes).toContain('analysis_evidence_state_source_path_unresolved');
    expect(blocked.source_classification).toBe('real_runtime_v3_blocked');
  });

  it('blocks cross-run AnalysisEvidenceState promotion', async () => {
    const { anchorsOut } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.run_id = 'other-run';
      },
    });
    expect(anchorsOut.written).toBe(false);
    expect(anchorsOut.source_classification).toBe('missing');
  });

  it('blocks truth-linked anchors when linked_truth_state_ids are unavailable', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle();
    const knownTruths = anchors.anchors.find((anchor: any) => anchor.evidence_modality === 'resolver_truth' && anchor.evidence_text.includes('known runtime truth'));
    expect(knownTruths.linked_truth_state_ids).toEqual([]);
    expect(knownTruths.cannot_satisfy_v3_gate).toBe(true);
    expect(knownTruths.blocker_codes).toContain('missing_truth_state_linkage');
  });

  it('blocks fabricated evidence text that is not supported by the source path', async () => {
    const { anchors } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.observable_evidence_items[0].safe_evidence_summary = 'fabricated unsupported claim from nowhere';
        payload.observable_evidence_items[0].source_artefact_id = 'raw_report';
      },
    });
    const fabricated = anchors.anchors.find((anchor: any) => anchor.evidence_text === 'fabricated unsupported claim from nowhere');
    expect(fabricated.cannot_satisfy_v3_gate).toBe(true);
    expect(fabricated.blocker_codes).toContain('forbidden_report_snapshot_source_ref');
  });

  it('keeps source_scaffold helper and local fixture classifications non-satisfying', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914d-scaffold-'));
    const run = 'run-s914d-scaffold';
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['evidence_anchors'],
      artefact_source_classification_by_id: { evidence_anchors: 'source_scaffold' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors'],
      real_v3_spine_artefact_ids: ['evidence_anchors'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(manifest.runtime_evidence_accepted_by_id).not.toContain('evidence_anchors');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('does not turn unavailable extractor families into satisfying anchors', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    const serialised = JSON.stringify(anchors.anchors);
    expect(serialised).not.toContain('video_observable_performance_evidence_not_extracted');
    expect(serialised).not.toContain('candidate_technique_evidence_not_extracted');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('missing_video_observable_evidence');
  });

  it('does not use legacy TechniqueObservationTrace for candidate technique anchors', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.anchors.some((anchor: any) => anchor.source_artefact_id === 'technique_observation_trace')).toBe(false);
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('keeps mixed real and legacy anchors aggregate insufficient', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle({
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
    });
    expect(anchors.blocker_codes).toContain('mixed_evidence_anchor_source_families');
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBeGreaterThan(0);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(1);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('classifies deterministic anchors as real_runtime_v3 while aggregate remains insufficient for partial Step 1 coverage', async () => {
    const { anchors, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.real_runtime_anchor_count).toBeGreaterThan(0);
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBeGreaterThan(0);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('missing_video_observable_evidence');
  });

  it('does not let caller metadata override canonical promoted EvidenceAnchors fields', async () => {
    const { anchors, run } = await emitPromotedEvidenceAnchorsBundle({
      transformAnalysisEvidenceState(payload) {
        payload.schema_version = 'attacker';
        payload.artefact_type = 'accepted_gate_evidence';
        payload.internal_only = false;
        payload.privacy_classification = 'public';
      },
    });
    expect(anchors.schema_version).toBe('tapecoach_v3_evidence_anchors_runtime_v1');
    expect(anchors.artefact_type).toBe('evidence_anchors');
    expect(anchors.run_id).toBe(run);
    expect(anchors.internal_only).toBe(true);
    expect(anchors.privacy_classification).toBe('internal_private');
    expect(anchors.cannot_satisfy_v3_evidence_anchor_gate).toBe(true);
  });

  it('aligns manifest and qa_acceptance_metrics for deterministic anchor promotion', async () => {
    const { manifest, metrics, anchors } = await emitPromotedEvidenceAnchorsBundle();
    expect(metrics.evidence_anchor_trace_status).toBe(manifest.artefact_status_by_id.evidence_anchors);
    expect(metrics.evidence_anchor_source_family_summary).toEqual(anchors.evidence_anchor_trace_summary.source_family_summary);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
  });

  it('keeps PublicClaimTrace legacy and non-satisfying after EvidenceAnchors promotion', async () => {
    const { claims, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle({ includePublicClaimTrace: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(false);
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps global gates blocked after EvidenceAnchors promotion', async () => {
    const { manifest, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('does not change public output posture after EvidenceAnchors promotion', async () => {
    const { anchors, metrics } = await emitPromotedEvidenceAnchorsBundle();
    expect(anchors.public_output_unchanged ?? true).toBe(true);
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('does not crash on malformed AnalysisEvidenceState input', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914d-malformed-'));
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: 'run-s914d-malformed',
      analysis_run_id: 'run-s914d-malformed',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      analysis_evidence_state_data: { run_id: 'run-s914d-malformed', analysis_run_id: 'run-s914d-malformed', observable_evidence_items: [null, {}, { safe_evidence_summary: '' }] },
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(out.written).toBe(true);
    expect(out.source_classification).toBe('real_runtime_v3_partial_non_satisfying');
    expect(out.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
  });
});

describe('S9-14G hardened runEvidencePass persisted Step 1 extractor', () => {
  it('persists filtered runEvidencePass output as Step 1 before Step 2/raw_report', async () => {
    const { payload, out } = await emitFilteredRunEvidencePassAnalysisBundle();
    expect(out.written).toBe(true);
    expect(payload.source_stage).toBe('analysis_step_1_evidence_mapping');
    expect(payload.source_trigger_stage).toBe('analysis_step_1_evidence_mapping');
    expect(payload.extractor_source_module).toBe('src/server/evidence-pass.server.ts');
    expect(payload.extractor_source_stage).toBe('runEvidencePass_filtered_before_step2');
    expect(payload.step2_dependency_status).toMatchObject({ status: 'ready_with_limitations', can_run_step2: true });
    expect(payload.video_observable_evidence_items.length).toBeGreaterThan(0);
    expect(payload.audio_observable_evidence_items.length).toBeGreaterThan(0);
    expect(payload.material_observable_evidence_items.length).toBeGreaterThan(0);
    expect(payload.performance_observable_evidence_items.length).toBeGreaterThan(0);
  });

  it('does not use raw_report or report_data as Step 1 evidence', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle();
    const serialised = JSON.stringify(payload).toLowerCase();
    expect(serialised).not.toContain('source_artefact_id":"raw_report');
    expect(serialised).not.toContain('report_data');
    expect(serialised).not.toContain('forbidden report note');
    expect(serialised).not.toContain('forbidden report strength');
    expect(serialised).not.toContain('forbidden fix first');
    expect(serialised).not.toContain('forbidden category note');
  });

  it('filters score fields and preserves public scoring as blocked', async () => {
    const { payload, metrics } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        overall_score: 94,
        score: 93,
        score_breakdown: { acting: 92 },
        readiness_score: 91,
      }),
    });
    expect(payload.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      'overall_score',
      'score',
      'score_breakdown',
      'readiness_score',
      'raw_scores',
    ]));
    const evidenceOnly = JSON.stringify(payload.observable_evidence_items).toLowerCase();
    expect(evidenceOnly).not.toContain('overall_score');
    expect(evidenceOnly).not.toContain('readiness_score');
    expect(evidenceOnly).not.toContain('raw_scores');
    expect(payload.prohibited_field_filter_summary.raw_values_persisted).toBe(false);
    expect(metrics.public_scoring_status).toBe('blocked');
  });

  it('filters readiness, verdict and submit/retake recommendations', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        readiness: 'ready to submit',
        verdict: 'submit this take',
        submit_recommendation: 'submit',
        retake_recommendation: 'not needed',
      }),
    });
    expect(payload.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      'readiness',
      'verdict',
      'submit_recommendation',
      'retake_recommendation',
      'timestamped_evidence[3].observation',
    ]));
    const evidenceOnly = JSON.stringify(payload.observable_evidence_items).toLowerCase();
    expect(evidenceOnly).not.toContain('ready to submit');
    expect(evidenceOnly).not.toContain('submit this take');
  });

  it('filters role-fit, casting-fit, marketability, bookability and castability fields', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        role_fit: 'ideal role fit',
        casting_fit: 'casting fit is strong',
        marketability: 'high',
        bookability: 'high',
        castability: 'high',
      }),
    });
    expect(payload.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      'role_fit',
      'casting_fit',
      'marketability',
      'bookability',
      'castability',
      'role_fit_evidence',
    ]));
    const evidenceOnly = JSON.stringify(payload.observable_evidence_items).toLowerCase();
    expect(evidenceOnly).not.toContain('role fit');
    expect(evidenceOnly).not.toContain('casting fit');
    expect(evidenceOnly).not.toContain('bookability');
  });

  it('filters fix-first, priority, next-take and report prose fields', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        fix_first: 'Fix first: change the ending',
        priority_fixes: ['report-ready priority'],
        next_take_plan: 'Next take should be brighter',
        report_prose: 'This is final report prose',
      }),
    });
    expect(payload.rejected_or_filtered_fields).toEqual(expect.arrayContaining([
      'fix_first',
      'priority_fixes',
      'next_take_plan',
      'report_prose',
      'fix_first_evidence',
      'category_notes_evidence',
      'core_strengths_evidence',
      'core_improvements_evidence',
    ]));
    const evidenceOnly = JSON.stringify(payload.observable_evidence_items).toLowerCase();
    expect(evidenceOnly).not.toContain('fix first');
    expect(evidenceOnly).not.toContain('next take');
    expect(evidenceOnly).not.toContain('final report prose');
  });

  it('persists candidate technique evidence only as internal non-authoritative observation candidates', async () => {
    const { payload, metrics } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        candidate_technique_evidence: [
          { safe_evidence_summary: 'Breath support pattern is observable as a candidate only.', label: 'breath_support' },
          { safe_evidence_summary: 'Authoritative diagnosis with score', score: 99, authoritative: true },
        ],
      }),
    });
    expect(payload.candidate_technique_evidence).toHaveLength(1);
    expect(payload.candidate_technique_evidence[0]).toMatchObject({
      evidence_family: 'candidate_technique',
      public_display_status: 'internal_only',
    });
    expect(payload.rejected_or_filtered_fields).toContain('candidate_technique_evidence[1]');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('persists video, audio, material and performance observations when provided by runEvidencePass', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle();
    expect(payload.video_observable_evidence_items.some((item: any) => item.source_artefact_id === 'run_evidence_pass')).toBe(true);
    expect(payload.audio_observable_evidence_items.some((item: any) => item.evidence_family === 'audio')).toBe(true);
    expect(payload.material_observable_evidence_items.some((item: any) => item.evidence_family === 'material')).toBe(true);
    expect(payload.performance_observable_evidence_items.some((item: any) => item.evidence_family === 'performance')).toBe(true);
    const serialised = JSON.stringify([
      payload.video_observable_evidence_items,
      payload.audio_observable_evidence_items,
      payload.material_observable_evidence_items,
      payload.performance_observable_evidence_items,
    ]).toLowerCase();
    expect(serialised).not.toContain('ready to submit');
    expect(serialised).not.toContain('overall score');
  });

  it('records missing extractor families as unavailable instead of fabricating evidence', async () => {
    const { payload } = await emitFilteredRunEvidencePassAnalysisBundle({
      evidence: sampleRunEvidencePass({
        presentation_evidence: [],
        timestamped_evidence: [],
        candidate_technique_evidence: [],
      }),
    });
    expect(payload.evidence_state_status).toBe('partial');
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    const unavailableKinds = payload.unsupported_or_unavailable_evidence.map((item: any) => item.evidence_kind);
    expect(unavailableKinds).toEqual(expect.arrayContaining([
      'video_observable_evidence_not_extracted',
      'audio_observable_evidence_not_extracted',
      'material_observable_evidence_not_extracted',
      'performance_observable_evidence_not_extracted',
      'candidate_technique_observable_evidence_not_extracted',
    ]));
  });

  it('blocks Step 2 dependency when TruthStateMap linkage is missing', async () => {
    const { payload, metrics } = await emitFilteredRunEvidencePassAnalysisBundle({ truth: false });
    expect(payload.step2_dependency_status).toMatchObject({ status: 'blocked', can_run_step2: false });
    expect(payload.step2_dependency_status.blocker_codes).toContain('TruthStateMap_missing');
    expect(metrics.blocker_codes).toContain('TruthStateMap_missing');
  });

  it('reports Step 1 write failure without creating satisfying evidence', async () => {
    const rootFile = path.join(os.tmpdir(), `qa-s914g-not-dir-${Math.random().toString(36).slice(2)}`);
    await writeFile(rootFile, 'not a directory', 'utf8');
    const filtered = filterRunEvidencePassForStep1(sampleRunEvidencePass(), { model: 'test-model', durationSeconds: 60 });
    const out = await emitAnalysisEvidenceStatePrerequisite({
      run_id: 'run-s914g-write-fail',
      analysis_run_id: 'run-s914g-write-fail',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'analysis_step_1_evidence_mapping',
      filtered_run_evidence_pass_step1: filtered,
      root_dir: rootFile,
      internal_qa_emit: true,
    } as any);
    expect(out.written).toBe(false);
    expect(out.level2_satisfies).toBe(false);
  });

  it('allows Step 2 to continue when Step 1 evidence is valid but the QA sink write fails', async () => {
    const rootFile = path.join(os.tmpdir(), `qa-s914g-step2-sink-fail-${Math.random().toString(36).slice(2)}`);
    await writeFile(rootFile, 'not a directory', 'utf8');
    const run = 'take-step2-sink-fail';
    const filtered = filterRunEvidencePassForStep1(sampleRunEvidencePass(), { model: 'test-model', durationSeconds: 60 });
    const out = await emitAnalysisEvidenceStatePrerequisite({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 'step2-sink-fail',
      source_module: 'test',
      source_stage: 'analysis_step_1_evidence_mapping',
      resolver_output_available: true,
      truth_state_map_available: true,
      filtered_run_evidence_pass_step1: filtered,
      root_dir: rootFile,
      internal_qa_emit: true,
    } as any);

    const dependency = evaluateStep1EvidenceForStep2({
      analysisEvidenceState: out,
      expectedRunId: run,
      expectedAnalysisRunId: run,
      takeId: 'step2-sink-fail',
      internalQaEmit: true,
    });

    expect(out.written).toBe(false);
    expect(out.payload.step2_dependency_status).toMatchObject({ can_run_step2: true });
    expect(dependency.step1EvidenceValidForStep2).toBe(true);
    expect(dependency.step1QaPersistenceStatus).toBe('failed_emission');
    expect(dependency.step2DependencyBlocked).toBe(false);
    expect(dependency.warningCodes).toEqual(['qa_persistence_failed_but_step1_evidence_valid']);

    const manifestRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-s914g-step2-sink-fail-manifest-'));
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 'step2-sink-fail',
      root_dir: manifestRoot,
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
      emitted_blocked_artefact_ids: ['analysis_evidence_state'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter', analysis_evidence_state: out.source_classification },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, analysis_evidence_state: false },
      analysis_evidence_state_summary: {
        ...out.summary,
        qa_persistence_status: 'failed_emission',
        qa_persistence_warning: out.warning ?? null,
      },
    });
    const manifest = JSON.parse(await readFile(path.join(manifestRoot, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(manifestRoot, run, 'qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe('emitted_blocked');
    expect(metrics.analysis_evidence_state_status).toBe('emitted_blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
  });

  it('blocks Step 2 when Step 1 evidence is invalid even if a result object exists', async () => {
    const run = 'take-step2-invalid';
    const dependency = evaluateStep1EvidenceForStep2({
      analysisEvidenceState: {
        written: false,
        payload: {
          run_id: run,
          analysis_run_id: run,
          evidence_state_status: 'blocked',
          step2_dependency_status: {
            status: 'blocked',
            can_run_step2: false,
            blocker_codes: ['TruthStateMap_missing'],
          },
        },
      },
      expectedRunId: run,
      expectedAnalysisRunId: run,
      takeId: 'step2-invalid',
      internalQaEmit: true,
    });

    expect(dependency.step1EvidenceValidForStep2).toBe(false);
    expect(dependency.step2DependencyBlocked).toBe(true);
    expect(dependency.blockerCodes).toEqual(expect.arrayContaining([
      'analysis_evidence_state_invalid_for_step2',
      'analysis_evidence_state_step2_dependency_blocked',
      'TruthStateMap_missing',
    ]));
  });

  it('handles malformed runEvidencePass output without crashing', async () => {
    const { payload, out } = await emitFilteredRunEvidencePassAnalysisBundle({ evidence: 'malformed-runEvidencePass-output' });
    expect(out.written).toBe(true);
    expect(payload.evidence_state_status).toBe('blocked');
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
    expect(payload.rejected_or_filtered_fields).toContain('runEvidencePass.malformed_output');
    expect(payload.blocker_codes).toContain('runEvidencePass_malformed_output');
  });

  it('does not let caller metadata override canonical AnalysisEvidenceState fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914g-canonical-'));
    const run = `run-s914g-canonical-${Math.random().toString(36).slice(2)}`;
    const filtered = {
      ...filterRunEvidencePassForStep1(sampleRunEvidencePass(), { model: 'test-model', durationSeconds: 60 }),
      schema_version: 'attacker',
      artefact_type: 'accepted_gate_evidence',
      run_id: 'attacker-run',
      analysis_run_id: 'attacker-analysis',
      internal_only: false,
      privacy_classification: 'public',
      source_classification: 'accepted_gate_evidence',
      cannot_satisfy_v3_gate: false,
      blocker_codes: [],
    };
    const out = await emitAnalysisEvidenceStatePrerequisite({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'analysis_step_1_evidence_mapping',
      selected_level: 'advanced',
      audition_type: 'monologue',
      brief_presence: 'supplied',
      material_presence: 'supplied',
      media_readiness_state: 'ready',
      media_duration_seconds: 60,
      duration_confidence: 'known',
      resolver_output_available: true,
      truth_state_map_available: true,
      filtered_run_evidence_pass_step1: filtered,
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(out.written).toBe(true);
    const payload = out.payload as any;
    expect(payload.schema_version).toBe('tapecoach_v3_analysis_evidence_state_v1');
    expect(payload.artefact_type).toBe('analysis_evidence_state');
    expect(payload.run_id).toBe(run);
    expect(payload.analysis_run_id).toBe(run);
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.cannot_satisfy_v3_gate).toBe(true);
  });

  it('keeps EvidenceAnchors truthful after persisted filtered Step 1 evidence', async () => {
    const base = await emitFilteredRunEvidencePassAnalysisBundle();
    const anchorsOut = await emitEvidenceAnchorsFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'process_take_success',
      analysis_evidence_state_data: base.payload,
      raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
      root_dir: base.root,
      internal_qa_emit: true,
    } as any);
    expect(anchorsOut.written).toBe(true);
    expect(anchorsOut.source_classification).toBe('mixed_real_and_legacy_non_satisfying');
    expect(anchorsOut.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('keeps PublicClaimTrace legacy and non-satisfying after persisted filtered Step 1 evidence', async () => {
    const { claims, manifest, metrics } = await emitPromotedEvidenceAnchorsBundle({ includePublicClaimTrace: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('aligns manifest and qa_acceptance_metrics for AnalysisEvidenceState and keeps global gates blocked', async () => {
    const { manifest, metrics, out, payload } = await emitFilteredRunEvidencePassAnalysisBundle();
    expect(manifest.artefact_status_by_id.analysis_evidence_state).toBe(metrics.analysis_evidence_state_status);
    expect(manifest.artefact_source_classification_by_id.analysis_evidence_state).toBe(metrics.analysis_evidence_state_source_classification);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.analysis_evidence_state).toBe(false);
    expect(metrics.analysis_evidence_state_gate_status).toBe('insufficient');
    expect(metrics.analysis_evidence_state_gate_reason).toBe(out.summary.analysis_evidence_state_gate_reason);
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(payload.public_output_unchanged).toBe(true);
    expect(manifest.level2_qa_acceptance).toBe('not_accepted');
    expect(manifest.production_safe_status).toBe('blocked');
    expect(manifest.public_scoring_status).toBe('blocked');
    expect(manifest.public_technique_authority_status).toBe('blocked');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});

describe('S9-14H EvidenceAnchors aggregate promotion audit', () => {
  it('keeps current partial S9-14G coverage aggregate insufficient while individual anchors are real_runtime_v3', async () => {
    const base = await emitFilteredRunEvidencePassAnalysisBundle();
    const { anchors, manifest, metrics } = await emitAnchorsAndManifestFromAnalysisState(base);
    expect(anchors.real_runtime_anchor_count).toBeGreaterThan(0);
    expect(anchors.anchors.some((anchor: any) => anchor.source_family === 'real_runtime_v3')).toBe(true);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.evidence_anchor_trace_summary.blocker_codes).toEqual(expect.arrayContaining(['partial_step1_evidence_coverage', 'missing_candidate_technique_evidence']));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
  });

  it('allows complete required evidence families to satisfy the EvidenceAnchors subgate only', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    const { anchors, manifest, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.anchors.every((anchor: any) => anchor.source_artefact_id === 'analysis_evidence_state')).toBe(true);
    expect(anchors.anchors.every((anchor: any) => anchor.source_family === 'real_runtime_v3')).toBe(true);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('sufficient');
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('real_runtime_v3');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(true);
    expect(metrics.evidence_anchor_gate_status).toBe('sufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
  });

  it('does not let complete deterministic facts alone satisfy when performance coverage is missing', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload, {
      familyCoverage: { performance: false },
      familyStatus: { performance: 'not_extracted' },
    });
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('missing_performance_observable_evidence');
  });

  it('keeps unavailable video audio material and candidate technique families aggregate insufficient when required', async () => {
    for (const [family, expectedReason] of [
      ['video', 'missing_video_observable_evidence'],
      ['audio', 'missing_audio_observable_evidence'],
      ['material', 'missing_material_observable_evidence'],
      ['candidate_technique', 'missing_candidate_technique_evidence'],
    ] as const) {
      const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
      completeAnalysisEvidenceStateForAggregate(bundle.payload, {
        familyCoverage: { [family]: false },
        familyStatus: { [family]: 'not_extracted' },
      });
      const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
      expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
      expect(metrics.evidence_anchor_gate_reason).toBe(expectedReason);
      expect(anchors.blocker_codes).toContain(expectedReason);
    }
  });

  it('does not block on a truthfully not_applicable material family', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied', materialPresence: 'absent' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload, { materialNotApplicable: true });
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.evidence_anchor_trace_summary.blocker_codes).not.toContain('missing_material_observable_evidence');
    expect(metrics.evidence_anchor_gate_status).toBe('sufficient');
  });

  it('keeps mixed real_runtime_v3 and legacy_adapter anchors insufficient', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    const { anchors, manifest, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle, {
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report note' }] } },
    });
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.blocker_codes).toEqual(expect.arrayContaining(['mixed_real_and_legacy_non_satisfying', 'forbidden_raw_report_anchor_source']));
    expect(manifest.artefact_source_classification_by_id.evidence_anchors).toBe('mixed_real_and_legacy_non_satisfying');
    expect(metrics.evidence_anchor_source_family_summary.real_runtime_v3).toBeGreaterThan(0);
    expect(metrics.evidence_anchor_source_family_summary.legacy_adapter).toBe(1);
  });

  it('does not count raw_report or report_data anchors toward aggregate satisfaction', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle, {
      rawReport: { report_data: { timestamped_notes: [{ timestamp: '00:10', note: 'Legacy report_data note' }] } },
    });
    const legacy = anchors.anchors.find((anchor: any) => anchor.source_artefact_id === 'raw_report');
    expect(legacy.source_path).toContain('report_data.timestamped_notes');
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('forbidden_raw_report_anchor_source');
  });

  it('keeps source_scaffold helper and local fixture evidence non-satisfying', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914h-scaffold-'));
    const run = 'run-s914h-scaffold';
    await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 't1',
      submission_id: 'sub1',
      root_dir: root,
      internal_qa_emit: true,
      emitted_artefact_ids: ['evidence_anchors'],
      artefact_source_classification_by_id: { evidence_anchors: 'source_scaffold' },
      artefact_level2_spine_satisfaction_by_id: { evidence_anchors: true },
      runtime_evidence_accepted_by_id: ['evidence_anchors'],
      real_v3_spine_artefact_ids: ['evidence_anchors'],
      evidence_anchor_trace_summary: {
        anchor_count: 1,
        real_runtime_anchor_count: 0,
        legacy_adapter_anchor_count: 0,
        blocked_anchor_count: 1,
        source_family_summary: { legacy_adapter: 0, report_snapshot: 0, real_runtime_v3: 0, input_artifact: 0, resolver_truth_state: 0, source_scaffold: 1 },
        evidence_anchor_gate_status: 'insufficient',
        evidence_anchor_gate_reason: 'source_scaffold_not_gate_evidence',
        blocker_codes: ['source_scaffold_not_gate_evidence'],
      },
    });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('source_scaffold_not_gate_evidence');
  });

  it('blocks aggregate satisfaction on unresolved AnalysisEvidenceState source paths', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    bundle.payload.observable_evidence_items[0].analysis_evidence_state_source_path = 'observable_evidence_items[999]';
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('unresolved_source_path');
    expect(anchors.blocker_codes).toContain('unresolved_source_path');
  });

  it('blocks aggregate satisfaction when required truth linkage is missing', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    const truthItem = bundle.payload.observable_evidence_items.find((item: any) => item.source_artefact_id === 'truth_state_map');
    truthItem.linked_truth_state_ids = [];
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('missing_truth_state_linkage');
  });

  it('does not count anchors whose cannot_satisfy_v3_gate remains true', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    bundle.payload.observable_evidence_items[0].blocker_codes = ['caller_marked_anchor_blocked'];
    const { anchors, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(anchors.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    expect(anchors.blocker_codes).toContain('anchor_cannot_satisfy_v3_gate');
  });

  it('does not count rejected prohibited runEvidencePass fields as evidence coverage', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload, {
      familyCoverage: { performance: false },
      familyStatus: { performance: 'not_extracted' },
    });
    bundle.payload.rejected_or_filtered_fields = ['overall_score', 'fix_first', 'role_fit_evidence'];
    bundle.payload.prohibited_field_filter_summary = { rejected_field_count: 3, rejected_field_keys: ['overall_score', 'fix_first', 'role_fit_evidence'], raw_values_persisted: false };
    const { metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle);
    expect(metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(metrics.evidence_anchor_gate_reason).toBe('missing_performance_observable_evidence');
    expect(metrics.public_scoring_status).toBe('blocked');
  });

  it('aligns manifest and qa_acceptance_metrics for sufficient and insufficient aggregate cases', async () => {
    const complete = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(complete.payload);
    const sufficient = await emitAnchorsAndManifestFromAnalysisState(complete);
    expect(sufficient.manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(true);
    expect(sufficient.metrics.evidence_anchor_gate_status).toBe('sufficient');
    expect(sufficient.metrics.evidence_anchor_source_family_summary).toEqual(sufficient.anchors.evidence_anchor_trace_summary.source_family_summary);

    const partial = await emitPromotedEvidenceAnchorsBundle();
    expect(partial.manifest.artefact_level2_spine_satisfaction_by_id.evidence_anchors).toBe(false);
    expect(partial.metrics.evidence_anchor_gate_status).toBe('insufficient');
    expect(partial.metrics.blocker_codes).toEqual(partial.manifest.blocker_codes);
  });

  it('keeps PublicClaimTrace legacy and global accepted gate posture blocked', async () => {
    const bundle = await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' });
    completeAnalysisEvidenceStateForAggregate(bundle.payload);
    const { claims, manifest, metrics } = await emitAnchorsAndManifestFromAnalysisState(bundle, { includePublicClaimTrace: true });
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(JSON.stringify(manifest.artefact_source_classification_by_id)).not.toContain('accepted_gate_evidence');
  });

  it('does not change public output and does not crash on malformed aggregate inputs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914h-malformed-'));
    const out = await emitEvidenceAnchorsFirstPass({
      run_id: 'run-s914h-malformed',
      analysis_run_id: 'run-s914h-malformed',
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      analysis_evidence_state_data: { run_id: 'run-s914h-malformed', analysis_run_id: 'run-s914h-malformed', source_classification: 'real_runtime_v3', evidence_state_status: 'complete', cannot_satisfy_v3_gate: false, observable_evidence_items: [{}] },
      root_dir: root,
      internal_qa_emit: true,
    } as any);
    expect(out.written).toBe(true);
    expect(out.evidence_anchor_trace_summary.evidence_anchor_gate_status).toBe('insufficient');
    const payload = JSON.parse(await readFile(path.join(root, 'run-s914h-malformed', 'takes', 'take-t1', 'analysis-run-s914h-malformed', 'traces', 'EvidenceAnchors.json'), 'utf8'));
    expect(payload.public_output_unchanged).toBe(true);
    expect(payload.production_safe_status).toBe('blocked');
  });
});

async function emitClaimCandidateBundle(options: {
  rawReport?: Record<string, unknown> | null;
  includeAnalysis?: boolean;
  includeAnchors?: boolean;
  includePublicClaimTrace?: boolean;
  analysisEvidenceOverrides?: Record<string, unknown>;
  metadataOverrides?: Record<string, unknown>;
} = {}) {
  const includeAnalysis = options.includeAnalysis ?? true;
  const base = includeAnalysis
    ? await emitAnalysisEvidenceStateBundle({ duration: 42, componentStatus: 'supplied' })
    : {
      root: await mkdtemp(path.join(os.tmpdir(), 'qa-s914k-')),
      run: `run-s914k-${Math.random().toString(36).slice(2)}`,
      take: 't1',
      out: null,
      payload: null,
    };
  const analysisEvidencePayload = base.payload && options.analysisEvidenceOverrides
    ? { ...base.payload, ...options.analysisEvidenceOverrides }
    : base.payload;
  let anchorsOut: any = null;
  let anchors: any = null;
  if (options.includeAnchors && analysisEvidencePayload) {
    anchorsOut = await emitEvidenceAnchorsFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'unit',
      analysis_evidence_state_data: analysisEvidencePayload,
      root_dir: base.root,
      internal_qa_emit: true,
    });
    const anchorsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'EvidenceAnchors.json');
    anchors = anchorsOut.written ? JSON.parse(await readFile(anchorsPath, 'utf8')) : null;
  }
  const claimCandidateOut = await emitClaimCandidateTrace({
    run_id: base.run,
    analysis_run_id: base.run,
    submission_id: 'sub1',
    take_id: base.take,
    source_module: 'test',
    source_stage: 'unit',
    analysis_evidence_state_data: analysisEvidencePayload,
    evidence_anchors_data: anchors,
    raw_report_data: options.rawReport === undefined ? null : { report_data: options.rawReport },
    metadata_overrides: options.metadataOverrides,
    root_dir: base.root,
    internal_qa_emit: true,
  });
  const claimCandidatePath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'ClaimCandidateTrace.json');
  const claimCandidateTrace = claimCandidateOut.written ? JSON.parse(await readFile(claimCandidatePath, 'utf8')) : null;

  let claimsOut: any = null;
  let claims: any = null;
  if (options.includePublicClaimTrace) {
    claimsOut = await emitPublicClaimTraceFirstPass({
      run_id: base.run,
      analysis_run_id: base.run,
      submission_id: 'sub1',
      take_id: base.take,
      source_module: 'test',
      source_stage: 'unit',
      raw_report_data: { report_data: options.rawReport ?? { strengths: ['grounded acting'] } },
      evidence_anchors_data: anchors,
      root_dir: base.root,
      internal_qa_emit: true,
    });
    const claimsPath = path.join(base.root, base.run, 'takes', `take-${base.take}`, `analysis-${base.run}`, 'traces', 'PublicClaimTrace.json');
    claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  }

  await emitQAManifestForAnalysisRun({
    run_id: base.run,
    analysis_run_id: base.run,
    take_id: base.take,
    submission_id: 'sub1',
    root_dir: base.root,
    internal_qa_emit: true,
    emitted_artefact_ids: [
      ...(base.out?.emitted_artefact_ids ?? []),
      ...(anchorsOut?.written ? ['evidence_anchors'] : []),
      ...(claimCandidateOut.written ? ['claim_candidate_trace'] : []),
      ...(claimsOut?.written ? ['public_claim_trace'] : []),
    ],
    emitted_blocked_artefact_ids: [...(base.out?.emitted_blocked_artefact_ids ?? [])],
    artefact_source_classification_by_id: {
      ...(base.out?.written ? { analysis_evidence_state: base.out.source_classification } : {}),
      ...(anchorsOut?.written ? { evidence_anchors: anchorsOut.source_classification } : {}),
      ...(claimCandidateOut.written ? { claim_candidate_trace: claimCandidateOut.source_classification } : {}),
      ...(claimsOut?.written ? { public_claim_trace: 'legacy_adapter' } : {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      ...(base.out?.written ? { analysis_evidence_state: false } : {}),
      ...(anchorsOut?.written ? { evidence_anchors: anchorsOut.level2_satisfies } : {}),
      ...(claimCandidateOut.written ? { claim_candidate_trace: false } : {}),
      ...(claimsOut?.written ? { public_claim_trace: false } : {}),
    },
    analysis_evidence_state_summary: base.out?.summary,
    evidence_anchor_trace_summary: anchorsOut?.evidence_anchor_trace_summary,
    claim_candidate_trace_summary: claimCandidateOut.summary,
    public_claim_trace_summary: claimsOut?.summary,
    legacy_adapter_artefact_ids: claimsOut?.written ? ['public_claim_trace'] : [],
  });
  const manifest = JSON.parse(await readFile(path.join(base.root, base.run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(base.root, base.run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { ...base, anchorsOut, anchors, claimCandidateOut, claimCandidateTrace, claimsOut, claims, manifest, metrics };
}

describe('S9-14K v3 ClaimCandidate artefact', () => {
  it('emits an internal-only ClaimCandidateTrace artefact without satisfying the public claim gate', async () => {
    const { claimCandidateTrace, manifest, metrics } = await emitClaimCandidateBundle();
    expect(claimCandidateTrace.artefact_type).toBe('claim_candidate_trace');
    expect(claimCandidateTrace.internal_only).toBe(true);
    expect(claimCandidateTrace.privacy_classification).toBe('internal_private');
    expect(claimCandidateTrace.cannot_satisfy_public_claim_gate).toBe(true);
    expect(claimCandidateTrace.public_render_permission_status).toBe('not_evaluated_or_blocked');
    expect(manifest.artefact_status_by_id.claim_candidate_trace).toBe('emitted');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.claim_candidate_trace).toBe(false);
    expect(metrics.claim_candidate_gate_status).toBe('insufficient');
  });

  it('does not let caller metadata override canonical ClaimCandidateTrace fields', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      metadataOverrides: {
        schema_version: 'attacker',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong',
        analysis_run_id: 'wrong',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'real_runtime_v3',
        blocker_codes: [],
        cannot_satisfy_public_claim_gate: false,
      },
    });
    expect(claimCandidateTrace.schema_version).toBe('tapecoach_v3_claim_candidate_trace_v1');
    expect(claimCandidateTrace.artefact_type).toBe('claim_candidate_trace');
    expect(claimCandidateTrace.run_id).not.toBe('wrong');
    expect(claimCandidateTrace.analysis_run_id).not.toBe('wrong');
    expect(claimCandidateTrace.internal_only).toBe(true);
    expect(claimCandidateTrace.privacy_classification).toBe('internal_private');
    expect(claimCandidateTrace.cannot_satisfy_public_claim_gate).toBe(true);
    expect(claimCandidateTrace.blocker_codes).toContain('claim_candidate_trace_internal_only_not_public_claim_gate_evidence');
  });

  it('creates factual status candidates from AnalysisEvidenceState without rendering them', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle();
    const selectedLevel = claimCandidateTrace.claim_candidates.find((candidate: any) => String(candidate.safe_candidate_summary).includes('selected_level'));
    const mediaReadiness = claimCandidateTrace.claim_candidates.find((candidate: any) => String(candidate.safe_candidate_summary).includes('media_readiness_state'));
    expect(selectedLevel).toMatchObject({
      source_artefact_id: 'analysis_evidence_state',
      source_family: 'real_runtime_v3',
      eligible_for_public_claim_trace_support_check: true,
      public_display_status: 'not_rendered_internal_candidate',
    });
    expect(mediaReadiness.claim_family).toBe('technical_media');
    expect(claimCandidateTrace.public_output_unchanged).toBe(true);
  });

  it('creates assessability limitation candidates from Step 1 unavailable evidence families', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle();
    const limitation = claimCandidateTrace.claim_candidates.find((candidate: any) => candidate.claim_family === 'assessability_limitation');
    expect(limitation).toBeTruthy();
    expect(limitation.source_artefact_id).toBe('analysis_evidence_state');
    expect(limitation.source_family).toBe('real_runtime_v3');
    expect(['safe_for_public_candidate', 'needs_rewrite']).toContain(limitation.public_safety_status);
  });

  it('creates limitation candidates from string record and mixed Step 1 assessability limitations', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      analysisEvidenceOverrides: {
        unsupported_or_unavailable_evidence: [],
        assessability_limitations: [
          'timestamp_normalisation_warning: take.created_at invalid',
          { reason: 'media readiness pending' },
          '',
          'audio assessability limited',
        ],
      },
    });
    const byPath = new Map(claimCandidateTrace.claim_candidates.map((candidate: any) => [candidate.source_path, candidate]));
    expect(byPath.get('assessability_limitations[0]')).toMatchObject({
      claim_family: 'assessability_limitation',
      source_artefact_id: 'analysis_evidence_state',
      safe_candidate_summary: 'timestamp_normalisation_warning: take.created_at invalid',
    });
    expect(byPath.get('assessability_limitations[1]')).toMatchObject({
      claim_family: 'assessability_limitation',
      safe_candidate_summary: 'media readiness pending',
    });
    expect(byPath.has('assessability_limitations[2]')).toBe(false);
    expect(byPath.get('assessability_limitations[3]')).toMatchObject({
      claim_family: 'assessability_limitation',
      safe_candidate_summary: 'audio assessability limited',
    });
  });

  it('redacts unsafe string limitations instead of leaking raw diagnostics', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      analysisEvidenceOverrides: {
        unsupported_or_unavailable_evidence: [],
        assessability_limitations: ['Use https://example.test/video?token=abc and signed_url=bad'],
      },
    });
    const limitation = claimCandidateTrace.claim_candidates.find((candidate: any) => candidate.source_path === 'assessability_limitations[0]');
    expect(limitation.safe_candidate_summary).toBe('[redacted unsafe candidate summary]');
    expect(limitation.blocker_codes).toContain('unsafe_limitation_summary_redacted');
    const serialized = JSON.stringify(claimCandidateTrace).toLowerCase();
    expect(serialized).not.toContain('https://example.test');
    expect(serialized).not.toContain('token=abc');
    expect(serialized).not.toContain('signed_url=bad');
  });

  it('preserves string unavailable-evidence and timestamp-warning limitations as candidates', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      analysisEvidenceOverrides: {
        unsupported_or_unavailable_evidence: ['video_observable_evidence_not_extracted'],
        assessability_limitations: [],
        timestamp_normalisation_warnings: ['take_created_at_invalid_timestamp'],
      },
    });
    const unavailable = claimCandidateTrace.claim_candidates.find((candidate: any) => candidate.source_path === 'unsupported_or_unavailable_evidence[0]');
    const timestampWarning = claimCandidateTrace.claim_candidates.find((candidate: any) => candidate.source_path === 'timestamp_normalisation_warnings[0]');
    expect(unavailable).toMatchObject({
      claim_family: 'assessability_limitation',
      safe_candidate_summary: 'video_observable_evidence_not_extracted',
    });
    expect(timestampWarning).toMatchObject({
      claim_family: 'assessability_limitation',
      safe_candidate_summary: 'take_created_at_invalid_timestamp',
    });
  });

  it('records raw_report submission verdict candidates as legacy_or_unsupported', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: { submission_verdict: { label: 'Submit', reason: 'Ready to submit with confidence' } },
    });
    expect(claimCandidateTrace.source_classification).toBe('legacy_or_unsupported');
    const candidate = claimCandidateTrace.claim_candidates.find((item: any) => item.source_path === 'report_data.submission_verdict.label');
    expect(candidate).toMatchObject({
      source_family: 'legacy_adapter',
      candidate_support_precheck_status: 'legacy_or_unsupported',
      cannot_satisfy_public_claim_gate: true,
    });
  });

  it('keeps raw_report fix_first next_take strengths and category notes non-satisfying', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: {
        fix_first: 'Sharpen the opening action',
        next_take: 'Use the next take plan',
        strengths: ['Strong acting presence'],
        category_notes: ['Grounded acting reads as professional'],
      },
    });
    const legacyCandidates = claimCandidateTrace.claim_candidates.filter((item: any) => String(item.source_path).startsWith('report_data.'));
    expect(legacyCandidates.length).toBeGreaterThanOrEqual(4);
    expect(legacyCandidates.every((item: any) => item.source_family === 'legacy_adapter')).toBe(true);
    expect(legacyCandidates.every((item: any) => item.candidate_support_precheck_status === 'legacy_or_unsupported')).toBe(true);
  });

  it('blocks score candidates and keeps public scoring blocked', async () => {
    const { claimCandidateTrace, metrics } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: { overall_score: 94, scores: { acting: 91 } },
    });
    const scoreCandidates = claimCandidateTrace.claim_candidates.filter((candidate: any) => candidate.blocked_claim_category === 'public_scoring');
    expect(scoreCandidates.length).toBeGreaterThan(0);
    expect(scoreCandidates.every((candidate: any) => candidate.blocker_codes.includes('public_scoring_blocked'))).toBe(true);
    expect(claimCandidateTrace.public_scoring_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
  });

  it.each([
    ['technique authority', { category_notes: ['Meisner technique authority diagnosis says this is ready'] }, 'public_technique_authority'],
    ['castability bookability marketability', { casting_headline: 'High castability and marketability for this role' }, 'castability_bookability_marketability'],
    ['public comparison winner', { category_notes: ['Take 2 is the winner and recommended over Take 1'] }, 'public_comparison_result'],
  ])('blocks %s candidates', async (_label, rawReport, blockedCategory) => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({ includeAnalysis: false, rawReport });
    const blocked = claimCandidateTrace.claim_candidates.find((candidate: any) => candidate.blocked_claim_category === blockedCategory);
    expect(blocked).toBeTruthy();
    expect(blocked.public_safety_status).toBe('blocked');
    expect(blocked.rewrite_required).toBe(true);
    expect(blocked.cannot_satisfy_public_claim_gate).toBe(true);
  });

  it('marks role and brief-fit overclaim candidates as rewrite_required', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: { category_notes: ['This fits the brief perfectly and should be sent with confidence'] },
    });
    const overclaim = claimCandidateTrace.claim_candidates[0];
    expect(overclaim.public_safety_status).toBe('needs_rewrite');
    expect(overclaim.rewrite_required).toBe(true);
    expect(overclaim.blocker_codes).toContain('unsupported_overclaim_requires_rewrite');
  });

  it('does not render safe_for_public_candidate entries or alter public output posture', async () => {
    const { claimCandidateTrace, metrics } = await emitClaimCandidateBundle();
    expect(claimCandidateTrace.safe_candidate_count).toBeGreaterThan(0);
    expect(claimCandidateTrace.public_render_permission_status).toBe('not_evaluated_or_blocked');
    expect(claimCandidateTrace.public_output_unchanged).toBe(true);
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('does not promote PublicClaimTrace or Level 2 when ClaimCandidateTrace emits', async () => {
    const { claimCandidateTrace, claims, manifest, metrics } = await emitClaimCandidateBundle({
      includeAnchors: true,
      includePublicClaimTrace: true,
      rawReport: { strengths: ['grounded acting'] },
    });
    expect(claimCandidateTrace.artefact_type).toBe('claim_candidate_trace');
    expect(manifest.artefact_source_classification_by_id.public_claim_trace).toBe('legacy_adapter');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('insufficient');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.claim_candidate_trace).toBe(false);
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('aligns manifest and qa_acceptance_metrics claim candidate summaries', async () => {
    const { claimCandidateTrace, manifest, metrics } = await emitClaimCandidateBundle({
      rawReport: { overall_score: 88, fix_first: 'Sharpen objective' },
    });
    expect(manifest.artefact_source_classification_by_id.claim_candidate_trace).toBe(claimCandidateTrace.source_classification);
    expect(metrics.claim_candidate_trace_status).toBe('emitted');
    expect(metrics.claim_candidate_source_classification).toBe(claimCandidateTrace.source_classification);
    expect(metrics.claim_candidate_trace_summary.claim_candidate_count).toBe(claimCandidateTrace.claim_candidate_count);
    expect(metrics.claim_candidate_source_summary).toEqual(claimCandidateTrace.claim_candidate_source_summary);
    expect(metrics.blocker_codes).toContain('claim_candidate_trace_internal_only_not_public_claim_gate_evidence');
  });

  it('redacts unsafe candidate diagnostics without leaking URLs credentials or private payloads', async () => {
    const { claimCandidateTrace } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: { fix_first: 'Use https://example.test/video?token=abc and signed_url=bad' },
    });
    const serialized = JSON.stringify(claimCandidateTrace).toLowerCase();
    expect(serialized).toContain('[redacted unsafe candidate summary]');
    expect(serialized).not.toContain('https://example.test');
    expect(serialized).not.toContain('token=abc');
    expect(serialized).not.toContain('signed_url=bad');
  });

  it('does not crash on malformed claim source input and preserves non-satisfying status', async () => {
    const { claimCandidateTrace, metrics } = await emitClaimCandidateBundle({
      includeAnalysis: false,
      rawReport: { fix_first: { malformed: true }, strengths: [{ nested: ['bad'] }, 'Usable legacy strength'] },
    });
    expect(claimCandidateTrace.claim_candidate_count).toBeGreaterThan(0);
    expect(claimCandidateTrace.cannot_satisfy_public_claim_gate).toBe(true);
    expect(metrics.claim_candidate_gate_status).toBe('insufficient');
  });
});

function claimsOutSummary(claims: any) {
  return {
    claim_count: claims.claim_count,
    unsupported_claim_count: claims.unsupported_claim_count,
    legacy_untraced_claim_count: claims.legacy_untraced_claim_count,
    unsafe_or_overclaim_count: claims.unsafe_or_overclaim_count,
    rewrite_required_count: claims.rewrite_required_count,
  };
}

function runtimeAnchor(overrides: Record<string, unknown> = {}) {
  const id = String(overrides.evidence_anchor_id ?? 'ea-brief-presence');
  return {
    schema_version: 'tapecoach_v3_evidence_anchors_runtime_v1',
    artefact_type: 'evidence_anchors',
    run_id: 'run-s914l',
    analysis_run_id: 'run-s914l',
    internal_only: true,
    privacy_classification: 'internal_private',
    source_classification: 'real_runtime_v3',
    source_family: 'real_runtime_v3',
    evidence_anchor_id: id,
    source_stage: 'analysis_step_1_evidence_mapping',
    source_artefact_id: 'analysis_evidence_state',
    source_path: `observable_evidence_items.${id}`,
    safe_evidence_summary: 'brief_presence: supplied',
    evidence_text: 'brief_presence: supplied',
    evidence_modality: 'submission_context',
    timestamp_source: 'not_applicable',
    linked_truth_state_ids: ['truth-brief-presence'],
    blocker_codes: [],
    cannot_satisfy_v3_gate: false,
    public_display_status: 'internal_only',
    ...overrides,
  };
}

function claimCandidate(overrides: Record<string, unknown> = {}) {
  return {
    claim_candidate_id: 'cc-brief-presence',
    safe_candidate_summary: 'brief supplied',
    claim_type: 'factual_or_limitation_status',
    claim_family: 'factual_status',
    source_artefact_id: 'analysis_evidence_state',
    source_path: 'observable_evidence_items[0]',
    source_family: 'real_runtime_v3',
    source_stage: 'analysis_step_1_evidence_mapping',
    required_evidence_anchor_family: 'brief_presence',
    required_truth_state_family: 'linked_truth_state_ids',
    linked_evidence_anchor_ids: ['ea-brief-presence'],
    linked_truth_state_ids: ['truth-brief-presence'],
    candidate_support_precheck_status: 'eligible_for_support_check',
    public_safety_status: 'safe_for_public_candidate',
    rewrite_required: false,
    score_scope: 'not_score',
    blocked_claim_category: null,
    blocker_codes: [],
    public_display_status: 'not_rendered_internal_candidate',
    cannot_satisfy_public_claim_gate: true,
    eligible_for_public_claim_trace_support_check: true,
    ...overrides,
  };
}

async function emitPublicClaimSupportBundle(options: {
  candidates?: Array<Record<string, unknown>>;
  anchors?: Array<Record<string, unknown>>;
  evidenceAnchorGateStatus?: 'sufficient' | 'insufficient';
  evidenceAnchorsDataOverrides?: Record<string, unknown>;
  claimCandidateTraceOverrides?: Record<string, unknown>;
  truthStateMap?: Record<string, unknown> | null;
  metadataOverrides?: Record<string, unknown>;
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914l-'));
  const run = `run-s914l-${Math.random().toString(36).slice(2)}`;
  const take = 't1';
  const anchors = options.anchors ?? [runtimeAnchor()];
  const evidenceAnchorGateStatus = options.evidenceAnchorGateStatus ?? 'sufficient';
  const evidenceAnchorsData = {
    schema_version: 'tapecoach_v3_evidence_anchors_runtime_v1',
    artefact_type: 'evidence_anchors',
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    source_classification: evidenceAnchorGateStatus === 'sufficient' ? 'real_runtime_v3' : 'real_runtime_v3_partial_non_satisfying',
    anchors,
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_gate_reason: evidenceAnchorGateStatus === 'sufficient' ? 'complete_controlled_fixture' : 'partial_step1_evidence_coverage',
    evidence_anchor_source_family_summary: {
      real_runtime_v3: anchors.filter((anchor) => anchor.source_family === 'real_runtime_v3' || anchor.source_classification === 'real_runtime_v3').length,
      legacy_adapter: anchors.filter((anchor) => anchor.source_family === 'legacy_adapter').length,
      report_snapshot: 0,
      source_scaffold: anchors.filter((anchor) => anchor.source_family === 'source_scaffold').length,
    },
    evidence_family_coverage: {
      video: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      audio: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      material: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      performance: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      candidate_technique: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
    },
    evidence_family_status_by_id: {
      video: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      audio: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      material: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      performance: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
      candidate_technique: evidenceAnchorGateStatus === 'sufficient' ? 'complete' : 'partial',
    },
    unsupported_or_unavailable_evidence: evidenceAnchorGateStatus === 'sufficient' ? [] : [{ evidence_kind: 'video_observable_performance_evidence_not_extracted' }],
    blocker_codes: evidenceAnchorGateStatus === 'sufficient' ? [] : ['partial_step1_evidence_coverage'],
    cannot_satisfy_v3_gate: evidenceAnchorGateStatus !== 'sufficient',
    evidence_anchor_trace_summary: {
      evidence_anchor_gate_status: evidenceAnchorGateStatus,
      evidence_anchor_gate_reason: evidenceAnchorGateStatus === 'sufficient' ? 'complete_controlled_fixture' : 'partial_step1_evidence_coverage',
      source_family_summary: {
        real_runtime_v3: anchors.filter((anchor) => anchor.source_family === 'real_runtime_v3' || anchor.source_classification === 'real_runtime_v3').length,
        legacy_adapter: anchors.filter((anchor) => anchor.source_family === 'legacy_adapter').length,
        report_snapshot: 0,
        source_scaffold: anchors.filter((anchor) => anchor.source_family === 'source_scaffold').length,
      },
    },
    ...(options.evidenceAnchorsDataOverrides ?? {}),
  };
  const candidates = options.candidates ?? [claimCandidate()];
  const claimCandidateTrace = {
    schema_version: 'tapecoach_v3_claim_candidate_trace_v1',
    artefact_type: 'claim_candidate_trace',
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    internal_only: true,
    privacy_classification: 'internal_private',
    source_classification: candidates.some((candidate) => candidate.source_family === 'legacy_adapter') ? 'mixed_real_runtime_v3_and_legacy_or_unsupported' : 'real_runtime_v3_candidate_source',
    claim_candidate_count: candidates.length,
    claim_candidates: candidates,
    claim_candidate_source_summary: candidates.reduce<Record<string, number>>((acc, candidate) => {
      const key = String(candidate.source_family ?? 'unknown');
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, { real_runtime_v3: 0, legacy_adapter: 0, report_candidate_requires_support: 0, first_pass_internal: 0, blocked: 0 }),
    cannot_satisfy_public_claim_gate: true,
    ...(options.claimCandidateTraceOverrides ?? {}),
  };
  const claimsOut = await emitPublicClaimTraceFirstPass({
    run_id: run,
    analysis_run_id: run,
    submission_id: 'sub1',
    take_id: take,
    source_module: 'test',
    source_stage: 'unit',
    claim_candidate_trace_data: claimCandidateTrace,
    evidence_anchors_data: evidenceAnchorsData,
    truth_state_map_data: options.truthStateMap === undefined ? { run_id: run, analysis_run_id: run, take_id: take, truth_state_ids: ['truth-brief-presence'], known_truths: { 'truth-brief-presence': 'supplied' } } : options.truthStateMap,
    metadata_overrides: options.metadataOverrides,
    root_dir: root,
    internal_qa_emit: true,
  });
  const claimsPath = path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'PublicClaimTrace.json');
  const claims = claimsOut.written ? JSON.parse(await readFile(claimsPath, 'utf8')) : null;
  await emitQAManifestForAnalysisRun({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    submission_id: 'sub1',
    root_dir: root,
    internal_qa_emit: true,
    emitted_artefact_ids: ['claim_candidate_trace', 'evidence_anchors', ...(claimsOut.written ? ['public_claim_trace'] : [])],
    artefact_source_classification_by_id: {
      claim_candidate_trace: claimCandidateTrace.source_classification,
      evidence_anchors: evidenceAnchorsData.source_classification,
      ...(claimsOut.written ? { public_claim_trace: claimsOut.source_classification } : {}),
    },
    artefact_level2_spine_satisfaction_by_id: {
      claim_candidate_trace: false,
      evidence_anchors: evidenceAnchorGateStatus === 'sufficient',
      ...(claimsOut.written ? { public_claim_trace: Boolean(claimsOut.level2_satisfies) } : {}),
    },
    evidence_anchor_trace_summary: evidenceAnchorsData.evidence_anchor_trace_summary,
    claim_candidate_trace_summary: {
      claim_candidate_count: candidates.length,
      source_classification: claimCandidateTrace.source_classification,
      claim_candidate_source_summary: claimCandidateTrace.claim_candidate_source_summary,
      claim_candidate_gate_status: 'insufficient',
      claim_candidate_gate_reason: 'claim_candidate_trace_internal_only_not_public_claim_gate_evidence',
    },
    public_claim_trace_summary: claimsOut.summary as any,
    blocker_codes: claimsOut.summary?.blocker_codes ?? [],
    legacy_adapter_artefact_ids: claims?.source_classification === 'legacy_or_unsupported' ? ['public_claim_trace'] : [],
    real_v3_spine_artefact_ids: claimsOut.level2_satisfies ? ['evidence_anchors', 'public_claim_trace'] : (evidenceAnchorGateStatus === 'sufficient' ? ['evidence_anchors'] : []),
    runtime_evidence_accepted_by_id: claimsOut.level2_satisfies ? ['evidence_anchors', 'public_claim_trace'] : (evidenceAnchorGateStatus === 'sufficient' ? ['evidence_anchors'] : []),
  } as any);
  const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
  const metrics = JSON.parse(await readFile(path.join(root, run, 'qa', 'acceptance_metrics.json'), 'utf8'));
  return { root, run, take, claimCandidateTrace, evidenceAnchorsData, claimsOut, claims, manifest, metrics };
}

describe('S9-14L PublicClaimTrace support classification', () => {
  it('keeps legacy raw_report PublicClaimTrace non-satisfying', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({
        safe_candidate_summary: 'Submit this take',
        claim_type: 'readiness_status',
        claim_family: 'readiness_status',
        source_artefact_id: 'raw_report',
        source_path: 'report_data.submission_verdict.label',
        source_family: 'legacy_adapter',
        linked_evidence_anchor_ids: [],
        linked_truth_state_ids: [],
      })],
      anchors: [],
      evidenceAnchorGateStatus: 'insufficient',
    });
    expect(claims.source_classification).toBe('legacy_or_unsupported');
    expect(claims.public_claim_gate_status).toBe('insufficient');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(claims.claims[0].support_status).toBe('legacy_or_unsupported');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it.each([
    ['submission verdict', claimCandidate({ safe_candidate_summary: 'Submit this take with a 95 score', claim_type: 'score_or_verdict', claim_family: 'readiness_status', source_artefact_id: 'raw_report', source_path: 'report_data.submission_verdict.label', source_family: 'legacy_adapter', linked_evidence_anchor_ids: [] }), 'legacy_or_unsupported'],
    ['fix_first next_take', claimCandidate({ safe_candidate_summary: 'Fix first: make the next take sharper', claim_type: 'priority_fix', claim_family: 'priority_fix', source_artefact_id: 'raw_report', source_path: 'report_data.fix_first', source_family: 'legacy_adapter', linked_evidence_anchor_ids: [] }), 'legacy_or_unsupported'],
    ['category notes strengths', claimCandidate({ safe_candidate_summary: 'Strong acting presence', claim_type: 'preserve_strength', claim_family: 'preserve_strength', source_artefact_id: 'raw_report', source_path: 'report_data.strengths[0]', source_family: 'legacy_adapter', linked_evidence_anchor_ids: [] }), 'legacy_or_unsupported'],
  ])('keeps raw_report %s claims non-satisfying', async (_label, candidate, expectedStatus) => {
    const { claims } = await emitPublicClaimSupportBundle({ candidates: [candidate], anchors: [], evidenceAnchorGateStatus: 'insufficient' });
    expect(claims.claims[0].support_status).toBe(expectedStatus);
    expect(claims.claims[0].cannot_satisfy_public_claim_gate).toBe(true);
  });

  it.each([
    ['score', claimCandidate({ safe_candidate_summary: 'overall score: 94', claim_type: 'score_or_verdict', claim_family: 'score_or_verdict', blocked_claim_category: 'public_scoring', blocker_codes: ['public_scoring_blocked'] }), 'public_scoring', 'public_scoring_blocked'],
    ['public technique authority', claimCandidate({ safe_candidate_summary: 'Meisner technique authority diagnosis', claim_type: 'technique_authority', claim_family: 'technique_authority', blocked_claim_category: 'public_technique_authority', blocker_codes: ['public_technique_authority_blocked'] }), 'public_technique_authority', 'public_technique_authority_blocked'],
    ['castability bookability marketability', claimCandidate({ safe_candidate_summary: 'High castability and marketability', claim_type: 'castability_bookability_marketability', claim_family: 'castability_bookability_marketability', blocked_claim_category: 'castability_bookability_marketability', blocker_codes: ['castability_bookability_marketability_blocked'] }), 'castability_bookability_marketability', 'castability_bookability_marketability_blocked'],
    ['public comparison winner', claimCandidate({ safe_candidate_summary: 'Take 2 is the winner and recommendation', claim_type: 'comparison_public_result', claim_family: 'comparison_public_result', blocked_claim_category: 'public_comparison_result', blocker_codes: ['public_comparison_result_blocked'] }), 'public_comparison_result', 'public_comparison_result_blocked'],
  ])('blocks %s claims', async (_label, candidate, blockedCategory, blocker) => {
    const { claims, metrics } = await emitPublicClaimSupportBundle({ candidates: [candidate] });
    expect(claims.claims[0]).toMatchObject({
      support_status: 'blocked',
      public_safety_status: 'blocked',
      blocked_claim_category: blockedCategory,
      rewrite_required: true,
    });
    expect(claims.claims[0].blocker_codes).toContain(blocker);
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('keeps unsupported role or brief-fit overclaims rewrite_required', async () => {
    const { claims } = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({
        safe_candidate_summary: 'Perfectly fits the brief and should be sent with confidence',
        claim_family: 'role_or_brief_fit_overclaim',
        public_safety_status: 'needs_rewrite',
        rewrite_required: true,
        blocked_claim_category: 'role_or_brief_fit_overclaim',
        blocker_codes: ['unsupported_overclaim_requires_rewrite'],
      })],
    });
    expect(claims.claims[0].support_status).toBe('unsupported_overclaim');
    expect(claims.claims[0].public_safety_status).toBe('needs_rewrite');
    expect(claims.claims[0].rewrite_required).toBe(true);
  });

  it('classifies missing evidence, unresolved truth and legacy-only anchor support as non-satisfying', async () => {
    const missingEvidence = await emitPublicClaimSupportBundle({ candidates: [claimCandidate({ linked_evidence_anchor_ids: [] })] });
    expect(missingEvidence.claims.claims[0].support_status).toBe('missing_evidence');
    expect(missingEvidence.claims.claims[0].blocker_codes).toContain('missing_evidence_anchor_support');

    const missingTruth = await emitPublicClaimSupportBundle({ truthStateMap: { truth_state_ids: [] } });
    expect(missingTruth.claims.claims[0].support_status).toBe('missing_truth_link');
    expect(missingTruth.claims.claims[0].blocker_codes).toContain('missing_truth_state_linkage');

    const legacyAnchor = await emitPublicClaimSupportBundle({
      anchors: [runtimeAnchor({ source_family: 'legacy_adapter', source_classification: 'legacy_adapter', cannot_satisfy_v3_gate: true })],
    });
    expect(legacyAnchor.claims.claims[0].support_status).toBe('missing_evidence');
    expect(legacyAnchor.claims.claims[0].blocker_codes).toContain('legacy_anchor_cannot_support_public_claim_gate');
  });

  it('supports factual brief presence and media readiness limitation claims when linked to real anchors and truth', async () => {
    const { claims } = await emitPublicClaimSupportBundle({
      candidates: [
        claimCandidate(),
        claimCandidate({
          claim_candidate_id: 'cc-media-limitation',
          safe_candidate_summary: 'audio evidence family not extracted',
          claim_type: 'assessability_limitation',
          claim_family: 'assessability_limitation',
          required_truth_state_family: 'not_required_for_limitation_candidate',
          linked_evidence_anchor_ids: ['ea-media-limitation'],
          linked_truth_state_ids: [],
        }),
      ],
      anchors: [
        runtimeAnchor(),
        runtimeAnchor({ evidence_anchor_id: 'ea-media-limitation', safe_evidence_summary: 'audio evidence family not extracted', evidence_text: 'audio evidence family not extracted', linked_truth_state_ids: [], evidence_modality: 'audio' }),
      ],
    });
    expect(claims.claims.map((claim: any) => claim.support_status)).toEqual(['supported', 'supported']);
    expect(claims.claims[0].public_safety_status).toBe('safe_for_public_candidate');
    expect(claims.claims[1].claim_family).toBe('assessability_limitation');
  });

  it('allows limitation claim support while broader EvidenceAnchors aggregate is partial, but keeps aggregate PublicClaimTrace insufficient when other claims are unsupported', async () => {
    const { claims } = await emitPublicClaimSupportBundle({
      evidenceAnchorGateStatus: 'insufficient',
      candidates: [
        claimCandidate({
          claim_candidate_id: 'cc-limitation',
          safe_candidate_summary: 'video evidence family not extracted',
          claim_type: 'assessability_limitation',
          claim_family: 'assessability_limitation',
          required_truth_state_family: 'not_required_for_limitation_candidate',
          linked_evidence_anchor_ids: ['ea-limitation'],
          linked_truth_state_ids: [],
        }),
        claimCandidate({ claim_candidate_id: 'cc-strength', safe_candidate_summary: 'preserve the opening beat', claim_type: 'preserve_strength', claim_family: 'preserve_strength', linked_evidence_anchor_ids: ['ea-limitation'], linked_truth_state_ids: [], required_truth_state_family: 'not_required_for_runtime_fact' }),
      ],
      anchors: [runtimeAnchor({ evidence_anchor_id: 'ea-limitation', linked_truth_state_ids: [], safe_evidence_summary: 'video evidence family not extracted' })],
    });
    expect(claims.claims[0].support_status).toBe('supported');
    expect(claims.claims[1].support_status).toBe('partially_supported');
    expect(claims.public_claim_gate_status).toBe('insufficient');
  });

  it('keeps priority-fix v3 candidates non-satisfying without real support and does not render safe candidates', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ claim_type: 'priority_fix', claim_family: 'priority_fix', safe_candidate_summary: 'adjust the eyeline', linked_evidence_anchor_ids: [] })],
    });
    expect(claims.claims[0].support_status).toBe('missing_evidence');
    expect(claims.public_output_unchanged).toBe(true);
    expect(claims.claims[0].public_display_status).toBe('not_rendered_internal_trace');
    expect(metrics.public_output_unchanged).toBe(true);
  });

  it('can satisfy the PublicClaimTrace subgate in a complete controlled fixture without accepting global Level 2', async () => {
    const { claims, manifest, metrics } = await emitPublicClaimSupportBundle();
    expect(claims.public_claim_gate_status).toBe('sufficient');
    expect(claims.source_classification).toBe('real_runtime_v3_claim_support');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(false);
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_claim_trace).toBe(true);
    expect(metrics.public_claim_gate_status).toBe('sufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
  });

  it('prevents full PublicClaimTrace satisfaction for non-limitation claims when EvidenceAnchors aggregate is insufficient', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle({ evidenceAnchorGateStatus: 'insufficient' });
    expect(claims.claims[0].support_status).toBe('partially_supported');
    expect(claims.public_claim_gate_status).toBe('insufficient');
    expect(metrics.public_claim_gate_status).toBe('insufficient');
  });

  it('does not let caller metadata override canonical PublicClaimTrace fields', async () => {
    const { claims } = await emitPublicClaimSupportBundle({
      metadataOverrides: {
        schema_version: 'attacker',
        artefact_type: 'accepted_gate_evidence',
        run_id: 'wrong',
        analysis_run_id: 'wrong',
        internal_only: false,
        privacy_classification: 'public',
        source_classification: 'accepted_gate_evidence',
        cannot_satisfy_public_claim_gate: false,
        blocker_codes: [],
      },
    });
    expect(claims.schema_version).toBe('tapecoach_v3_public_claim_trace_support_v1');
    expect(claims.artefact_type).toBe('public_claim_trace');
    expect(claims.run_id).not.toBe('wrong');
    expect(claims.analysis_run_id).not.toBe('wrong');
    expect(claims.internal_only).toBe(true);
    expect(claims.privacy_classification).toBe('internal_private');
    expect(claims.source_classification).toBe('real_runtime_v3_claim_support');
  });

  it('redacts diagnostics and aligns manifest and qa_acceptance_metrics for insufficient and sufficient cases', async () => {
    const insufficient = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ safe_candidate_summary: 'Use https://example.test/video?token=abc', linked_evidence_anchor_ids: [] })],
    });
    const serialized = JSON.stringify(insufficient.claims).toLowerCase();
    expect(serialized).toContain('[redacted unsafe candidate summary]');
    expect(serialized).not.toContain('token=abc');
    expect(insufficient.manifest.artefact_source_classification_by_id.public_claim_trace).toBe(insufficient.claims.source_classification);
    expect(insufficient.metrics.public_claim_trace_summary.public_claim_gate_status).toBe('insufficient');

    const sufficient = await emitPublicClaimSupportBundle();
    expect(sufficient.manifest.artefact_source_classification_by_id.public_claim_trace).toBe('real_runtime_v3_claim_support');
    expect(sufficient.metrics.public_claim_gate_status).toBe('sufficient');
    expect(sufficient.metrics.public_claim_gate_reason).toBe('real_runtime_v3_claim_support_complete');
  });

  it('keeps global gates blocked and handles malformed ClaimCandidateTrace without crashing', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle({
      candidates: [{ malformed: true, linked_evidence_anchor_ids: ['missing-anchor'], source_family: 'real_runtime_v3' }],
      truthStateMap: null,
    });
    expect(claims.public_claim_gate_status).toBe('insufficient');
    expect(claims.claims[0].support_status).toBe('missing_evidence');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });
});

describe('S9-14M final runtime evidence promotion audit guardrail', () => {
  it('wires ClaimCandidateTrace into process-take PublicClaimTrace support classification', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/process-take.server.ts'), 'utf8');
    expect(source).toContain('emitClaimCandidateTrace');
    expect(source).toContain('claim_candidate_trace_data: claimCandidateTrace.written');
    expect(source).toContain('run_id: `take-${takeId}`');
    expect(source).toContain('take_id: takeId');
    expect(source).toContain('evidence_anchor_gate_status: evidenceAnchors.evidence_anchor_trace_summary?.evidence_anchor_gate_status');
    expect(source).toContain('evidence_anchor_trace_summary: evidenceAnchors.evidence_anchor_trace_summary');
    expect(source).toContain('evidence_anchor_source_family_summary: evidenceAnchors.evidence_anchor_trace_summary?.source_family_summary');
    expect(source).toContain('evidence_family_coverage: evidenceAnchors.evidence_family_coverage');
    expect(source).toContain('evidence_family_status_by_id: evidenceAnchors.evidence_family_status_by_id');
    expect(source).toContain('unsupported_or_unavailable_evidence: evidenceAnchors.unsupported_or_unavailable_evidence');
    expect(source).toContain('blocker_codes: evidenceAnchors.blocker_codes');
    expect(source).toContain('cannot_satisfy_v3_gate: evidenceAnchors.cannot_satisfy_v3_gate');
    expect(source).toContain('truth_state_map_data: resolverTruth.written ? resolverTruth.truth_state_map : null');
    expect(source).toContain('evaluateStep1EvidenceForStep2');
    expect(source).toContain("step1QaPersistenceStatus === 'failed_emission'");
    expect(source).toContain('qa_persistence_failed_but_step1_evidence_valid');
    expect(source).toContain('analysisEvidenceStatePayloadAvailable');
    expect(source).toContain('public_claim_trace: publicClaimTrace.source_classification');
    expect(source).toContain('claim_candidate_trace_summary: claimCandidateTrace.written ? claimCandidateTrace.summary : undefined');
    expect(source).not.toContain("public_claim_trace: 'legacy_adapter'");
  });

  it.each([
    ['run_id', { run_id: 'take-other' }],
    ['analysis_run_id', { analysis_run_id: 'take-other' }],
    ['take_id', { take_id: 'other-take' }],
  ])('rejects mismatched ClaimCandidateTrace %s before support classification', async (_field, overrides) => {
    const { claims } = await emitPublicClaimSupportBundle({ claimCandidateTraceOverrides: overrides });
    expect(claims.public_claim_gate_status).toBe('insufficient');
    expect(claims.cannot_satisfy_public_claim_gate).toBe(true);
    expect(claims.blocker_codes).toContain('claim_candidate_trace_identity_mismatch');
    expect(claims.claims[0].support_status).toBe('blocked');
  });

  it('rejects candidate-level identity conflicts and missing ClaimCandidateTrace identity', async () => {
    const candidateConflict = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ source_take_id: 'other-take' })],
    });
    expect(candidateConflict.claims.public_claim_gate_status).toBe('insufficient');
    expect(candidateConflict.claims.blocker_codes).toContain('claim_candidate_trace_candidate_identity_mismatch');
    expect(candidateConflict.claims.claims[0].support_status).toBe('blocked');

    const missingIdentity = await emitPublicClaimSupportBundle({
      claimCandidateTraceOverrides: { run_id: undefined, analysis_run_id: undefined, take_id: undefined },
    });
    expect(missingIdentity.claims.public_claim_gate_status).toBe('insufficient');
    expect(missingIdentity.claims.blocker_codes).toContain('claim_candidate_trace_identity_missing');
    expect(missingIdentity.claims.claims[0].support_status).toBe('blocked');
  });

  it('allows matching ClaimCandidateTrace identity to reach controlled support classification', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle();
    expect(claims.blocker_codes).not.toContain('claim_candidate_trace_identity_mismatch');
    expect(claims.blocker_codes).not.toContain('claim_candidate_trace_identity_missing');
    expect(claims.claims[0].support_status).toBe('supported');
    expect(claims.public_claim_gate_status).toBe('sufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
  });

  it('does not let stale EvidenceAnchors or TruthStateMap data support the current PublicClaimTrace', async () => {
    const staleAnchors = await emitPublicClaimSupportBundle({
      evidenceAnchorsDataOverrides: { run_id: 'take-other', analysis_run_id: 'take-other' },
    });
    expect(staleAnchors.claims.public_claim_gate_status).toBe('insufficient');
    expect(staleAnchors.claims.claims[0].support_status).toBe('missing_evidence');
    expect(staleAnchors.claims.blocker_codes).toContain('evidence_anchors_identity_mismatch');

    const staleTruth = await emitPublicClaimSupportBundle({
      truthStateMap: { run_id: 'take-other', analysis_run_id: 'take-other', take_id: 't1', truth_state_ids: ['truth-brief-presence'] },
    });
    expect(staleTruth.claims.public_claim_gate_status).toBe('insufficient');
    expect(staleTruth.claims.claims[0].support_status).toBe('missing_truth_link');
    expect(staleTruth.claims.blocker_codes).toContain('truth_state_map_identity_mismatch');
  });

  it('lets PublicClaimTrace see sufficient EvidenceAnchors aggregate support in controlled fixtures', async () => {
    const { claims, metrics } = await emitPublicClaimSupportBundle();
    expect(claims.claims[0].support_status).toBe('supported');
    expect(claims.claims[0].evidence_support_summary.evidence_anchor_gate_status).toBe('sufficient');
    expect(claims.public_claim_gate_status).toBe('sufficient');
    expect(metrics.public_claim_gate_status).toBe('sufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('keeps PublicClaimTrace insufficient when EvidenceAnchors aggregate data is partial or absent', async () => {
    const partial = await emitPublicClaimSupportBundle({ evidenceAnchorGateStatus: 'insufficient' });
    expect(partial.claims.claims[0].support_status).toBe('partially_supported');
    expect(partial.claims.public_claim_gate_status).toBe('insufficient');

    const missingMetadataRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-s914m-missing-anchor-metadata-'));
    const missingMetadataRun = `run-s914m-${Math.random().toString(36).slice(2)}`;
    const missingMetadataOut = await emitPublicClaimTraceFirstPass({
      run_id: missingMetadataRun,
      analysis_run_id: missingMetadataRun,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      claim_candidate_trace_data: { run_id: missingMetadataRun, analysis_run_id: missingMetadataRun, take_id: 't1', claim_candidates: [claimCandidate()] },
      evidence_anchors_data: { run_id: missingMetadataRun, analysis_run_id: missingMetadataRun, take_id: 't1', anchors: [runtimeAnchor()] },
      truth_state_map_data: { run_id: missingMetadataRun, analysis_run_id: missingMetadataRun, take_id: 't1', truth_state_ids: ['truth-brief-presence'] },
      root_dir: missingMetadataRoot,
      internal_qa_emit: true,
    });
    const missingMetadataClaims = missingMetadataOut.written
      ? JSON.parse(await readFile(path.join(missingMetadataRoot, missingMetadataRun, 'takes', 'take-t1', `analysis-${missingMetadataRun}`, 'traces', 'PublicClaimTrace.json'), 'utf8'))
      : null;
    expect(missingMetadataClaims.claims[0].support_status).toBe('partially_supported');
    expect(missingMetadataClaims.public_claim_gate_status).toBe('insufficient');

    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914m-no-anchors-'));
    const run = `run-s914m-${Math.random().toString(36).slice(2)}`;
    const claimsOut = await emitPublicClaimTraceFirstPass({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      claim_candidate_trace_data: { run_id: run, analysis_run_id: run, take_id: 't1', claim_candidates: [claimCandidate()] },
      evidence_anchors_data: null,
      truth_state_map_data: { run_id: run, analysis_run_id: run, take_id: 't1', truth_state_ids: ['truth-brief-presence'] },
      root_dir: root,
      internal_qa_emit: true,
    });
    const claims = claimsOut.written
      ? JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'PublicClaimTrace.json'), 'utf8'))
      : null;
    expect(claims.public_claim_gate_status).toBe('insufficient');
    expect(claims.claims[0].support_status).toBe('missing_evidence');
  });

  it('does not resolve linked truth IDs from structural TruthStateMap keys', async () => {
    const structural = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['known_truths'] })],
      truthStateMap: { known_truths: { brief_presence: 'supplied' }, brief_truths: { status: 'known' } },
    });
    expect(structural.claims.claims[0].support_status).toBe('missing_truth_link');
    expect(structural.claims.claims[0].truth_support_summary.unresolved_truth_state_ids).toEqual(['known_truths']);
    expect(structural.claims.public_claim_gate_status).toBe('insufficient');
  });

  it('resolves explicit truth_state_id and truth_state_ids values only', async () => {
    const explicitId = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['take-x:truth_state:brief_001'] })],
      truthStateMap: { known_truths: [{ truth_state_id: 'take-x:truth_state:brief_001', truth_state: 'known' }] },
    });
    expect(explicitId.claims.claims[0].support_status).toBe('supported');

    const explicitIds = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['take-x:truth_state:media_001'] })],
      truthStateMap: { truth_state_ids: ['take-x:truth_state:media_001'] },
    });
    expect(explicitIds.claims.claims[0].support_status).toBe('supported');
  });

  it('resolves only canonical ID-keyed truth maps, not generic keyed maps', async () => {
    const canonical = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['take-x:truth_state:brief_002'] })],
      truthStateMap: { truth_states: { 'take-x:truth_state:brief_002': { status: 'known' } } },
    });
    expect(canonical.claims.claims[0].support_status).toBe('supported');

    const generic = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['brief_presence'] })],
      truthStateMap: { known_truths: { brief_presence: 'supplied' } },
    });
    expect(generic.claims.claims[0].support_status).toBe('missing_truth_link');
    expect(generic.claims.claims[0].truth_support_summary.unresolved_truth_state_ids).toEqual(['brief_presence']);
  });

  it('keeps malformed TruthStateMap input non-satisfying without crashing', async () => {
    const malformed = await emitPublicClaimSupportBundle({
      candidates: [claimCandidate({ linked_truth_state_ids: ['take-x:truth_state:missing'] })],
      truthStateMap: { truth_state_ids: [null, { bad: true }], known_truths: null } as any,
    });
    expect(malformed.claims.claims[0].support_status).toBe('missing_truth_link');
    expect(malformed.claims.public_claim_gate_status).toBe('insufficient');
  });

  it('normalises untrusted take timestamps safely for Step 1 QA context', async () => {
    expect(safeIsoTimestamp('not-a-date')).toBeNull();
    expect(safeIsoTimestamp(new Date('not-a-date'))).toBeNull();
    expect(safeIsoTimestamp(null)).toBeNull();
    expect(safeIsoTimestamp(undefined)).toBeNull();
    expect(safeIsoTimestamp('')).toBeNull();
    expect(safeIsoTimestamp({ value: '2026-01-01' })).toBeNull();
    expect(safeIsoTimestamp('2026-01-01T00:00:00Z')).toBe('2026-01-01T00:00:00.000Z');
    expect(safeIsoTimestamp(new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03:04:05.000Z');
  });

  it('records timestamp normalisation warnings without blocking AnalysisEvidenceState emission', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s914m-timestamps-'));
    const run = `run-s914m-${Math.random().toString(36).slice(2)}`;
    const out = await emitAnalysisEvidenceStatePrerequisite({
      run_id: run,
      analysis_run_id: run,
      submission_id: 'sub1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      media_readiness_state: 'ready',
      take_created_at: safeIsoTimestamp('not-a-date'),
      take_updated_at: safeIsoTimestamp('2026-01-01T00:00:00Z'),
      timestamp_normalisation_warnings: ['take_created_at_invalid_timestamp'],
      resolver_output_available: true,
      truth_state_map_available: true,
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(out.written).toBe(true);
    expect(out.payload.timestamp_normalisation_warnings).toEqual(['take_created_at_invalid_timestamp']);
    expect(out.payload.assessability_limitations).toContain('take_created_at_invalid_timestamp');
    expect(out.payload.media_readiness_summary.timestamp_source).toBe('unavailable');
  });

  it('uses mixed limitation normalisation for known string-array limitation fields', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/v3/qa-artifacts-wiring.server.ts'), 'utf8');
    expect(source).toContain('normaliseSafeLimitationItems');
    expect(source).not.toContain('safeRecordArray(analysisEvidenceState.assessability_limitations)');
    expect(source).not.toContain('safeRecordArray(analysisEvidenceState.timestamp_normalisation_warnings)');
  });
});
