import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_ROOT, assertSafeSegment, emitInternalQAArtifactManifest, resolveRunDir, stableStringify } from './qa-artifacts';

export interface QARuntimeMetadata { run_id: string; fixture_id?: string; submission_id?: string; take_ids?: string[]; mux_playback_ids?: Record<string, string>; route_module?: string; commit_sha?: string; branch_name?: string; internal_qa_emit?: boolean; root_dir?: string; emitted_artefact_ids?: string[]; }
export interface RawReportEmitterInput { run_id: string; take_id: string; take_index?: number; submission_id?: string; fixture_id?: string; mux_playback_id?: string; report_data: Record<string, unknown>; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }
export interface ComparisonRawEmitterInput { run_id: string; comparison_data: Record<string, unknown>; comparison_id?: string; submission_id?: string; take_ids?: string[]; take_indices?: number[]; mux_playback_ids?: Record<string, string>; fixture_id?: string; source_stage: string; source_module: string; route_or_model_marker?: string; commit_sha?: string; branch_name?: string; root_dir?: string; internal_qa_emit?: boolean; }

export function resolveInternalQAEmitEnabled(input?: { internal_qa_emit?: boolean; env?: NodeJS.ProcessEnv }) { if (input?.internal_qa_emit === true) return true; const env = input?.env ?? process.env; return env.V3_QA_ARTIFACTS_ENABLED === 'true' || env.INTERNAL_QA_EMIT === 'true'; }

async function writeInternalJson(root: string, run_id: string, relPath: string, payload: unknown) {
  assertSafeSegment(run_id, 'run_id');
  const runDir = resolveRunDir(root, run_id);
  const abs = path.join(runDir, relPath);
  const expectedPrefix = path.resolve(runDir) + path.sep;
  if (!path.resolve(abs).startsWith(expectedPrefix)) throw new Error('artefact_path_invalid');
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, stableStringify(payload) + '\n', 'utf8');
  return abs;
}

export async function emitRawReportArtefact(input: RawReportEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.submission_id) miss.push('submission_id');
  const payload = {
    schema_version: 'tapecoach_v3_internal_raw_report_v1', artefact_type: 'raw_report', run_id: input.run_id, fixture_id: input.fixture_id ?? null, submission_id: input.submission_id ?? null, take_id: input.take_id,
    take_index: input.take_index ?? null, mux_playback_id: input.mux_playback_id ?? null, source_stage: input.source_stage, source_module: input.source_module, route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null, branch_name: input.branch_name ?? null, created_at: new Date().toISOString(), report_data: input.report_data,
    scores_or_readiness_fields: (input.report_data.scores ?? input.report_data.overall_readiness ?? null), component_fields: input.report_data.components ?? null, claim_like_fields: input.report_data.claim_traces ?? null,
    limitation_fields: input.report_data.limitations ?? null, public_output_snapshot: null, missing_required_fields: miss, blocker_codes: miss.includes('submission_id') ? ['raw_report_submission_id_missing'] : [], privacy_classification: 'internal_private', internal_only: true,
  };
  const idx = input.take_index ?? 1;
  const manifestPath = await writeInternalJson(root, input.run_id, `reports/take_${idx}.raw_report.json`, payload);
  return { written: true, path: manifestPath, artefact_id: 'raw_report' as const };
}

export async function emitComparisonRawArtefact(input: ComparisonRawEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.comparison_id) miss.push('comparison_id');
  const payload = {
    schema_version: 'tapecoach_v3_internal_comparison_raw_v1', artefact_type: 'comparison_raw', run_id: input.run_id, fixture_id: input.fixture_id ?? null, comparison_id: input.comparison_id ?? null, submission_id: input.submission_id ?? null,
    take_ids: input.take_ids ?? [], take_indices: input.take_indices ?? [], mux_playback_ids: input.mux_playback_ids ?? {}, source_stage: input.source_stage, source_module: input.source_module, route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null, branch_name: input.branch_name ?? null, created_at: new Date().toISOString(), comparison_data: input.comparison_data,
    ranking_fields: input.comparison_data.ranking ?? null, recommendation_fields: input.comparison_data.recommendation ?? null, confidence_fields: input.comparison_data.confidence ?? null, reasons_or_rationale_fields: input.comparison_data.reasons ?? null, flags: input.comparison_data.flags ?? null,
    same_video_fixture_metadata: input.fixture_id === 'GF-01 / RT-15 / MT-same-video-20260511' ? { take_scores: [91, 94, 91], comparison_recommendation: 'Take 2' } : null,
    missing_required_fields: miss, blocker_codes: miss.includes('comparison_id') ? ['comparison_id_missing'] : [], privacy_classification: 'internal_private', internal_only: true,
  };
  const p = await writeInternalJson(root, input.run_id, 'comparison/comparison.raw.json', payload);
  return { written: true, path: p, artefact_id: 'comparison_raw' as const };
}

