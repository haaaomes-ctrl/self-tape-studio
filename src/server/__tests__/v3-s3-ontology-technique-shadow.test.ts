import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { V3_FLAG_DEFAULTS } from '@/server/v3/flags';
import { assertS1ReleaseStateAllowed } from '@/server/v3/release-state';
import { getFixtureRegistry, getRedTeamRegistry, getS3MetricRegistry, runS3Harness } from '@/server/v3/evaluation-harness';
import { getS3CoverageForDiscipline, getS3DisciplineCoverageMap, getS3TechniqueFamilyById, getS3TechniqueFamilyRegistry, validateS3CoverageIsShadowOnly, validateS3DisciplineCoverageMap, validateS3TechniqueFamilyRegistry, validateS3TechniqueFamilyShadowOnly } from '@/server/v3/fixtures';
import { validateOntologyItem, validateOntologyVersion, validateSourceProvenance, validateSafePublicLanguageMap, validateRecognitionTestResult, validateTechniqueObservation, validateTechniqueObservationPublicDisplayBlocked, validateTechniqueObservationDoesNotScore, validateOntologyMaturityUse, validateTechniqueFutureReviewEligibility, validateFalsePositiveChecks } from '@/server/v3/validation';

const ontologyItem = {
  technique_id:'acting_through_song', discipline:'musical_theatre', label_internal:'Acting through song', definition:'Internal shadow descriptor', observable_indicators:['lyric intent'], common_faults:['flat phrasing'], false_positive_risks:['lyric inaudible'], assessability_requirements:['audible lyric'], evidence_required:['audio evidence'], safe_public_wording:['story intent supported'], unsafe_wording:['marketability'], benchmark_fixtures:['GF-01'], source_provenance_ids:['sp-1'], source_status:'research', release_maturity:'research_seed', maturity_notes:'limitation: provisional only', version_id:'ov-1', created_at:'2026-01-01', updated_at:'2026-01-01',
};

