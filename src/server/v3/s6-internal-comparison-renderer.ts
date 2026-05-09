import type { QAValidationResult } from './types';
import type { V3ReleaseState } from './release-state';
import { assertS6ReleaseStateAllowed, type ComparisonResult } from './s6-variance-comparison';

export interface InternalComparisonRenderInput {
  comparison_result: ComparisonResult;
  validator_trace_summary: QAValidationResult[];
  redaction_result: 'pass'|'warn'|'block';
  uk_english_result: { passed:boolean; flags:string[] };
  fixture_id?: string;
  release_state: V3ReleaseState;
  internal_qa_marker: true;
  comparison_artefact_summary: string[];
  suppressed_recommendation_reason: string;
  variance_warning_summary: string[];
  confidence_trace_summary: Array<{ key:string; value:number; note?:string }>;
}

type ValidatorGroup =
  | 'duplicate_detection' | 'tie_near_tie' | 'evidence_delta' | 'analysis_variance' | 'same_video_variance'
  | 'component_split_instability' | 'gate_toggle' | 'technique_maturity' | 'public_recommendation_exposure'
  | 'private_leakage' | 'hidden_reasoning' | 'uk_english' | 'gf01_false_winner' | 'other';

export interface RenderedComparisonSection { section_id:string; title:string; status:'ok'|'warn'|'blocked'|'empty'; safe_text:string[]; linked_comparison_ids:string[]; linked_delta_ids:string[]; validator_statuses:string[]; empty_state_reason?:string; }
export interface RenderedComparisonDeltaRow { row_id:string; object_type:string; take_id_a:string; take_id_b:string; delta_type:string; old_value:string; new_value:string; evidence_refs:string[]; confidence:number; safe_summary:string; validator_status:string; warning_or_suppression:'none'|'warn'|'suppressed'; }
export interface RenderedComparisonConfidenceRow { key:string; value:number; status:'ok'|'warn'; safe_summary:string; }
export interface RenderedComparisonVarianceWarningRow { code:string; severity:'P1'|'P0'; safe_summary:string; }
export interface RenderedComparisonValidatorRow { validator_name:string; validator_group:ValidatorGroup; section_affected:string; severity:string; action:string; passed:boolean; safe_summary:string; blocked_comparison_reference?:string; }

export interface RenderedInternalComparisonQA {
  render_id:string; schema_version:'tapecoach_v3'; release_state:V3ReleaseState; internal_qa_marker:true; comparison_state:ComparisonResult['comparison_state']; blocked_public_release:true;
  sections:RenderedComparisonSection[]; delta_rows:RenderedComparisonDeltaRow[]; validator_rows:RenderedComparisonValidatorRow[]; confidence_rows:RenderedComparisonConfidenceRow[]; variance_warning_rows:RenderedComparisonVarianceWarningRow[];
  redaction_status:'pass'|'warn'|'block'; uk_english_status:{passed:boolean;flags:string[]};
  no_recommendation_status:{public_recommendation_allowed:false; recommendation_state:string; suppressed_reason:string; suppression_validator_ids:string[]; safe_explanation:string; what_would_be_needed_to_recommend:string;};
}

const FORBIDDEN = /hidden\s+reasoning|chain[\s-]*of[\s-]*thought|scoretrace|modelruntrace|evidenceanchor\s*notes|raw\s*brief|access\/?setup\s*context|user\s*id|media\s*asset\s*id|raw\s*resolver\s*output|truthstatemap|private_trace|marketability|bookability|castability|commercial\s+look|vocal[-\s]*health\s+diagnosis|submit\s+take\s*1|best\s+take|winner/ig;
const sanitise = (t:string)=>t.replace(FORBIDDEN,'[redacted]').replace(/\s+/g,' ').trim();
const red = (id:string,p='id')=>`${p}:redacted`;

const groupFor = (name:string): ValidatorGroup => {
  if (/duplicate/i.test(name)) return 'duplicate_detection';
  if (/near-tie|same-band|tie/i.test(name)) return 'tie_near_tie';
  if (/evidence-delta/i.test(name)) return 'evidence_delta';
  if (/analysis-variance/i.test(name)) return 'analysis_variance';
  if (/same-video-variance/i.test(name)) return 'same_video_variance';
  if (/component-split/i.test(name)) return 'component_split_instability';
  if (/gate-toggle/i.test(name)) return 'gate_toggle';
  if (/technique-maturity/i.test(name)) return 'technique_maturity';
  if (/public-recommendation/i.test(name)) return 'public_recommendation_exposure';
  if (/private-trace-leakage/i.test(name)) return 'private_leakage';
  if (/hidden-reasoning/i.test(name)) return 'hidden_reasoning';
  if (/uk-english/i.test(name)) return 'uk_english';
  if (/gf01-false-winner/i.test(name)) return 'gf01_false_winner';
  return 'other';
};

