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

const S4_ALLOWED = new Set<V3ReleaseState>(['design_only', 'dark_mode_internal']);

export function isS4AllowedReleaseState(state: V3ReleaseState): boolean {
  return S4_ALLOWED.has(state);
}

export function assertS4ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS4AllowedReleaseState(state)) {
    throw new Error(`S4 release state not allowed: ${state}`);
  }
}


const S5_ALLOWED = new Set<V3ReleaseState>(['design_only', 'dark_mode_internal', 'internal_rendered_QA']);

export function isS5AllowedReleaseState(state: V3ReleaseState): boolean {
  return S5_ALLOWED.has(state);
}

export function assertS5ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS5AllowedReleaseState(state)) {
    throw new Error(`S5 release state not allowed: ${state}`);
  }
}


const S6_ALLOWED = new Set<V3ReleaseState>(['design_only', 'dark_mode_internal', 'internal_rendered_QA']);

export function isS6AllowedReleaseState(state: V3ReleaseState): boolean {
  return S6_ALLOWED.has(state);
}

export function assertS6ReleaseStateAllowed(state: V3ReleaseState): void {
  if (!isS6AllowedReleaseState(state)) {
    throw new Error(`S6 release state not allowed: ${state}`);
  }
}
