export const V3_RELEASE_STATES = [
  'design_only',
  'dark_mode_internal',
  'internal_rendered_QA',
  'hidden_production_beta',
  'branch_limited_readiness',
  'external_release_candidate',
  'launch',
] as const;

export type V3ReleaseState = (typeof V3_RELEASE_STATES)[number];

const S1_ALLOWED = new Set<V3ReleaseState>(['design_only', 'dark_mode_internal']);

export function isS1AllowedReleaseState(state: V3ReleaseState): boolean {
  return S1_ALLOWED.has(state);
}

export function assertS1ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS1AllowedReleaseState(state)) {
    throw new Error(`S1 release state not allowed: ${state}`);
  }
}

export function isLaunchReadinessState(state: V3ReleaseState): boolean {
  return state === 'launch';
}