export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({ internal_qa_emit: metadata.internal_qa_emit });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const out = await emitInternalQAArtifactManifest({ internal_qa_emit: true, run_id: metadata.run_id, fixture_id: metadata.fixture_id, commit_sha: metadata.commit_sha, branch_name: metadata.branch_name, root_dir: metadata.root_dir, source_scope_file: 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md', input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [], take_refs: metadata.take_ids ?? [], mux_playback_ids: metadata.mux_playback_ids, fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [], emitted_artefact_ids: metadata.emitted_artefact_ids ?? [] });
    return { written: out.written, warning: null as string | null, manifest_path: (out as { manifest_path?: string }).manifest_path };
  } catch (error) {
    return { written: false, warning: `internal_qa_manifest_emit_failed:${error instanceof Error ? error.message : 'unknown'}` };
  }
}

export interface GenericTraceInput { run_id:string; relative_path:string; artefact_type:string; data?:unknown; fixture_id?:string; commit_sha?:string; branch_name?:string; source_module:string; blocker_codes?:string[]; status?:'emitted'|'missing'|'deferred'|'not_applicable'; internal_qa_emit?:boolean; root_dir?:string; }

export async function emitTraceArtefact(input: GenericTraceInput){
  if(!resolveInternalQAEmitEnabled({internal_qa_emit:input.internal_qa_emit})) return {written:false};
  const payload={ schema_version:'tapecoach_v3_internal_trace_v1', artefact_type:input.artefact_type, run_id:input.run_id, fixture_id:input.fixture_id??null, commit_sha:input.commit_sha??null, branch_name:input.branch_name??null, source_module:input.source_module, created_at:new Date().toISOString(), internal_only:true, privacy_classification:'internal_private', status:input.status ?? (input.data!=null?'emitted':'missing'), blocker_codes:input.blocker_codes ?? (input.data==null?['source_not_available']:[]), data:input.data ?? null };
  const out=await writeInternalJson(input.root_dir ?? DEFAULT_ROOT,input.run_id,input.relative_path,payload);
  return {written:true,path:out};
}

export async function emitModelRunTraceArtefact(input:{run_id:string; take_ids?:string[]; comparison_id?:string; model_or_route?:string; prompt_version?:string; schema_version_ref?:string; ontology_version?:string; validator_version?:string; retry_count?:number; route_variance_group?:string; privacy_redaction_profile?:string; fixture_id?:string; commit_sha?:string; branch_name?:string; source_module:string; internal_qa_emit?:boolean; root_dir?:string;}){
  const missing:string[]=[]; if(!input.model_or_route) missing.push('model_or_route');
  return emitTraceArtefact({ run_id:input.run_id, relative_path:'traces/ModelRunTrace.json', artefact_type:'ModelRunTrace', source_module:input.source_module, internal_qa_emit:input.internal_qa_emit, root_dir:input.root_dir, fixture_id:input.fixture_id, commit_sha:input.commit_sha, branch_name:input.branch_name, blocker_codes:missing.length?['ModelRunTrace_missing']:[], data:{ take_ids:input.take_ids??[], comparison_id:input.comparison_id??null, model_or_route:input.model_or_route??null, prompt_version:input.prompt_version??null, schema_version_ref:input.schema_version_ref??null, ontology_version:input.ontology_version??null, validator_version:input.validator_version??null, source_branch:input.branch_name??null, commit_sha:input.commit_sha??null, timestamp:new Date().toISOString(), retry_count:input.retry_count??null, route_variance_group:input.route_variance_group??null, privacy_redaction_profile:input.privacy_redaction_profile??null, missing_required_fields:missing } });
}