describe('v3 s3 ontology and technique shadow', () => {
  it('ontology flag exists and defaults false', ()=> expect(V3_FLAG_DEFAULTS.v3_ontology_shadow_enabled).toBe(false));
  it('external_release_candidate forbidden', ()=> expect(()=>assertS1ReleaseStateAllowed('external_release_candidate')).toThrow());
  it('ontology maturity and item checks', ()=> { expect(validateOntologyMaturityUse('research_seed').passed).toBe(true); expect(validateOntologyMaturityUse('expert_reviewed').passed).toBe(true); expect(validateOntologyMaturityUse('benchmark_validated').passed).toBe(false); expect(validateOntologyMaturityUse('production_safe').passed).toBe(false); expect(validateOntologyMaturityUse('deprecated').passed).toBe(false); expect(validateOntologyMaturityUse('invalid' as never).passed).toBe(false); expect(validateOntologyItem(ontologyItem).length).toBe(0); expect(validateOntologyItem({ ...ontologyItem, discipline:'invalid' }).some((r)=>!r.passed)).toBe(true); expect(validateOntologyItem({ ...ontologyItem, false_positive_risks:[] }).some((r)=>!r.passed)).toBe(true); });
  it('ontology version and source provenance checks', ()=> { expect(validateOntologyVersion({ ontology_version_id:'ov', included_item_ids:['x'], release_maturity_summary:'research_seed' }).length).toBe(0); expect(validateOntologyVersion({ ontology_version_id:'ov', included_item_ids:[], release_maturity_summary:'production_safe' }).some((r)=>!r.passed)).toBe(true); expect(validateSourceProvenance({ source_hierarchy_level:2, limitation_notes:'descriptor not weighting', supports:['descriptor'], does_not_support:['weights'] }).every((r)=>r.passed)).toBe(true); expect(validateSourceProvenance({ source_hierarchy_level:7, limitation_notes:'x', supports:[], does_not_support:[] }).some((r)=>!r.passed)).toBe(true); });
  it('safe language and recognition placeholders', ()=> { expect(validateSafePublicLanguageMap({ unsafe_phrase:'marketability', maturity_required_for_public_use:'expert_reviewed' }).length).toBe(0); expect(validateRecognitionTestResult({ pass:true, confidence:0.8 }).length).toBe(0); });
  it('technique observation rules and thresholds', ()=> { const obs={ observation_id:'o1', take_id:'t1', evidence_anchor_id:'a1', ontology_item_id:'acting_through_song', technique_id:'acting_through_song', status:'uncertain', confidence:0.6, evidence_note_private:'internal', truth_state:'observed_in_tape', assessability_status:'partial', evidence_sufficiency:'partial', false_positive_checks:['lyric audible'], public_display_eligibility:'not_public_s3', validator_status:'warn' }; expect(validateTechniqueObservation(obs).every((r)=>r.passed)).toBe(true); expect(validateTechniqueObservation({ ...obs, status:'observed', confidence:0.4 }).some((r)=>!r.passed)).toBe(true); expect(validateTechniqueObservationPublicDisplayBlocked('public').passed).toBe(false); expect(validateTechniqueObservationDoesNotScore({ score_input:true }).passed).toBe(false); expect(validateTechniqueFutureReviewEligibility(0.9,'expert_reviewed',true).passed).toBe(true); expect(validateTechniqueFutureReviewEligibility(0.7,'expert_reviewed',true).passed).toBe(false); expect(validateFalsePositiveChecks([]).passed).toBe(false); });
  it('harness and fixture/rt s3 mapping', ()=> { expect(getS3MetricRegistry()).toHaveLength(20); expect(runS3Harness('GF-01').checks).toHaveLength(20); const gf01=getFixtureRegistry().find((f)=>f.id==='GF-01')!; expect(gf01.required_s3_artefacts).toContain('technique_observations_shadow_only'); expect(gf01.priority).toBe('P0'); expect(getRedTeamRegistry().find((r)=>r.id==='RT-15')!.fixture_links).toContain('GF-01'); });
  it('structured technique family registry is complete and shadow-only', ()=> {
    const families=getS3TechniqueFamilyRegistry();
    expect(families.length).toBe(43);
    expect(validateS3TechniqueFamilyRegistry()).toBe(true);
    expect(validateS3TechniqueFamilyShadowOnly()).toBe(true);
    expect(getS3TechniqueFamilyById('acting_through_song')).toBeDefined();
    expect(getS3TechniqueFamilyById('technical')).toBeUndefined();
    expect(families.every((f)=>f.minimum_maturity_for_future_public_naming!=='production_safe')).toBe(true);
  });
  it('structured discipline coverage map is complete with required gaps', ()=> {
    const map=getS3DisciplineCoverageMap();
    expect(map).toHaveLength(6);
    expect(validateS3DisciplineCoverageMap()).toBe(true);
    expect(validateS3CoverageIsShadowOnly()).toBe(true);
    const mt=getS3CoverageForDiscipline('musical_theatre')!;
    expect(mt.remaining_gaps.join(' ')).toContain('through-composed calibration remains limited');
    const dance=getS3CoverageForDiscipline('dance')!;
    expect(dance.remaining_gaps.join(' ')).toContain('true Dance live QA remains absent');
  });
  it('static non-regression scan for forbidden runtime imports', ()=> {
    const targets=['src/routes','src/components/report','src/lib','src/server'];
    const cmd=`rg -n "src/server/v3|server/v3" ${targets.join(' ')} | rg -v "src/server/__tests__|src/server/v3" || true`;
    const out=execSync(cmd,{encoding:'utf8'}).trim();
    expect(out).toBe('');
    const v=readFileSync('src/server/v3/validation.ts','utf8');
    expect(v.includes('DimensionScore')).toBe(false);
    expect(v.includes('ProfessionalScoreBand')).toBe(false);
  });
});
