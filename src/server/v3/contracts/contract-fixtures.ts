import { CONTRACT_SCHEMA_VERSION, type ManifestArtefactId } from './artefact-contracts';
import { DEFAULT_QA_ACCEPTANCE_METRICS } from './acceptance-metrics-contracts';

const artefactInventory: ManifestArtefactId[] = [
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
];

export const CONTRACT_FIXTURES = {
  producer_fixture: { schema_version: CONTRACT_SCHEMA_VERSION, artefacts: artefactInventory },
  consumer_fixture: { schema_version: CONTRACT_SCHEMA_VERSION, accepts_private_only: true },
  empty_null_fixture: { schema_version: CONTRACT_SCHEMA_VERSION, payload: null },
  blocked_not_applicable_fixture: { status: ['emitted_blocked', 'not_applicable'] as const },
  legacy_adapter_fixture: { source: 'legacy_adapter', insufficient_for_v3_gates: true },
  brief_requirement: { id: 'br-1', requirement: 'Slate included', status: 'required' as const },
  brief_achievement: { requirement_id: 'br-1', achieved: false, evidence: 'emitted_blocked' },
  technique_standard: { technique_id: 'tk-1', label: 'Objective clarity', descriptor_safe: false },
  technique_level_standard: { technique_id: 'tk-1', level: 'foundational' as const },
  technique_observation_trace: { technique_id: 'tk-1', observed: false, trace_id: 'trace-001' },
  knowledge_source: { source_id: 'ks-1', provenance: 'internal' as const },
  repertoire_standard: { repertoire_id: 'rep-1', category: 'commercial', public_claims_enabled: false },
  research_augmented_specificity: { run_id: 'run-1', specificity_score: 0, gated: true },
  public_report_v3_render_payload: {
    report_id: 'rpt-1',
    visibility: 'private_internal' as const,
    scoring_exposed: false,
    technique_authority_exposed: false,
  },
  manifest_artefact_inventory: artefactInventory,
  qa_acceptance_metrics: DEFAULT_QA_ACCEPTANCE_METRICS,
  comparison_raw_json: { comparison_run_id: 'cmp-1', left_run_id: 'a1', right_run_id: 'a2' },
  comparison_evidence_delta: { comparison_run_id: 'cmp-1', delta_summary: 'blocked', evidence_ids: [] },
};