export function redactComparisonDeltaRows(rows: RenderedComparisonDeltaRow[]): RenderedComparisonDeltaRow[] {
  return rows.map((r)=>({ ...r, take_id_a:red(r.take_id_a,'take'), take_id_b:red(r.take_id_b,'take'), evidence_refs:r.evidence_refs.map((e)=>red(e,'ev')), safe_summary:sanitise(r.safe_summary) }));
}

export function redactComparisonForInternalRender(result: ComparisonResult): ComparisonResult {
  return {
    ...result,
    take_ids: result.take_ids.map((t)=>red(t,'take')),
    internal_qa_summary: sanitise(result.internal_qa_summary),
    variance_warnings: result.variance_warnings.map(sanitise),
    recommendation: { ...result.recommendation, recommendation_label: sanitise(result.recommendation.recommendation_label), recommendation_reason_private: sanitise(result.recommendation.recommendation_reason_private), recommended_take_id: result.recommendation.recommended_take_id ? red(result.recommendation.recommended_take_id,'take') : undefined },
  };
}

export function assertNoComparisonPrivateTraceRendered(output: { sections: RenderedComparisonSection[]; delta_rows: RenderedComparisonDeltaRow[]; validator_rows: RenderedComparisonValidatorRow[]; confidence_rows: RenderedComparisonConfidenceRow[]; variance_warning_rows: RenderedComparisonVarianceWarningRow[]; }): void {
  const visible = [
    ...output.sections.flatMap((s)=>s.safe_text),
    ...output.delta_rows.map((r)=>r.safe_summary),
    ...output.validator_rows.map((r)=>r.safe_summary),
    ...output.confidence_rows.map((r)=>r.safe_summary),
    ...output.variance_warning_rows.map((r)=>r.safe_summary),
  ].join(' ').toLowerCase();
  FORBIDDEN.lastIndex = 0;
  if (FORBIDDEN.test(visible)) throw new Error('Private/sensitive or recommendation wording leaked');
}

const section = (section_id:string,title:string,safe_text:string[],status:RenderedComparisonSection['status']='ok', linked_delta_ids:string[]=[], validator_statuses:string[]=[]): RenderedComparisonSection => ({ section_id, title, status:safe_text.length?status:'empty', safe_text:safe_text.length?safe_text.map(sanitise):['No validated comparison content available.'], linked_comparison_ids:[], linked_delta_ids, validator_statuses, empty_state_reason:safe_text.length?undefined:'No validated comparison content available.' });

const conf = (k:string,v:number):RenderedComparisonConfidenceRow=>({ key:k, value:v, status:v<0.6?'warn':'ok', safe_summary:v<0.6?'Low confidence contributes to suppressed recommendation.':'Confidence is acceptable for internal QA interpretation.' });
const mk = (object_type:string, idx:number, take_id_a:string,take_id_b:string, old_value:string,new_value:string, evidence_refs:string[], confidence:number, safe_summary:string, validator_status='pass', warning_or_suppression:RenderedComparisonDeltaRow['warning_or_suppression']='none', delta_type='delta'):RenderedComparisonDeltaRow => ({ row_id:`${object_type}-${idx}`, object_type, take_id_a, take_id_b, delta_type, old_value, new_value, evidence_refs, confidence, safe_summary, validator_status, warning_or_suppression });

