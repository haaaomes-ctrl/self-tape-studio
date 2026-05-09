import type { PerformerLevel, QAValidationResult, ValidatorAction } from './types';
import type { V3ReleaseState } from './release-state';
import { validateUKEnglish } from './validation';

export const S5_ALLOWED_RELEASE_STATES = ['design_only', 'dark_mode_internal', 'internal_rendered_QA'] as const;

export function isS5AllowedReleaseState(state: V3ReleaseState): boolean {
  return (S5_ALLOWED_RELEASE_STATES as readonly string[]).includes(state);
}

export function assertS5ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS5AllowedReleaseState(state)) throw new Error(`S5 release state not allowed: ${state}`);
}

export type ReportClaimSection =
  | 'audition_summary' | 'overall_readiness' | 'observed_quality_summary' | 'gap_to_selected_level' | 'component_breakdown'
  | 'technique_observations' | 'discipline_summaries' | 'why_this_score' | 'standout_delta' | 'priority_fixes' | 'strengths'
  | 'improvements' | 'timestamped_evidence' | 'next_take_plan' | 'assessability_notes' | 'limitations'
  | 'brief_or_task_fit' | 'role_or_material_context' | 'critical_component_gates' | 'submission_cohesion' | 'comparison_summary' | 'safety_public_notes';

export interface ReportClaimTraceV3 {
  report_claim_id: string;
  report_section: ReportClaimSection;
  claim_type: string;
  public_safe_text: string;
  linked_evidence_anchor_ids: string[];
  linked_public_claim_trace_ids: string[];
  truth_state_key: string;
  component_id?: string;
  dimension_score_ref?: string;
  component_score_ref?: string;
  critical_gate_ref?: string;
  score_trace_ref?: string; // internal only
  validator_status: ValidatorAction;
  blocked_reason?: string;
}

export type NextTakePlanGroup =
  | 'retake_critical' | 'quick_wins' | 'craft_refinements' | 'technique_drills'
  | 'recorded_take_safe_changes' | 'setup_assessability_checks' | 'preserve_next_time';

export interface NextTakePlanAction {
  action_text: string;
  linked_evidence_anchor_ids: string[];
  linked_component_ids: string[];
  linked_dimension_or_technique_ids: string[];
  why_it_matters: string;
  level_relevance: string;
  rehearsal_only_or_recorded_take_ready: 'rehearsal_only' | 'recorded_take_ready';
  expected_band_impact: string;
}

export interface TechniqueDisplayCard {
  technique_or_safe_descriptor: string;
  component_id?: string;
  timestamp_or_range?: string;
  confidence: number;
  observed_evidence: string;
  why_it_matters: string;
  readiness_impact: string;
  next_action: string;
  caveat_if_not_confidently_assessable?: string;
}

export interface PublicReportV3 {
  schema_version: 'tapecoach_v3';
  report_id: string;
  take_id: string;
  submission_id: string;
  selected_level: PerformerLevel;
  audition_summary: string;
  analysis_mode: string;
  overall_readiness: string;
  professional_band: string;
  level_adjusted_readiness: string;
  observed_quality_summary: string;
  gap_to_selected_level: string;
  component_breakdown: string[];
  technique_observations: TechniqueDisplayCard[];
  discipline_summaries: string[];
  why_this_score: string;
  standout_delta?: string;
  priority_fixes: string[];
  strengths: string[];
  improvements: string[];
  timestamped_evidence: string[];
  next_take_plan: Array<{ group: NextTakePlanGroup; actions: NextTakePlanAction[] }>;
  assessability_notes: string[];
  limitations: string[];
  brief_or_task_fit: string;
  role_or_material_context: string;
  critical_component_gates: string[];
  submission_cohesion: string;
  comparison_summary: { status: 'placeholder_only_no_recommendation'; note?: 'comparison not available in S5' };
  safety_public_notes: string[];
  export_metadata?: { placeholder_only: true };
  optional_summary_categories?: string[];
  claim_traces: ReportClaimTraceV3[];
}

export type ReportDepthScore = { score: number; rationale: string };
export type ActionabilityScore = { score: number; rationale: string };
export type RenderedInternalQAReport = { report: PublicReportV3; redaction_result: 'pass' | 'warn' | 'block' };

const q = (validator_name: string, action: ValidatorAction, severity: 'P0'|'P1'|'P2', message: string, passed: boolean): QAValidationResult => ({
  validation_id: `${validator_name}:${severity}`,
  validator_name,
  action,
  severity,
  message,
  passed,
});

const blockedTerms = /hidden\s+reasoning|chain[\s-]+of[\s-]+thought|castability|bookability|marketability|role[\s-]*fit|commercial\s+look|would\s+get\s+a\s+recall|workshop\s+ready/i;
const vocalHealth = /vocal\s+health\s+diagnosis|medical\s+diagnosis|injury\s+diagnosis/i;

export function validateReportHasClaimTraces(r: PublicReportV3): QAValidationResult {
  return r.claim_traces.length ? q('report-claim-traces','pass','P2','Claim traces present',true) : q('report-claim-traces','warn','P1','Claim traces missing',false);
}

