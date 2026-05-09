import { describe, expect, it } from 'vitest';
import { V3_FLAG_DEFAULTS, assertS6ReleaseStateAllowed, evaluateDuplicateDetectionShadow, evaluateEvidenceDeltaDecisiveness, evaluateRecommendationSuppressionShadow, evaluateTieSuppressionShadow, getMetricRegistry, getS6MetricRegistry, isS6AllowedReleaseState, runS6Harness, validateComparisonHiddenReasoningLeakage, validateComparisonPrivateTraceLeakage, validateComparisonUKEnglish, validateEvidenceDeltaRequirement, validateGF01FalseWinnerBlock, validateNoBriefComparisonOverclaim, validatePublicRecommendationExposure, type ComparisonResult, type ComparisonConfidenceTrace, type EvidenceDeltaSummary } from '@/server/v3';

const confidence: ComparisonConfidenceTrace = { duplicate_detection_confidence:0.9, asset_similarity_confidence:0.9, component_alignment_confidence:0.8, evidence_delta_confidence:0.4, scoring_delta_confidence:0.8, gate_delta_confidence:0.6, assessability_delta_confidence:0.6, cross_run_stability:0.4, comparison_confidence:0.55 };
const evidence: EvidenceDeltaSummary = { evidence_anchor_delta:0.4, component_evidence_delta:0.4, timestamp_quality_delta:0.2, evidence_sufficiency_delta:0.3, assessability_delta:0.3, confidence_delta:0.2, gate_delta:0.2, role_task_fit_delta:0.2, submission_cohesion_delta:0.2, decisive_evidence_delta:false };