export function renderInternalComparisonQA(input: InternalComparisonRenderInput): RenderedInternalComparisonQA {
  assertS6ReleaseStateAllowed(input.release_state);
  const result = redactComparisonForInternalRender(input.comparison_result);

  const deltaRows = redactComparisonDeltaRows([
    ...result.score_band_deltas.map((d,i)=>mk('score_band',i,d.take_id_a,d.take_id_b,String(d.same_band),String(d.delta),[],result.confidence_deltas.scoring_delta_confidence,'Score-band delta is shown for context only and does not establish performance difference by itself.','pass','warn','band_delta')),
    ...result.overall_readiness_deltas.map((d,i)=>mk('overall_readiness',i,d.take_id_a,d.take_id_b,'baseline',String(d.delta),[],result.confidence_deltas.scoring_delta_confidence,'Overall readiness delta is contextual and does not imply a preferred take.','pass','warn')),
    ...result.observed_quality_deltas.map((d,i)=>mk('observed_quality',i,d.take_id_a,d.take_id_b,'baseline',String(d.delta),[],result.confidence_deltas.evidence_delta_confidence,'Observed-quality delta is shown only with evidence context and suppression safeguards.')),
    ...result.level_adjusted_readiness_deltas.map((d,i)=>mk('level_adjusted_readiness',i,d.take_id_a,d.take_id_b,'baseline',String(d.delta),[],result.confidence_deltas.scoring_delta_confidence,'Level-adjusted readiness delta is level-contextual and not winner language.')),
    ...result.component_deltas.map((d,i)=>mk('component',i,d.take_id_a,d.take_id_b,String(d.old_value),String(d.new_value),d.evidence_refs,d.confidence,sanitise(d.public_safe_summary_candidate),d.validator_status,d.validator_status==='warn'?'warn':'none',d.delta_type)),
    ...result.dimension_deltas.map((d,i)=>mk('dimension',i,d.take_id_a,d.take_id_b,String(d.old_value),String(d.new_value),d.evidence_refs,d.confidence,sanitise(d.public_safe_summary_candidate),d.validator_status,d.validator_status==='warn'?'warn':'none',d.delta_type)),
    ...result.technique_deltas.map((d,i)=>mk('technique',i,d.take_id_a,d.take_id_b,String(d.old_value),String(d.new_value),d.evidence_refs,d.confidence,`Technique maturity caveat: ${sanitise(d.public_safe_summary_candidate)}`,d.validator_status,'warn',d.delta_type)),
    ...result.critical_gate_deltas.map((d,i)=>mk('critical_gate',i,d.take_id_a,d.take_id_b,String(d.old_value),String(d.new_value),d.evidence_refs,d.confidence,d.evidence_refs.length?'Critical gate delta is evidence-linked.':'Critical gate toggle without evidence; recommendation must remain suppressed.',d.validator_status,d.evidence_refs.length?'none':'warn',d.delta_type)),
    ...result.evidence_sufficiency_deltas.map((d,i)=>mk('evidence_sufficiency',i,d.take_id_a,d.take_id_b,'baseline',String(d.delta),[],result.confidence_deltas.evidence_delta_confidence,'Evidence sufficiency delta indicates uncertainty and cannot support recommendation alone.','warn','warn')),
    ...result.assessability_deltas.map((d,i)=>mk('assessability',i,d.take_id_a,d.take_id_b,'baseline',String(d.delta),[],result.confidence_deltas.assessability_delta_confidence,'Assessability delta is reported separately from performance weakness interpretation.','warn','warn')),
    ...result.submission_cohesion_deltas.map((d,i)=>mk('submission_cohesion',i,d.take_id_a,d.take_id_b,String(d.old_value),String(d.new_value),d.evidence_refs,d.confidence,'Submission cohesion delta is contextual and does not force a take preference.',d.validator_status,d.validator_status==='warn'?'warn':'none',d.delta_type)),
  ]);

  const confidenceRows = [
    conf('duplicate_detection_confidence', result.confidence_deltas.duplicate_detection_confidence),
    conf('asset_similarity_confidence', result.confidence_deltas.asset_similarity_confidence),
    conf('component_alignment_confidence', result.confidence_deltas.component_alignment_confidence),
    conf('evidence_delta_confidence', result.confidence_deltas.evidence_delta_confidence),
    conf('scoring_delta_confidence', result.confidence_deltas.scoring_delta_confidence),
    conf('gate_delta_confidence', result.confidence_deltas.gate_delta_confidence),
    conf('assessability_delta_confidence', result.confidence_deltas.assessability_delta_confidence),
    conf('cross_run_stability', result.confidence_deltas.cross_run_stability),
    conf('comparison_confidence', result.confidence_deltas.comparison_confidence),
  ];

  const varianceRows = result.variance_warnings.map((w, i)=>({ code:`vw-${i}`, severity:'P1' as const, safe_summary:sanitise(w) }));
  if (result.duplicate_detection.duplicate_detection_status === 'confirmed_duplicate' && varianceRows.length===0) varianceRows.push({ code:'vw-duplicate-required', severity:'P0', safe_summary:'Same-video duplicate requires an analysis variance warning.' });

  const validatorRows = input.validator_trace_summary.map((v)=>({ validator_name:v.validator_name, validator_group:groupFor(v.validator_name), section_affected:v.affected_claim_ids?.[0] ?? 'comparison', severity:v.severity, action:v.action, passed:v.passed, safe_summary:sanitise(v.message ?? 'Validator result'), blocked_comparison_reference:red(result.comparison_id,'cmp') }));

  const sections = [
    section('comparison_state_panel','Comparison state panel',[`State: ${result.comparison_state}`]),
    section('take_list','Take list',result.take_ids),
    section('duplicate_detection_status','Duplicate detection status',[`Duplicate status: ${result.duplicate_detection.duplicate_detection_status}`,`Reason: ${result.duplicate_detection.reason_private}`],result.duplicate_detection.duplicate_detection_status==='not_duplicate'?'ok':'warn'),
    section('score_band_deltas','Score-band deltas',['Score-band deltas are contextual and not primary performance comparisons.'],'warn',deltaRows.filter((r)=>r.object_type==='score_band').map((r)=>r.row_id)),
    section('overall_readiness_deltas','Overall readiness deltas',['Overall readiness deltas are shown with suppression and evidence context.'],'warn',deltaRows.filter((r)=>r.object_type==='overall_readiness').map((r)=>r.row_id)),
    section('observed_quality_deltas','Observed-quality deltas',['Observed-quality deltas shown for internal QA context only.'],'ok',deltaRows.filter((r)=>r.object_type==='observed_quality').map((r)=>r.row_id)),
    section('level_adjusted_readiness_deltas','Level-adjusted readiness deltas',['Level-adjusted readiness deltas shown for internal QA context only.'],'ok',deltaRows.filter((r)=>r.object_type==='level_adjusted_readiness').map((r)=>r.row_id)),
    section('evidence_deltas','Evidence deltas',[`Decisive evidence required for recommendation: ${result.suppressed_reason !== 'evidence_delta_not_decisive' ? 'yes' : 'no'}`]),
    section('component_deltas','Component deltas',['Component deltas displayed with redacted evidence refs.'],'ok',deltaRows.filter((r)=>r.object_type==='component').map((r)=>r.row_id)),
    section('dimension_deltas','Dimension deltas',['Dimension deltas available for internal QA.'],'ok',deltaRows.filter((r)=>r.object_type==='dimension').map((r)=>r.row_id)),
    section('technique_deltas','Technique deltas',['Technique deltas include maturity caveat and are non-authoritative.'],'warn',deltaRows.filter((r)=>r.object_type==='technique').map((r)=>r.row_id)),
    section('critical_gate_deltas','Critical gate deltas',['Gate toggles without evidence are treated as warnings/suppression.'],'warn',deltaRows.filter((r)=>r.object_type==='critical_gate').map((r)=>r.row_id)),
    section('assessability_deltas','Assessability deltas',['Assessability deltas shown separately from weakness interpretation.'],'warn',deltaRows.filter((r)=>r.object_type==='assessability').map((r)=>r.row_id)),
    section('submission_cohesion_deltas','Submission cohesion deltas',['Submission cohesion deltas shown for stability interpretation.'],'ok',deltaRows.filter((r)=>r.object_type==='submission_cohesion').map((r)=>r.row_id)),
    section('confidence_and_reliability','Confidence and reliability',['Confidence is separated by source and not collapsed into a public-looking score.'],confidenceRows.some((r)=>r.status==='warn')?'warn':'ok'),
    section('suppressed_recommendation_reason','Suppressed recommendation reason',[
      `Recommendation state: ${result.recommendation.recommendation_state}`,
      `Suppressed reason: ${result.suppressed_reason}`,
      'Recommendation is suppressed because the comparison evidence is not decisive enough for a safe take preference.',
      'To recommend a take, TapeCoach would need decisive evidence deltas across performance-relevant components, critical gates and confidence, not score spread alone.',
    ], 'warn',[],result.recommendation.suppression_validator_ids),
    section('variance_warnings','Variance warnings', varianceRows.map((v)=>v.safe_summary), varianceRows.length?'warn':'ok'),
    section('gf01_rt15_sentinel_status','GF-01 / RT-15 sentinel status',[input.fixture_id==='GF-01'?'GF-01 sentinel active: RT-15 P0 false-winner block required.':'Sentinel not applicable to this fixture.'], input.fixture_id==='GF-01'?'warn':'ok'),
    section('validator_trace','Validator trace',[`Validators rendered: ${validatorRows.length}`]),
    section('public_summary_placeholder','Public summary placeholder',['Comparison remains internal QA-only. Public recommendation is disabled in S6.']),
  ];

  assertNoComparisonPrivateTraceRendered({ sections, delta_rows:deltaRows, validator_rows:validatorRows, confidence_rows:confidenceRows, variance_warning_rows:varianceRows });

  return {
    render_id:`cmp_render_${result.comparison_id}`,
    schema_version:'tapecoach_v3',
    release_state:input.release_state,
    internal_qa_marker:true,
    comparison_state:result.comparison_state,
    blocked_public_release:true,
    sections,
    delta_rows:deltaRows,
    validator_rows:validatorRows,
    confidence_rows:confidenceRows,
    variance_warning_rows:varianceRows,
    redaction_status:input.redaction_result,
    uk_english_status:input.uk_english_result,
    no_recommendation_status:{
      public_recommendation_allowed:false,
      recommendation_state:result.recommendation.recommendation_state,
      suppressed_reason:result.suppressed_reason,
      suppression_validator_ids:result.recommendation.suppression_validator_ids,
      safe_explanation:'Recommendation is suppressed because the comparison evidence is not decisive enough for a safe take preference.',
      what_would_be_needed_to_recommend:'To recommend a take, TapeCoach would need decisive evidence deltas across performance-relevant components, critical gates and confidence, not score spread alone.',
    },
  };
}
