import type { AuditionContext, PerformerLevel, QAValidationResult, V3ReleaseState } from './types';
import { validateNoBriefInvention, validateUKEnglish } from './validation';

export const S6_ALLOWED_RELEASE_STATES = ['design_only', 'dark_mode_internal', 'internal_rendered_QA'] as const;

export type ComparisonState =
  | 'clear_winner'
  | 'marginal_preference'
  | 'no_material_difference_detected'
  | 'duplicate_or_near_duplicate_detected'
  | 'analysis_variance_warning'
  | 'suppressed_recommendation'
  | 'not_enough_evidence';

export type DuplicateDetectionStatus = 'confirmed_duplicate' | 'near_duplicate' | 'possible_duplicate' | 'uncertain' | 'not_duplicate';

export interface DuplicateDetectionInput {
  same_media_asset_id?: boolean;
  same_duration?: boolean;
  same_upload_hash?: boolean;
  same_brief_marker?: boolean;
  same_component_sequence?: boolean;
  same_evidence_anchor_pattern?: boolean;
  same_score_trace_pattern?: boolean;
  user_declared_duplicate?: boolean;
  gf01_fixture_marker?: boolean;
}

export interface DuplicateDetectionResult {
  duplicate_detection_status: DuplicateDetectionStatus;
  asset_similarity_score: number;
  duplicate_confidence: number;
  reason_private: string;
  validator_status: QAValidationResult['action'];
}

export interface EvidenceDeltaSummary {
  evidence_anchor_delta: number;
  component_evidence_delta: number;
  timestamp_quality_delta: number;
  evidence_sufficiency_delta: number;
  assessability_delta: number;
  confidence_delta: number;
  gate_delta: number;
  role_task_fit_delta: number;
  submission_cohesion_delta: number;
  decisive_evidence_delta: boolean;
}

export interface DeltaBase {
  take_id_a: string;
  take_id_b: string;
  object_id: string;
  delta_type: string;
  old_value: number | string | boolean | null;
  new_value: number | string | boolean | null;
  evidence_refs: string[];
  confidence: number;
  explanation_private: string;
  public_safe_summary_candidate: string;
  validator_status: QAValidationResult['action'];
}

export type ComponentDelta = DeltaBase;
export type DimensionDelta = DeltaBase;
export type TechniqueDelta = DeltaBase;
export type CriticalGateDelta = DeltaBase;
export type SubmissionCohesionDelta = DeltaBase;

export interface ComparisonConfidenceTrace {
  duplicate_detection_confidence: number;
  asset_similarity_confidence: number;
  component_alignment_confidence: number;
  evidence_delta_confidence: number;
  scoring_delta_confidence: number;
  gate_delta_confidence: number;
  assessability_delta_confidence: number;
  cross_run_stability: number;
  comparison_confidence: number;
}

export type SuppressedRecommendationReason =
  | 'duplicate_or_near_duplicate'
  | 'tied_score'
  | 'near_tie'
  | 'same_band'
  | 'evidence_delta_not_decisive'
  | 'analysis_variance'
  | 'not_enough_evidence'
  | 'critical_gate_uncertain'
  | 'component_split_instability'
  | 'low_comparison_confidence'
  | 'public_recommendation_not_enabled';

export interface ComparisonRecommendation {
  recommendation_state: 'suppressed' | 'internal_only_clear_winner' | 'internal_only_marginal_preference';
  recommended_take_id?: string;
  recommendation_label: string;
  recommendation_reason_private: string;
  public_recommendation_allowed: false;
  suppressed_reason: SuppressedRecommendationReason;
  suppression_validator_ids: string[];
}