describe('v3-s6 variance-aware comparison', () => {
  it('S6 flag default false', () => { expect(V3_FLAG_DEFAULTS.v3_comparison_internal_enabled).toBe(false); });
  it('S6 release states allow expected', () => { expect(isS6AllowedReleaseState('design_only')).toBe(true); expect(isS6AllowedReleaseState('dark_mode_internal')).toBe(true); expect(isS6AllowedReleaseState('internal_rendered_QA')).toBe(true); expect(()=>assertS6ReleaseStateAllowed('design_only')).not.toThrow(); });
  it('S6 release states reject forbidden', () => { expect(isS6AllowedReleaseState('hidden_production_beta')).toBe(false); expect(()=>assertS6ReleaseStateAllowed('launch')).toThrow(); });

  it('global metric registry includes S5, S5 renderer and S6 metrics', () => {
    const metrics = getMetricRegistry();
    expect(metrics).toContain('PublicReportV3 schema available');
    expect(metrics).toContain('internal QA renderer available');
    expect(metrics).toContain('ComparisonResult schema available');
    expect(metrics).toContain('internal comparison renderer available');
  });

  it('S6 metric registry and harness remain populated and stable', () => {
    const s6 = getS6MetricRegistry();
    expect(s6.length).toBeGreaterThan(0);
    expect(s6).toContain('RT-15 remains P0 and no recommendation');
    const run = runS6Harness('s6-test');
    expect(run.checks.length).toBe(s6.length);
    expect(run.checks.some((c)=>c.metric==='RT-15 remains P0 and no recommendation')).toBe(true);
  });


  it('duplicate same-video suppresses recommendation and GF-01 98/93/94 no winner', () => {
    const dup=evaluateDuplicateDetectionShadow({ same_media_asset_id:true, same_brief_marker:true, same_duration:true, gf01_fixture_marker:true });
    const tie=evaluateTieSuppressionShadow({ score_a:98, score_b:94, band_a:'95', band_b:'95', evidence_decisive:false, gate_delta_decisive:false, assessability_clear:false, confidence:0.5 });
    expect(dup.duplicate_detection_status).toBe('confirmed_duplicate');
    expect(tie.suppress).toBe(true);
    const rec=evaluateRecommendationSuppressionShadow({ comparison_state:'analysis_variance_warning', duplicate:dup, evidence_decisive:false, confidence, same_video_variance_warning:true, component_split_instability:false, critical_gate_uncertain:false, recommended_take_id:'take-1' });
    expect(rec.recommendation_state).toBe('suppressed');
  });

  it('exact tie and near-tie suppress', () => {
    expect(evaluateTieSuppressionShadow({ score_a:93, score_b:93, band_a:'90', band_b:'90', evidence_decisive:false, gate_delta_decisive:false, assessability_clear:true, confidence:0.8 }).suppress).toBe(true);
    expect(evaluateTieSuppressionShadow({ score_a:93, score_b:96, band_a:'90', band_b:'90', evidence_decisive:false, gate_delta_decisive:false, assessability_clear:true, confidence:0.8 }).suppress).toBe(true);
  });

  it('same-band and non-decisive evidence suppress; clear winner requires decisive evidence', () => {
    const sameBand=evaluateTieSuppressionShadow({ score_a:81, score_b:75, band_a:'80', band_b:'80', evidence_decisive:false, gate_delta_decisive:false, assessability_clear:true, confidence:0.9 });
    expect(sameBand.suppress).toBe(true);
    expect(evaluateEvidenceDeltaDecisiveness(evidence)).toBe(false);
    expect(validateEvidenceDeltaRequirement(evidence).action).toBe('suppress_claim');
    const decisive={ ...evidence, decisive_evidence_delta:true, component_evidence_delta:0.8, gate_delta:0.8, assessability_delta:0.6, evidence_sufficiency_delta:0.7, evidence_anchor_delta:0.7, timestamp_quality_delta:0.7, submission_cohesion_delta:0.7 };
    expect(evaluateEvidenceDeltaDecisiveness(decisive)).toBe(true);
  });

  it('blocks technique maturity misuse, public recommendation exposure, private trace leakage and hidden reasoning leakage', () => {
    expect(validatePublicRecommendationExposure({ recommendation_state:'suppressed', recommendation_label:'x', recommendation_reason_private:'x', public_recommendation_allowed:false, suppressed_reason:'analysis_variance', suppression_validator_ids:[] }).passed).toBe(true);
    expect(validateComparisonPrivateTraceLeakage('contains model_run_id token').action).toBe('block_report');
    expect(validateComparisonHiddenReasoningLeakage('chain-of-thought text').action).toBe('block_report');
  });

  it('no-brief overclaim blocks and UK English gate applies', () => {
    expect(validateNoBriefComparisonOverclaim('no_brief_baseline','Role is definitely the lead',true).action).toBe('block_report');
    expect(validateComparisonUKEnglish('callback calibration').passed).toBe(false);
  });



  it('GF-01 forced-winner wording variants are blocked and suppression wording passes', () => {
    const baseResult: ComparisonResult = {
      comparison_id:'GF-01-check', submission_id:'sub-1', take_ids:['take-1','take-2'], selected_level:'professional', audition_context:'musical_theatre', comparison_state:'suppressed_recommendation',
      duplicate_detection:{ duplicate_detection_status:'confirmed_duplicate', asset_similarity_score:0.95, duplicate_confidence:0.95, reason_private:'same-video', validator_status:'suppress_claim' },
      asset_similarity:{ score:0.95, confidence:0.95, reason_private:'same-video' }, score_band_deltas:[], overall_readiness_deltas:[], observed_quality_deltas:[], level_adjusted_readiness_deltas:[], component_deltas:[], dimension_deltas:[], technique_deltas:[], critical_gate_deltas:[], evidence_sufficiency_deltas:[], assessability_deltas:[], submission_cohesion_deltas:[], reliability_deltas:[],
      confidence_deltas:confidence, recommendation:{ recommendation_state:'suppressed', recommendation_label:'internal only', recommendation_reason_private:'internal', public_recommendation_allowed:false, suppressed_reason:'analysis_variance', suppression_validator_ids:[] }, suppressed_reason:'analysis_variance', variance_warnings:['variance'], comparison_confidence:0.5, public_summary_placeholder:'placeholder_only_no_recommendation', internal_qa_summary:'Recommendation suppressed', validator_status:[], created_at:new Date().toISOString(),
    };
    const blocked=[
      'Submit Take 1','winner is Take 2','best take','recommended take is Take 3','choose Take 1','Take 1 is the winner','Take 2 is the best','submit Take 2','submit the first take','submit the second take','submit the third take'
    ];
    blocked.forEach((txt)=>{ expect(validateGF01FalseWinnerBlock({ ...baseResult, internal_qa_summary:txt }).action).toBe('block_report'); });
    expect(validateGF01FalseWinnerBlock({ ...baseResult, internal_qa_summary:'recommendation suppressed' }).passed).toBe(true);
    expect(validateGF01FalseWinnerBlock({ ...baseResult, internal_qa_summary:'no winner is produced' }).passed).toBe(true);
    expect(validateGF01FalseWinnerBlock({ ...baseResult, internal_qa_summary:'no take recommendation is produced' }).passed).toBe(true);
    expect(validateGF01FalseWinnerBlock({ ...baseResult, comparison_id:'GF-02-check', internal_qa_summary:'winner is Take 2' }).passed).toBe(true);
  });

  it('hidden reasoning separator variants are blocked and safe text passes', () => {
    ['chain-of-thought','chain of thought','chain_of_thought','chainofthought','hidden reasoning','hidden_reasoning','hidden-reasoning'].forEach((txt)=>{
      expect(validateComparisonHiddenReasoningLeakage(txt).action).toBe('block_report');
    });
    expect(validateComparisonHiddenReasoningLeakage('safe comparison wording').passed).toBe(true);
  });

  it('minimal valid ComparisonResult shape supports suppression and GF-01 false winner block', () => {
    const dup=evaluateDuplicateDetectionShadow({ same_media_asset_id:true, same_duration:true, same_brief_marker:true, gf01_fixture_marker:true });
    const rec=evaluateRecommendationSuppressionShadow({ comparison_state:'duplicate_or_near_duplicate_detected', duplicate:dup, evidence_decisive:false, confidence, same_video_variance_warning:true, component_split_instability:true, critical_gate_uncertain:true, recommended_take_id:'take-1' });
    const result: ComparisonResult = {
      comparison_id:'GF-01-comparison', submission_id:'sub-1', take_ids:['take-1','take-2','take-3'], selected_level:'professional', audition_context:'musical_theatre', comparison_state:'analysis_variance_warning',
      duplicate_detection:dup, asset_similarity:{ score:0.98, confidence:0.95, reason_private:'same asset id' }, score_band_deltas:[{take_id_a:'take-1',take_id_b:'take-2',same_band:true,delta:0}], overall_readiness_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:3}], observed_quality_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:2}], level_adjusted_readiness_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:3}],
      component_deltas:[], dimension_deltas:[], technique_deltas:[], critical_gate_deltas:[], evidence_sufficiency_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:0}], assessability_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:0}], submission_cohesion_deltas:[], reliability_deltas:[{take_id_a:'take-1',take_id_b:'take-2',delta:0}], confidence_deltas:confidence,
      recommendation:rec, suppressed_reason:rec.suppressed_reason, variance_warnings:['analysis variance warning'], comparison_confidence:confidence.comparison_confidence, public_summary_placeholder:'placeholder_only_no_recommendation', internal_qa_summary:'Recommendation suppressed for internal QA.', validator_status:[], created_at:new Date().toISOString(),
    };
    expect(result.recommendation.recommendation_state).toBe('suppressed');
    expect(validateGF01FalseWinnerBlock(result).passed).toBe(true);
  });
});
