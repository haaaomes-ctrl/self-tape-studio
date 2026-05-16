import { describe, expect, it } from 'vitest';
import {
  ARTEFACT_STATUS_VOCABULARY,
  CONTRACT_SCHEMA_VERSION,
  MANIFEST_ARTEFACT_IDS,
} from '../../v3/contracts/artefact-contracts';
import { DEFAULT_QA_ACCEPTANCE_METRICS } from '../../v3/contracts/acceptance-metrics-contracts';
import { CONTRACT_FIXTURES } from '../../v3/contracts/contract-fixtures';
import { LEVEL2_SUB_GATES } from '../../v3/contracts/level2-gates';
import { V3_FEATURE_FLAG_DEFAULTS } from '../../v3/contracts/feature-flags';
import { PR13_P2_IDENTITY_CONFIRMATION } from '../../v3/contracts/comparison-contracts';

describe('v3 sprint-0 contract compatibility', () => {
  it('keeps schema versions and manifest artefact ids stable', () => {
    expect(CONTRACT_SCHEMA_VERSION).toBe('v3.0.0-contracts-r0');
    expect(MANIFEST_ARTEFACT_IDS).toContain('qa.acceptance_metrics');
    expect(CONTRACT_FIXTURES.manifest_artefact_inventory).toEqual(MANIFEST_ARTEFACT_IDS);
  });

  it('keeps acceptance metrics and blocked release gates intact', () => {
    expect(DEFAULT_QA_ACCEPTANCE_METRICS.level2_status).toBe('not_accepted');
    expect(DEFAULT_QA_ACCEPTANCE_METRICS.production_safe).toBe('blocked');
    expect(DEFAULT_QA_ACCEPTANCE_METRICS.public_scoring).toBe('blocked');
    expect(DEFAULT_QA_ACCEPTANCE_METRICS.public_technique_authority).toBe('blocked');
  });

  it('keeps public/private classification and status vocabulary', () => {
    expect(CONTRACT_FIXTURES.public_report_v3_render_payload.visibility).toBe('private_internal');
    expect(CONTRACT_FIXTURES.public_report_v3_render_payload.scoring_exposed).toBe(false);
    expect(ARTEFACT_STATUS_VOCABULARY).toEqual([
      'emitted',
      'missing',
      'deferred',
      'not_applicable',
      'emitted_blocked',
    ]);
  });

  it('keeps legacy_adapter insufficient and level2 sub-gates not accepted', () => {
    expect(CONTRACT_FIXTURES.legacy_adapter_fixture.insufficient_for_v3_gates).toBe(true);
    Object.values(LEVEL2_SUB_GATES).forEach((value) => expect(value).toBe('not_accepted'));
  });

  it('keeps protected feature flags off by default', () => {
    expect(V3_FEATURE_FLAG_DEFAULTS.V3_PUBLIC_SCORE_EXPOSURE_ENABLED).toBe('off');
    expect(V3_FEATURE_FLAG_DEFAULTS.V3_PUBLIC_TECHNIQUE_AUTHORITY_ENABLED).toBe('off');
    expect(V3_FEATURE_FLAG_DEFAULTS.V3_COMPARISON_RUNTIME_ENABLED).toBe('off');
  });

  it('keeps PR13/P2 comparison identity implementation blocked in sprint-0', () => {
    expect(PR13_P2_IDENTITY_CONFIRMATION.state).toBe('operator-verification-required');
  });
});
