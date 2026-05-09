import { describe, expect, it } from 'vitest';
import { getMetricRegistry, runS6RendererHarness, renderInternalComparisonQA, type ComparisonResult } from '@/server/v3';

const base: ComparisonResult = {
  comparison_id:'GF-01-cmp', submission_id:'sub-1', take_ids:['take-1','take-2','take-3'], selected_level:'professional', audition_context:'musical_theatre', comparison_state:'analysis_variance_warning',
  duplicate_detection:{ duplicate_detection_status:'confirmed_duplicate', asset_similarity_score:0.95, duplicate_confidence:0.93, reason_private:'Same media', validator_status:'suppress_claim' },
  asset_similarity:{ score:0.95, confidence:0.92, reason_private:'Same media asset id' },
  score_band_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', same_band:true, delta:0 }],
  overall_readiness_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:4 }], observed_quality_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:2 }], level_adjusted_readiness_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:4 }],
  component_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', object_id:'cmp', delta_type:'component', old_value:1, new_value:2, evidence_refs:['ev-comp'], confidence:0.7, explanation_private:'x', public_safe_summary_candidate:'Component evidence changed.', validator_status:'warn' }],
  dimension_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', object_id:'dim', delta_type:'dimension', old_value:1, new_value:2, evidence_refs:['ev-dim'], confidence:0.7, explanation_private:'x', public_safe_summary_candidate:'Dimension changed.', validator_status:'pass' }],
  technique_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', object_id:'tech', delta_type:'technique', old_value:'a', new_value:'b', evidence_refs:['ev-tech'], confidence:0.5, explanation_private:'internal', public_safe_summary_candidate:'Technique caveat applies.', validator_status:'warn' }],
  critical_gate_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', object_id:'gate', delta_type:'gate', old_value:false, new_value:true, evidence_refs:[], confidence:0.4, explanation_private:'x', public_safe_summary_candidate:'Gate toggled.', validator_status:'warn' }],
  evidence_sufficiency_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:0 }], assessability_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:0 }],
  submission_cohesion_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', object_id:'coh', delta_type:'cohesion', old_value:1, new_value:2, evidence_refs:['ev-coh'], confidence:0.6, explanation_private:'x', public_safe_summary_candidate:'Cohesion changed.', validator_status:'pass' }],
  reliability_deltas:[{ take_id_a:'take-1', take_id_b:'take-2', delta:0 }],
  confidence_deltas:{ duplicate_detection_confidence:0.95, asset_similarity_confidence:0.93, component_alignment_confidence:0.5, evidence_delta_confidence:0.4, scoring_delta_confidence:0.6, gate_delta_confidence:0.5, assessability_delta_confidence:0.5, cross_run_stability:0.4, comparison_confidence:0.45 },
  recommendation:{ recommendation_state:'suppressed', recommendation_label:'suppressed', recommendation_reason_private:'analysis variance', public_recommendation_allowed:false, suppressed_reason:'analysis_variance', suppression_validator_ids:['comparison-gf01-false-winner'] },
  suppressed_reason:'analysis_variance', variance_warnings:['same-video variance warning', '98 / 93 / 94 spread requires variance interpretation only'], comparison_confidence:0.45, public_summary_placeholder:'placeholder_only_no_recommendation', internal_qa_summary:'Do not submit take 1 winner best take', validator_status:[], created_at:new Date().toISOString(),
};

