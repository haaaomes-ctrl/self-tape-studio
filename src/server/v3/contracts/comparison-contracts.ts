export type ComparisonRawJson = { comparison_run_id: string; left_run_id: string; right_run_id: string };
export type ComparisonEvidenceDelta = { comparison_run_id: string; delta_summary: string; evidence_ids: string[] };

export const PR13_P2_IDENTITY_CONFIRMATION = {
  state: 'operator-verification-required',
  note: 'PR13/P2 comparison manifest identity/comparison_run_id handling not modified in Sprint 0 package.',
} as const;
