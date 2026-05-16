import { CONTRACT_SCHEMA_VERSION } from './artefact-contracts';

export type QaAcceptanceMetrics = {
  schema_version: typeof CONTRACT_SCHEMA_VERSION;
  level2_status: 'not_accepted';
  production_safe: 'blocked';
  public_scoring: 'blocked';
  public_technique_authority: 'blocked';
  notes: string[];
};

export const DEFAULT_QA_ACCEPTANCE_METRICS: QaAcceptanceMetrics = {
  schema_version: CONTRACT_SCHEMA_VERSION,
  level2_status: 'not_accepted',
  production_safe: 'blocked',
  public_scoring: 'blocked',
  public_technique_authority: 'blocked',
  notes: ['Sprint 0 contract-first package guardrail state.'],
};
