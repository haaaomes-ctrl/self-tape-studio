export const setupTask1ReleaseStateContract = {
  level2_status: 'not_accepted',
  production_safe_status: 'blocked',
  public_scoring_status: 'blocked',
  public_technique_authority_status: 'blocked',
  comparison_public_winner_status: 'blocked',
  customer_facing_release_status: 'blocked',
  contract_scope: 'setup_task1_bootstrap_source_contract_only',
  runtime_validated: false,
  not_live_runtime_proof: true,
  not_level2_acceptance: true,
  not_production_safe_approval: true,
  not_public_output_approval: true,
} as const;
