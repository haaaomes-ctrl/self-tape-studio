import { describe, expect, it } from 'vitest';
import {
  V3_BLOCKED_RELEASE_GATES,
  V3_CURRENT_ANALYSIS_STORAGE_BUNDLE_FILES,
  V3_ESCALATION_REASONS,
  V3_PUBLIC_BOUNDARY_CONTRACT,
  V3_STORAGE_VALIDATION_RULES,
} from '../v3/contracts';

describe('TapeCoach v3 operating-loop contracts', () => {
  it('keeps release and public-authority gates blocked', () => {
    expect(V3_BLOCKED_RELEASE_GATES).toEqual({
      level2_status: 'not_accepted',
      production_safe_status: 'blocked',
      public_scoring_status: 'blocked',
      public_technique_authority_status: 'blocked',
    });
  });

  it('keeps protected public, upload, Mux and webhook areas closed by default', () => {
    expect(V3_PUBLIC_BOUNDARY_CONTRACT).toMatchObject({
      public_output_unchanged_required: true,
      upload_changes_allowed: false,
      mux_changes_allowed: false,
      webhook_changes_allowed: false,
      release_decision_requires_operator: true,
      public_authority_decision_requires_operator: true,
    });
  });

  it('requires escalation only for the documented operator decision classes', () => {
    expect(V3_ESCALATION_REASONS).toEqual([
      'ambiguity',
      'contradiction',
      'protected_area_exception',
      'release_decision',
      'public_authority_decision',
    ]);
  });

  it('pins the current 12-file Storage validation bundle', () => {
    expect(V3_CURRENT_ANALYSIS_STORAGE_BUNDLE_FILES).toEqual([
      'inputs/input_record.json',
      'inputs/submission.json',
      'inputs/take.json',
      'reports/raw_report.json',
      'resolver/resolver_output.json',
      'resolver/TruthStateMap.json',
      'traces/EvidenceAnchors.json',
      'traces/PublicClaimTrace.json',
      'traces/TechniqueObservationTrace.json',
      'traces/ScoreTrace.json',
      'manifest.json',
      'qa/acceptance_metrics.json',
    ]);
    expect(V3_STORAGE_VALIDATION_RULES.expected_file_count_when_technique_and_score_sources_exist).toBe(12);
    expect(V3_STORAGE_VALIDATION_RULES.requires_manifest).toBe(true);
    expect(V3_STORAGE_VALIDATION_RULES.requires_acceptance_metrics).toBe(true);
    expect(V3_STORAGE_VALIDATION_RULES.internal_qa_bundle_is_level2_acceptance).toBe(false);
  });
});
