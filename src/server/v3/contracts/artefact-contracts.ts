export const CONTRACT_SCHEMA_VERSION = 'v3.0.0-contracts-r0';

export const ARTEFACT_STATUS_VOCABULARY = [
  'emitted',
  'missing',
  'deferred',
  'not_applicable',
  'emitted_blocked',
] as const;

export type ArtefactStatus = (typeof ARTEFACT_STATUS_VOCABULARY)[number];

export const MANIFEST_ARTEFACT_IDS = [
  'brief.requirement',
  'brief.achievement',
  'technique.standard',
  'technique.level_standard',
  'technique.observation_trace',
  'knowledge.source',
  'repertoire.standard',
  'research.augmented_specificity',
  'report.public_v3.render_payload',
  'manifest.artefact_inventory',
  'qa.acceptance_metrics',
  'comparison.raw_json',
  'comparison.evidence_delta',
] as const;

export type ManifestArtefactId = (typeof MANIFEST_ARTEFACT_IDS)[number];