export interface ComparisonResult {
  comparison_id: string;
  submission_id: string;
  take_ids: string[];
  selected_level: PerformerLevel;
  audition_context?: AuditionContext;
  comparison_state: ComparisonState;
  duplicate_detection: DuplicateDetectionResult;
  asset_similarity: { score: number; confidence: number; reason_private: string };
  score_band_deltas: Array<{ take_id_a: string; take_id_b: string; same_band: boolean; delta: number }>;
  overall_readiness_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  observed_quality_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  level_adjusted_readiness_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  component_deltas: ComponentDelta[];
  dimension_deltas: DimensionDelta[];
  technique_deltas: TechniqueDelta[];
  critical_gate_deltas: CriticalGateDelta[];
  evidence_sufficiency_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  assessability_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  submission_cohesion_deltas: SubmissionCohesionDelta[];
  reliability_deltas: Array<{ take_id_a: string; take_id_b: string; delta: number }>;
  confidence_deltas: ComparisonConfidenceTrace;
  recommendation: ComparisonRecommendation;
  suppressed_reason: SuppressedRecommendationReason;
  variance_warnings: string[];
  comparison_confidence: number;
  public_summary_placeholder: 'placeholder_only_no_recommendation';
  internal_qa_summary: string;
  validator_status: QAValidationResult[];
  created_at: string;
}

const comparisonStates = new Set<ComparisonState>([
  'clear_winner','marginal_preference','no_material_difference_detected','duplicate_or_near_duplicate_detected','analysis_variance_warning','suppressed_recommendation','not_enough_evidence',
]);

const q = (validator_name: string, action: QAValidationResult['action'], severity: QAValidationResult['severity'], message: string, passed: boolean): QAValidationResult => ({
  validation_id: validator_name,
  validator_name,
  action,
  severity,
  message,
  passed,
});

const clamp01 = (v: number): number => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));

export function isComparisonState(v: string): v is ComparisonState { return comparisonStates.has(v as ComparisonState); }
export function validateComparisonState(state: string): QAValidationResult { return isComparisonState(state) ? q('comparison-state','pass','P2','Valid comparison state',true) : q('comparison-state','block_report','P0','Invalid comparison state',false); }

export function isRecommendationAllowedInS6(): false { return false; }

export function isS6AllowedReleaseState(state: V3ReleaseState): boolean {
  return S6_ALLOWED_RELEASE_STATES.includes(state as (typeof S6_ALLOWED_RELEASE_STATES)[number]);
}

export function assertS6ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS6AllowedReleaseState(state)) throw new Error(`S6 release state not allowed: ${state}`);
}

export function evaluateDuplicateDetectionShadow(input: DuplicateDetectionInput): DuplicateDetectionResult {
  const direct = [input.same_media_asset_id, input.same_upload_hash, input.user_declared_duplicate, input.gf01_fixture_marker].filter(Boolean).length;
  const contextual = [input.same_duration, input.same_brief_marker, input.same_component_sequence, input.same_evidence_anchor_pattern, input.same_score_trace_pattern].filter(Boolean).length;
  const signalScore = Math.min(1, direct * 0.35 + contextual * 0.08);
  const noFingerprint = input.same_upload_hash == null;
  if (input.gf01_fixture_marker || direct >= 2 || signalScore >= 0.85) {
    return { duplicate_detection_status: 'confirmed_duplicate', asset_similarity_score: clamp01(Math.max(0.92, signalScore)), duplicate_confidence: clamp01(0.95), reason_private: 'Same-video or equivalent duplicate signals detected; recommendation must be suppressed.', validator_status: 'suppress_claim' };
  }
  if (signalScore >= 0.65) return { duplicate_detection_status: 'near_duplicate', asset_similarity_score: clamp01(signalScore), duplicate_confidence: clamp01(0.8), reason_private: 'Near-duplicate pattern detected; recommendation should be suppressed.', validator_status: 'suppress_claim' };
  if (signalScore >= 0.45 || noFingerprint) return { duplicate_detection_status: 'uncertain', asset_similarity_score: clamp01(signalScore), duplicate_confidence: clamp01(0.45), reason_private: 'Duplicate certainty is limited; missing fingerprint evidence should increase uncertainty rather than force a winner.', validator_status: 'warn' };
  return { duplicate_detection_status: 'not_duplicate', asset_similarity_score: clamp01(signalScore), duplicate_confidence: clamp01(0.7), reason_private: 'No meaningful duplicate signal detected.', validator_status: 'pass' };
}

export function isNearTie(a: number, b: number, tolerance = 4): boolean { return Math.abs(a - b) <= tolerance; }
export function isSameBandComparison(a: string, b: string): boolean { return a.trim().toLowerCase() === b.trim().toLowerCase(); }

