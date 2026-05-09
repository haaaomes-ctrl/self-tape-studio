export interface V3Flags {
  v3_inputs_enabled: boolean;
  v3_resolver_enabled: boolean;
  v3_evidence_anchor_enabled: boolean;
  v3_component_model_enabled: boolean;
  v3_claim_trace_enabled: boolean;
  v3_validator_blocking_enabled: boolean;
  v3_uk_english_gate_enabled: boolean;
  v3_archive_reset_enabled: boolean;
  v3_ontology_shadow_enabled: boolean;
}

export const V3_FLAG_DEFAULTS: V3Flags = {
  v3_inputs_enabled: false,
  v3_resolver_enabled: false,
  v3_evidence_anchor_enabled: false,
  v3_component_model_enabled: false,
  v3_claim_trace_enabled: false,
  v3_validator_blocking_enabled: false,
  v3_uk_english_gate_enabled: false,
  v3_archive_reset_enabled: false,
  v3_ontology_shadow_enabled: false,
};

export function resolveV3Flags(): V3Flags {
  return { ...V3_FLAG_DEFAULTS };
}
