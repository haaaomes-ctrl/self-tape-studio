export const V3_GATE_CONTRACT_VERSION = 'tapecoach_v3_codex_operating_loop_gates_v1' as const;

export const V3_BLOCKED_RELEASE_GATES = {
  level2_status: 'not_accepted',
  production_safe_status: 'blocked',
  public_scoring_status: 'blocked',
  public_technique_authority_status: 'blocked',
} as const;

export const V3_PUBLIC_BOUNDARY_CONTRACT = {
  public_output_unchanged_required: true,
  upload_changes_allowed: false,
  mux_changes_allowed: false,
  webhook_changes_allowed: false,
  release_decision_requires_operator: true,
  public_authority_decision_requires_operator: true,
} as const;

export const V3_ESCALATION_REASONS = [
  'ambiguity',
  'contradiction',
  'protected_area_exception',
  'release_decision',
  'public_authority_decision',
] as const;
