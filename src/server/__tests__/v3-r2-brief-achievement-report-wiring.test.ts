import { describe, expect, it } from 'vitest';
import { attachBriefAchievementToInternalReport, buildBriefAchievementTrace, buildBriefRequirementTrace } from '@/server/v3/brief-achievement.server';

describe('R2 brief achievement report wiring', () => {
  it('adds evaluated brief requirements and summary to the internal report payload', () => {
    const requirement = buildBriefRequirementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't',
      brief_text: 'Please film landscape.', selected_level: 'emerging',
    });
    const achievement = buildBriefAchievementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement,
      signals: { orientation: 'landscape' }, raw_report_data: {},
    });
    const report = attachBriefAchievementToInternalReport({ schema_version: 'v1-legacy' }, requirement, achievement);
    expect(report.brief_requirements).toHaveLength(1);
    expect(report.brief_requirements[0].achievement_status).toBe('achieved');
    expect(report.brief_requirements[0].readiness_impact).toBe('supports_submission');
    expect(report.brief_achievement.overall_brief_achievement).toBe('achieved');
    expect(report.brief_achievement_readiness_effect).toBe('supports_readiness');
  });

  it('keeps not-assessable technique requirements as assessability limitations, not performance criticism', () => {
    const requirement = buildBriefRequirementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't',
      brief_text: 'Please include a grand battement.', selected_level: 'professional',
    });
    const achievement = buildBriefAchievementTrace({
      run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement,
      signals: {}, raw_report_data: {},
    });
    const report = attachBriefAchievementToInternalReport({ schema_version: 'v1-legacy' }, requirement, achievement);
    expect(report.brief_requirements[0].achievement_status).toBe('not_assessable');
    expect(report.brief_requirements[0].assessability_limits).toContain('requires_R4_brief_requested_technique_detection');
    expect(achievement.requirement_results[0].achievement_status).not.toBe('not_achieved');
    expect(report.brief_achievement_readiness_effect).toBe('not_assessable');
  });

  it('surfaces mandatory assessable gaps as internal readiness material without mutating public priority fields', () => {
    const requirement = buildBriefRequirementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', brief_text: 'Please film landscape.' });
    const achievement = buildBriefAchievementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement, signals: { orientation: 'portrait' }, raw_report_data: {} });
    const originalPriorityFixes = [{ headline: 'Existing fix', category: 'technical' }];
    const report = attachBriefAchievementToInternalReport({ schema_version: 'v1-legacy', priority_fixes: originalPriorityFixes }, requirement, achievement);
    expect(achievement.readiness_effect).toBe('submission_blocker');
    expect(achievement.recommended_priority_focus[0]).toContain('Meet required brief item');
    expect(report.priority_fixes).toBe(originalPriorityFixes);
    expect(report.brief_requirements[0].achievement_status).toBe('not_achieved');
    expect(report.brief_achievement_internal_hooks.priority_fixes[0]).toMatchObject({
      type: 'retake_critical',
      linked_categories: ['brief_adherence'],
      linked_requirement_ids: ['brief-req-1'],
    });
    expect(report.brief_achievement_internal_hooks.action_plan[0].actions[0].action).toContain('Address brief gap');
  });

  it('does not turn ambiguous requirements into internal priority/action-plan hooks', () => {
    const requirement = buildBriefRequirementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', brief_text: 'Show us who you are.' });
    const achievement = buildBriefAchievementTrace({ run_id: 'r', analysis_run_id: 'r', submission_id: 's', take_id: 't', requirement_trace: requirement, signals: {}, raw_report_data: {} });
    const report = attachBriefAchievementToInternalReport({ schema_version: 'v1-legacy' }, requirement, achievement);
    expect(report.brief_requirements[0].category).toBe('ambiguous');
    expect(report.brief_achievement_internal_hooks.priority_fixes).toEqual([]);
    expect(report.brief_achievement_internal_hooks.action_plan).toEqual([]);
  });
});
