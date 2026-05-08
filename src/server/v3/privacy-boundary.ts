export type DataClass = 'public_safe'|'private'|'sensitive'|'private_trace'|'public_only_after_validation';
export const OBJECT_DEFAULT_CLASS: Record<string, DataClass> = {
  Submission:'private', Take:'private', UserInputContext:'private', BriefContext:'sensitive', MaterialContext:'private', ComparisonIntent:'private', TruthStateMap:'private_trace', ResolverResult:'private_trace', Component:'private', ComponentCriticality:'private', EvidenceAnchor:'private_trace', PublicClaimTrace:'private_trace', QAValidationResult:'private_trace', ModelRunTrace:'private_trace', ArchiveResetRecord:'private_trace',
};
export const FIELD_CLASSIFICATION: Record<string, DataClass> = {
  user_id:'sensitive', media_asset_id:'sensitive', full_brief_text:'sensitive', uploaded_material_ref:'sensitive', access_setup_context:'sensitive', hidden_reasoning:'private_trace', truth_state_map:'private_trace', raw_resolver_output:'private_trace', evidence_anchor:'private_trace', public_claim_trace:'private_trace', qa_validation_result:'private_trace', model_run_trace:'private_trace', score_trace:'private_trace', future_score_trace:'private_trace', selected_level_label:'public_only_after_validation', audition_context_label:'public_only_after_validation', brief_mode_label:'public_only_after_validation', take_label:'public_only_after_validation', component_public_label:'public_only_after_validation', curated_public_safe_limitation:'public_only_after_validation', public_safe_resolver_summary:'public_only_after_validation',
};
export function classifyField(field: string): DataClass { return FIELD_CLASSIFICATION[field] ?? 'private'; }
export function isObjectPublicByDefault(objectName:string): boolean { return OBJECT_DEFAULT_CLASS[objectName] === 'public_safe'; }
export function isFieldPublicSafe(field: string): boolean { return classifyField(field) === 'public_safe'; }
export function canSurfaceField(field:string, validated=false): boolean { const c=classifyField(field); return c==='public_safe' || (validated && c==='public_only_after_validation'); }
export function redactPrivateFields<T extends Record<string, unknown>>(input:T): Partial<T> { const out:Partial<T>={}; for (const [k,v] of Object.entries(input)) if (canSurfaceField(k,false)) out[k as keyof T]=v as T[keyof T]; return out; }