export function validateReportHasEvidenceForMajorClaims(r: PublicReportV3): QAValidationResult {
  const major = r.claim_traces.filter((c) => ['why_this_score','overall_readiness','gap_to_selected_level','critical_component_gates'].includes(c.report_section));
  const bad = major.some((c) => c.linked_evidence_anchor_ids.length === 0 || !c.truth_state_key);
  return bad ? q('report-major-claim-evidence','block_report','P0','Major claim missing evidence or truth-state support',false) : q('report-major-claim-evidence','pass','P2','Major claims evidence-linked',true);
}

export function validateReportNoPrivateTraceLeakage(r: PublicReportV3): QAValidationResult {
  const leaked = r.claim_traces.some((c) => Boolean(c.score_trace_ref));
  return leaked ? q('report-private-trace-leakage','block_report','P0','Private score trace leaked',false) : q('report-private-trace-leakage','pass','P2','No private trace leakage',true);
}

export function validateReportNoHiddenReasoning(r: PublicReportV3): QAValidationResult {
  return blockedTerms.test([r.audition_summary,r.why_this_score,...r.safety_public_notes].join(' ')) ? q('report-hidden-reasoning','block_report','P0','Hidden reasoning or blocked overclaim wording',false) : q('report-hidden-reasoning','pass','P2','No hidden reasoning leakage',true);
}

export const validateReportNoNoBriefInvention = (r: PublicReportV3) => /without brief.*(brand|audience|role)/i.test(r.brief_or_task_fit) ? q('report-no-brief-invention','block_report','P0','No-brief invention detected',false) : q('report-no-brief-invention','pass','P2','No no-brief invention',true);
export const validateReportNoRoleFitOverclaim = (r: PublicReportV3) => blockedTerms.test(`${r.brief_or_task_fit} ${r.role_or_material_context}`) ? q('report-role-fit-overclaim','block_report','P0','Role-fit/castability overclaim detected',false) : q('report-role-fit-overclaim','pass','P2','No role-fit overclaim',true);
export const validateReportNoVocalHealthDiagnosis = (r: PublicReportV3) => vocalHealth.test([r.why_this_score,...r.improvements].join(' ')) ? q('report-vocal-health','block_report','P0','Vocal-health diagnosis blocked',false) : q('report-vocal-health','pass','P2','No vocal-health diagnosis',true);
export const validateReportAccessLanguage = (r: PublicReportV3) => /deficit|normal\s+person/i.test(r.assessability_notes.join(' ')) ? q('report-access-language','rewrite_required','P1','Access language requires rewrite',false) : q('report-access-language','pass','P2','Access language acceptable',true);
export const validateReportUKEnglish = (r: PublicReportV3) => validateUKEnglish([r.audition_summary,r.why_this_score,...r.strengths,...r.improvements].join(' '), true);
export const validateReportHighScoreHasStandoutDelta = (r: PublicReportV3) => (/9[5-9]|100/.test(r.professional_band) && !r.standout_delta) ? q('report-high-score-standout','block_report','P0','High score requires standout_delta',false) : q('report-high-score-standout','pass','P2','High score standout rule satisfied',true);
export const validateReportLowScoreHonesty = (r: PublicReportV3) => (/not ready|worth another take|caution/i.test(r.professional_band) && /excellent|perfect/i.test(r.why_this_score)) ? q('report-low-score-honesty','warn','P1','Low-score wording appears inflated',false) : q('report-low-score-honesty','pass','P2','Low-score wording remains honest',true);
export const validateReportCriticalGatesExplained = (r: PublicReportV3) => r.critical_component_gates.length ? q('report-critical-gates','pass','P2','Critical gates explained',true) : q('report-critical-gates','warn','P1','Critical gates missing explanation',false);
export const validateReportAssessabilitySeparatedFromWeakness = (r: PublicReportV3) => r.assessability_notes.length && r.improvements.length ? q('report-assessability-separation','pass','P2','Assessability separated from weakness',true) : q('report-assessability-separation','warn','P1','Assessability/weakness separation unclear',false);
export const validateReportDepthMinimum = (r: PublicReportV3) => (r.strengths.length + r.improvements.length + r.timestamped_evidence.length) >= 3 ? q('report-depth-minimum','pass','P2','Report depth minimum met',true) : q('report-depth-minimum','warn','P1','Report depth minimum not met',false);
export const validateComparisonSummaryPlaceholderOnly = (r: PublicReportV3) => { const text = JSON.stringify(r.comparison_summary); return /submit take|winner|best take/i.test(text) ? q('report-comparison-placeholder','block_report','P0','Comparison recommendation forbidden in S5',false) : q('report-comparison-placeholder','pass','P2','Comparison summary remains placeholder only',true); };

export function runS5ReportValidators(r: PublicReportV3): QAValidationResult[] {
  return [
    validateReportHasClaimTraces(r), validateReportHasEvidenceForMajorClaims(r), validateReportNoPrivateTraceLeakage(r),
    validateReportNoHiddenReasoning(r), validateReportNoNoBriefInvention(r), validateReportNoRoleFitOverclaim(r),
    validateReportNoVocalHealthDiagnosis(r), validateReportAccessLanguage(r), validateReportUKEnglish(r),
    validateReportHighScoreHasStandoutDelta(r), validateReportLowScoreHonesty(r), validateReportCriticalGatesExplained(r),
    validateReportAssessabilitySeparatedFromWeakness(r), validateReportDepthMinimum(r), validateComparisonSummaryPlaceholderOnly(r),
  ];
}