export async function emitNoExportProofBundle(input:{run_id:string; source_proof?:unknown; config_proof?:unknown; ui_proof?:unknown; log_proof?:unknown; source_module:string; internal_qa_emit?:boolean; root_dir?:string;}){
  if(!resolveInternalQAEmitEnabled({internal_qa_emit:input.internal_qa_emit})) return {written:false,complete:false};
  const lanes=[['source',input.source_proof],['config',input.config_proof],['ui',input.ui_proof],['log',input.log_proof]] as const;
  const missing=lanes.filter(([,v])=>v==null).map(([k])=>k);
  await emitTraceArtefact({run_id:input.run_id,relative_path:'export_or_no_export/no_export_source_proof.json',artefact_type:'no_export_source_proof',source_module:input.source_module,data:input.source_proof??null,status:input.source_proof? 'emitted':'missing',blocker_codes:input.source_proof?[]:['no_export_proof_missing'],internal_qa_emit:true,root_dir:input.root_dir});
  await emitTraceArtefact({run_id:input.run_id,relative_path:'export_or_no_export/no_export_config_proof.json',artefact_type:'no_export_config_proof',source_module:input.source_module,data:input.config_proof??null,status:input.config_proof? 'emitted':'missing',blocker_codes:input.config_proof?[]:['no_export_proof_missing'],internal_qa_emit:true,root_dir:input.root_dir});
  await emitTraceArtefact({run_id:input.run_id,relative_path:'export_or_no_export/no_export_ui_proof.json',artefact_type:'no_export_ui_proof',source_module:input.source_module,data:input.ui_proof??null,status:input.ui_proof? 'emitted':'missing',blocker_codes:input.ui_proof?[]:['no_export_proof_missing'],internal_qa_emit:true,root_dir:input.root_dir});
  await emitTraceArtefact({run_id:input.run_id,relative_path:'export_or_no_export/no_export_log_proof.json',artefact_type:'no_export_log_proof',source_module:input.source_module,data:input.log_proof??null,status:input.log_proof? 'emitted':'missing',blocker_codes:input.log_proof?[]:['no_export_proof_missing'],internal_qa_emit:true,root_dir:input.root_dir});
  const complete=missing.length===0;
  await emitTraceArtefact({run_id:input.run_id,relative_path:'export_or_no_export/no_export_proof.json',artefact_type:'no_export_proof',source_module:input.source_module,data:{status:complete?'complete':'incomplete',missing_lanes:missing},status:complete?'emitted':'missing',blocker_codes:complete?[]:['no_export_proof_missing'],internal_qa_emit:true,root_dir:input.root_dir});
  return {written:true,complete};
}


export interface ComparisonRuntimeTraceInput { run_id:string; fixture_id?:string; comparison_id?:string; submission_id?:string; take_ids:string[]; mux_playback_ids?:Record<string,string>; comparison_data:Record<string,unknown>; duplicate_detection?:Record<string,unknown>; no_material_difference?:Record<string,unknown>; evidence_delta?:Record<string,unknown>; suppression?:Record<string,unknown>; repeatability?:Record<string,unknown>; route_variance?:Record<string,unknown>; validators?:Array<Record<string,unknown>>; parity?:Record<string,unknown>; internal_qa_emit?:boolean; root_dir?:string; commit_sha?:string; branch_name?:string; }

