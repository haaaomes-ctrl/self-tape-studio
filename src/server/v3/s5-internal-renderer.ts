import type { QAValidationResult } from './types';
import type { V3ReleaseState } from './release-state';
import type { PublicReportV3, ReportClaimTraceV3 } from './s5-public-report';
import { assertS5ReleaseStateAllowed, validateComparisonSummaryPlaceholderOnly, validateReportNoHiddenReasoning, validateReportNoRoleFitOverclaim, validateReportNoVocalHealthDiagnosis, validateReportUKEnglish } from './s5-public-report';

export interface ReportDepthScore { score:number; status:'ok'|'warn'|'blocked'; notes_safe:string; missing_sections:string[]; generic_phrase_count:number; timestamp_usefulness:'low'|'medium'|'high'; next_take_plan_usefulness:'low'|'medium'|'high'; level_appropriate_detail:'low'|'medium'|'high'; }
export interface ActionabilityScore { score:number; status:'ok'|'warn'|'blocked'; notes_safe:string; missing_sections:string[]; generic_phrase_count:number; timestamp_usefulness:'low'|'medium'|'high'; next_take_plan_usefulness:'low'|'medium'|'high'; level_appropriate_detail:'low'|'medium'|'high'; }

export interface InternalQARenderInput { public_report_v3: PublicReportV3; validator_trace_summary: QAValidationResult[]; evidence_to_report_trace_map: ReportClaimTraceV3[]; redaction_result: 'pass'|'warn'|'block'; uk_english_result: { passed:boolean; flags:string[] }; report_depth_score: ReportDepthScore; actionability_score: ActionabilityScore; fixture_id?: string; release_state: V3ReleaseState; internal_qa_marker: true; }
export interface RenderedQASection { section_id:string; title:string; status:'ok'|'warn'|'blocked'|'empty'; safe_text:string[]; linked_claim_ids:string[]; validator_statuses:string[]; empty_state_reason?:string; }
export interface RenderedTraceRow { report_claim_id:string; report_section:string; claim_type:string; linked_evidence_anchor_ids:string[]; linked_public_claim_trace_ids:string[]; truth_state_key:string; component_id?:string; validator_status:string; blocked_reason?:string; score_trace_ref?:'redacted_score_trace_ref'; }
export interface RenderedValidatorRow { validator_name:string; section_affected:string; severity:string; action:string; passed:boolean; safe_summary:string; blocked_claim_reference?:string; group:'traceability'|'evidence sufficiency'|'leakage / hidden reasoning'|'invention / overclaim safety'|'UK English'|'score honesty / standout'|'gate explanation'|'assessability separation'|'depth / actionability'|'comparison placeholder'; }
export interface RenderedInternalQAReport { render_id:string; schema_version:'tapecoach_v3'; release_state:V3ReleaseState; internal_qa_marker:true; sections:RenderedQASection[]; trace_rows:RenderedTraceRow[]; validator_rows:RenderedValidatorRow[]; redaction_status:'pass'|'warn'|'block'; uk_english_status:{ passed:boolean; flags:string[] }; report_depth_score:ReportDepthScore; actionability_score:ActionabilityScore; blocked_public_release:true; }

const red = (_id:string,p='id') => `${p}:redacted`; 
const FORBIDDEN = /hidden\s+reasoning|chain[\s-]*of[\s-]*thought|scoretrace|modelruntrace|evidenceanchor\s*notes|raw\s*brief|uploaded\s*(sides|copy|material)|access\/?setup\s*context|user\s*id|media\s*asset\s*id|raw\s*resolver\s*output|truthstatemap|private_trace|marketability|bookability|castability|commercial\s+look|vocal[-\s]*health\s+diagnosis/ig;
const COMPARISON_SAFE = 'Comparison is placeholder-only in S5 internal QA. No take recommendation is produced.';

const sanitise = (text: string): string => text.replace(FORBIDDEN, '[redacted]').replace(/\s+/g,' ').trim();

