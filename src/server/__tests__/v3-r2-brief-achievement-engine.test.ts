import { describe, expect, it } from 'vitest';
import {
  buildBriefAchievementTrace,
  buildBriefRequirementTrace,
  classifyBriefObligation,
  classifyRequirementType,
} from '@/server/v3/brief-achievement.server';

function traces(brief: string | null, extra: Record<string, unknown> = {}) {
  const requirement = buildBriefRequirementTrace({
    run_id: 'run-r2',
    analysis_run_id: 'run-r2',
    submission_id: 'sub-r2',
    take_id: 'take-r2',
    selected_level: 'professional',
    brief_text: brief,
    ...extra,
  });
  const achievement = buildBriefAchievementTrace({
    run_id: 'run-r2',
    analysis_run_id: 'run-r2',
    submission_id: 'sub-r2',
    take_id: 'take-r2',
    requirement_trace: requirement,
    raw_report_data: {},
    signals: (extra.signals as Record<string, unknown> | undefined) ?? {},
  });
  return { requirement, achievement };
}

describe('R2 brief achievement engine', () => {
  it('handles no brief without inventing requirements', () => {
    const { requirement, achievement } = traces(null);
    expect(requirement.brief_present).toBe(false);
    expect(requirement.source_family).toBe('no_brief');
    expect(requirement.requirements).toEqual([]);
    expect(achievement.summary.overall_brief_achievement).toBe('no_brief');
    expect(achievement.readiness_effect).toBe('no_brief');
  });

  it('itemises a simple format instruction as technical setup / format', () => {
    const { requirement, achievement } = traces('Please film landscape.', { signals: { orientation: 'landscape' } });
    expect(requirement.requirements[0]).toMatchObject({ category: 'technical_setup', requirement_type: 'format' });
    expect(achievement.requirement_results[0]).toMatchObject({ achievement_status: 'achieved', readiness_impact: 'supports_submission' });
  });

  it('classifies single-file instruction as admin process / submission process', () => {
    expect(classifyBriefObligation('Submit as a single file')).toBe('admin_process');
    expect(classifyRequirementType('Submit as a single file')).toBe('submission_process');
  });

  it('classifies full-body framing as technical setup / framing', () => {
    expect(classifyBriefObligation('Full body must be visible throughout')).toBe('technical_setup');
    expect(classifyRequirementType('Full body must be visible throughout')).toBe('framing');
  });

  it('classifies material instructions for song, scene, copy, monologue and dance', () => {
    expect(classifyRequirementType('Please prepare the song cut')).toBe('song');
    expect(classifyRequirementType('Read the scene from the sides')).toBe('scene');
    expect(classifyRequirementType('Use the commercial copy')).toBe('copy');
    expect(classifyRequirementType('Prepare one monologue')).toBe('monologue');
    expect(classifyRequirementType('Include the dance phrase')).toBe('dance');
  });

  it('keeps mandatory technique request not assessable before R4', () => {
    const { requirement, achievement } = traces('Please include a grand battement.');
    expect(requirement.requirements[0]).toMatchObject({ requirement_type: 'technique' });
    expect(achievement.requirement_results[0]).toMatchObject({ achievement_status: 'not_assessable', readiness_impact: 'not_assessable' });
    expect(achievement.requirement_results[0].assessability_limits).toContain('requires_R4_brief_requested_technique_detection');
  });

  it('does not turn preferred requirements into mandatory requirements', () => {
    expect(classifyBriefObligation('Ideally include a short slate')).toBe('preferred');
  });

  it('keeps style-context language separate from mandatory requirements', () => {
    expect(classifyBriefObligation('Style: bright commercial comedy')).toBe('style_context');
  });

  it('marks ambiguous language as ambiguous instead of forcing mandatory status', () => {
    expect(classifyBriefObligation('Show us who you are')).toBe('ambiguous');
  });

  it('reduces readiness when an explicit assessable format requirement is absent', () => {
    const { achievement } = traces('Please film landscape.', { signals: { orientation: 'portrait' } });
    expect(achievement.requirement_results[0].achievement_status).toBe('not_achieved');
    expect(achievement.requirement_results[0].readiness_impact).toBe('submission_blocker');
    expect(achievement.readiness_effect).toBe('submission_blocker');
  });

  it('uses not_assessable, not not_achieved, when evidence is missing', () => {
    const { achievement } = traces('Please include a grand battement.');
    expect(achievement.requirement_results[0].achievement_status).toBe('not_assessable');
    expect(achievement.requirement_results[0].blocker_codes).toContain('brief_requirement_not_assessable');
  });



  it('does not let generated brief requirement fields self-prove material achievement', () => {
    const requirement = buildBriefRequirementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', brief_text: 'Please sing the song cut.' });
    const achievement = buildBriefAchievementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement,
      raw_report_data: { brief_requirements: requirement.requirements },
      signals: {},
    });
    expect(achievement.requirement_results[0].achievement_status).toBe('not_assessable');
    expect(achievement.requirement_results[0].assessability_limits).toContain('brief_evidence_missing:material_identity_not_verified');
  });

  it('keeps hard not-assessable requirements visible in readiness effect', () => {
    const requirement = buildBriefRequirementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', brief_text: 'Please film landscape. Please include a grand battement.' });
    const achievement = buildBriefAchievementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement,
      raw_report_data: {},
      signals: { orientation: 'landscape' },
    });
    expect(achievement.requirement_results.some((result) => result.achievement_status === 'not_assessable')).toBe(true);
    expect(achievement.readiness_effect).toBe('not_assessable');
  });

  it('can use legacy component fields cautiously for material-family presence', () => {
    const requirement = buildBriefRequirementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', brief_text: 'Please sing the song cut.' });
    const achievement = buildBriefAchievementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement,
      raw_report_data: { detected_components: [{ type: 'song', score: 80 }] },
      signals: {},
    });
    expect(achievement.requirement_results[0].achievement_status).toBe('achieved');
    expect(achievement.requirement_results[0].assessability_limits).toContain('legacy_adapter_source:not_full_v3_material_proof');
  });
});