export function evaluateEvidenceDeltaDecisiveness(summary: EvidenceDeltaSummary): boolean {
  const structuralSignal = Math.max(summary.component_evidence_delta, summary.gate_delta, summary.role_task_fit_delta);
  const supportSignal = Math.max(summary.evidence_anchor_delta, summary.timestamp_quality_delta, summary.submission_cohesion_delta);
  return summary.decisive_evidence_delta && structuralSignal >= 0.6 && supportSignal >= 0.5 && summary.assessability_delta >= 0.4 && summary.evidence_sufficiency_delta >= 0.4;
}

export function evaluateTieSuppressionShadow(input: {
  score_a: number; score_b: number; band_a: string; band_b: string; evidence_decisive: boolean; gate_delta_decisive: boolean; assessability_clear: boolean; confidence: number;
}): { suppress: boolean; reason?: SuppressedRecommendationReason; state: ComparisonState } {
  if (input.score_a === input.score_b) return { suppress: true, reason: 'tied_score', state: 'suppressed_recommendation' };
  if (isNearTie(input.score_a, input.score_b)) return { suppress: true, reason: 'near_tie', state: 'no_material_difference_detected' };
  if (isSameBandComparison(input.band_a, input.band_b) && !(input.evidence_decisive && input.gate_delta_decisive)) return { suppress: true, reason: 'same_band', state: 'marginal_preference' };
  if (!input.evidence_decisive || !input.assessability_clear || input.confidence < 0.7) return { suppress: true, reason: 'evidence_delta_not_decisive', state: 'suppressed_recommendation' };
  return { suppress: false, state: 'clear_winner' };
}

export function evaluateRecommendationSuppressionShadow(input: {
  comparison_state: ComparisonState; duplicate: DuplicateDetectionResult; evidence_decisive: boolean; confidence: ComparisonConfidenceTrace; same_video_variance_warning: boolean; component_split_instability: boolean; critical_gate_uncertain: boolean;
  recommended_take_id?: string;
}): ComparisonRecommendation {
  if (!isRecommendationAllowedInS6()) {
    const baseReason: SuppressedRecommendationReason = input.duplicate.duplicate_detection_status === 'confirmed_duplicate' || input.duplicate.duplicate_detection_status === 'near_duplicate' ? 'duplicate_or_near_duplicate' : input.same_video_variance_warning ? 'analysis_variance' : !input.evidence_decisive ? 'evidence_delta_not_decisive' : input.component_split_instability ? 'component_split_instability' : input.critical_gate_uncertain ? 'critical_gate_uncertain' : input.confidence.comparison_confidence < 0.7 ? 'low_comparison_confidence' : 'public_recommendation_not_enabled';
    return { recommendation_state: 'suppressed', recommendation_label: 'Recommendation suppressed (internal QA)', recommendation_reason_private: 'S6 suppression policy applied.', public_recommendation_allowed: false, suppressed_reason: baseReason, suppression_validator_ids: ['s6-recommendation-suppression'] };
  }
  return { recommendation_state: 'suppressed', recommendation_label: 'Recommendation suppressed (internal QA)', recommendation_reason_private: 'Public recommendation is forbidden in S6.', public_recommendation_allowed: false, suppressed_reason: 'public_recommendation_not_enabled', suppression_validator_ids: ['s6-recommendation-suppression'] };
}