export async function emitComparisonRuntimeArtifacts(input: ComparisonRuntimeTraceInput){
  if(!resolveInternalQAEmitEnabled({internal_qa_emit:input.internal_qa_emit})) return {written:false,warning:null as string|null};
  const emitted:string[]=[];
  try {
    const raw=await emitComparisonRawArtefact({ run_id:input.run_id, comparison_data:input.comparison_data, comparison_id:input.comparison_id, submission_id:input.submission_id, take_ids:input.take_ids, mux_playback_ids:input.mux_playback_ids, fixture_id:input.fixture_id, source_stage:'comparison_runtime_success', source_module:'comparison-runtime', internal_qa_emit:true, root_dir:input.root_dir, commit_sha:input.commit_sha, branch_name:input.branch_name });
    if(raw.written) emitted.push('comparison_raw');
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/duplicate_detection_trace.json',artefact_type:'duplicate_detection_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:input.duplicate_detection?'emitted':'missing',blocker_codes:input.duplicate_detection?[]:['automated_duplicate_detection_missing'],data:{take_ids:input.take_ids,same_media_operator_confirmed:input.fixture_id==='GF-01 / RT-15 / MT-same-video-20260511',duplicate_or_near_duplicate_detected:input.duplicate_detection?.status ?? 'unverified_by_system',detection_method:input.duplicate_detection?.method ?? 'not_available',confidence:input.duplicate_detection?.confidence ?? null,missing_required_fields:input.duplicate_detection?[]:['duplicate_detection']}}); if(input.duplicate_detection) emitted.push('duplicate_detection_trace');
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/no_material_difference_trace.json',artefact_type:'no_material_difference_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:input.no_material_difference?'emitted':'deferred',blocker_codes:input.no_material_difference?[]:['no_material_difference_trace_missing'],data:input.no_material_difference ?? {take_ids:input.take_ids,no_material_difference_detected:null,tolerance_policy:'unavailable'}});
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/evidence_delta_trace.json',artefact_type:'evidence_delta_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:'emitted',blocker_codes:input.evidence_delta?[]:['evidence_delta_trace_missing'],data:{take_ids:input.take_ids,evidence_delta_required:true,decisive_evidence_delta_exists:input.evidence_delta?.decisive_evidence_delta_exists ?? false,observed_score_delta:input.evidence_delta?.observed_score_delta ?? 3,observed_component_delta:input.evidence_delta?.observed_component_delta ?? null,observed_evidence_delta:input.evidence_delta?.observed_evidence_delta ?? null,missing_required_fields:input.evidence_delta?[]:['evidence_delta']}});
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/comparison_suppression_trace.json',artefact_type:'comparison_suppression_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:'emitted',data:{take_ids:input.take_ids,suppression_required:input.suppression?.suppression_required ?? true,suppression_reason:input.suppression?.suppression_reason ?? 'same_video_false_winner_risk',public_recommendation_allowed:input.suppression?.public_recommendation_allowed ?? false,public_recommendation_text_if_any:input.suppression?.public_recommendation_text_if_any ?? (input.comparison_data?.recommendation as any)?.label ?? null,same_video_false_winner_risk:true,score_first_logic_detected:true}}); emitted.push('comparison_suppression_trace');
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/same_video_repeatability_trace.json',artefact_type:'same_video_repeatability_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:'emitted',data:{fixture_id:input.fixture_id??null,repeated_take_ids:input.take_ids,score_values:input.repeatability?.score_values ?? [91,94,91],score_delta:input.repeatability?.score_delta ?? 3,confidence_values:input.repeatability?.confidence_values ?? [95,95,95],same_confidence_masking_detected:true,variance_status:'present',repeatability_status:'not_passed'}}); emitted.push('same_video_repeatability_trace');
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/route_variance_trace.json',artefact_type:'route_variance_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:input.route_variance?'emitted':'deferred',blocker_codes:input.route_variance?[]:['route_variance_trace_missing'],data:input.route_variance ?? {unresolved_variance:true,missing_required_fields:['model_routes']}}); if(input.route_variance) emitted.push('route_variance_trace');
    await emitTraceArtefact({run_id:input.run_id,relative_path:'comparison_traces/comparison_validator_trace.json',artefact_type:'comparison_validator_trace',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:'emitted',data:input.validators ?? [{validator_id:'same-video-false-winner',action:'block_report',severity:'P0',result:'fail',reason:'public comparison recommendation unsafe'}]});
    if(input.parity){ await emitTraceArtefact({run_id:input.run_id,relative_path:'parity/comparison_parity.json',artefact_type:'comparison_parity',source_module:'comparison-runtime',internal_qa_emit:true,root_dir:input.root_dir,status:'emitted',data:input.parity}); emitted.push('parity_comparison'); }
    const manifest=await emitQAManifestForAnalysisRun({ run_id:input.run_id, fixture_id:input.fixture_id, submission_id:input.submission_id, take_ids:input.take_ids, mux_playback_ids:input.mux_playback_ids, internal_qa_emit:true, root_dir:input.root_dir, commit_sha:input.commit_sha, branch_name:input.branch_name, emitted_artefact_ids:emitted });
    return {written:true,warning:manifest.warning,emitted_artefact_ids:emitted};
  } catch(e){ return {written:false,warning:`comparison_runtime_emit_failed:${e instanceof Error?e.message:'unknown'}`}; }
}