export function redactPublicReportForInternalRender(report: PublicReportV3): PublicReportV3 {
  return { ...report, audition_summary:sanitise(report.audition_summary), why_this_score:sanitise(report.why_this_score), brief_or_task_fit:sanitise(report.brief_or_task_fit), role_or_material_context:sanitise(report.role_or_material_context), safety_public_notes:report.safety_public_notes.map(sanitise), limitations:report.limitations.map(sanitise), assessability_notes:report.assessability_notes.map(sanitise), strengths:report.strengths.map(sanitise), improvements:report.improvements.map(sanitise), comparison_summary:{ status:'placeholder_only_no_recommendation', note:'comparison not available in S5' }, claim_traces: report.claim_traces.map((c)=>({ ...c, report_claim_id:red(c.report_claim_id,'claim'), linked_evidence_anchor_ids:c.linked_evidence_anchor_ids.map((i)=>red(i,'ev')), linked_public_claim_trace_ids:c.linked_public_claim_trace_ids.map((i)=>red(i,'pct')), public_safe_text:sanitise(c.public_safe_text), score_trace_ref: c.score_trace_ref ? 'redacted_score_trace_ref' : undefined })) };
}

export function redactTraceRowsForInternalRender(rows: ReportClaimTraceV3[]): RenderedTraceRow[] {
  return rows.map((r)=>({ report_claim_id:red(r.report_claim_id,'claim'), report_section:r.report_section, claim_type:r.claim_type, linked_evidence_anchor_ids:r.linked_evidence_anchor_ids.map((i)=>red(i,'ev')), linked_public_claim_trace_ids:r.linked_public_claim_trace_ids.map((i)=>red(i,'pct')), truth_state_key:r.truth_state_key, component_id:r.component_id, validator_status:r.validator_status, blocked_reason:r.blocked_reason ? sanitise(r.blocked_reason) : undefined, score_trace_ref: r.score_trace_ref ? 'redacted_score_trace_ref' : undefined }));
}

export function assertNoPrivateTraceRendered(input: {trace_rows: RenderedTraceRow[]; sections: RenderedQASection[]; validator_rows: RenderedValidatorRow[]}): void {
  const text = JSON.stringify(input).toLowerCase();
  FORBIDDEN.lastIndex = 0;
  if (FORBIDDEN.test(text) || /submit take|best take|winner/.test(text)) throw new Error('Private/sensitive or recommendation text leaked');
}

const section = (id:string,title:string,text:string[],linked:string[],vals:string[]):RenderedQASection => ({ section_id:id,title,status:text.length?'ok':'empty',safe_text:text.length?text.map(sanitise):['No validated content available.'],linked_claim_ids:linked,validator_statuses:vals,empty_state_reason:text.length?undefined:'No validated content available.' });
const claimIdsFor = (report: PublicReportV3, sec: string) => report.claim_traces.filter((c)=>c.report_section===sec).map((c)=>c.report_claim_id);

const groupFor = (name:string): RenderedValidatorRow['group'] => { if (/claim-traces|major-claim-evidence/.test(name)) return 'traceability'; if (/depth|high-score|low-score/.test(name)) return 'depth / actionability'; if (/uk-english/.test(name)) return 'UK English'; if (/private-trace|hidden-reasoning/.test(name)) return 'leakage / hidden reasoning'; if (/comparison/.test(name)) return 'comparison placeholder'; if (/critical-gates/.test(name)) return 'gate explanation'; if (/assessability/.test(name)) return 'assessability separation'; if (/role-fit|no-brief|vocal-health/.test(name)) return 'invention / overclaim safety'; return 'evidence sufficiency'; };

