export const V3_STORAGE_BUNDLE_CONTRACT_VERSION = 'tapecoach_v3_storage_bundle_contract_v1' as const;

export const V3_CURRENT_ANALYSIS_STORAGE_BUNDLE_FILES = [
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
] as const;

export const V3_STORAGE_VALIDATION_RULES = {
  expected_file_count_when_technique_and_score_sources_exist: 12,
  requires_manifest: true,
  requires_acceptance_metrics: true,
  internal_qa_bundle_is_level2_acceptance: false,
  ordinary_single_take_comparison_absence_fails_analysis_proof: false,
} as const;