describe('v3-s6 internal comparison renderer', () => {
  it('renders minimal valid comparison and keeps no recommendation', () => {
    const out = renderInternalComparisonQA({ comparison_result:base, validator_trace_summary:[{ validation_id:'v', validator_name:'comparison-public-recommendation', action:'block_report', severity:'P0', passed:false, message:'public blocked' }], redaction_result:'pass', uk_english_result:{passed:true,flags:[]}, fixture_id:'GF-01', release_state:'internal_rendered_QA', internal_qa_marker:true, comparison_artefact_summary:['x'], suppressed_recommendation_reason:'analysis_variance', variance_warning_summary:['x'], confidence_trace_summary:[{key:'comparison_confidence',value:0.45}] });
    expect(out.internal_qa_marker).toBe(true);
    expect(out.no_recommendation_status.public_recommendation_allowed).toBe(false);
    expect(out.sections.some((s)=>s.section_id==='gf01_rt15_sentinel_status')).toBe(true);
    expect(out.sections.flatMap((s)=>s.safe_text).join(' ').toLowerCase()).not.toMatch(/submit take 1|winner|best take/);
  });

  it('creates rows for all 11 delta classes and redacts ids/refs', () => {
    const out = renderInternalComparisonQA({ comparison_result:base, validator_trace_summary:[], redaction_result:'pass', uk_english_result:{passed:true,flags:[]}, release_state:'dark_mode_internal', internal_qa_marker:true, comparison_artefact_summary:[], suppressed_recommendation_reason:'analysis_variance', variance_warning_summary:[], confidence_trace_summary:[] });
    const types = new Set(out.delta_rows.map((r)=>r.object_type));
    ['score_band','overall_readiness','observed_quality','level_adjusted_readiness','component','dimension','technique','critical_gate','evidence_sufficiency','assessability','submission_cohesion'].forEach((t)=>expect(types.has(t)).toBe(true));
    expect(out.delta_rows.every((r)=>r.take_id_a.startsWith('take:redacted') && r.take_id_b.startsWith('take:redacted'))).toBe(true);
    expect(out.delta_rows.every((r)=>r.evidence_refs.every((e)=>e.startsWith('ev:redacted') || e.length===0))).toBe(true);
    expect(out.delta_rows.some((r)=>/does not establish performance difference/i.test(r.safe_summary))).toBe(true);
    expect(out.delta_rows.some((r)=>/does not imply a preferred take/i.test(r.safe_summary))).toBe(true);
    expect(out.delta_rows.some((r)=>/maturity caveat/i.test(r.safe_summary))).toBe(true);
    expect(out.delta_rows.some((r)=>r.object_type==='critical_gate' && r.warning_or_suppression==='warn')).toBe(true);
    expect(out.delta_rows.some((r)=>r.object_type==='assessability' && /separately from performance weakness/i.test(r.safe_summary))).toBe(true);
    expect(out.delta_rows.some((r)=>r.object_type==='submission_cohesion' && /does not force a take preference/i.test(r.safe_summary))).toBe(true);
  });

  it('suppression panel includes validator ids and what-needed wording', () => {
    const out = renderInternalComparisonQA({ comparison_result:base, validator_trace_summary:[], redaction_result:'pass', uk_english_result:{passed:true,flags:[]}, fixture_id:'GF-01', release_state:'dark_mode_internal', internal_qa_marker:true, comparison_artefact_summary:[], suppressed_recommendation_reason:'analysis_variance', variance_warning_summary:[], confidence_trace_summary:[] });
    expect(out.no_recommendation_status.suppression_validator_ids.length).toBeGreaterThan(0);
    expect(out.no_recommendation_status.what_would_be_needed_to_recommend).toMatch(/decisive evidence deltas/i);
    expect(out.no_recommendation_status.public_recommendation_allowed).toBe(false);
    const txt = out.sections.find((s)=>s.section_id==='suppressed_recommendation_reason')!.safe_text.join(' ');
    expect(txt).toMatch(/suppressed reason/i);
  });

  it('validator rows include explicit groups and safe summaries', () => {
    const out = renderInternalComparisonQA({ comparison_result:base, validator_trace_summary:[
      { validation_id:'1', validator_name:'comparison-gf01-false-winner', action:'block_report', severity:'P0', passed:false, message:'GF-01 block' },
      { validation_id:'2', validator_name:'comparison-public-recommendation', action:'block_report', severity:'P0', passed:false, message:'public blocked' },
      { validation_id:'3', validator_name:'comparison-private-trace-leakage', action:'block_report', severity:'P0', passed:false, message:'leak blocked' },
      { validation_id:'4', validator_name:'comparison-hidden-reasoning', action:'block_report', severity:'P0', passed:false, message:'hidden reasoning blocked' },
    ], redaction_result:'pass', uk_english_result:{passed:true,flags:[]}, release_state:'dark_mode_internal', internal_qa_marker:true, comparison_artefact_summary:[], suppressed_recommendation_reason:'analysis_variance', variance_warning_summary:[], confidence_trace_summary:[] });
    expect(out.validator_rows.every((r)=>!!r.validator_group)).toBe(true);
    expect(out.validator_rows.find((r)=>r.validator_name==='comparison-gf01-false-winner')?.validator_group).toBe('gf01_false_winner');
    expect(out.validator_rows.find((r)=>r.validator_name==='comparison-public-recommendation')?.validator_group).toBe('public_recommendation_exposure');
    expect(out.validator_rows.find((r)=>r.validator_name==='comparison-private-trace-leakage')?.validator_group).toBe('private_leakage');
    expect(out.validator_rows.find((r)=>r.validator_name==='comparison-hidden-reasoning')?.validator_group).toBe('hidden_reasoning');
    expect(out.validator_rows.some((r)=>/submit take 1|winner|best take/i.test(r.safe_summary))).toBe(false);
  });

  it('GF-01 rendering shows duplicate, variance, suppression and separated confidence', () => {
    const out = renderInternalComparisonQA({ comparison_result:base, validator_trace_summary:[], redaction_result:'pass', uk_english_result:{passed:true,flags:[]}, fixture_id:'GF-01', release_state:'internal_rendered_QA', internal_qa_marker:true, comparison_artefact_summary:[], suppressed_recommendation_reason:'analysis_variance', variance_warning_summary:['same-video variance warning'], confidence_trace_summary:[] });
    const text = out.sections.flatMap((s)=>s.safe_text).join(' ').toLowerCase();
    expect(text).toMatch(/duplicate status/);
    expect(text).toMatch(/variance/);
    expect(text).not.toMatch(/submit take 1|best take|winner/);
    expect(out.confidence_rows.length).toBe(9);
    expect(out.no_recommendation_status.suppressed_reason).toBe('analysis_variance');
  });

  it('metric registry includes S6 renderer metrics and renderer harness runs', () => {
    expect(getMetricRegistry()).toContain('internal comparison renderer available');
    const run = runS6RendererHarness('s6-render');
    expect(run.checks.length).toBeGreaterThan(0);
    expect(run.checks.some((c)=>c.metric==='GF-01 false winner blocked in render')).toBe(true);
  });
});