export function renderInternalQAReport(input: InternalQARenderInput): RenderedInternalQAReport {
  assertS5ReleaseStateAllowed(input.release_state);
  const report = redactPublicReportForInternalRender(input.public_report_v3);
  const validatorRows: RenderedValidatorRow[] = input.validator_trace_summary.map((v) => ({ validator_name:v.validator_name, section_affected:(v.affected_claim_ids?.[0] ?? 'general'), severity:v.severity, action:v.action, passed:v.passed, safe_summary:sanitise(v.message ?? 'Validator result'), blocked_claim_reference:v.affected_claim_ids?.[0] ? red(v.affected_claim_ids[0],'claim') : undefined, group:groupFor(v.validator_name) }));
  const traceRows = redactTraceRowsForInternalRender(input.evidence_to_report_trace_map);

  const sections: RenderedQASection[] = [
    section('top_readiness_panel','Top readiness panel',[report.overall_readiness, report.professional_band], claimIdsFor(report,'overall_readiness'), []),
    section('level_standard_panel','Level standard panel',[report.selected_level, report.analysis_mode], [], []),
    section('observed_quality_vs_level_gap','Observed quality vs level gap',[report.observed_quality_summary], claimIdsFor(report,'observed_quality_summary'), []),
    section('component_breakdown','Component breakdown',report.component_breakdown, claimIdsFor(report,'component_breakdown'), []),
    section('technique_observations','Technique observations',report.technique_observations.map((t)=>`${t.technique_or_safe_descriptor}: ${t.observed_evidence}`), claimIdsFor(report,'technique_observations'), []),
    section('discipline_summaries','Discipline summaries',report.discipline_summaries, claimIdsFor(report,'discipline_summaries'), []),
    section('why_this_score','Why this score',[report.why_this_score], claimIdsFor(report,'why_this_score'), []),
    section('gap_to_selected_level','Gap to selected level',[report.gap_to_selected_level], claimIdsFor(report,'gap_to_selected_level'), []),
    section('standout_delta','Standout delta',report.standout_delta?[report.standout_delta]:[], claimIdsFor(report,'standout_delta'), []),
    section('priority_fixes','Priority fixes',report.priority_fixes, claimIdsFor(report,'priority_fixes'), []),
    section('strengths','Strengths',report.strengths, claimIdsFor(report,'strengths'), []),
    section('improvements','Improvements',report.improvements, claimIdsFor(report,'improvements'), []),
    section('timestamped_evidence','Timestamped evidence',report.timestamped_evidence, claimIdsFor(report,'timestamped_evidence'), []),
    section('next_take_plan','Next-take plan',report.next_take_plan.flatMap((g)=>g.actions.map((a)=>`${sanitise(a.action_text)} (evidence: ${a.linked_evidence_anchor_ids.map((i)=>red(i,'ev')).join(', ')})`)), claimIdsFor(report,'next_take_plan'), []),
    section('assessability_and_limitations','Assessability and limitations',[...report.assessability_notes,...report.limitations], claimIdsFor(report,'assessability_notes'), []),
    section('brief_task_fit','Brief/task fit',[report.brief_or_task_fit], claimIdsFor(report,'brief_or_task_fit'), []),
    section('role_material_context','Role/material context',[report.role_or_material_context], claimIdsFor(report,'role_or_material_context'), []),
    section('critical_gates','Critical gates',report.critical_component_gates, claimIdsFor(report,'critical_component_gates'), []),
    section('submission_cohesion','Submission cohesion',[report.submission_cohesion], claimIdsFor(report,'submission_cohesion'), []),
    section('comparison_placeholder','Comparison placeholder',[COMPARISON_SAFE], claimIdsFor(report,'comparison_summary'), []),
    section('safety_public_notes','Safety/public notes',report.safety_public_notes, claimIdsFor(report,'safety_public_notes'), []),
  ];

  const checks = [validateComparisonSummaryPlaceholderOnly(report), validateReportNoHiddenReasoning(report), validateReportNoRoleFitOverclaim(report), validateReportNoVocalHealthDiagnosis(report), validateReportUKEnglish(report)];
  if (checks.some((c)=>!c.passed)) sections.push({ section_id:'validator_block_notice', title:'Validator block notice', status:'blocked', safe_text:['One or more validators blocked this internal QA render.'], linked_claim_ids:[], validator_statuses:checks.filter((c)=>!c.passed).map((c)=>c.validator_name) });

  assertNoPrivateTraceRendered({ trace_rows: traceRows, sections, validator_rows: validatorRows });
  return { render_id:`render_${report.report_id}`, schema_version:'tapecoach_v3', release_state:input.release_state, internal_qa_marker:true, sections, trace_rows:traceRows, validator_rows:validatorRows, redaction_status:input.redaction_result, uk_english_status:input.uk_english_result, report_depth_score:input.report_depth_score, actionability_score:input.actionability_score, blocked_public_release:true };
}