export const validateDuplicateRecommendationSuppression = (r: ComparisonResult): QAValidationResult => (['confirmed_duplicate','near_duplicate'].includes(r.duplicate_detection.duplicate_detection_status) && r.recommendation.recommendation_state !== 'suppressed') ? q('comparison-duplicate-suppression','block_report','P0','Duplicate or near-duplicate comparison must suppress recommendation',false) : q('comparison-duplicate-suppression','pass','P2','Duplicate suppression valid',true);
export const validateNearTieSuppression = (r: ComparisonResult): QAValidationResult => r.suppressed_reason==='near_tie' && r.recommendation.recommendation_state!=='suppressed' ? q('comparison-near-tie-suppression','block_report','P0','Near-tie must suppress recommendation',false) : q('comparison-near-tie-suppression','pass','P2','Near-tie behaviour valid',true);
export const validateSameBandSuppression = (r: ComparisonResult): QAValidationResult => r.suppressed_reason==='same_band' && r.recommendation.recommendation_state!=='suppressed' ? q('comparison-same-band-suppression','block_report','P0','Same-band comparison must suppress recommendation unless decisive',false) : q('comparison-same-band-suppression','pass','P2','Same-band behaviour valid',true);
export const validateEvidenceDeltaRequirement = (summary: EvidenceDeltaSummary): QAValidationResult => evaluateEvidenceDeltaDecisiveness(summary) ? q('comparison-evidence-delta','pass','P2','Evidence delta is decisive',true) : q('comparison-evidence-delta','suppress_claim','P1','Evidence delta is not decisive enough for winner recommendation',false);
export const validateAnalysisVarianceWarning = (r: ComparisonResult): QAValidationResult => r.variance_warnings.length>0 ? q('comparison-analysis-variance','warn','P1','Variance warnings present',false) : q('comparison-analysis-variance','pass','P2','No variance warning',true);
export const validateSameVideoScoreVarianceComparison = (r: ComparisonResult): QAValidationResult => r.duplicate_detection.duplicate_detection_status==='confirmed_duplicate' && !r.variance_warnings.some((w)=>/variance/i.test(w)) ? q('comparison-same-video-variance','block_report','P0','Same-video duplicate requires analysis variance warning',false) : q('comparison-same-video-variance','pass','P2','Same-video variance handling valid',true);
export const validateComponentSplitInstability = (unstable:boolean): QAValidationResult => unstable ? q('comparison-component-split-instability','warn','P1','Component split instability present',false) : q('comparison-component-split-instability','pass','P2','No component split instability',true);
export const validateGateToggleWithoutEvidence = (hasGateToggle:boolean, hasEvidence:boolean): QAValidationResult => hasGateToggle && !hasEvidence ? q('comparison-gate-toggle-evidence','block_report','P0','Gate toggle without evidence must suppress recommendation',false) : q('comparison-gate-toggle-evidence','pass','P2','Gate toggle evidence valid',true);
export const validateTechniqueMaturityMisuseInComparison = (usesTechniqueAuthority:boolean): QAValidationResult => usesTechniqueAuthority ? q('comparison-technique-maturity','block_report','P0','Technique maturity misuse in comparison authority',false) : q('comparison-technique-maturity','pass','P2','Technique maturity usage valid',true);
export const validatePublicRecommendationExposure = (r: ComparisonRecommendation): QAValidationResult => r.public_recommendation_allowed ? q('comparison-public-recommendation','block_report','P0','Public recommendation exposure is forbidden in S6',false) : q('comparison-public-recommendation','pass','P2','Public recommendation remains disabled',true);
export const validateComparisonPrivateTraceLeakage = (text:string): QAValidationResult => /score_trace_ref|model_run_id|hidden_reasoning/i.test(text) ? q('comparison-private-trace-leakage','block_report','P0','Private trace leakage detected in comparison output',false) : q('comparison-private-trace-leakage','pass','P2','No private trace leakage detected',true);
export const validateComparisonHiddenReasoningLeakage = (text:string): QAValidationResult => /chain-of-thought|hidden reasoning/i.test(text) ? q('comparison-hidden-reasoning','block_report','P0','Hidden reasoning leakage detected',false) : q('comparison-hidden-reasoning','pass','P2','No hidden reasoning leakage',true);
export const validateNoBriefComparisonOverclaim = (briefMode:'full_casting_brief'|'no_brief_baseline', claim:string, isPublic=false): QAValidationResult => validateNoBriefInvention(briefMode, claim, isPublic);
export const validateComparisonUKEnglish = (text:string): QAValidationResult => validateUKEnglish(text,true);
export const validateGF01FalseWinnerBlock = (r: ComparisonResult): QAValidationResult => r.comparison_id.includes('GF-01') && /submit take 1/i.test(r.internal_qa_summary) ? q('comparison-gf01-false-winner','block_report','P0','GF-01 must not produce forced winner wording',false) : q('comparison-gf01-false-winner','pass','P2','GF-01 false-winner block holds',true);
