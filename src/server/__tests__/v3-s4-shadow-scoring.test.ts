import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { V3_FLAG_DEFAULTS } from '@/server/v3/flags';
import { assertS4ReleaseStateAllowed, isS4AllowedReleaseState } from '@/server/v3/release-state';
import { classifyField, isObjectPublicByDefault } from '@/server/v3/privacy-boundary';
import { applyCriticalGateCapShadow, applyOverallGateCapsShadow, canComponentScoreOverrideEssentialGate, createDimensionScore, createScoreTrace, evaluateSameVideoScoreVarianceShadow, findWeakestCriticalComponent, getAllLevelStandards, getLevelAdjustedReadiness, getLevelBandForScore, getProfessionalScoreBand, getScoringSentinelRegistry, requiresExceptionalEvidence, requiresProfessionalStandoutEvidence, validateCleanCaptureInflation, validateComponentScore, validateCriticalComponentGate, validateOldSixFieldLeakage, validateProfessionalHighScoreEvidence, validatePublicScoreExposure, validateRoleFitWording, validateScoringSentinelRegistry, validateSubmissionCohesion } from '@/server/v3/s4-shadow-scoring';

describe('v3 s4 core shadow scoring contracts', () => {
  it('s4 flags default false', () => {
    expect(V3_FLAG_DEFAULTS.v3_level_calibration_shadow_enabled).toBe(false);
    expect(V3_FLAG_DEFAULTS.v3_scoring_shadow_enabled).toBe(false);
    expect(V3_FLAG_DEFAULTS.v3_critical_gates_shadow_enabled).toBe(false);
    expect(V3_FLAG_DEFAULTS.v3_score_trace_enabled).toBe(false);
  });

  it('s4 release states allow only design_only and dark_mode_internal', () => {
    expect(isS4AllowedReleaseState('design_only')).toBe(true);
    expect(isS4AllowedReleaseState('dark_mode_internal')).toBe(true);
    expect(() => assertS4ReleaseStateAllowed('internal_rendered_QA')).toThrow();
    expect(() => assertS4ReleaseStateAllowed('launch')).toThrow();
  });

  it('all four level standards exist', () => {
    expect(getAllLevelStandards().map((v) => v.id)).toEqual([
      'learning_school','amateur_community','emerging_training','professional',
    ]);
  });

  it('professional is stricter than amateur / community', () => {
    expect(getLevelBandForScore('amateur_community', 90).description).toContain('exceptional');
    expect(getLevelBandForScore('professional', 90).description).toContain('competitive but exposed');
  });

  it('95+ professional requires standout evidence', () => {
    expect(requiresProfessionalStandoutEvidence('professional', 95)).toBe(true);
    expect(requiresProfessionalStandoutEvidence('professional', 94)).toBe(false);
  });

  it('98-100 professional requires exceptional evidence', () => {
    expect(requiresExceptionalEvidence('professional', 98)).toBe(true);
    expect(requiresExceptionalEvidence('professional', 97)).toBe(false);
  });

  it('dimension score requires evidence anchors or allowed source', () => {
    expect(createDimensionScore({ score: 80, confidence: 0.8 }).evidence_required).toBe(true);
    expect(createDimensionScore({ score: 80, confidence: 0.8, evidence_anchor_ids: ['ea-1'] }).evidence_required).toBe(false);
  });

  it('insufficient evidence caps confidence', () => {
    expect(createDimensionScore({ score: 70, confidence: 0.9 }).confidence).toBeLessThanOrEqual(0.5);
  });

  it('assessability limitation is not weak performance', () => {
    const readiness = getLevelAdjustedReadiness('professional', { quality_score: 88, assessability_limitation: true, performance_weakness: false });
    expect(readiness.assessability_limitation).toBe(true);
    expect(readiness.performance_weakness).toBe(false);
  });

  it('score trace private by default and adapter is debug-only non-authoritative', () => {
    expect(createScoreTrace().visibility).toBe('private_trace');
    const adapter = createScoreTrace(true).six_field_adapter!;
    expect(adapter.debug_only).toBe(true);
    expect(adapter.authoritative).toBe(false);
  });

  it('role-fit unsafe wording is blocked', () => {
    expect(validateRoleFitWording('task readiness remains steady')).toBe(true);
    expect(validateRoleFitWording('marketability outcome')).toBe(false);
  });

  it('no public v3 scoring route is added', () => {
    const cmd = `rg -n "/api/v3/scoring|v3.*scoring" src/routes src/lib src/components/report || true`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    expect(out).toBe('');
  });

  it('forbidden areas do not import s4 module', () => {
    const cmd = `rg -n "s4-shadow-scoring" src/routes src/components/report src/lib src/server | rg -v "src/server/__tests__/v3-s4-shadow-scoring.test.ts|src/server/v3/index.ts" || true`;
    const out = execSync(cmd, { encoding: 'utf8' }).trim();
    expect(out).toBe('');
  });


  it('valid ComponentScore passes', () => {
    const c = { component_score_id:'cs1', component_id:'song', take_id:'t1', component_type:'song', component_criticality:'essential', component_weight_source:'discipline_standard', dimension_score_ids:['d1'], observed_component_score:88, level_adjusted_component_score:84, confidence:0.8, reliability:0.8, evidence_sufficiency:'sufficient', assessability_status:'sufficient', cap_applied:false, gate_refs:[], rationale_private:'internal', validator_status:'pass', visibility:'private' } as const;
    expect(validateComponentScore(c)).toBe(true);
  });

  it('essential failure cannot be overridden by strong component', () => {
    const c = { component_score_id:'cs2', component_id:'acting', take_id:'t1', component_type:'acting', component_criticality:'essential', component_weight_source:'discipline_standard', dimension_score_ids:['d1'], observed_component_score:94, level_adjusted_component_score:90, confidence:0.9, reliability:0.9, evidence_sufficiency:'sufficient', assessability_status:'sufficient', cap_applied:true, gate_refs:['g1'], rationale_private:'internal', validator_status:'warn', visibility:'private' } as const;
    expect(canComponentScoreOverrideEssentialGate(c)).toBe(false);
  });

  it('uncertain criticality cannot hard-gate', () => {
    const c = { component_score_id:'cs3', component_id:'slate', take_id:'t1', component_type:'slate_ident', component_criticality:'unknown', component_weight_source:'fallback', dimension_score_ids:['d1'], observed_component_score:90, level_adjusted_component_score:90, confidence:0.5, reliability:0.5, evidence_sufficiency:'partial', assessability_status:'partial', cap_applied:true, gate_refs:['g1'], rationale_private:'internal', validator_status:'warn', visibility:'private' } as const;
    expect(validateComponentScore(c)).toBe(false);
  });

  it('active gate caps shadow readiness', () => {
    expect(applyCriticalGateCapShadow(91, [{ gate_id:'g1', gate_type:'weak_critical_component_caps_overall', active:true, cap_to:84, reason_private:'cap', assessability_related:false, performance_weakness_related:true, visibility:'private' }])).toBe(84);
  });

  it('severe audio/visibility gate separates assessability from weakness', () => {
    expect(validateCriticalComponentGate({ gate_id:'g2', gate_type:'severe_audio_assessability_limit', active:true, cap_to:78, reason_private:'assessability audio limit', assessability_related:true, performance_weakness_related:false, visibility:'private' })).toBe(true);
  });

  it('SubmissionCohesion identifies weakest critical component', () => {
    const weakest = findWeakestCriticalComponent([
      { component_score_id:'a', component_id:'song', take_id:'t', component_type:'song', component_criticality:'essential', component_weight_source:'discipline_standard', dimension_score_ids:['d'], observed_component_score:80, level_adjusted_component_score:70, confidence:0.8, reliability:0.7, evidence_sufficiency:'sufficient', assessability_status:'sufficient', cap_applied:true, gate_refs:[], rationale_private:'x', validator_status:'warn', visibility:'private' },
      { component_score_id:'b', component_id:'acting', take_id:'t', component_type:'acting', component_criticality:'essential', component_weight_source:'discipline_standard', dimension_score_ids:['d'], observed_component_score:92, level_adjusted_component_score:88, confidence:0.8, reliability:0.7, evidence_sufficiency:'sufficient', assessability_status:'sufficient', cap_applied:false, gate_refs:[], rationale_private:'x', validator_status:'pass', visibility:'private' }
    ] as never);
    expect(weakest).toBe('song');
    expect(validateSubmissionCohesion({ component_ids:['song','acting'], integration_dimensions:['integration'], weakest_critical_component_id:'song', cross_component_integration_score:72, submission_cohesion_score:70, reliability:0.7, confidence:0.7, visibility:'private' })).toBe(true);
  });

  it('OverallReadiness cannot override active gate via weighted average', () => {
    const out = applyOverallGateCapsShadow({ selected_level:'professional', observed_performance_quality:{ quality_score:95, assessability_limitation:false, performance_weakness:false }, level_adjusted_readiness:{ level:'professional', readiness_score:92, assessability_limitation:false, performance_weakness:false }, component_scores:[], critical_gates:[{ gate_id:'g', gate_type:'weak_critical_component_caps_overall', active:true, cap_to:83, reason_private:'cap', assessability_related:false, performance_weakness_related:true, visibility:'private' }], submission_cohesion:{ component_ids:['a','b'], integration_dimensions:['x'], weakest_critical_component_id:'a', cross_component_integration_score:70, submission_cohesion_score:70, reliability:0.7, confidence:0.7, visibility:'private' }, professional_band:getProfessionalScoreBand(83), reliability:0.7, score_trace:createScoreTrace(), visibility:'private', same_video_variance_warning:false });
    expect(out.level_adjusted_readiness.readiness_score).toBe(83);
  });

  it('ProfessionalScoreBand resolves and enforces evidence rules', () => {
    expect(getProfessionalScoreBand(96).label).toContain('Outstanding');
    expect(validateProfessionalHighScoreEvidence(95, false, false)).toBe(false);
    expect(validateProfessionalHighScoreEvidence(98, true, false)).toBe(false);
  });


  it('ProfessionalScoreBand is safe for out-of-range and non-finite scores', () => {
    expect(getProfessionalScoreBand(-10).label).toContain('Not ready for Professional submission');
    expect(getProfessionalScoreBand(101).label).toContain('Exceptional / rare / industry-ready');
    expect(getProfessionalScoreBand(Number.NaN).label).toContain('Not ready for Professional submission');
    expect(getProfessionalScoreBand(Number.POSITIVE_INFINITY).label).toContain('Not ready for Professional submission');
    expect(getProfessionalScoreBand(68).label).toContain('Worth another take before relying professionally');
  });

  it('clean capture alone cannot justify Professional 90s', () => {
    expect(validateCleanCaptureInflation(true, 92).passed).toBe(false);
  });

  it('old six fields cannot drive score', () => {
    expect(validateOldSixFieldLeakage(true).passed).toBe(false);
  });

  it('public score exposure blocks', () => {
    expect(validatePublicScoreExposure(true).action).toBe('block_report');
  });

  it('GF-01 same-video variance metric exists and warns on >4', () => {
    const v = evaluateSameVideoScoreVarianceShadow({ readiness_scores:[98,93,94], gate_toggled_without_new_evidence:true, has_explicit_new_evidence_or_assessability_reason:false });
    expect(v.variance_tolerance).toBe(4);
    expect(v.warning).toBe(true);
  });


  it('same-video variance is safe for empty and single-score lists', () => {
    const empty = evaluateSameVideoScoreVarianceShadow({ readiness_scores:[], gate_toggled_without_new_evidence:false, has_explicit_new_evidence_or_assessability_reason:false });
    expect(empty.delta).toBe(0);
    expect(empty.warning).toBe(true);
    expect(empty.suppress_comparison).toBe(true);

    const single = evaluateSameVideoScoreVarianceShadow({ readiness_scores:[94], gate_toggled_without_new_evidence:false, has_explicit_new_evidence_or_assessability_reason:false });
    expect(single.delta).toBe(0);
    expect(single.warning).toBe(true);
    expect(single.suppress_comparison).toBe(true);
  });

  it('RT-15 creates no recommendation and sentinel registry validates', () => {
    expect(validateScoringSentinelRegistry()).toBe(true);
    const s = getScoringSentinelRegistry().find((x) => x.sentinel_id === 'S4-SEN-07');
    expect(s?.expected_validator_behaviour).toContain('suppress comparison');
  });

  it('privacy boundary classifies s4 artefacts as private or private_trace', () => {
    expect(isObjectPublicByDefault('DimensionScore')).toBe(false);
    expect(classifyField('score_trace')).toBe('private_trace');
    const pb = readFileSync('src/server/v3/privacy-boundary.ts', 'utf8');
    expect(pb.includes("ScoreTrace:'private_trace'")).toBe(true);
  });
});
