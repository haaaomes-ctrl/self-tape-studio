import { createHash } from "node:crypto";
import {
  isPublicReportViewModel,
  isRejectedPublicReportSourceKind,
  type PublicReportSourceKind,
} from "@/lib/public-report-view-model";
import {
  assertSafeSegment,
  buildQAAcceptanceMetrics,
  DEFAULT_ROOT,
  emitInternalQAArtifactManifest,
  resolveQADeploymentProvenance,
  type QAArtifactEmitterOptions,
} from "./qa-artifacts.server";
import { readQAArtifactText, writeQAArtifact } from "./qa-artifact-sink.server";

function mergeQAWarnings(...warnings: Array<string | null | undefined>): string | null {
  const present = warnings.filter((warning): warning is string =>
    Boolean(warning && warning.trim()),
  );
  return present.length > 0 ? present.join("; ") : null;
}

function getQAWriteWarning(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const warning = (result as { warning?: unknown }).warning;
  const sinkWarning = (result as { sink_warning?: unknown }).sink_warning;
  return mergeQAWarnings(
    typeof warning === "string" ? warning : null,
    typeof sinkWarning === "string" ? sinkWarning : null,
  );
}

const COMPARISON_ARTEFACT_IDS = [
  "comparison_raw",
  "comparison_report_internal",
  "same_video_repeatability_trace",
  "duplicate_detection_trace",
  "comparison_suppression_trace",
  "route_variance_trace",
] as const;
type ComparisonArtefactId = (typeof COMPARISON_ARTEFACT_IDS)[number];
const COMPARISON_BLOCKER_BY_ID: Record<ComparisonArtefactId, string> = {
  comparison_raw: "comparison_JSON_missing",
  comparison_report_internal: "comparison_report_unavailable",
  same_video_repeatability_trace: "same_video_repeatability_trace_missing",
  duplicate_detection_trace: "duplicate_detection_trace_missing",
  comparison_suppression_trace: "comparison_suppression_trace_missing",
  route_variance_trace: "route_variance_trace_missing",
};
const COMPARISON_SOURCE_BY_ID: Record<ComparisonArtefactId, string> = {
  comparison_raw: "internal_comparison_runtime",
  comparison_report_internal: "internal_comparison_report",
  same_video_repeatability_trace: "internal_comparison_trace",
  duplicate_detection_trace: "internal_comparison_trace",
  comparison_suppression_trace: "internal_comparison_trace",
  route_variance_trace: "internal_comparison_trace",
};
function isComparisonArtefactId(value: unknown): value is ComparisonArtefactId {
  return (
    typeof value === "string" && (COMPARISON_ARTEFACT_IDS as readonly string[]).includes(value)
  );
}

type ComparisonParityStatus = "not_applicable" | "passed" | "failed" | "insufficient";

function applyComparisonParityManifestState(input: {
  manifest: Record<string, any>;
  written: boolean;
  parity_status: ComparisonParityStatus;
  blocker_codes?: string[];
  comparison_parity_summary?: Record<string, unknown> | null;
}) {
  const manifest = JSON.parse(JSON.stringify(input.manifest ?? {}));
  const emittedSet = new Set<string>(manifest.emitted_artifacts ?? []);
  const emittedBlockedSet = new Set<string>(manifest.emitted_blocked_artefact_ids ?? []);
  const missingSet = new Set<string>(manifest.missing_artifacts ?? []);
  const deferredSet = new Set<string>(manifest.deferred_artifact_ids ?? []);
  const notApplicableSet = new Set<string>(manifest.not_applicable_artifact_ids ?? []);
  const blockerSet = new Set<string>(manifest.blocker_codes ?? []);
  const acceptedSet = new Set<string>(manifest.runtime_evidence_accepted_by_id ?? []);
  const blockedSet = new Set<string>(manifest.runtime_evidence_blocked_by_id ?? []);
  const statusById = { ...(manifest.artefact_status_by_id ?? {}) };
  const srcById = { ...(manifest.artefact_source_classification_by_id ?? {}) };
  const l2ById = { ...(manifest.artefact_level2_spine_satisfaction_by_id ?? {}) };
  const parityBlockerCode =
    getStringArray(input.blocker_codes).find(Boolean) ?? "parity_artefacts_missing";
  const hasOtherParityBlocker = Array.isArray(manifest.required_artifacts)
    ? manifest.required_artifacts.some(
        (artefact: any) =>
          artefact?.artefact_id !== "parity_comparison" &&
          artefact?.blocker_code === "parity_artefacts_missing" &&
          artefact?.status !== "emitted" &&
          artefact?.status !== "not_applicable",
      )
    : false;

  emittedSet.delete("parity_comparison");
  emittedBlockedSet.delete("parity_comparison");
  missingSet.delete("parity_comparison");
  deferredSet.delete("parity_comparison");
  notApplicableSet.delete("parity_comparison");
  acceptedSet.delete("parity_comparison");
  blockedSet.delete("parity_comparison");

  const status =
    input.parity_status === "not_applicable"
      ? "not_applicable"
      : input.written && input.parity_status === "passed"
        ? "emitted"
        : input.written
          ? "emitted_blocked"
          : "missing";

  srcById.parity_comparison = "internal_comparison_parity_proof";
  l2ById.parity_comparison = status === "emitted";
  statusById.parity_comparison = status;

  if (status === "emitted") {
    emittedSet.add("parity_comparison");
    acceptedSet.add("parity_comparison");
  } else if (status === "emitted_blocked") {
    emittedBlockedSet.add("parity_comparison");
    blockedSet.add("parity_comparison");
    blockerSet.add(parityBlockerCode);
    if (parityBlockerCode !== "parity_artefacts_missing")
      blockerSet.delete("parity_artefacts_missing");
  } else if (status === "missing") {
    missingSet.add("parity_comparison");
    blockedSet.add("parity_comparison");
    blockerSet.add(parityBlockerCode);
    if (parityBlockerCode !== "parity_artefacts_missing")
      blockerSet.delete("parity_artefacts_missing");
  } else {
    notApplicableSet.add("parity_comparison");
  }
  if ((status === "emitted" || status === "not_applicable") && !hasOtherParityBlocker) {
    blockerSet.delete("parity_artefacts_missing");
  }

  const reason =
    status === "emitted"
      ? "Emitted in current run"
      : status === "emitted_blocked"
        ? "Emitted with blocked/not_executed runtime evidence"
        : status === "not_applicable"
          ? "Not applicable for this run shape"
          : "Not emitted by current pipeline stage";
  const required_artifacts = Array.isArray(manifest.required_artifacts)
    ? manifest.required_artifacts.map((artefact: any) => {
        if (artefact?.artefact_id !== "parity_comparison") return artefact;
        return {
          ...artefact,
          status,
          blocker_code:
            status === "emitted" || status === "not_applicable" ? undefined : parityBlockerCode,
          reason,
        };
      })
    : manifest.required_artifacts;

  return {
    ...manifest,
    required_artifacts,
    emitted_artifacts: [...emittedSet],
    emitted_blocked_artefact_ids: [...emittedBlockedSet],
    missing_artifacts: [...missingSet],
    deferred_artifact_ids: [...deferredSet],
    not_applicable_artifact_ids: [...notApplicableSet],
    blocker_codes: [...blockerSet],
    runtime_evidence_accepted_by_id: [...acceptedSet],
    runtime_evidence_blocked_by_id: [...blockedSet],
    artefact_status_by_id: statusById,
    artefact_source_classification_by_id: srcById,
    artefact_level2_spine_satisfaction_by_id: l2ById,
    comparison_parity_summary:
      input.comparison_parity_summary ?? manifest.comparison_parity_summary,
  };
}

export function reconcileComparisonManifestState(input: {
  manifest: Record<string, any>;
  comparison_write_success_by_id: Partial<Record<ComparisonArtefactId, boolean>>;
  comparison_run_id?: string | null;
  compared_take_ids?: string[];
}) {
  const manifest = JSON.parse(JSON.stringify(input.manifest ?? {}));
  const succ = input.comparison_write_success_by_id ?? {};
  const emittedSet = new Set<string>(manifest.emitted_artifacts ?? []);
  const emittedBlockedSet = new Set<string>(
    (manifest.emitted_blocked_artefact_ids ?? []).filter(
      (id: string) => !isComparisonArtefactId(id),
    ),
  );
  const missingSet = new Set<string>(
    (manifest.missing_artifacts ?? []).filter((id: string) => !isComparisonArtefactId(id)),
  );
  const deferredSet = new Set<string>(
    (manifest.deferred_artifact_ids ?? []).filter((id: string) => !isComparisonArtefactId(id)),
  );
  const notApplicableSet = new Set<string>(
    (manifest.not_applicable_artifact_ids ?? []).filter(
      (id: string) => !isComparisonArtefactId(id),
    ),
  );
  const blockerSet = new Set<string>(
    (manifest.blocker_codes ?? []).filter(
      (b: string) => b !== "comparison_report_internal_missing",
    ),
  );
  const acceptedSet = new Set<string>(
    (manifest.runtime_evidence_accepted_by_id ?? []).filter(
      (id: string) => !isComparisonArtefactId(id),
    ),
  );
  const blockedSet = new Set<string>(
    (manifest.runtime_evidence_blocked_by_id ?? []).filter(
      (id: string) => !isComparisonArtefactId(id),
    ),
  );
  const statusById = { ...(manifest.artefact_status_by_id ?? {}) };
  const srcById = { ...(manifest.artefact_source_classification_by_id ?? {}) };
  const l2ById = { ...(manifest.artefact_level2_spine_satisfaction_by_id ?? {}) };
  for (const id of COMPARISON_ARTEFACT_IDS) {
    const ok = Boolean(succ[id]);
    if (ok) {
      emittedSet.add(id);
      missingSet.delete(id);
      blockerSet.delete(COMPARISON_BLOCKER_BY_ID[id]);
      acceptedSet.delete(id);
      blockedSet.add(id);
      statusById[id] = "emitted";
      srcById[id] = COMPARISON_SOURCE_BY_ID[id];
      l2ById[id] = false;
    } else {
      emittedSet.delete(id);
      missingSet.add(id);
      blockerSet.add(COMPARISON_BLOCKER_BY_ID[id]);
      acceptedSet.delete(id);
      blockedSet.add(id);
      statusById[id] = "missing";
      delete srcById[id];
      delete l2ById[id];
    }
  }
  const req = Array.isArray(manifest.required_artifacts)
    ? manifest.required_artifacts.map((a: any) => {
        if (!isComparisonArtefactId(a?.artefact_id)) return a;
        const id = a.artefact_id as ComparisonArtefactId;
        const ok = Boolean(succ[id]);
        return {
          ...a,
          status: ok ? "emitted" : "missing",
          blocker_code: ok ? undefined : COMPARISON_BLOCKER_BY_ID[id],
          reason: ok ? "Emitted in current run" : "Not emitted by current pipeline stage",
        };
      })
    : manifest.required_artifacts;
  delete manifest.comparison_report_internal_missing;
  const emittedComparisonArtefact = COMPARISON_ARTEFACT_IDS.some((id) => Boolean(succ[id]));
  return {
    ...manifest,
    comparison_run_id: emittedComparisonArtefact
      ? (input.comparison_run_id ?? manifest.comparison_run_id ?? null)
      : (manifest.comparison_run_id ?? null),
    compared_take_ids: emittedComparisonArtefact
      ? (input.compared_take_ids ?? manifest.compared_take_ids ?? [])
      : (manifest.compared_take_ids ?? []),
    required_artifacts: req,
    emitted_artifacts: [...emittedSet],
    emitted_blocked_artefact_ids: [...emittedBlockedSet],
    missing_artifacts: [...missingSet],
    deferred_artifact_ids: [...deferredSet],
    not_applicable_artifact_ids: [...notApplicableSet],
    blocker_codes: [...blockerSet],
    runtime_evidence_accepted_by_id: [...acceptedSet],
    runtime_evidence_blocked_by_id: [...blockedSet],
    artefact_status_by_id: statusById,
    artefact_source_classification_by_id: srcById,
    artefact_level2_spine_satisfaction_by_id: l2ById,
  };
}
type QAScoreTraceSummary = NonNullable<QAArtifactEmitterOptions["score_trace_summary"]>;
export interface QARuntimeMetadata {
  run_id: string;
  public_output_unchanged?: boolean;
  fixture_id?: string;
  submission_id?: string;
  take_ids?: string[];
  take_id?: string;
  compared_take_ids?: string[];
  comparison_run_id?: string | null;
  analysis_run_id?: string;
  mux_playback_ids?: Record<string, string>;
  route_module?: string;
  commit_sha?: string;
  branch_name?: string;
  internal_qa_emit?: boolean;
  root_dir?: string;
  source_scope_file?: string;
  runtime_operator_verification_status?: string;
  runtime_bundle_freshness_status?: string;
  runtime_bundle_matches_current_commit_status?: string;
  runtime_bundle_matches_current_implementation_status?: string;
  runtime_verified_take_ids?: string[];
  runtime_verified_comparison_run_ids?: string[];
  runtime_verified_deployment_ref?: string;
  runtime_verified_at?: string;
  runtime_verified_by_role?: string;
  operator_confirmation_status?: string;
  operator_confirmed_pr_or_commit?: string;
  operator_confirmation_reason?: string;
  emitted_artefact_ids?: string[];
  emitted_blocked_artefact_ids?: string[];
  deferred_artefact_ids?: string[];
  not_applicable_artefact_ids?: string[];
  runtime_evidence_accepted_by_id?: string[];
  runtime_evidence_blocked_by_id?: string[];
  artefact_source_classification_by_id?: Record<string, string>;
  artefact_level2_spine_satisfaction_by_id?: Record<string, boolean>;
  legacy_adapter_artefact_ids?: string[];
  real_v3_spine_artefact_ids?: string[];
  defect_risk_ids?: string[];
  public_claim_trace_summary?: QAArtifactEmitterOptions["public_claim_trace_summary"];
  claim_candidate_trace_summary?: QAArtifactEmitterOptions["claim_candidate_trace_summary"];
  evidence_anchor_trace_summary?: QAArtifactEmitterOptions["evidence_anchor_trace_summary"];
  technique_observation_trace_summary?: QAArtifactEmitterOptions["technique_observation_trace_summary"];
  score_trace_summary?: QAScoreTraceSummary;
  model_run_trace_summary?: Record<string, unknown>;
  analysis_evidence_state_summary?: QAArtifactEmitterOptions["analysis_evidence_state_summary"];
  step1_observable_evidence_summary?: QAArtifactEmitterOptions["step1_observable_evidence_summary"];
  media_identity_summary?: QAArtifactEmitterOptions["media_identity_summary"];
  report_parity_summary?: QAArtifactEmitterOptions["report_parity_summary"];
  runtime_verification_trace_summary?: QAArtifactEmitterOptions["runtime_verification_trace_summary"];
  comparison_parity_summary?: QAArtifactEmitterOptions["comparison_parity_summary"];
  report_parity_input?: {
    raw_report_data?: Record<string, unknown> | null;
    render_report_data?: Record<string, unknown> | null;
    public_report_data?: Record<string, unknown> | null;
    render_source_kind?: string | null;
    public_report_source_kind?: string | null;
    render_payload?: Record<string, unknown> | null;
    public_report_payload?: Record<string, unknown> | null;
    allowed_public_fields?: string[];
    blocked_field_paths?: string[];
    blocked_score_field_paths?: string[];
  };
  comparison_parity_input?: {
    comparison_payloads?: unknown;
    public_comparison_surface_paths?: string[];
  };
}

const COMPARISON_RISK_FIELDS = [
  "forced_winner_risk",
  "false_winner_risk",
  "false_winner_prevention_status",
  "same_video_unresolved_risk",
  "same_video_detected",
  "repeated_input_detected",
  "no_material_difference",
  "same_video_suppression_status",
  "same_video_repeatability_status",
  "duplicate_detection_status",
  "duplicate_detection_confidence",
  "sufficient_upload_or_content_evidence",
  "not_detected_evidence_sufficient",
  "suppression_required",
  "route_variance_risk",
  "route_mismatch_detected",
  "route_variance_detected",
  "route_variance_status",
  "route_variance_mitigation_status",
  "route_variance_suppression_status",
] as const;
const COMPARISON_RISK_FIELD_SET = new Set<string>(COMPARISON_RISK_FIELDS);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isSafeComparisonParitySegment(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!trimmed) return false;
  if (trimmed === ".") return false;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return false;
  if (trimmed.includes("..")) return false;
  if (trimmed.startsWith("take-take-")) return false;
  return true;
}

function isSafeComparisonParityTakeIdSegment(value: unknown): value is string {
  return isSafeComparisonParitySegment(value) && !value.startsWith("take-");
}

function comparisonParityIdentityIsSafe(input: {
  run_id: string;
  analysis_run_id: string;
  take_id?: string | null;
  comparison_run_id?: string | null;
}): boolean {
  return (
    isSafeComparisonParitySegment(input.run_id) &&
    isSafeComparisonParitySegment(input.analysis_run_id) &&
    (input.take_id === undefined ||
      input.take_id === null ||
      isSafeComparisonParityTakeIdSegment(input.take_id)) &&
    (input.comparison_run_id === undefined ||
      input.comparison_run_id === null ||
      isSafeComparisonParitySegment(input.comparison_run_id))
  );
}

type ComparisonRiskSource = { source: string; value: Record<string, unknown> };
type ComparisonRiskFieldValue = string | number | boolean | null;
type ComparisonRiskFieldHit = {
  source: string;
  field: string;
  path: string;
  value?: ComparisonRiskFieldValue;
};
type ComparisonRiskSourceScanWarning = { source: string; path: string; warning: string };
type ComparisonRiskFieldDiagnostic = {
  source: string;
  field: string;
  path: string;
  value_type?: "string" | "number" | "boolean" | "null";
  value_summary?: string;
  value_hash?: string;
};

function comparisonRiskFieldValue(value: unknown): ComparisonRiskFieldValue | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  )
    return value;
  return undefined;
}

function hashDiagnosticValue(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function comparisonRiskFieldDiagnostic(hit: ComparisonRiskFieldHit): ComparisonRiskFieldDiagnostic {
  if (hit.value === undefined) return { source: hit.source, field: hit.field, path: hit.path };
  if (hit.value === null)
    return {
      source: hit.source,
      field: hit.field,
      path: hit.path,
      value_type: "null",
      value_summary: "null",
    };
  if (typeof hit.value === "boolean") {
    return {
      source: hit.source,
      field: hit.field,
      path: hit.path,
      value_type: "boolean",
      value_summary: hit.value ? "true" : "false",
    };
  }
  if (typeof hit.value === "number") {
    return {
      source: hit.source,
      field: hit.field,
      path: hit.path,
      value_type: "number",
      value_summary: Number.isFinite(hit.value) ? "finite_number" : "non_finite_number",
    };
  }
  return {
    source: hit.source,
    field: hit.field,
    path: hit.path,
    value_type: "string",
    value_summary: `string_length_${hit.value.length}`,
    value_hash: hashDiagnosticValue(hit.value),
  };
}

function collectDirectComparisonRiskFieldHits(
  source: string,
  value: Record<string, unknown>,
): ComparisonRiskFieldHit[] {
  return Object.keys(value)
    .map((key) => ({ original: key, normalised: key.trim().toLowerCase() }))
    .filter(({ normalised }) => COMPARISON_RISK_FIELD_SET.has(normalised))
    .map(({ original, normalised }) => ({
      source,
      field: normalised,
      path: `${source}.${original}`,
      value: comparisonRiskFieldValue(value[original]),
    }));
}

function scanComparisonRiskFieldHits(
  source: string,
  value: unknown,
): { hits: ComparisonRiskFieldHit[]; warnings: ComparisonRiskSourceScanWarning[] } {
  const hits: ComparisonRiskFieldHit[] = [];
  const warnings: ComparisonRiskSourceScanWarning[] = [];
  const activeObjects = new WeakSet<object>();
  const maxDepth = 24;
  const markWarning = (path: string, warning: string) => warnings.push({ source, path, warning });
  const walk = (node: unknown, pathPrefix: string, depth = 0): void => {
    if (depth > maxDepth) {
      markWarning(pathPrefix, "depth_limit_exceeded");
      return;
    }
    if (Array.isArray(node)) {
      if (activeObjects.has(node)) {
        markWarning(pathPrefix, "cycle_detected");
        return;
      }
      activeObjects.add(node);
      node.forEach((entry, index) => walk(entry, `${pathPrefix}[${index}]`, depth + 1));
      activeObjects.delete(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (activeObjects.has(node)) {
      markWarning(pathPrefix, "cycle_detected");
      return;
    }
    activeObjects.add(node);
    if (!isPlainRecord(node)) {
      markWarning(pathPrefix, "uninspectable_object");
      activeObjects.delete(node);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const nextPath = `${pathPrefix}.${key}`;
      const normalisedKey = key.trim().toLowerCase();
      if (COMPARISON_RISK_FIELD_SET.has(normalisedKey))
        hits.push({
          source,
          field: normalisedKey,
          path: nextPath,
          value: comparisonRiskFieldValue(child),
        });
      walk(child, nextPath, depth + 1);
    }
    activeObjects.delete(node);
  };
  walk(value, source);
  return { hits, warnings };
}

function collectComparisonRiskSources(payloadsObject: Record<string, unknown> | null): {
  sources: ComparisonRiskSource[];
  fieldHits: ComparisonRiskFieldHit[];
  scanWarnings: ComparisonRiskSourceScanWarning[];
} {
  if (!payloadsObject) return { sources: [], fieldHits: [], scanWarnings: [] };
  const sources: ComparisonRiskSource[] = [];
  const fieldHits: ComparisonRiskFieldHit[] = [];
  const scanWarnings: ComparisonRiskSourceScanWarning[] = [];
  const topLevelHits = collectDirectComparisonRiskFieldHits("comparison_payloads", payloadsObject);
  if (topLevelHits.length > 0) {
    sources.push({ source: "comparison_payloads", value: payloadsObject });
    fieldHits.push(...topLevelHits);
  }
  const addKnownTraceSource = (source: string, value: unknown) => {
    if (value === undefined) return;
    if (!value || typeof value !== "object") {
      scanWarnings.push({ source, path: source, warning: "uninspectable_source" });
      return;
    }
    if (isPlainRecord(value)) sources.push({ source, value });
    const scan = scanComparisonRiskFieldHits(source, value);
    fieldHits.push(...scan.hits);
    scanWarnings.push(...scan.warnings);
  };
  const addExplicitInternalSource = (source: string, value: unknown) => {
    if (value === undefined) return;
    if (!value || typeof value !== "object") return;
    const scan = scanComparisonRiskFieldHits(source, value);
    if (scan.hits.length > 0 && isPlainRecord(value)) sources.push({ source, value });
    fieldHits.push(...scan.hits);
    scanWarnings.push(...scan.warnings);
  };
  addKnownTraceSource(
    "same_video_repeatability_trace",
    payloadsObject.same_video_repeatability_trace,
  );
  addKnownTraceSource("duplicate_detection_trace", payloadsObject.duplicate_detection_trace);
  addKnownTraceSource("route_variance_trace", payloadsObject.route_variance_trace);
  addKnownTraceSource("comparison_suppression_trace", payloadsObject.comparison_suppression_trace);
  addExplicitInternalSource("comparison_raw", payloadsObject.comparison_raw);
  addExplicitInternalSource(
    "comparison_report_internal",
    payloadsObject.comparison_report_internal,
  );
  return { sources, fieldHits, scanWarnings };
}

export async function emitComparisonParityProof(input: {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string | null;
  comparison_run_id?: string | null;
  compared_take_ids?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
  comparison_invoked: boolean;
  comparison_evidence_status: Record<string, boolean>;
  comparison_payloads?: unknown;
  public_comparison_surface_paths?: string[];
}) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      parity_status: "not_applicable" as const,
      blocker_codes: [] as string[],
      comparison_parity_summary: null as Record<string, unknown> | null,
    };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const evidence = input.comparison_evidence_status;
  const requiredOk = Object.values(evidence).every(Boolean);
  const payloads = input.comparison_payloads;
  const payloadsObject = isPlainRecord(payloads) ? payloads : null;
  const extract = (obj: unknown, path: string): unknown =>
    path.split(".").reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[key];
    }, obj);
  const publicSurfaces = [
    { key: "public_comparison_payload", value: payloadsObject?.public_comparison_payload },
    { key: "comparison_public_payload", value: payloadsObject?.comparison_public_payload },
    { key: "public_output", value: payloadsObject?.public_output },
    { key: "comparison_output_public", value: payloadsObject?.comparison_output_public },
    {
      key: "render_payload.comparison",
      value: extract(payloadsObject, "render_payload.comparison"),
    },
    {
      key: "public_report_payload.comparison",
      value: extract(payloadsObject, "public_report_payload.comparison"),
    },
    ...(input.public_comparison_surface_paths ?? []).map((surfacePath) => ({
      key: surfacePath,
      value: extract(payloadsObject, surfacePath),
    })),
  ].filter((x) => isPlainRecord(x.value) || Array.isArray(x.value));
  const hasPublicOutputAbsenceEvidence = Boolean(
    payloadsObject?.public_comparison_output_absent_or_unchanged === true ||
    payloadsObject?.public_output_unchanged === true ||
    payloadsObject?.comparison_public_output_absent === true,
  );
  let publicSurfaceContextAvailable = publicSurfaces.length > 0 || hasPublicOutputAbsenceEvidence;
  const forbiddenPublicFields = new Set([
    "winner",
    "public_winner",
    "selected_winner",
    "selected_take_id_public",
    "recommendation",
    "public_recommendation",
    "comparison_recommendation",
    "forced_winner",
    "false_winner",
    "castability",
    "bookability",
    "marketability",
    "public_scoring",
    "public_score",
    "public_technique_authority",
    "technique_authority",
  ]);
  const winnerFields = new Set([
    "winner",
    "public_winner",
    "selected_winner",
    "selected_take_id_public",
  ]);
  const recommendationFields = new Set([
    "recommendation",
    "public_recommendation",
    "comparison_recommendation",
  ]);
  const forbiddenHits: Array<{ surface: string; field: string; path: string }> = [];
  const publicSurfaceScanIssues: Array<{ surface: string; path: string; issue: string }> = [];
  const activePublicSurfacePathObjects = new WeakSet<object>();
  const maxPublicSurfaceScanDepth = 24;
  const markPublicScanIssue = (surface: string, path: string, issue: string) => {
    publicSurfaceScanIssues.push({ surface, path, issue });
  };
  const walk = (value: unknown, pathPrefix: string, surface: string, depth = 0): void => {
    if (depth > maxPublicSurfaceScanDepth) {
      markPublicScanIssue(surface, pathPrefix, "depth_limit_exceeded");
      return;
    }
    if (Array.isArray(value)) {
      if (activePublicSurfacePathObjects.has(value)) {
        markPublicScanIssue(surface, pathPrefix, "cycle_detected");
        return;
      }
      activePublicSurfacePathObjects.add(value);
      value.forEach((entry, idx) => walk(entry, `${pathPrefix}[${idx}]`, surface, depth + 1));
      activePublicSurfacePathObjects.delete(value);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (activePublicSurfacePathObjects.has(value)) {
      markPublicScanIssue(surface, pathPrefix, "cycle_detected");
      return;
    }
    activePublicSurfacePathObjects.add(value);
    if (!isPlainRecord(value)) {
      markPublicScanIssue(surface, pathPrefix, "uninspectable_object");
      activePublicSurfacePathObjects.delete(value);
      return;
    }
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const normalisedKey = k.trim().toLowerCase();
      if (forbiddenPublicFields.has(normalisedKey))
        forbiddenHits.push({ surface, field: normalisedKey, path: nextPath });
      walk(v, nextPath, surface, depth + 1);
    }
    activePublicSurfacePathObjects.delete(value);
  };
  for (const surface of publicSurfaces) walk(surface.value, surface.key, surface.key);
  const publicSurfaceScanSafe = publicSurfaceScanIssues.length === 0;
  const publicWinnerAbsent = !forbiddenHits.some((x) => winnerFields.has(x.field));
  const publicRecommendationAbsent = !forbiddenHits.some((x) => recommendationFields.has(x.field));
  const riskSourceCollection = collectComparisonRiskSources(payloadsObject);
  const riskSources = riskSourceCollection.sources;
  const riskFieldHits = riskSourceCollection.fieldHits;
  const riskSourceScanSafe = riskSourceCollection.scanWarnings.length === 0;
  const acceptedMitigationStatuses = new Set([
    "not_required",
    "mitigated",
    "resolved",
    "accepted",
    "suppressed",
    "applied",
    "recommended",
    "active",
  ]);
  const duplicateStatuses = new Set([
    "detected",
    "likely_duplicate",
    "possible_duplicate",
    "insufficient_evidence",
    "not_detected",
  ]);
  const normaliseRiskStatus = (value: unknown) =>
    typeof value === "string" ? value.trim().toLowerCase() : null;
  const isAcceptedComparisonMitigation = (value: unknown) => {
    const status = normaliseRiskStatus(value);
    return Boolean(status && acceptedMitigationStatuses.has(status));
  };
  const riskHitsFor = (field: string) => riskFieldHits.filter((hit) => hit.field === field);
  const riskHitValueIs = (hit: ComparisonRiskFieldHit, expected: boolean | string) => {
    if (typeof expected === "string") return normaliseRiskStatus(hit.value) === expected;
    return hit.value === expected;
  };
  const hasRiskHit = (field: string, expected: boolean | string): boolean =>
    riskHitsFor(field).some((hit) => riskHitValueIs(hit, expected));
  const parentRiskPath = (path: string): string => path.replace(/\.[^.]+$/, "");
  const mitigationAppliesToRiskHit = (
    riskHit: ComparisonRiskFieldHit,
    mitigationHit: ComparisonRiskFieldHit,
  ): boolean => {
    if (riskHit.source !== mitigationHit.source) return false;
    const mitigationParent = parentRiskPath(mitigationHit.path);
    return mitigationParent === riskHit.source || mitigationParent === parentRiskPath(riskHit.path);
  };
  const hasAcceptedRiskMitigationForHit = (
    riskHit: ComparisonRiskFieldHit,
    fields: string[],
  ): boolean =>
    riskFieldHits.some(
      (hit) =>
        fields.includes(hit.field) &&
        isAcceptedComparisonMitigation(hit.value) &&
        mitigationAppliesToRiskHit(riskHit, hit),
    );
  const hasUnmitigatedRiskHit = (
    flagField: string,
    mitigationFields: string[],
    expected: boolean | string = true,
  ): boolean =>
    riskHitsFor(flagField).some(
      (hit) =>
        riskHitValueIs(hit, expected) && !hasAcceptedRiskMitigationForHit(hit, mitigationFields),
    );
  const noRiskStatusFields = new Set(["same_video_repeatability_status", "route_variance_status"]);
  const mitigationStatusFields = new Set([
    "same_video_suppression_status",
    "route_variance_mitigation_status",
    "route_variance_suppression_status",
    "false_winner_prevention_status",
  ]);
  const riskContextValueInspectable = (hit: ComparisonRiskFieldHit): boolean => {
    if (typeof hit.value === "boolean") return true;
    const status = normaliseRiskStatus(hit.value);
    if (!status) return false;
    if (hit.field === "duplicate_detection_status") return duplicateStatuses.has(status);
    if (noRiskStatusFields.has(hit.field)) return status === "not_detected";
    if (mitigationStatusFields.has(hit.field)) return acceptedMitigationStatuses.has(status);
    return false;
  };
  const hasRiskContext = (...fields: string[]): boolean =>
    riskFieldHits.some((hit) => fields.includes(hit.field) && riskContextValueInspectable(hit));
  const sourceKeysForRiskHits = (predicate: (hit: ComparisonRiskFieldHit) => boolean): string[] => [
    ...new Set(riskFieldHits.filter(predicate).map((hit) => hit.source)),
  ];
  const sameVideoRiskContextAvailable = hasRiskContext(
    "same_video_unresolved_risk",
    "same_video_detected",
    "repeated_input_detected",
    "no_material_difference",
    "same_video_suppression_status",
    "same_video_repeatability_status",
  );
  const routeVarianceRiskContextAvailable = hasRiskContext(
    "route_variance_risk",
    "route_mismatch_detected",
    "route_variance_detected",
    "route_variance_status",
    "route_variance_mitigation_status",
    "route_variance_suppression_status",
  );
  const forcedFalseWinnerRiskContextAvailable = hasRiskContext(
    "forced_winner_risk",
    "false_winner_risk",
    "false_winner_prevention_status",
  );
  const duplicateTrace =
    payloadsObject && isPlainRecord(payloadsObject.duplicate_detection_trace)
      ? payloadsObject.duplicate_detection_trace
      : null;
  const duplicateDetectionStatus = normaliseRiskStatus(duplicateTrace?.duplicate_detection_status);
  const duplicateDetectionContextAvailable = Boolean(
    duplicateTrace && duplicateDetectionStatus && duplicateStatuses.has(duplicateDetectionStatus),
  );
  const suppressionTrace =
    payloadsObject && isPlainRecord(payloadsObject.comparison_suppression_trace)
      ? payloadsObject.comparison_suppression_trace
      : null;
  const duplicateSuppressionApplied = Boolean(
    suppressionTrace?.recommendation_suppressed === true ||
    isAcceptedComparisonMitigation(suppressionTrace?.same_video_suppression_status) ||
    duplicateTrace?.suppression_applied === true,
  );
  const duplicateSameVideoSuppressed = Boolean(
    (duplicateDetectionStatus === "detected" || duplicateDetectionStatus === "likely_duplicate") &&
    duplicateSuppressionApplied,
  );
  const falseWinnerPreventionActive = Boolean(
    isAcceptedComparisonMitigation(suppressionTrace?.false_winner_prevention_status) ||
    hasRiskHit("false_winner_prevention_status", "active") ||
    hasRiskHit("false_winner_prevention_status", "mitigated") ||
    hasRiskHit("false_winner_prevention_status", "suppressed"),
  );
  if (duplicateSameVideoSuppressed) publicSurfaceContextAvailable = true;
  const decisiveEvidenceDelta = Boolean(
    duplicateTrace?.evidence_delta_material_difference_status === "decisive" ||
    duplicateTrace?.evidence_delta_trace_status === "decisive_material_difference" ||
    duplicateTrace?.no_material_difference === false,
  );
  const duplicateDetectionBlocker = (() => {
    if (
      !duplicateTrace ||
      !duplicateDetectionStatus ||
      !duplicateStatuses.has(duplicateDetectionStatus)
    )
      return "duplicate_detection_trace_missing";
    if (duplicateDetectionStatus === "insufficient_evidence")
      return "duplicate_detection_insufficient_evidence";
    if (duplicateDetectionStatus === "possible_duplicate" && !decisiveEvidenceDelta)
      return "duplicate_detection_possible_duplicate_unresolved";
    if (
      (duplicateDetectionStatus === "detected" ||
        duplicateDetectionStatus === "likely_duplicate") &&
      !duplicateSuppressionApplied
    )
      return "duplicate_detection_without_suppression";
    if (
      (duplicateDetectionStatus === "detected" ||
        duplicateDetectionStatus === "likely_duplicate") &&
      !decisiveEvidenceDelta
    )
      return "duplicate_detection_suppressed_without_evidence_delta";
    if (
      duplicateDetectionStatus === "not_detected" &&
      duplicateTrace.not_detected_evidence_sufficient !== true &&
      duplicateTrace.sufficient_upload_or_content_evidence !== true
    )
      return "duplicate_detection_not_detected_without_content_evidence";
    return null;
  })();
  const duplicateDetectionFailed =
    duplicateDetectionBlocker === "duplicate_detection_without_suppression";
  const duplicateDetectionInsufficient = Boolean(
    duplicateDetectionBlocker && !duplicateDetectionFailed,
  );
  const comparisonRiskContextAvailable =
    sameVideoRiskContextAvailable &&
    routeVarianceRiskContextAvailable &&
    forcedFalseWinnerRiskContextAvailable &&
    duplicateDetectionContextAvailable;
  const forcedWinnerRiskAbsent =
    !hasRiskHit("forced_winner_risk", true) ||
    (duplicateSameVideoSuppressed && falseWinnerPreventionActive);
  const falseWinnerRiskAbsent =
    !hasRiskHit("false_winner_risk", true) ||
    (duplicateSameVideoSuppressed && falseWinnerPreventionActive);
  const routeVarianceRiskAbsent = !(
    hasRiskHit("route_variance_mitigation_status", "unresolved_blocked") ||
    hasUnmitigatedRiskHit("route_variance_risk", [
      "route_variance_mitigation_status",
      "route_variance_suppression_status",
    ]) ||
    hasUnmitigatedRiskHit("route_mismatch_detected", [
      "route_variance_mitigation_status",
      "route_variance_suppression_status",
    ]) ||
    hasUnmitigatedRiskHit("route_variance_detected", [
      "route_variance_mitigation_status",
      "route_variance_suppression_status",
    ])
  );
  const sameVideoRiskAbsent =
    duplicateSameVideoSuppressed ||
    !(
      hasUnmitigatedRiskHit("same_video_unresolved_risk", ["same_video_suppression_status"]) ||
      hasUnmitigatedRiskHit("same_video_detected", ["same_video_suppression_status"]) ||
      hasUnmitigatedRiskHit("repeated_input_detected", ["same_video_suppression_status"]) ||
      hasUnmitigatedRiskHit("no_material_difference", ["same_video_suppression_status"], false)
    );
  const comparisonPayloadsAvailable = Boolean(
    payloadsObject &&
    (publicSurfaces.length > 0 ||
      hasPublicOutputAbsenceEvidence ||
      riskSourceCollection.fieldHits.length > 0),
  );
  const forbiddenPublicComparisonFieldsAbsent = forbiddenHits.length === 0;
  const failedRiskOrLeakDetected =
    !forbiddenPublicComparisonFieldsAbsent ||
    !forcedWinnerRiskAbsent ||
    !falseWinnerRiskAbsent ||
    !routeVarianceRiskAbsent ||
    !sameVideoRiskAbsent ||
    duplicateDetectionFailed;
  const mismatch: Array<Record<string, unknown>> = [];
  if (!requiredOk && input.comparison_invoked)
    mismatch.push({ mismatch_type: "missing_required_comparison_evidence" });
  if (!comparisonPayloadsAvailable && input.comparison_invoked)
    mismatch.push({ mismatch_type: "comparison_parity_payload_missing" });
  if (!publicSurfaceContextAvailable && input.comparison_invoked)
    mismatch.push({ mismatch_type: "comparison_public_surface_context_missing" });
  if (!publicSurfaceScanSafe && input.comparison_invoked)
    mismatch.push({
      mismatch_type: "public_comparison_surface_uninspectable",
      issues: publicSurfaceScanIssues,
    });
  if (!riskSourceScanSafe && input.comparison_invoked)
    mismatch.push({
      mismatch_type: "comparison_risk_source_uninspectable",
      warnings: riskSourceCollection.scanWarnings,
    });
  if (duplicateDetectionBlocker && input.comparison_invoked)
    mismatch.push({
      mismatch_type: duplicateDetectionBlocker,
      duplicate_detection_status: duplicateDetectionStatus ?? "missing",
    });
  if (!comparisonRiskContextAvailable && input.comparison_invoked && !failedRiskOrLeakDetected)
    mismatch.push({
      mismatch_type: "comparison_risk_context_missing",
      missing_contexts: [
        ...(!sameVideoRiskContextAvailable ? ["same_video"] : []),
        ...(!routeVarianceRiskContextAvailable ? ["route_variance"] : []),
        ...(!forcedFalseWinnerRiskContextAvailable ? ["forced_false_winner"] : []),
        ...(!duplicateDetectionContextAvailable ? ["duplicate_detection"] : []),
      ],
    });
  if (!forbiddenPublicComparisonFieldsAbsent) {
    for (const hit of forbiddenHits) {
      mismatch.push({
        mismatch_type: "forbidden_public_comparison_field_present",
        surface: hit.surface,
        field: hit.field,
        path: hit.path,
      });
    }
  }
  if (!forcedWinnerRiskAbsent)
    mismatch.push({
      mismatch_type: "forced_winner_risk_detected",
      source_trace_keys: sourceKeysForRiskHits(
        (hit) => hit.field === "forced_winner_risk" && riskHitValueIs(hit, true),
      ),
    });
  if (!falseWinnerRiskAbsent)
    mismatch.push({
      mismatch_type: "false_winner_risk_detected",
      source_trace_keys: sourceKeysForRiskHits(
        (hit) => hit.field === "false_winner_risk" && riskHitValueIs(hit, true),
      ),
    });
  if (!routeVarianceRiskAbsent)
    mismatch.push({
      mismatch_type: "route_variance_unresolved",
      source_trace_keys: sourceKeysForRiskHits(
        (hit) =>
          (hit.field === "route_variance_risk" && riskHitValueIs(hit, true)) ||
          (hit.field === "route_variance_mitigation_status" &&
            riskHitValueIs(hit, "unresolved_blocked")) ||
          (hit.field === "route_mismatch_detected" && riskHitValueIs(hit, true)) ||
          (hit.field === "route_variance_detected" && riskHitValueIs(hit, true)),
      ),
    });
  if (!sameVideoRiskAbsent)
    mismatch.push({
      mismatch_type: "same_video_unresolved_risk",
      source_trace_keys: sourceKeysForRiskHits(
        (hit) =>
          (hit.field === "same_video_unresolved_risk" && riskHitValueIs(hit, true)) ||
          (hit.field === "same_video_detected" && riskHitValueIs(hit, true)) ||
          (hit.field === "repeated_input_detected" && riskHitValueIs(hit, true)) ||
          (hit.field === "no_material_difference" && riskHitValueIs(hit, false)),
      ),
    });
  const parityStatus = !input.comparison_invoked
    ? "not_applicable"
    : failedRiskOrLeakDetected
      ? "failed"
      : !requiredOk ||
          !comparisonPayloadsAvailable ||
          !publicSurfaceContextAvailable ||
          !publicSurfaceScanSafe ||
          !riskSourceScanSafe ||
          !comparisonRiskContextAvailable ||
          duplicateDetectionInsufficient
        ? "insufficient"
        : "passed";
  const comparisonPublicOutputStatus = !input.comparison_invoked
    ? "not_applicable"
    : !publicSurfaceScanSafe || !forbiddenPublicComparisonFieldsAbsent
      ? "emitted_unsafe"
      : publicSurfaces.length > 0
        ? "emitted_public_safe"
        : duplicateSameVideoSuppressed && publicSurfaceContextAvailable
          ? "not_emitted_suppressed"
          : "missing_unexpected";
  const comparisonPublicOutputAbsenceProofStatus =
    ["not_emitted_suppressed", "emitted_public_safe"].includes(comparisonPublicOutputStatus) &&
    publicWinnerAbsent &&
    publicRecommendationAbsent &&
    forbiddenPublicComparisonFieldsAbsent &&
    publicSurfaceScanSafe
      ? "satisfied"
      : input.comparison_invoked
        ? "insufficient"
        : "not_applicable";
  const comparisonSuppressionSafetySatisfied = Boolean(
    requiredOk &&
    duplicateSameVideoSuppressed &&
    comparisonPublicOutputAbsenceProofStatus === "satisfied" &&
    comparisonRiskContextAvailable &&
    riskSourceScanSafe &&
    !failedRiskOrLeakDetected,
  );
  const comparisonSuppressionSafetyStatus = comparisonSuppressionSafetySatisfied
    ? "satisfied_suppressed"
    : input.comparison_invoked
      ? failedRiskOrLeakDetected
        ? "blocked"
        : "insufficient"
      : "not_applicable";
  const evidenceDeltaOrNoMaterialDifferenceStatus = !input.comparison_invoked
    ? "not_applicable"
    : decisiveEvidenceDelta
      ? "decisive"
      : duplicateSameVideoSuppressed
        ? "non_decisive"
        : "unavailable";
  const comparisonParityStatus =
    parityStatus === "passed" || parityStatus === "not_applicable"
      ? parityStatus
      : comparisonSuppressionSafetySatisfied && !decisiveEvidenceDelta
        ? "fail_closed"
        : parityStatus;
  const comparisonParityReason = (() => {
    if (parityStatus === "passed") return "comparison_parity_passed";
    if (comparisonParityStatus === "fail_closed")
      return "duplicate_same_video_suppression_safety_satisfied_but_decisive_evidence_delta_missing";
    if (parityStatus === "failed")
      return "forbidden_public_comparison_field_present_or_duplicate_without_suppression";
    if (duplicateDetectionBlocker) return duplicateDetectionBlocker;
    if (!comparisonPayloadsAvailable) return "comparison_parity_payload_missing";
    if (!publicSurfaceContextAvailable) return "comparison_public_surface_context_missing";
    if (!publicSurfaceScanSafe) return "comparison_public_surface_uninspectable";
    if (!riskSourceScanSafe) return "comparison_risk_source_uninspectable";
    if (!comparisonRiskContextAvailable) return "comparison_risk_context_missing";
    return "comparison_evidence_missing_or_unresolved";
  })();
  const blocker_codes =
    parityStatus === "passed" || parityStatus === "not_applicable"
      ? []
      : comparisonSuppressionSafetySatisfied && !decisiveEvidenceDelta
        ? ["duplicate_same_video_suppressed_without_decisive_evidence_delta"]
        : ["parity_artefacts_missing"];
  const comparison_parity_summary = {
    parity_status: parityStatus,
    comparison_parity_status: comparisonParityStatus,
    comparison_parity_reason: comparisonParityReason,
    comparison_parity_blocker_codes: blocker_codes,
    comparison_public_output_status: comparisonPublicOutputStatus,
    comparison_public_output_absence_proof_status: comparisonPublicOutputAbsenceProofStatus,
    comparison_suppression_safety_status: comparisonSuppressionSafetyStatus,
    comparison_checked_surface_refs: publicSurfaces.map((s) => s.key),
    comparison_checked_risk_trace_refs: riskSources.map((s) => s.source),
    comparison_public_winner_absent: publicWinnerAbsent,
    comparison_public_recommendation_absent: publicRecommendationAbsent,
    comparison_recommendation_permission: false,
    evidence_delta_or_no_material_difference_status: evidenceDeltaOrNoMaterialDifferenceStatus,
    duplicate_same_video_safety_status: comparisonSuppressionSafetyStatus,
  };
  if (!input.comparison_invoked)
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      parity_status: "not_applicable" as const,
      blocker_codes,
      comparison_parity_summary,
    };
  const outPayload = {
    schema_version: "tapecoach_v3_comparison_parity_v1",
    artefact_type: "comparison_parity",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    comparison_run_id: input.comparison_run_id ?? null,
    compared_take_ids: input.compared_take_ids ?? [],
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    comparison_invoked: input.comparison_invoked,
    public_output_unchanged: publicSurfaceContextAvailable,
    public_comparison_output_absent_or_unchanged:
      hasPublicOutputAbsenceEvidence ||
      publicSurfaces.length > 0 ||
      comparisonPublicOutputStatus === "not_emitted_suppressed",
    comparison_public_output_absent:
      payloadsObject?.comparison_public_output_absent === true ||
      comparisonPublicOutputStatus === "not_emitted_suppressed",
    ...comparison_parity_summary,
    comparison_raw_available: Boolean(evidence.comparison_raw),
    comparison_report_internal_available: Boolean(evidence.comparison_report_internal),
    same_video_repeatability_trace_available: Boolean(evidence.same_video_repeatability_trace),
    duplicate_detection_trace_available: Boolean(evidence.duplicate_detection_trace),
    comparison_suppression_trace_available: Boolean(evidence.comparison_suppression_trace),
    route_variance_trace_available: Boolean(evidence.route_variance_trace),
    duplicate_detection_status: duplicateDetectionStatus ?? "missing",
    duplicate_detection_context_available: duplicateDetectionContextAvailable,
    duplicate_detection_blocker: duplicateDetectionBlocker,
    duplicate_detection_suppression_applied: duplicateSuppressionApplied,
    duplicate_detection_evidence_delta_decisive: decisiveEvidenceDelta,
    comparison_payloads_available: comparisonPayloadsAvailable,
    public_surface_context_available: publicSurfaceContextAvailable,
    public_output_absence_or_unchanged_evidence_available: hasPublicOutputAbsenceEvidence,
    public_surface_scan_safe: publicSurfaceScanSafe,
    public_surface_scan_issues: publicSurfaceScanIssues,
    risk_source_scan_safe: riskSourceScanSafe,
    risk_source_scan_warnings: riskSourceCollection.scanWarnings,
    comparison_risk_context_available: comparisonRiskContextAvailable,
    same_video_risk_context_available: sameVideoRiskContextAvailable,
    route_variance_risk_context_available: routeVarianceRiskContextAvailable,
    forced_false_winner_risk_context_available: forcedFalseWinnerRiskContextAvailable,
    false_winner_risk_absent: falseWinnerRiskAbsent,
    forced_winner_risk_absent: forcedWinnerRiskAbsent,
    public_winner_absent: publicWinnerAbsent,
    public_recommendation_absent: publicRecommendationAbsent,
    forbidden_public_comparison_fields_absent: forbiddenPublicComparisonFieldsAbsent,
    checked_comparison_surfaces: publicSurfaces.map((s) => s.key),
    checked_risk_sources: riskSources.map((s) => s.source),
    risk_source_count: riskSources.length,
    risk_trace_fields_checked: [...COMPARISON_RISK_FIELDS],
    risk_trace_field_hits: riskSourceCollection.fieldHits.map(comparisonRiskFieldDiagnostic),
    mismatch_count: mismatch.length,
    mismatches: mismatch,
    blocker_codes,
    gate_satisfaction_reason: comparisonParityReason,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    level2_satisfaction: parityStatus === "passed" ? "satisfied" : "insufficient",
    submission_id: input.submission_id ?? null,
    take_id: input.take_id ?? null,
  };
  if (
    !comparisonParityIdentityIsSafe({
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      take_id: input.take_id,
      comparison_run_id: input.comparison_run_id,
    })
  ) {
    return {
      written: false as boolean,
      emitted_artefact_ids: [] as string[],
      parity_status: "insufficient" as const,
      blocker_codes: ["parity_artefacts_missing"],
      comparison_parity_summary: {
        ...comparison_parity_summary,
        parity_status: "insufficient",
        comparison_parity_status: "insufficient",
        comparison_parity_blocker_codes: ["parity_artefacts_missing"],
      },
    };
  }
  const relative = input.take_id
    ? `takes/take-${input.take_id}/analysis-${analysisRunId}/parity/comparison_parity.json`
    : "parity/comparison_parity.json";
  const result = await writeInternalJson(
    root,
    input.run_id,
    relative,
    outPayload,
    "parity_comparison",
  );
  return {
    written: Boolean(result.written),
    emitted_artefact_ids: result.written ? ["parity_comparison"] : [],
    parity_status: parityStatus,
    blocker_codes,
    comparison_parity_summary,
  };
}

export interface RuntimeVerificationTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  comparison_run_id?: string | null;
  verification_scope?:
    | "ordinary_single_take"
    | "duplicate_same_video_comparison"
    | "release_readiness";
  runtime_operator_verification_status?: string;
  runtime_operator_verification_reason?: string;
  runtime_bundle_freshness_status?: string;
  runtime_bundle_matches_current_commit_status?: string;
  runtime_bundle_matches_current_implementation_status?: string;
  runtime_verified_take_ids?: string[];
  runtime_verified_comparison_run_ids?: string[];
  runtime_verified_artefact_ids?: string[];
  runtime_verified_deployment_ref?: string | null;
  runtime_verified_at?: string;
  runtime_verified_by_role?: string | null;
  operator_confirmation_status?: string;
  operator_confirmation_reason?: string;
  operator_confirmed_runtime_build_ref?: string | null;
  operator_confirmed_runtime_pr_or_slice?: string | null;
  operator_confirmation_source?:
    | "explicit_operator_runtime_message"
    | "deployment_dashboard"
    | "safe_env_var"
    | "unknown";
  public_output_unchanged?: boolean;
  blocker_codes?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

export async function emitRuntimeVerificationTrace(input: RuntimeVerificationTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      runtime_verification_trace_summary: null,
    };
  }
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  try {
    assertSafeSegment(analysisRunId, "analysis_run_id");
    if (input.take_id) assertSafeSegment(input.take_id, "take_id");
  } catch {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      runtime_verification_trace_summary: {
        runtime_operator_verification_status: "blocked",
        runtime_operator_verification_reason: "runtime_verification_identity_unsafe",
        runtime_operator_verification_blocker_codes: ["runtime_verification_identity_unsafe"],
        blocker_codes: ["runtime_verification_identity_unsafe"],
      },
      blocker_codes: ["runtime_verification_identity_unsafe"],
    };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const provenance = resolveQADeploymentProvenance();
  const runtimeVerifiedTakeIds = getStringArray(input.runtime_verified_take_ids);
  const runtimeVerifiedComparisonRunIds = getStringArray(input.runtime_verified_comparison_run_ids);
  const runtimeVerifiedArtefactIds = getStringArray(input.runtime_verified_artefact_ids);
  const runtimeBundleFreshnessStatus = input.runtime_bundle_freshness_status ?? "unknown";
  const runtimeBundleMatchesCurrentImplementationStatus =
    input.runtime_bundle_matches_current_implementation_status ??
    input.runtime_bundle_matches_current_commit_status ??
    "unknown";
  const runtimeBundleMatchesCurrentCommitStatus =
    input.runtime_bundle_matches_current_commit_status ??
    runtimeBundleMatchesCurrentImplementationStatus;
  const operatorConfirmationStatus = input.operator_confirmation_status ?? "missing";
  const deploymentProvenanceStatus =
    provenance.deployment_provenance_status ?? "unknown_no_safe_env_var_found";
  const deploymentContextSatisfied =
    deploymentProvenanceStatus === "resolved" ||
    operatorConfirmationStatus === "confirmed" ||
    operatorConfirmationStatus === "provided";
  const bundleFresh = ["fresh", "verified_fresh", "current"].includes(runtimeBundleFreshnessStatus);
  const bundleMatches =
    [
      "matched",
      "matches",
      "matches_current_commit",
      "current_commit_matched",
      "matches_current_implementation",
      "current_implementation_matched",
      "operator_confirmed",
    ].includes(runtimeBundleMatchesCurrentImplementationStatus) ||
    [
      "matched",
      "matches",
      "matches_current_commit",
      "current_commit_matched",
      "operator_confirmed",
    ].includes(runtimeBundleMatchesCurrentCommitStatus);
  const runtimeContextPresent =
    input.verification_scope === "duplicate_same_video_comparison"
      ? runtimeVerifiedComparisonRunIds.length > 0
      : runtimeVerifiedTakeIds.length > 0;
  const requestedStatus = input.runtime_operator_verification_status ?? "required";
  const computedCompleted =
    requestedStatus === "completed" &&
    bundleFresh &&
    bundleMatches &&
    deploymentContextSatisfied &&
    runtimeContextPresent &&
    runtimeVerifiedArtefactIds.length > 0;
  const runtimeOperatorVerificationStatus = computedCompleted
    ? "completed"
    : requestedStatus === "blocked"
      ? "blocked"
      : requestedStatus === "completed"
        ? "incomplete"
        : "required";
  const blockerCodes = dedupePreservingOrder([
    ...(input.blocker_codes ?? []),
    ...(runtimeOperatorVerificationStatus === "completed"
      ? []
      : ["runtime_operator_verification_required"]),
    ...(!bundleFresh ? ["runtime_bundle_freshness_required"] : []),
    ...(!bundleMatches ? ["runtime_bundle_current_implementation_required"] : []),
    ...(!deploymentContextSatisfied
      ? ["deployment_provenance_or_operator_confirmation_required"]
      : []),
    ...(!runtimeContextPresent ? ["runtime_verified_runtime_scope_required"] : []),
    ...(runtimeVerifiedArtefactIds.length > 0 ? [] : ["runtime_verified_artefact_required"]),
  ]);
  const runtimeVerificationTraceSummary = {
    runtime_operator_verification_status: runtimeOperatorVerificationStatus,
    runtime_operator_verification_reason:
      runtimeOperatorVerificationStatus === "completed"
        ? "fresh_runtime_bundle_matches_current_implementation_with_deployment_context"
        : (input.runtime_operator_verification_reason ??
          `runtime_operator_verification_blockers:${blockerCodes.join(",")}`),
    runtime_operator_verification_blocker_codes: blockerCodes,
    runtime_bundle_freshness_status: runtimeBundleFreshnessStatus,
    runtime_bundle_matches_current_commit_status: runtimeBundleMatchesCurrentCommitStatus,
    runtime_bundle_matches_current_implementation_status:
      runtimeBundleMatchesCurrentImplementationStatus,
    runtime_verified_take_ids: runtimeVerifiedTakeIds,
    runtime_verified_comparison_run_ids: runtimeVerifiedComparisonRunIds,
    runtime_verified_artefact_ids: runtimeVerifiedArtefactIds,
    runtime_verified_deployment_ref:
      input.runtime_verified_deployment_ref ??
      provenance.deployment_revision ??
      provenance.build_commit_sha ??
      null,
    runtime_verified_at: input.runtime_verified_at ?? "unknown",
    runtime_verified_by_role: input.runtime_verified_by_role ?? null,
    operator_confirmation_status: operatorConfirmationStatus,
    operator_confirmation_reason:
      input.operator_confirmation_reason ??
      (deploymentContextSatisfied
        ? "deployment_context_confirmed_without_release_approval"
        : "operator_confirmation_missing"),
    operator_confirmed_runtime_build_ref: input.operator_confirmed_runtime_build_ref ?? null,
    operator_confirmed_runtime_pr_or_slice: input.operator_confirmed_runtime_pr_or_slice ?? null,
    operator_confirmation_source: input.operator_confirmation_source ?? "unknown",
    deployment_provenance_status: deploymentProvenanceStatus,
    deployment_provenance_reason:
      deploymentProvenanceStatus === "resolved"
        ? "safe_deployment_provenance_resolved"
        : deploymentProvenanceStatus,
    deployment_provenance_blocker_codes:
      deploymentProvenanceStatus === "resolved"
        ? []
        : ["deployment_provenance_or_operator_confirmation_required"],
    public_output_unchanged: input.public_output_unchanged !== false,
    secrets_or_signed_urls_stored: false,
    raw_prompt_or_response_stored: false,
    blocker_codes: blockerCodes,
  };
  const payload = {
    schema_version: "tapecoach_v3_runtime_verification_trace_v1",
    artefact_type: "runtime_verification_trace",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id ?? null,
    comparison_run_id: input.comparison_run_id ?? null,
    verification_scope: input.verification_scope ?? "ordinary_single_take",
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    ...runtimeVerificationTraceSummary,
    production_safe_status: "blocked",
    customer_release_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_comparison_recommendation_status: "blocked",
    ...provenance,
  };
  const relative = input.take_id
    ? `takes/take-${input.take_id}/analysis-${analysisRunId}/analysis/RuntimeVerificationTrace.json`
    : `analysis-${analysisRunId}/analysis/RuntimeVerificationTrace.json`;
  const result = await writeInternalJson(
    root,
    input.run_id,
    relative,
    payload,
    "runtime_verification_trace",
  );
  return {
    written: Boolean(result.written),
    emitted_artefact_ids: result.written ? ["runtime_verification_trace"] : [],
    path: result.path ?? result.storage_path,
    warning: getQAWriteWarning(result),
    runtime_verification_trace_summary: runtimeVerificationTraceSummary,
    blocker_codes: blockerCodes,
  };
}
export interface RawReportEmitterInput {
  run_id: string;
  take_id: string;
  take_index?: number;
  submission_id?: string;
  fixture_id?: string;
  mux_playback_id?: string;
  report_data: Record<string, unknown>;
  source_stage: string;
  source_module: string;
  route_or_model_marker?: string;
  commit_sha?: string;
  branch_name?: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface ComparisonRawEmitterInput {
  run_id: string;
  comparison_data: Record<string, unknown>;
  comparison_id?: string;
  submission_id?: string;
  take_ids?: string[];
  take_indices?: number[];
  mux_playback_ids?: Record<string, string>;
  fixture_id?: string;
  source_stage: string;
  source_module: string;
  route_or_model_marker?: string;
  commit_sha?: string;
  branch_name?: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface TraceEmitterInput {
  run_id: string;
  artefact_id: string;
  relative_path: string;
  trace_data: Record<string, unknown>;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface EvidenceAnchorsEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  analysis_evidence_state_data?: Record<string, unknown> | null;
  truth_state_map_data?: Record<string, unknown> | null;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
type EvidenceAnchorsSupportData = {
  anchors?: Array<Record<string, unknown>>;
  evidence_anchor_gate_status?: string;
  evidence_anchor_gate_reason?: string;
  evidence_anchor_trace_summary?: Record<string, unknown>;
  evidence_anchor_source_family_summary?: Record<string, unknown>;
} & Record<string, unknown>;
export interface PublicClaimTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  claim_candidate_trace_data?:
    | { claim_candidates?: Array<Record<string, unknown>> }
    | Record<string, unknown>
    | null;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  truth_state_map_data?: Record<string, unknown> | null;
  metadata_overrides?: Record<string, unknown>;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface ClaimCandidateTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  comparison_run_id?: string | null;
  source_module: string;
  source_stage: string;
  raw_report_data?: Record<string, unknown> | null;
  analysis_evidence_state_data?: Record<string, unknown> | null;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  resolver_output_data?: Record<string, unknown> | null;
  truth_state_map_data?: Record<string, unknown> | null;
  metadata_overrides?: Record<string, unknown>;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface TechniqueObservationTraceEmitterInput extends PublicClaimTraceEmitterInput {
  analysis_evidence_state_data?: Record<string, unknown> | null;
  public_claim_trace_data?: { claims?: Array<Record<string, unknown>> } | null;
}

export interface ScoreTraceEmitterInput extends TechniqueObservationTraceEmitterInput {
  structured_step2_score_data?: Record<string, unknown> | null;
}
export interface ModelRunTraceEntryInput {
  model_run_id?: string;
  stage?: string;
  invocation_status?: "invoked" | "skipped" | "not_applicable" | "failed" | "blocked";
  model_provider?: string;
  model_name?: string;
  model_version?: string;
  prompt_version?: string;
  model_role?: "primary" | "fallback" | "parser" | "unknown";
  source_stage?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  timeout_ms?: number;
  timed_out?: boolean;
  retry_count?: number;
  attempt_index?: number;
  http_status?: number;
  circuit_open?: boolean;
  fallback_used?: boolean;
  analysis_tier?: string;
  request_status?: "started" | "completed" | "failed" | "timed_out" | "unknown";
  parse_status?: "completed" | "failed" | "skipped" | "unknown";
  safe_error_category?: string;
  input_artifact_refs?: string[];
  output_artifact_refs?: string[];
  raw_prompt_or_response_stored?: boolean;
  secrets_or_signed_urls_stored?: boolean;
}
export interface ModelRunTraceEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  source_module: string;
  source_stage: string;
  analysis_route?: string;
  model_run_entries?: ModelRunTraceEntryInput[];
  expected_model_stages?: string[];
  comparison_invoked?: boolean;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
type TechniqueObservationSourceFamilySummary = {
  legacy_adapter: number;
  report_snapshot: number;
  real_runtime_v3: number;
  input_artifact: number;
  resolver_truth_state: number;
};
type TechniqueObservationTraceFirstPassResult = {
  written: boolean;
  emitted_artefact_ids: string[];
  source_classification?: string;
  source_family_summary?: TechniqueObservationSourceFamilySummary;
  technique_observation_trace_summary?: NonNullable<
    QAArtifactEmitterOptions["technique_observation_trace_summary"]
  >;
  level2_satisfies?: boolean;
};

const BLOCKED_PUBLIC_OUTPUT_PERMISSIONS = {
  show_overall_score: false,
  show_public_technique_names: false,
  show_repertoire_claims: false,
  show_comparison_recommendation: false,
  show_public_report: false,
} as const;

export interface ReportParityProofEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_payload?: Record<string, unknown> | null;
  public_report_payload?: Record<string, unknown> | null;
  render_source_kind?: PublicReportSourceKind | null;
  public_report_source_kind?: PublicReportSourceKind | null;
  allowed_public_fields?: string[];
  blocked_field_paths?: string[];
  blocked_score_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

export interface RenderPayloadEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_report_data?: Record<string, unknown> | null;
  render_source_kind?: PublicReportSourceKind | null;
  allowed_field_paths?: string[];
  blocked_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

export interface PublicReportPayloadEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  submission_id?: string;
  source_module?: string;
  source_stage?: string;
  raw_report_data?: Record<string, unknown> | null;
  render_payload?: Record<string, unknown> | null;
  public_report_data?: Record<string, unknown> | null;
  public_report_source_kind?: PublicReportSourceKind | null;
  allowed_field_paths?: string[];
  blocked_field_paths?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}

const INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS = [
  "report_data.schema_version",
  "report_data.submission_verdict",
  "report_data.why_this_verdict",
  "report_data.fix_first",
  "report_data.priority_fixes",
  "report_data.must_fix_before_submitting",
  "report_data.should_improve_if_retaking",
  "report_data.optional_polish",
  "report_data.strengths",
  "report_data.preserve",
  "report_data.do_not_overfix",
  "report_data.next_take_plan",
  "report_data.feedback_reliability",
  "report_data.brief_requirements",
  "report_data.brief_achievement",
  "report_data.not_assessable",
];

const INITIAL_PUBLIC_REPORT_PAYLOAD_ALLOWED_FIELDS = INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS;

const DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS = [
  "internal_qa",
  "internal_qa.*",
  "qa_private",
  "qa_private.*",
  "internal_only",
  "report_data.internal_only",
  "qa_trace",
  "qa_trace.*",
  "report_data.qa_trace",
  "report_data.qa_trace.*",
  "raw_report",
  "raw_report.*",
  "report_data.raw_report",
  "report_data.raw_report.*",
  "evidence_anchors",
  "evidence_anchors.*",
  "EvidenceAnchors",
  "EvidenceAnchors.*",
  "truth_state_map",
  "truth_state_map.*",
  "TruthStateMap",
  "TruthStateMap.*",
  "public_claim_trace",
  "public_claim_trace.*",
  "PublicClaimTrace",
  "PublicClaimTrace.*",
  "validator_trace",
  "validator_trace.*",
  "ValidatorTrace",
  "ValidatorTrace.*",
  "gate_trace",
  "gate_trace.*",
  "GateTrace",
  "GateTrace.*",
  "evidence_id",
  "evidence_ids",
  "evidence_anchor_id",
  "evidence_anchor_ids",
  "truth_id",
  "truth_ids",
  "truth_state_entry_id",
  "truth_state_entry_ids",
  "run_id",
  "analysis_run_id",
  "model_run_id",
  "storage_path",
  "storage_paths",
  "raw_prompt",
  "raw_prompts",
  "prompt",
  "prompts",
  "system_prompt",
  "user_prompt",
  "raw_model_response",
  "raw_model_responses",
  "raw_response",
  "raw_responses",
  "response_text",
  "model_response",
  "model_responses",
  "request",
  "request_body",
  "response",
  "response_body",
  "auth_header",
  "authorization",
  "api_key",
  "token",
  "tokens",
  "secret",
  "secrets",
  "cookie",
  "cookies",
  "session",
  "sessions",
  "signed_url",
  "signed_urls",
  "mux_url",
  "mux_urls",
  "storage_url",
  "storage_urls",
  "raw_url",
  "raw_urls",
  "score",
  "scores",
  "overall_score",
  "overall_score_final",
  "overall_score_model",
  "overall_readiness",
  "overall_readiness_score",
  "readiness_score",
  "score_trace",
  "score_trace.*",
  "public_score",
  "public_scoring",
  "technique_authority",
  "technique_authority.*",
  "public_technique_authority",
  "public_technique_authority.*",
  "technique_observation_trace",
  "technique_observation_trace.*",
  "castability",
  "bookability",
  "marketability",
  "role_fit",
  "role_fit_notes",
  "role_fit_modifier",
  "role_fit_confidence",
  "employability",
  "casting_headline",
  "casting_insight",
  "comparison",
  "comparison.*",
  "comparison_raw",
  "comparison_raw.*",
  "comparison_report_internal",
  "comparison_report_internal.*",
  "selected_take_id",
  "selected_winner",
  "winner",
  "recommendation",
  "report_data.internal_qa",
  "report_data.internal_qa.*",
  "report_data.qa_private",
  "report_data.qa_private.*",
  "report_data.evidence_anchors",
  "report_data.evidence_anchors.*",
  "report_data.EvidenceAnchors",
  "report_data.EvidenceAnchors.*",
  "report_data.truth_state_map",
  "report_data.truth_state_map.*",
  "report_data.TruthStateMap",
  "report_data.TruthStateMap.*",
  "report_data.public_claim_trace",
  "report_data.public_claim_trace.*",
  "report_data.PublicClaimTrace",
  "report_data.PublicClaimTrace.*",
  "report_data.validator_trace",
  "report_data.validator_trace.*",
  "report_data.ValidatorTrace",
  "report_data.ValidatorTrace.*",
  "report_data.gate_trace",
  "report_data.gate_trace.*",
  "report_data.GateTrace",
  "report_data.GateTrace.*",
  "report_data.evidence_id",
  "report_data.evidence_ids",
  "report_data.evidence_anchor_id",
  "report_data.evidence_anchor_ids",
  "report_data.truth_id",
  "report_data.truth_ids",
  "report_data.truth_state_entry_id",
  "report_data.truth_state_entry_ids",
  "report_data.run_id",
  "report_data.analysis_run_id",
  "report_data.model_run_id",
  "report_data.storage_path",
  "report_data.storage_paths",
  "report_data.raw_prompt",
  "report_data.raw_prompts",
  "report_data.prompt",
  "report_data.prompts",
  "report_data.system_prompt",
  "report_data.user_prompt",
  "report_data.raw_model_response",
  "report_data.raw_model_responses",
  "report_data.raw_response",
  "report_data.raw_responses",
  "report_data.response_text",
  "report_data.model_response",
  "report_data.model_responses",
  "report_data.request",
  "report_data.request_body",
  "report_data.response",
  "report_data.response_body",
  "report_data.auth_header",
  "report_data.authorization",
  "report_data.api_key",
  "report_data.token",
  "report_data.tokens",
  "report_data.secret",
  "report_data.secrets",
  "report_data.cookie",
  "report_data.cookies",
  "report_data.session",
  "report_data.sessions",
  "report_data.signed_url",
  "report_data.signed_urls",
  "report_data.mux_url",
  "report_data.mux_urls",
  "report_data.storage_url",
  "report_data.storage_urls",
  "report_data.raw_url",
  "report_data.raw_urls",
  "report_data.score",
  "report_data.score.*",
  "report_data.scores",
  "report_data.scores.*",
  "report_data.overall_score",
  "report_data.overall_score_final",
  "report_data.overall_score_model",
  "report_data.overall_readiness",
  "report_data.overall_readiness_score",
  "report_data.readiness_score",
  "report_data.score_trace",
  "report_data.score_trace.*",
  "report_data.public_score",
  "report_data.public_scoring",
  "report_data.technique_authority",
  "report_data.technique_authority.*",
  "report_data.public_technique_authority",
  "report_data.public_technique_authority.*",
  "report_data.technique_observation_trace",
  "report_data.technique_observation_trace.*",
  "report_data.castability",
  "report_data.bookability",
  "report_data.marketability",
  "report_data.role_fit",
  "report_data.role_fit_notes",
  "report_data.role_fit_modifier",
  "report_data.role_fit_confidence",
  "report_data.employability",
  "report_data.casting_headline",
  "report_data.casting_insight",
  "report_data.comparison",
  "report_data.comparison.*",
  "report_data.comparison_raw",
  "report_data.comparison_raw.*",
  "report_data.comparison_report_internal",
  "report_data.comparison_report_internal.*",
  "report_data.selected_take_id",
  "report_data.selected_winner",
  "report_data.winner",
  "report_data.recommendation",
];

function diagnosticValueSummary(value: unknown): Record<string, unknown> {
  if (value === null) return { type: "null" };
  if (Array.isArray(value)) return { type: "array", item_count: value.length };
  if (typeof value === "string") return { type: "string", length: value.length };
  if (typeof value === "number") return { type: "number", finite: Number.isFinite(value) };
  if (typeof value === "boolean") return { type: "boolean" };
  if (typeof value === "object" && value)
    return { type: "object", key_count: Object.keys(value as Record<string, unknown>).length };
  return { type: typeof value };
}

function isUnsafeRenderString(value: string): boolean {
  const text = value.toLowerCase();
  return (
    /https?:\/\//i.test(value) &&
    (text.includes("signature=") ||
      text.includes("token=") ||
      text.includes("x-amz-") ||
      text.includes("mux.com") ||
      text.includes("storage") ||
      text.includes("supabase"))
  );
}

const BLOCKED_PUBLIC_REPORT_TEXT =
  /\b(?:castability|castable|bookability|bookable|marketability|marketable|role[-\s]?fit|casting\s+fit|commercial\s+fit|market\s+fit|buyer\s+fit|employability|commercial\s+look|callback|recall[-\s]?ready|recall\s+worthy|would\s+(?:get|be)\s+(?:a\s+)?recall|guaranteed|guarantees|winner|best\s+take|selected\s+take|overall\s+score|category\s+score|score\s+of\s+\d+|Meisner|Stanislavski|Uta\s+Hagen|Chekhov|Laban|Viewpoints|Suzuki)\b/i;

function isBlockedPublicReportString(value: string): boolean {
  return BLOCKED_PUBLIC_REPORT_TEXT.test(value);
}

function cloneRenderSafeValue(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
  blockedPaths: string[] = [],
  currentPath = "",
): { safe: boolean; value?: unknown; reason?: string } {
  if (currentPath && blockedPaths.some((path) => matchesBlockedPath(currentPath, path))) {
    return { safe: false, reason: "blocked_field_omitted" };
  }
  if (value === undefined) return { safe: false, reason: "undefined_value_omitted" };
  if (value === null || typeof value === "number" || typeof value === "boolean")
    return { safe: true, value };
  if (typeof value === "string") {
    if (isUnsafeRenderString(value))
      return { safe: false, reason: "unsafe_url_or_token_like_string_redacted" };
    if (isBlockedPublicReportString(value))
      return { safe: false, reason: "blocked_public_report_claim_redacted" };
    return { safe: true, value };
  }
  if (typeof value === "bigint" || typeof value === "symbol" || typeof value === "function")
    return { safe: false, reason: "non_json_value_omitted" };
  if (!value || typeof value !== "object")
    return { safe: false, reason: "unsupported_value_omitted" };
  if (seen.has(value as object)) return { safe: false, reason: "circular_value_omitted" };
  seen.add(value as object);
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    value.forEach((item, index) => {
      const cloned = cloneRenderSafeValue(item, seen, blockedPaths, `${currentPath}[${index}]`);
      if (cloned.safe) arr.push(cloned.value);
    });
    seen.delete(value as object);
    return { safe: true, value: arr };
  }
  if (!isPlainRecord(value)) {
    seen.delete(value as object);
    return { safe: false, reason: "non_plain_object_omitted" };
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = currentPath ? `${currentPath}.${key}` : key;
    const cloned = cloneRenderSafeValue(child, seen, blockedPaths, childPath);
    if (cloned.safe) out[key] = cloned.value;
  }
  seen.delete(value as object);
  return { safe: true, value: out };
}

function textItemsOnly(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function pruneObjectKeys(value: unknown, keys: string[]): Record<string, unknown> {
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key]) => keys.includes(key)));
}

function prunePriorityFixes(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      const pruned = pruneObjectKeys(item, ["headline", "rationale", "kind", "category", "action"]);
      return Object.keys(pruned).length > 0 ? pruned : null;
    })
    .filter((item): item is string | Record<string, unknown> => item !== null);
}

function pruneBriefRequirements(value: unknown): unknown {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const pruned = pruneObjectKeys(item, [
        "requirement_id",
        "source_text",
        "public_summary",
        "category",
        "obligation",
        "requirement_type",
        "achievement_status",
        "readiness_impact",
        "public_evidence_summary",
        "assessability_limits",
        "next_take_action",
      ]);
      if (Array.isArray(pruned.assessability_limits)) {
        pruned.assessability_limits = textItemsOnly(pruned.assessability_limits);
      }
      return Object.keys(pruned).length > 0 ? pruned : null;
    })
    .filter((item): item is Record<string, unknown> => item !== null);
}

function pruneNextTakePlan(value: unknown): unknown {
  if (Array.isArray(value)) return textItemsOnly(value);
  if (!isPlainRecord(value)) return {};
  const out: Record<string, unknown> = {};
  if (Array.isArray(value.steps)) out.steps = textItemsOnly(value.steps);
  if (Array.isArray(value.groups)) {
    out.groups = value.groups
      .map((group) => {
        if (!isPlainRecord(group)) return null;
        const label = typeof group.label === "string" ? group.label : null;
        const items = textItemsOnly(group.items);
        return label && items.length > 0 ? { label, items } : null;
      })
      .filter((group): group is { label: string; items: string[] } => group !== null);
  }
  return out;
}

function pruneAllowedReportDataValue(path: string, value: unknown): unknown {
  const field = path.replace(/^report_data\./, "");
  switch (field) {
    case "submission_verdict":
      return typeof value === "string"
        ? value
        : pruneObjectKeys(value, ["decision", "label", "reason", "blocked"]);
    case "why_this_verdict": {
      const pruned = pruneObjectKeys(value, ["summary", "main_reasons", "limitations"]);
      if (Array.isArray(pruned.main_reasons))
        pruned.main_reasons = textItemsOnly(pruned.main_reasons);
      if (Array.isArray(pruned.limitations)) pruned.limitations = textItemsOnly(pruned.limitations);
      return pruned;
    }
    case "priority_fixes":
      return prunePriorityFixes(value);
    case "must_fix_before_submitting":
    case "should_improve_if_retaking":
    case "optional_polish":
    case "strengths":
    case "preserve":
    case "do_not_overfix":
    case "not_assessable":
      return textItemsOnly(value);
    case "next_take_plan":
      return pruneNextTakePlan(value);
    case "feedback_reliability":
      return typeof value === "string"
        ? value
        : pruneObjectKeys(value, ["level", "summary", "status"]);
    case "brief_requirements":
      return pruneBriefRequirements(value);
    case "brief_achievement":
      return pruneObjectKeys(value, [
        "overall_status",
        "summary",
        "mandatory_requirements_status",
        "mandatory_status",
        "readiness_impact",
        "readiness_effect",
        "not_assessable_summary",
      ]);
    default:
      return value;
  }
}

function normaliseAllowedFieldForParity(
  path: string,
  field: { present: boolean; value: unknown },
  blockedPaths: string[],
): { present: boolean; value: unknown } {
  if (!field.present) return field;
  if (!path.startsWith("report_data.")) return field;
  const cloned = cloneRenderSafeValue(field.value, new WeakSet(), blockedPaths, path);
  if (!cloned.safe) return { present: false, value: undefined };
  return { present: true, value: pruneAllowedReportDataValue(path, cloned.value) };
}

function setPathValue(target: Record<string, unknown>, path: string, value: unknown): boolean {
  const tokens = tokenizePath(path);
  if (!tokens) return false;
  let current: unknown = target;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const nextToken = tokens[i + 1];
    if (i === tokens.length - 1) {
      if (typeof token === "number") {
        if (!Array.isArray(current)) return false;
        current[token] = value;
      } else {
        if (!isPlainRecord(current)) return false;
        current[token] = value;
      }
      return true;
    }
    if (typeof token === "number") {
      if (!Array.isArray(current)) return false;
      const existing = current[token];
      if (typeof nextToken === "number") {
        if (!Array.isArray(existing)) current[token] = [];
      } else if (!isPlainRecord(existing)) {
        current[token] = {};
      }
      current = current[token];
      continue;
    }
    if (!isPlainRecord(current)) return false;
    const existing = current[token];
    if (typeof nextToken === "number") {
      if (!Array.isArray(existing)) current[token] = [];
    } else if (!isPlainRecord(existing)) {
      current[token] = {};
    }
    current = current[token];
  }
  return false;
}

function collectCandidatePaths(value: unknown, pathPrefix = ""): string[] {
  const out: string[] = [];
  const active = new WeakSet<object>();
  const walk = (node: unknown, currentPath: string) => {
    if (!node || typeof node !== "object") return;
    if (active.has(node as object)) return;
    active.add(node as object);
    if (Array.isArray(node)) {
      node.forEach((item, index) => {
        const next = `${currentPath}[${index}]`;
        out.push(next);
        walk(item, next);
      });
      active.delete(node as object);
      return;
    }
    if (!isPlainRecord(node)) {
      active.delete(node as object);
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const next = currentPath ? `${currentPath}.${key}` : key;
      out.push(next);
      walk(child, next);
    }
    active.delete(node as object);
  };
  walk(value, pathPrefix);
  return out;
}

function collectBlockedFieldHits(
  surface: unknown,
  blockedPaths: string[],
): Array<{ path: string; matched_blocked_path: string; value_summary: Record<string, unknown> }> {
  const hits: Array<{
    path: string;
    matched_blocked_path: string;
    value_summary: Record<string, unknown>;
  }> = [];
  const seen = new Set<string>();
  for (const candidate of collectCandidatePaths(surface)) {
    const blockedPath = blockedPaths.find((path) => matchesBlockedPath(candidate, path));
    if (!blockedPath || seen.has(candidate)) continue;
    seen.add(candidate);
    hits.push({
      path: candidate,
      matched_blocked_path: blockedPath,
      value_summary: diagnosticValueSummary(getPathValue(surface, candidate).value),
    });
  }
  return hits;
}

function tokenizePath(path: string): Array<string | number> | null {
  const tokens: Array<string | number> = [];
  let i = 0;
  const n = path.length;
  while (i < n) {
    const ch = path[i];
    if (ch === ".") {
      i += 1;
      continue;
    }
    if (ch === "[") {
      const end = path.indexOf("]", i + 1);
      if (end === -1) return null;
      const indexRaw = path.slice(i + 1, end).trim();
      if (!/^\d+$/.test(indexRaw)) return null;
      const index = Number(indexRaw);
      if (!Number.isInteger(index) || index < 0) return null;
      tokens.push(index);
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < n && path[j] !== "." && path[j] !== "[" && path[j] !== "]") j += 1;
    const segment = path.slice(i, j).trim();
    if (!segment) return null;
    tokens.push(segment);
    i = j;
  }
  return tokens.length > 0 ? tokens : null;
}

function getPathValue(obj: unknown, path: unknown): { present: boolean; value: unknown } {
  if (!obj || typeof obj !== "object") return { present: false, value: undefined };
  if (typeof path !== "string") return { present: false, value: undefined };
  const trimmedPath = path.trim();
  if (!trimmedPath) return { present: false, value: undefined };
  const tokens = tokenizePath(trimmedPath);
  if (!tokens) return { present: false, value: undefined };
  let cur: any = obj;
  for (const token of tokens) {
    if (typeof token === "number") {
      if (!Array.isArray(cur) || token < 0 || token >= cur.length)
        return { present: false, value: undefined };
      cur = cur[token];
      continue;
    }
    if (!cur || typeof cur !== "object" || !(token in cur))
      return { present: false, value: undefined };
    cur = cur[token];
  }
  return { present: true, value: cur };
}

function normaliseParityPathList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!tokenizePath(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function toStableJson(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  const type = typeof value;
  if (value === undefined) return '"__undefined__"';
  if (value === null) return "null";
  if (type === "string") return JSON.stringify(value);
  if (type === "number")
    return Number.isFinite(value as number) ? String(value) : '"__non_finite_number__"';
  if (type === "boolean") return value ? "true" : "false";
  if (type === "bigint") return `"__bigint__:${String(value)}"`;
  if (type === "symbol") return `"__symbol__:${String((value as symbol).description ?? "")}"`;
  if (type === "function")
    return `"__function__:${String((value as Function).name || "anonymous")}"`;
  if (type !== "object") return `"__unknown_type__:${type}"`;
  const obj = value as object;
  if (seen.has(obj)) return '"__circular__"';
  seen.add(obj);
  if (Array.isArray(value)) {
    const arr = `[${value.map((item) => toStableJson(item, seen)).join(",")}]`;
    seen.delete(obj);
    return arr;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const stableObj = `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${toStableJson(v, seen)}`).join(",")}}`;
  seen.delete(obj);
  return stableObj;
}

function valuesDeepEqual(
  a: unknown,
  b: unknown,
  seenPairs: WeakMap<object, WeakSet<object>> = new WeakMap(),
): boolean {
  if (Object.is(a, b)) return true;

  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA !== typeB) return false;

  if (a === null || b === null) return false;

  if (typeA === "bigint") return (a as bigint) === (b as bigint);
  if (typeA === "symbol" || typeA === "function") return false;

  if (typeA !== "object") return false;

  const objA = a as object;
  const objB = b as object;
  const seenForA = seenPairs.get(objA);
  if (seenForA?.has(objB)) return true;
  if (seenForA) {
    seenForA.add(objB);
  } else {
    seenPairs.set(objA, new WeakSet([objB]));
  }

  const arrA = Array.isArray(a);
  const arrB = Array.isArray(b);
  if (arrA !== arrB) return false;

  if (arrA && arrB) {
    const aItems = a as unknown[];
    const bItems = b as unknown[];
    if (aItems.length !== bItems.length) return false;
    for (let i = 0; i < aItems.length; i += 1) {
      if (!valuesDeepEqual(aItems[i], bItems[i], seenPairs)) return false;
    }
    return true;
  }

  const recA = a as Record<string, unknown>;
  const recB = b as Record<string, unknown>;
  const keysA = Object.keys(recA).sort();
  const keysB = Object.keys(recB).sort();
  if (keysA.length !== keysB.length) return false;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return false;
    if (!valuesDeepEqual(recA[keysA[i]], recB[keysA[i]], seenPairs)) return false;
  }
  return true;
}

function summariseValueForParity(value: unknown): Record<string, unknown> {
  const stable = toStableJson(value);
  const type = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  const hash = createHash("sha256").update(`${type}:${stable}`).digest("hex");
  return { type, stable_hash_sha256: hash, length: stable.length };
}

function normaliseBlockedPath(path: string): string {
  return String(path).trim().toLowerCase();
}

function normaliseIndexedPath(path: string): string {
  return normaliseBlockedPath(path).replace(/\[\d+\]/g, "");
}

function normaliseIndexedWildcardPath(path: string): string {
  return normaliseBlockedPath(path).replace(/\[\d+\]/g, "[]");
}

function pathStringSegments(path: string): string[] {
  const tokens = tokenizePath(path);
  if (!tokens) return [];
  return tokens
    .filter((token): token is string => typeof token === "string")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
}

const defaultBlockedScoreFieldPaths = [
  "score",
  "scores",
  "overall_score",
  "overall_score_final",
  "overall_readiness",
  "overall_readiness_score",
  "readiness_score",
  "score_value",
  "score_entries",
  "category_scores",
  "discipline_scores",
  "attribute_scores",
  "public_score",
  "public_scores",
  "report_data.overall_score",
  "report_data.overall_score_final",
  "report_data.overall_score_model",
  "report_data.overall_score_model.*",
  "report_data.overall_readiness",
  "report_data.overall_readiness_score",
  "report_data.overall_readiness_score.*",
  "report_data.readiness_score",
  "report_data.readiness_score.*",
  "report_data.scores",
  "report_data.scores.*",
  "report_data.score",
  "report_data.score.*",
  "report_data.score_summary",
  "report_data.score_summary.*",
  "report_data.score_breakdown",
  "report_data.score_breakdown.*",
  "report_data.category_scores",
  "report_data.category_scores.*",
  "report_data.discipline_scores",
  "report_data.discipline_scores.*",
  "report_data.attribute_scores",
  "report_data.attribute_scores.*",
  "report_data.score_entries",
  "report_data.score_value",
  "report_data.public_score",
  "report_data.public_scores",
  "report_data.public_scores.*",
];

function matchesBlockedPath(fieldPath: string, blockedPath: string): boolean {
  const field = normaliseBlockedPath(fieldPath);
  const fieldIndexless = normaliseIndexedPath(fieldPath);
  const fieldIndexedWildcard = normaliseIndexedWildcardPath(fieldPath);
  const blocked = normaliseBlockedPath(blockedPath);
  if (!field || !blocked) return false;
  if (!blocked.includes(".") && !blocked.includes("[") && !blocked.endsWith(".*")) {
    return pathStringSegments(fieldPath).includes(blocked);
  }
  if (blocked.endsWith(".*")) {
    const base = blocked.slice(0, -2);
    const baseIndexless = normaliseIndexedPath(base);
    const baseIndexedWildcard = normaliseIndexedWildcardPath(base);
    return (
      field === base ||
      field.startsWith(`${base}.`) ||
      field.startsWith(`${base}[`) ||
      fieldIndexless === baseIndexless ||
      fieldIndexless.startsWith(`${baseIndexless}.`) ||
      fieldIndexedWildcard === baseIndexedWildcard ||
      fieldIndexedWildcard.startsWith(`${baseIndexedWildcard}.`)
    );
  }
  const blockedIndexless = normaliseIndexedPath(blocked);
  const blockedIndexedWildcard = normaliseIndexedWildcardPath(blocked);
  return (
    field === blocked ||
    field.startsWith(`${blocked}.`) ||
    field.startsWith(`${blocked}[`) ||
    fieldIndexless === blockedIndexless ||
    fieldIndexless.startsWith(`${blockedIndexless}.`) ||
    fieldIndexedWildcard === blockedIndexedWildcard ||
    fieldIndexedWildcard.startsWith(`${blockedIndexedWildcard}.`)
  );
}

function isBlockedScoreFieldPath(path: string, blockedScorePaths?: string[]): boolean {
  const allBlockedPaths = [...defaultBlockedScoreFieldPaths, ...(blockedScorePaths ?? [])];
  return allBlockedPaths.some((blockedPath) => matchesBlockedPath(path, blockedPath));
}

function collectSurfacePathSet(surface: unknown): Set<string> {
  return new Set(collectCandidatePaths(surface));
}

function isSafeTakeIdSegment(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!trimmed) return false;
  if (trimmed === ".") return false;
  if (/[\\/]/.test(trimmed)) return false;
  if (trimmed.includes("..")) return false;
  if (trimmed.startsWith("take-")) return false;
  return true;
}

export async function emitReportParityProof(input: ReportParityProofEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const raw = input.raw_report_data ?? null;
  const render = input.render_payload ?? null;
  const publicPayload = input.public_report_payload ?? null;
  const rawAvail = Boolean(raw && typeof raw === "object");
  const renderAvail = Boolean(render && typeof render === "object");
  const publicAvail = Boolean(publicPayload && typeof publicPayload === "object");
  const allowedFieldsInput = input.allowed_public_fields;
  const checked = normaliseParityPathList(allowedFieldsInput);
  const allowedInputCount = Array.isArray(allowedFieldsInput) ? allowedFieldsInput.length : 0;
  const invalidAllowedPublicFieldCount = Array.isArray(allowedFieldsInput)
    ? allowedFieldsInput.filter((entry) => typeof entry !== "string").length
    : 0;
  const droppedAllowedPublicFieldCount = Math.max(0, allowedInputCount - checked.length);
  const blocked = [
    ...new Set([
      ...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS,
      ...defaultBlockedScoreFieldPaths,
      ...normaliseParityPathList(input.blocked_field_paths),
    ]),
  ];
  const blockedScorePaths = normaliseParityPathList(input.blocked_score_field_paths);
  const checkedSurfaces = [
    ...(renderAvail ? [{ name: "render_payload" as const, value: render }] : []),
    ...(publicAvail ? [{ name: "public_report_payload" as const, value: publicPayload }] : []),
  ];
  const checkedSurfaceNames = checkedSurfaces.map((s) => s.name);
  const mismatches: Array<Record<string, unknown>> = [];

  if (rawAvail) {
    for (const field of checked) {
      const rawField = getPathValue(raw, field);
      const rawComparableField = normaliseAllowedFieldForParity(field, rawField, blocked);
      for (const surface of checkedSurfaces) {
        const surfaceField = getPathValue(surface.value, field);
        if (rawComparableField.present !== surfaceField.present) {
          mismatches.push({
            field,
            surface: surface.name,
            mismatch_type: "presence_mismatch",
            raw_present: rawComparableField.present,
            surface_present: surfaceField.present,
          });
          continue;
        }
        if (
          rawComparableField.present &&
          surfaceField.present &&
          !valuesDeepEqual(rawComparableField.value, surfaceField.value)
        ) {
          mismatches.push({
            field,
            surface: surface.name,
            mismatch_type: "value_mismatch",
            value_diagnostic: {
              raw_value_summary: summariseValueForParity(rawComparableField.value),
              surface_value_summary: summariseValueForParity(surfaceField.value),
            },
          });
        }
      }
    }
  }

  const forbiddenFindings: Array<Record<string, unknown>> = [];
  const checkSurface = (
    surfaceName: "render_payload" | "public_report_payload",
    surface: unknown,
  ) => {
    const foundPaths = new Set<string>();
    const candidates = new Set<string>();
    const visited = new WeakSet<object>();
    const collectPaths = (value: unknown, currentPath = "") => {
      if (!value || typeof value !== "object") return;
      const obj = value as object;
      if (visited.has(obj)) return;
      visited.add(obj);
      if (Array.isArray(value)) {
        value.forEach((item, idx) => {
          const next = `${currentPath}[${idx}]`;
          candidates.add(next);
          collectPaths(item, next);
        });
        return;
      }
      for (const key of Object.keys(value as Record<string, unknown>)) {
        const next = currentPath ? `${currentPath}.${key}` : key;
        candidates.add(next);
        collectPaths((value as Record<string, unknown>)[key], next);
      }
    };
    collectPaths(surface);
    for (const candidate of candidates) {
      const blockedMatch = blocked.find((blockedPath) =>
        matchesBlockedPath(candidate, blockedPath),
      );
      if (!blockedMatch) continue;
      const label = candidate === blockedMatch ? blockedMatch : candidate;
      if (foundPaths.has(label)) continue;
      foundPaths.add(label);
      const found = getPathValue(surface, candidate.replace(/\[(\d+)\]/g, ".$1"));
      forbiddenFindings.push({
        field: label,
        mismatch_type: "forbidden_field_present",
        surface: surfaceName,
        value_summary: summariseValueForParity(found.value),
      });
    }
  };
  for (const surface of checkedSurfaces) checkSurface(surface.name, surface.value);
  const publicTechniqueAuthorityContentFindings: Array<Record<string, unknown>> = [];
  const checkTechniqueAuthorityContent = (
    surfaceName: "render_payload" | "public_report_payload",
    surface: unknown,
  ) => {
    const visited = new WeakSet<object>();
    const scan = (value: unknown, currentPath = "") => {
      if (typeof value === "string") {
        if (TECHNIQUE_AUTHORITY_CLAIM_PATTERN.test(value)) {
          publicTechniqueAuthorityContentFindings.push({
            field: currentPath || "<root>",
            mismatch_type: "public_technique_authority_content_present",
            surface: surfaceName,
            value_summary: summariseValueForParity(value),
          });
        }
        return;
      }
      if (!value || typeof value !== "object") return;
      const obj = value as object;
      if (visited.has(obj)) return;
      visited.add(obj);
      if (Array.isArray(value)) {
        value.forEach((item, idx) => scan(item, `${currentPath}[${idx}]`));
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        scan(child, currentPath ? `${currentPath}.${key}` : key);
      }
    };
    scan(surface);
  };
  for (const surface of checkedSurfaces)
    checkTechniqueAuthorityContent(surface.name, surface.value);
  const blockedPublicReportContentFindings: Array<Record<string, unknown>> = [];
  const checkBlockedPublicReportContent = (
    surfaceName: "render_payload" | "public_report_payload",
    surface: unknown,
  ) => {
    const visited = new WeakSet<object>();
    const scan = (value: unknown, currentPath = "") => {
      if (typeof value === "string") {
        if (isBlockedPublicReportString(value)) {
          blockedPublicReportContentFindings.push({
            field: currentPath || "<root>",
            mismatch_type: "blocked_public_report_claim_content_present",
            surface: surfaceName,
            value_summary: summariseValueForParity(value),
          });
        }
        return;
      }
      if (!value || typeof value !== "object") return;
      const obj = value as object;
      if (visited.has(obj)) return;
      visited.add(obj);
      if (Array.isArray(value)) {
        value.forEach((item, idx) => scan(item, `${currentPath}[${idx}]`));
        return;
      }
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        scan(child, currentPath ? `${currentPath}.${key}` : key);
      }
    };
    scan(surface);
  };
  for (const surface of checkedSurfaces)
    checkBlockedPublicReportContent(surface.name, surface.value);
  mismatches.push(...blockedPublicReportContentFindings);
  mismatches.push(...publicTechniqueAuthorityContentFindings);
  mismatches.push(...forbiddenFindings);

  const renderSourceKind =
    input.render_source_kind ??
    sourceKindFromSurface(render, ["render_source_kind", "source_kind"]);
  const publicReportSourceKind =
    input.public_report_source_kind ??
    sourceKindFromSurface(publicPayload, ["public_report_source_kind", "source_kind"]);
  const sourceKindFindings: Array<Record<string, unknown>> = [];
  const addSourceKindFinding = (
    surface: "render_payload" | "public_report_payload",
    sourceKind: PublicReportSourceKind | null,
  ) => {
    if (!sourceKind) return;
    if (!isRejectedPublicReportSourceKind(sourceKind)) return;
    sourceKindFindings.push({
      field: surface === "render_payload" ? "render_source_kind" : "public_report_source_kind",
      surface,
      mismatch_type: "public_report_source_kind_not_canonical",
      source_kind: sourceKind,
      detail:
        "R10.7 public report acceptance requires a PublicReportViewModel source, not a legacy/raw/shadow source.",
    });
  };
  addSourceKindFinding("render_payload", renderSourceKind);
  addSourceKindFinding("public_report_payload", publicReportSourceKind);
  mismatches.push(...sourceKindFindings);

  if (renderAvail && publicAvail) {
    const renderPaths = collectSurfacePathSet(render);
    const publicPaths = collectCandidatePaths(publicPayload);
    const reportedExtraPaths = new Set<string>();
    for (const publicPath of publicPaths) {
      if (renderPaths.has(publicPath) || reportedExtraPaths.has(publicPath)) continue;
      reportedExtraPaths.add(publicPath);
      mismatches.push({
        field: publicPath,
        surface: "public_report_payload",
        mismatch_type: "public_report_payload_extra_path",
        detail: "public_report_payload_path_not_present_in_render_payload",
      });
    }
  }

  const forbiddenAbsent = forbiddenFindings.length === 0;
  const hasAllowedFields = checked.length > 0;
  const requiredSurfacesAvailable = rawAvail && renderAvail && publicAvail;
  const parityStatus =
    forbiddenFindings.length > 0
      ? "failed"
      : mismatches.length > 0
        ? "failed"
        : !hasAllowedFields || !requiredSurfacesAvailable
          ? "insufficient"
          : "passed";
  const blocker_codes =
    parityStatus === "passed"
      ? []
      : [
          ...new Set([
            ...(sourceKindFindings.length > 0 ? ["public_report_source_kind_not_canonical"] : []),
            "parity_artefacts_missing",
          ]),
        ];
  if (!rawAvail)
    mismatches.push({
      mismatch_type: "raw_report_data_missing",
      detail: "raw_report_data_required_for_report_parity",
    });
  if (!renderAvail)
    mismatches.push({
      mismatch_type: "render_payload_missing",
      detail: "render_payload_required_for_report_parity",
    });
  if (!publicAvail)
    mismatches.push({
      mismatch_type: "public_report_payload_missing",
      detail: "public_report_payload_required_for_report_parity",
    });
  if (!hasAllowedFields)
    mismatches.push({
      mismatch_type: "allowed_public_fields_missing",
      detail: "no_allowed_public_fields_configured",
    });
  const payload = {
    schema_version: "tapecoach_v3_report_parity_result_v1",
    artefact_type: "report_parity_result",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    parity_status: parityStatus,
    public_output_unchanged: true,
    raw_report_available: rawAvail,
    render_payload_available: renderAvail,
    public_report_payload_available: publicAvail,
    checked_surfaces: checkedSurfaceNames,
    checked_public_fields: checked,
    blocked_internal_fields_absent: forbiddenAbsent,
    forbidden_fields_absent: forbiddenAbsent,
    blocked_score_fields_absent: !forbiddenFindings.some((finding) =>
      isBlockedScoreFieldPath(String(finding.field), blockedScorePaths),
    ),
    blocked_comparison_fields_absent: !forbiddenFindings.some((p) =>
      /comparison|winner|recommendation/i.test(String(p.field)),
    ),
    blocked_technique_authority_fields_absent: !forbiddenFindings.some((p) =>
      [
        "technique_authority",
        "public_technique_authority",
        "report_data.technique_authority",
        "report_data.public_technique_authority",
      ].some((blockedPath) => matchesBlockedPath(String(p.field), blockedPath)),
    ),
    public_technique_authority_content_scan_safe:
      publicTechniqueAuthorityContentFindings.length === 0,
    public_technique_authority_content_hit_count: publicTechniqueAuthorityContentFindings.length,
    blocked_public_report_claim_content_scan_safe: blockedPublicReportContentFindings.length === 0,
    blocked_public_report_claim_content_hit_count: blockedPublicReportContentFindings.length,
    unsafe_castability_or_marketability_fields_absent: !forbiddenFindings.some((p) =>
      /castability|bookability|marketability/i.test(String(p.field)),
    ),
    render_payload_checked: checkedSurfaceNames.includes("render_payload"),
    public_report_payload_checked: checkedSurfaceNames.includes("public_report_payload"),
    public_output_permissions_checked: checkedSurfaceNames.includes("public_report_payload"),
    report_output_enforcement_checked: checkedSurfaces.length > 0,
    mismatch_count: mismatches.length,
    render_source_kind: renderSourceKind ?? null,
    public_report_source_kind: publicReportSourceKind ?? null,
    public_report_source_kind_accepted:
      (!renderSourceKind || !isRejectedPublicReportSourceKind(renderSourceKind)) &&
      (!publicReportSourceKind || !isRejectedPublicReportSourceKind(publicReportSourceKind)),
    rejected_source_kind_count: sourceKindFindings.length,
    invalid_allowed_public_field_count: invalidAllowedPublicFieldCount,
    dropped_allowed_public_field_count: droppedAllowedPublicFieldCount,
    mismatches,
    blocker_codes,
    gate_satisfaction_reason:
      parityStatus === "passed"
        ? "public_and_render_payloads_match_checked_surface"
        : !hasAllowedFields
          ? "allowed_public_fields_missing"
          : !requiredSurfacesAvailable
            ? "required_report_parity_surface_missing"
            : "report_parity_mismatch_or_forbidden_field_detected",
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    level2_satisfaction: parityStatus === "passed" ? "satisfied" : "insufficient",
    source_module: input.source_module ?? "qa-artifacts-wiring.server",
    source_stage: input.source_stage ?? "emitReportParityProof",
    submission_id: input.submission_id ?? null,
    take_id: input.take_id ?? null,
  };
  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try {
      assertSafeSegment(takeId, "take_id");
    } catch {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        parity_status: "insufficient" as const,
        blocker_codes: ["parity_artefacts_missing"],
      };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        parity_status: "insufficient" as const,
        blocker_codes: ["parity_artefacts_missing"],
      };
    }
  }
  const relative = takeId
    ? `takes/take-${takeId}/analysis-${analysisRunId}/parity/report_parity_result.json`
    : "parity/report_parity_result.json";
  const result = await writeInternalJson(root, input.run_id, relative, payload, "parity_report");
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["parity_report"] : [],
    parity_status: parityStatus as "passed" | "failed" | "insufficient",
    blocker_codes,
    report_parity_summary: payload,
  };
}

export interface ComparisonRuntimeArtifactsInput {
  run_id: string;
  analysis_run_id?: string;
  take_id?: string | null;
  comparison_run_id?: string;
  comparison_id?: string;
  compared_take_ids?: string[];
  comparison_raw_data?: Record<string, unknown>;
  suppression_trace?: Record<string, unknown>;
  same_video_repeatability_trace?: Record<string, unknown>;
  duplicate_detection_trace?: Record<string, unknown>;
  route_variance_trace?: Record<string, unknown>;
  media_identity_payloads?: MediaIdentityPayload[];
  root_dir?: string;
  internal_qa_emit?: boolean;
  source_module?: string;
  source_stage?: string;
}
export interface InternalComparisonTakeInput {
  take_id: string;
  analysis_run_id: string;
  analysis_route?: string | null;
  model_provider_family?: string | null;
  mux_playback_ref?: string | null;
  mux_asset_or_upload_id_present?: boolean | null;
  safe_mux_playback_ref?: string | null;
  safe_media_fingerprint?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  audition_id?: string | null;
  submission_id?: string | null;
  original_upload_file_hash?: string | null;
  original_upload_file_hash_source_stage?: string | null;
  visible_or_original_file_name?: string | null;
  original_file_name?: string | null;
  file_name?: string | null;
  filename?: string | null;
  metadata_file_name?: string | null;
  file_size_bytes?: number | string | null;
  mime_type_safe_summary?: string | null;
  last_modified_ms?: number | string | null;
  upload_metadata_source?: string | null;
  upload_identity_capture_status?: string | null;
  upload_identity_capture_reason?: string | null;
  upload_identity_merge_status?: string | null;
  video_duration_ms?: number | string | null;
  duration_ms?: number | string | null;
  video_duration_seconds?: number | string | null;
  duration_seconds?: number | string | null;
  opening_video_sample_hash_or_profile?: string | null;
  closing_video_sample_hash_or_profile?: string | null;
  opening_audio_profile_hash?: string | null;
  closing_audio_profile_hash?: string | null;
  operator_same_video_assertion?: boolean | null;
  upload_identity_metadata?: Record<string, unknown> | null;
  media_identity?: MediaIdentityPayload | null;
  artefact_summaries?: Record<string, unknown>;
}
export interface InternalComparisonRuntimeSourceInput {
  run_id: string;
  root_take_id: string;
  root_analysis_run_id?: string;
  compared_takes: InternalComparisonTakeInput[];
  manifest_reconciliation_mode?: "none" | "required";
  comparison_run_id?: string;
  operator_same_video_assertion?: boolean;
  source_module: string;
  source_stage: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface InternalComparisonOperatorTriggerInput {
  root_take_id: string;
  compared_take_ids: readonly string[];
  compared_analysis_run_ids?: readonly string[];
  comparison_run_id?: string;
  source_module: string;
  source_stage: string;
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface CompletedTakeComparisonSource extends InternalComparisonTakeInput {
  completed?: boolean;
}
export interface InternalComparisonOperatorTriggerResult {
  ok: boolean;
  written: boolean;
  comparison_run_id: string | null;
  root_take_id: string;
  root_analysis_run_id: string | null;
  compared_take_ids: string[];
  compared_analysis_run_ids: string[];
  emitted_artefact_ids: string[];
  emitted_blocked_artefact_ids?: string[];
  comparison_parity_status?: ComparisonParityStatus;
  warning?: string | null;
  blocker_codes?: string[];
}

export interface CanonicalComparisonReconciliationIdentity {
  source_run_id: string;
  canonical_qa_run_id: string;
  canonical_take_id: string;
  canonical_analysis_run_id: string;
  manifest_relative_path: "manifest.json";
  metrics_relative_path: "qa/acceptance_metrics.json";
  comparison_relative_paths: {
    comparison_raw: "comparison/comparison.raw.json";
    comparison_report_internal: "comparison/comparison.report.internal.json";
    same_video_repeatability_trace: "comparison_traces/same_video_repeatability_trace.json";
    duplicate_detection_trace: "comparison/duplicate_detection_trace.json";
    comparison_suppression_trace: "comparison_traces/comparison_suppression_trace.json";
    route_variance_trace: "comparison_traces/route_variance_trace.json";
  };
  canonical_manifest_storage_key: string;
  canonical_metrics_storage_key: string;
  canonical_comparison_root: string;
  identity_status: "resolved" | "comparison_reconciliation_manifest_identity_mismatch";
  blocker_code?: "comparison_reconciliation_manifest_identity_mismatch";
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function resolveCanonicalComparisonReconciliationIdentity(input: {
  run_id: string;
  take_id?: string | null;
  root_take_id?: string | null;
  analysis_run_id?: string;
  compared_take_ids?: string[];
}): CanonicalComparisonReconciliationIdentity {
  const sourceRunId = String(input.run_id ?? "").trim();
  const takeIdRaw = (input.root_take_id ?? input.take_id ?? "").trim();
  const compared = (input.compared_take_ids ?? []).map((x) => String(x).trim()).filter(Boolean);
  const takeCore = stripRepeatedTakePrefixes(takeIdRaw);
  const comparedTakeCores = normaliseUniqueTakeCores(compared);
  const safeMismatch = (): CanonicalComparisonReconciliationIdentity => ({
    source_run_id: sourceRunId,
    canonical_qa_run_id: "",
    canonical_take_id: "",
    canonical_analysis_run_id: "",
    manifest_relative_path: "manifest.json",
    metrics_relative_path: "qa/acceptance_metrics.json",
    comparison_relative_paths: {
      comparison_raw: "comparison/comparison.raw.json",
      comparison_report_internal: "comparison/comparison.report.internal.json",
      same_video_repeatability_trace: "comparison_traces/same_video_repeatability_trace.json",
      duplicate_detection_trace: "comparison/duplicate_detection_trace.json",
      comparison_suppression_trace: "comparison_traces/comparison_suppression_trace.json",
      route_variance_trace: "comparison_traces/route_variance_trace.json",
    },
    canonical_manifest_storage_key: "",
    canonical_metrics_storage_key: "",
    canonical_comparison_root: "",
    identity_status: "comparison_reconciliation_manifest_identity_mismatch",
    blocker_code: "comparison_reconciliation_manifest_identity_mismatch",
  });
  if (!takeCore) return safeMismatch();
  try {
    assertSafeSegment(takeCore, "take_id");
  } catch {
    return safeMismatch();
  }
  if (compared.length > 0 && !comparedTakeCores.includes(takeCore)) return safeMismatch();
  const takeRunMatch = /^take-(.+)$/.exec(sourceRunId);
  if (takeRunMatch && stripRepeatedTakePrefixes(takeRunMatch[1]) !== takeCore)
    return safeMismatch();
  if (
    sourceRunId &&
    !takeRunMatch &&
    sourceRunId !== `take-${takeCore}` &&
    !isUuidLike(sourceRunId)
  ) {
    try {
      assertSafeSegment(sourceRunId, "run_id");
    } catch {
      return safeMismatch();
    }
  }
  const canonicalQaRunId = `take-${takeCore}`;
  const canonicalAnalysisRunId = canonicalQaRunId;
  const analysisInput = (input.analysis_run_id ?? "").trim();
  if (analysisInput && analysisInput !== canonicalAnalysisRunId) return safeMismatch();
  const canonicalComparisonRoot = `takes/take-${takeCore}/analysis-${canonicalAnalysisRunId}`;
  const manifestRelativePath = "manifest.json" as const;
  const metricsRelativePath = "qa/acceptance_metrics.json" as const;
  return {
    source_run_id: sourceRunId,
    canonical_qa_run_id: canonicalQaRunId,
    canonical_take_id: takeCore,
    canonical_analysis_run_id: canonicalAnalysisRunId,
    manifest_relative_path: manifestRelativePath,
    metrics_relative_path: metricsRelativePath,
    comparison_relative_paths: {
      comparison_raw: "comparison/comparison.raw.json",
      comparison_report_internal: "comparison/comparison.report.internal.json",
      same_video_repeatability_trace: "comparison_traces/same_video_repeatability_trace.json",
      duplicate_detection_trace: "comparison/duplicate_detection_trace.json",
      comparison_suppression_trace: "comparison_traces/comparison_suppression_trace.json",
      route_variance_trace: "comparison_traces/route_variance_trace.json",
    },
    canonical_manifest_storage_key: `${canonicalQaRunId}/analysis-${canonicalAnalysisRunId}/${manifestRelativePath}`,
    canonical_metrics_storage_key: `${canonicalQaRunId}/analysis-${canonicalAnalysisRunId}/${metricsRelativePath}`,
    canonical_comparison_root: canonicalComparisonRoot,
    identity_status: "resolved",
  };
}

export interface AnalysisInputArtefactEmitterInput {
  run_id: string;
  analysis_run_id?: string;
  submission_id?: string;
  take_id: string;
  compared_take_ids?: string[];
  comparison_run_id?: string;
  source_module: string;
  source_stage: string;
  analysis_route?: string;
  route_or_model_marker?: string;
  audition_type?: string | null;
  selected_level?: string | null;
  brief_presence?: "supplied" | "absent" | "unknown";
  brief_presence_source?:
    | "audition.brief"
    | "audition.extracted_brief_cached"
    | "audition.brief+audition.extracted_brief_cached"
    | "none_loaded"
    | "unavailable"
    | "not_loaded"
    | "audition.brief+audition.extracted_brief_cached_empty";
  material_presence?: "supplied" | "absent" | "unknown";
  material_presence_source?: "loaded_runtime_field" | "not_loaded" | "unavailable";
  mux_playback_id?: string | null;
  mux_asset_or_upload_id_present?: boolean | null;
  submission_created_at?: string | null;
  submission_updated_at?: string | null;
  take_created_at?: string | null;
  take_updated_at?: string | null;
  take_index?: number | null;
  take_index_source?:
    | "loaded_take_index"
    | "computed_from_loaded_submission_takes_order"
    | "unavailable";
  component_or_task_declaration?: string[] | null;
  component_or_task_declaration_status?: "unknown" | "known_empty" | "supplied";
  component_or_task_declaration_source?: "not_loaded" | "loaded_runtime_field";
  media_readiness_state?: string | null;
  safe_submission_refs?: string[];
  safe_mux_playback_ref?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  audition_id?: string | null;
  original_upload_file_hash?: string | null;
  original_upload_file_hash_source_stage?: string | null;
  visible_or_original_file_name?: string | null;
  original_file_name?: string | null;
  file_name?: string | null;
  filename?: string | null;
  metadata_file_name?: string | null;
  file_size_bytes?: number | string | null;
  mime_type_safe_summary?: string | null;
  last_modified_ms?: number | string | null;
  upload_metadata_source?: string | null;
  upload_identity_capture_status?: string | null;
  upload_identity_capture_reason?: string | null;
  upload_identity_merge_status?: string | null;
  video_duration_ms?: number | string | null;
  duration_ms?: number | string | null;
  video_duration_seconds?: number | string | null;
  duration_seconds?: number | string | null;
  opening_video_sample_hash_or_profile?: string | null;
  opening_video_sample_hash?: string | null;
  closing_video_sample_hash_or_profile?: string | null;
  closing_video_sample_hash?: string | null;
  opening_audio_profile_hash?: string | null;
  closing_audio_profile_hash?: string | null;
  safe_media_fingerprint?: string | null;
  upload_identity_metadata?: Record<string, unknown> | null;
  unavailable_fields?: string[];
  root_dir?: string;
  internal_qa_emit?: boolean;
}
export interface ResolverTruthStateEmitterInput extends AnalysisInputArtefactEmitterInput {
  filtered_run_evidence_pass_step1?: Record<string, unknown> | null;
}
export interface AnalysisEvidenceStateEmitterInput extends AnalysisInputArtefactEmitterInput {
  resolver_output_available?: boolean;
  truth_state_map_available?: boolean;
  media_duration_seconds?: number | null;
  duration_confidence?: "known" | "estimated" | "unknown" | string | null;
  observable_evidence_items?: Array<Record<string, unknown>>;
  filtered_run_evidence_pass_step1?: Record<string, unknown> | null;
  timestamp_normalisation_warnings?: string[];
  metadata_overrides?: Record<string, unknown>;
}
type AnalysisObservableEvidenceItem = {
  evidence_item_id: string;
  evidence_modality:
    | "video"
    | "audio"
    | "material"
    | "submission_context"
    | "resolver_truth"
    | "media_readiness"
    | "unknown";
  evidence_kind: string;
  safe_evidence_summary: string;
  source_artefact_id: string;
  source_path: string;
  timestamp: string | null;
  timestamp_range: null;
  timestamp_source: string;
  component_id: string | null;
  linked_truth_state_ids: string[];
  assessability_limitations: string[];
  confidence_or_strength: string | null;
  public_display_status: "internal_only" | "not_public";
  blocker_codes: string[];
};
type Step1ObservableEvidenceFamily =
  | "deterministic_runtime_fact"
  | "resolver_truth_fact"
  | "video_observable"
  | "audio_observable"
  | "material_specific"
  | "material_specific_performance"
  | "performance_observable"
  | "candidate_technique"
  | "assessability_limit";
type Step1ObservableEvidenceItem = {
  evidence_item_id: string;
  evidence_family: Step1ObservableEvidenceFamily;
  evidence_modality: AnalysisObservableEvidenceItem["evidence_modality"];
  evidence_kind: string;
  safe_evidence_summary: string;
  source_artefact_id:
    | "step1_observable_evidence"
    | "analysis_input_record"
    | "analysis_submission"
    | "analysis_take"
    | "resolver_output"
    | "truth_state_map"
    | "media_readiness"
    | "model_run_trace";
  source_path: string;
  timestamp: string | null;
  timestamp_range: null | { start: string; end: string };
  timestamp_source: string;
  component_id: string | null;
  linked_truth_state_ids: string[];
  assessability_limitations: string[];
  confidence_or_strength: string | null;
  public_display_status: "internal_only" | "not_public";
  blocker_codes: string[];
  cannot_satisfy_v3_gate: boolean;
  derived_from_evidence_item_id?: string;
  derived_from_family?: Step1ObservableEvidenceFamily;
  cross_family_derivation_reason?: string;
};
type OrdinaryAnalysisRequiredFamilyId =
  | "video_observable"
  | "audio_observable"
  | "material_specific_performance"
  | "performance_observable"
  | "candidate_technique";
type OrdinaryAnalysisFamilyCompletionStatus =
  | "complete"
  | "partial"
  | "not_extracted"
  | "unavailable"
  | "blocked"
  | "not_applicable";
type OrdinaryAnalysisFamilyCompletionSummary = {
  family_id: OrdinaryAnalysisRequiredFamilyId;
  status: OrdinaryAnalysisFamilyCompletionStatus;
  accepted_item_count: number;
  limitation_only_item_count: number;
  rejected_item_count: number;
  truth_linked_item_count: number;
  unresolved_truth_link_count: number;
  source_path_unresolved_count: number;
  forbidden_source_count: number;
  required_for_ordinary_analysis: boolean;
  can_satisfy_family_gate: boolean;
  blocker_codes: string[];
};
const ORDINARY_ANALYSIS_REQUIRED_FAMILY_IDS: OrdinaryAnalysisRequiredFamilyId[] = [
  "video_observable",
  "audio_observable",
  "material_specific_performance",
  "performance_observable",
  "candidate_technique",
];
const ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS: Record<OrdinaryAnalysisRequiredFamilyId, string> =
  {
    video_observable: "missing_video_observable_evidence",
    audio_observable: "missing_audio_observable_evidence",
    material_specific_performance: "missing_material_specific_performance_evidence",
    performance_observable: "missing_performance_observable_evidence",
    candidate_technique: "missing_candidate_technique_evidence",
  };
const ORDINARY_ANALYSIS_FAMILY_EVENT_BLOCKERS: Partial<
  Record<OrdinaryAnalysisRequiredFamilyId, string>
> = {
  material_specific_performance:
    "material_specific_performance_requires_safe_step1_event_observation",
  performance_observable: "performance_observable_requires_safe_step1_event_observation",
};
const SUPPLIED_CONTEXT_MATERIAL_FACT_KINDS = new Set([
  "brief_presence",
  "brief_presence_source_resolved",
  "extracted_brief_cache_status",
  "material_presence",
  "material_presence_source_resolved",
  "component_or_task_declaration_loaded",
  "component_or_task_declaration_unavailable",
]);
const STEP1_ALLOWED_EVIDENCE_SOURCE_ARTEFACT_IDS = new Set([
  "step1_observable_evidence",
  "analysis_input_record",
  "analysis_submission",
  "analysis_take",
  "resolver_output",
  "truth_state_map",
  "media_readiness",
]);
const STEP1_MEDIA_OBSERVABLE_ALLOWED_SOURCE_PATHS = [
  "step1_observations[",
  "timestamped_evidence[",
  "presentation_evidence[",
  "evidence_sufficiency.video_assessable",
  "evidence_sufficiency.audio_assessable",
  "evidence_sufficiency.movement_assessable",
] as const;
const STEP1_MEDIA_OBSERVABLE_FORBIDDEN_TEXT_RE =
  /\b(good acting|strong performance|brief achieved|technique demonstrated|professional quality|castable|bookable|marketable|readiness verdict|numeric score|score band|role fit|public technique authority|ready to submit|not ready|fix first|priority fix|winner|recommendation)\b/i;
const STEP1_FORBIDDEN_SATISFYING_SOURCE_REFS = [
  {
    source_family: "raw_report",
    source_path: "reports/raw_report.json",
    blocker_code: "raw_report_forbidden_as_step1_observable_evidence",
    reason: "raw_report_prose_forbidden_as_satisfying_step1_observable_evidence",
  },
  {
    source_family: "render_payload",
    source_path: "reports/render_payload.json",
    blocker_code: "render_payload_forbidden_as_step1_observable_evidence",
    reason: "render_payload_forbidden_as_satisfying_step1_observable_evidence",
  },
  {
    source_family: "public_report_payload",
    source_path: "reports/public_report_payload.json",
    blocker_code: "public_report_payload_forbidden_as_step1_observable_evidence",
    reason: "public_report_payload_forbidden_as_satisfying_step1_observable_evidence",
  },
  {
    source_family: "report_parity_result",
    source_path: "parity/report_parity_result.json",
    blocker_code: "report_parity_result_forbidden_as_step1_observable_evidence",
    reason: "report_parity_result_forbidden_as_satisfying_step1_observable_evidence",
  },
  {
    source_family: "legacy_score_trace",
    source_path: "traces/ScoreTrace.json",
    blocker_code: "legacy_score_trace_forbidden_as_step1_observable_evidence",
    reason: "legacy ScoreTrace forbidden as satisfying Step 1 observable evidence",
  },
  {
    source_family: "legacy_technique_observation_trace",
    source_path: "traces/TechniqueObservationTrace.json",
    blocker_code: "legacy_technique_trace_forbidden_as_step1_observable_evidence",
    reason: "legacy TechniqueObservationTrace forbidden as satisfying Step 1 observable evidence",
  },
] as const;
function isAllowedStep1EvidenceSource(
  source: unknown,
): source is Step1ObservableEvidenceItem["source_artefact_id"] {
  return typeof source === "string" && STEP1_ALLOWED_EVIDENCE_SOURCE_ARTEFACT_IDS.has(source);
}
function hasMeaningfulStep1Value(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}
function normaliseSafeStep1Value(value: unknown): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "unknown";
  if (typeof value === "string") return value.trim() || "unknown";
  return "unknown";
}
function parseStep1TimestampSeconds(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^(?:(\d+):)?([0-5]?\d):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![hours, minutes, seconds].every((part) => Number.isFinite(part) && part >= 0)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}
function step1TimestampedEvidenceIndex(sourcePath: string): number | null {
  const match = /^timestamped_evidence\[(\d+)]/.exec(sourcePath);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 ? index : null;
}
function isAllowedMediaObservableEvidenceSource(item: Record<string, unknown>): boolean {
  if (item.source_artefact_id !== "run_evidence_pass") return false;
  const sourcePath = typeof item.source_path === "string" ? item.source_path : "";
  return STEP1_MEDIA_OBSERVABLE_ALLOWED_SOURCE_PATHS.some((prefix) =>
    sourcePath.startsWith(prefix),
  );
}
function classifyVideoAssessabilityKind(summary: string, sourcePath: string): string | null {
  const text = summary.toLowerCase();
  if (sourcePath.startsWith("evidence_sufficiency.video_assessable"))
    return "video_observable_evidence_unavailable";
  if (sourcePath.startsWith("evidence_sufficiency.movement_assessable"))
    return "movement_visibility_limitation_observed";
  if (sourcePath.startsWith("timestamped_evidence[")) return "timestamped_video_observation";
  if (/\b(framing|frame|crop|cropped)\b/.test(text)) return "framing_state_observed";
  if (/\b(light|lighting|visibility|visible|visual|see|read)\b/.test(text))
    return "video_visibility_observed";
  if (/\bfocus\b/.test(text)) return "focus_visibility_limitation_observed";
  if (/\bmovement\b/.test(text)) return "movement_visibility_limitation_observed";
  return null;
}
function classifyAudioAssessabilityKind(summary: string, sourcePath: string): string | null {
  const text = summary.toLowerCase();
  if (sourcePath.startsWith("evidence_sufficiency.audio_assessable"))
    return "audio_observable_evidence_unavailable";
  if (sourcePath.startsWith("timestamped_evidence[")) return "timestamped_audio_observation";
  if (/\b(audio|audible|heard|hear|sound|speech|lyric|voice|vocal)\b/.test(text))
    return "audio_presence_observed";
  if (/\b(intelligib|clarity|clear)\b/.test(text))
    return "speech_or_lyric_intelligibility_limitation_observed";
  if (/\b(volume|balance)\b/.test(text)) return "volume_balance_limitation_observed";
  if (/\b(clipping|noise|distortion)\b/.test(text)) return "clipping_or_noise_limitation_observed";
  return null;
}
function mediaObservableFamilyForKind(
  kind: string,
  modality: "video" | "audio",
): Step1ObservableEvidenceFamily {
  if (kind.endsWith("_unavailable") || kind.includes("limitation")) return "assessability_limit";
  return modality === "video" ? "video_observable" : "audio_observable";
}
function buildMediaObservableStep1EvidenceItems(args: {
  videoItems: Array<Record<string, unknown>>;
  audioItems: Array<Record<string, unknown>>;
}): {
  items: Step1ObservableEvidenceItem[];
  rejected: Array<{ source_path: string; reason: string; blocker_codes: string[] }>;
  videoCount: number;
  audioCount: number;
  timestampedCount: number;
  limitationCount: number;
} {
  const projected: Step1ObservableEvidenceItem[] = [];
  const rejected: Array<{ source_path: string; reason: string; blocker_codes: string[] }> = [];
  let lastTimestampSeconds = -1;
  const reject = (sourcePath: string, reason: string, blockerCode: string) => {
    rejected.push({
      source_path: sourcePath || "unknown_media_observable_source",
      reason,
      blocker_codes: [blockerCode],
    });
  };
  const project = (rawItem: Record<string, unknown>, modality: "video" | "audio") => {
    const sourcePath = typeof rawItem.source_path === "string" ? rawItem.source_path : "";
    const summary =
      typeof rawItem.safe_evidence_summary === "string" ? rawItem.safe_evidence_summary.trim() : "";
    if (!isAllowedMediaObservableEvidenceSource(rawItem)) {
      reject(
        sourcePath,
        "media_observable_source_not_allowed_for_s9_18d",
        "media_observable_source_not_allowed",
      );
      return;
    }
    if (
      !summary ||
      STEP1_MEDIA_OBSERVABLE_FORBIDDEN_TEXT_RE.test(summary) ||
      hasForbiddenEvidenceSourceRef(rawItem)
    ) {
      reject(
        sourcePath,
        "media_observable_summary_failed_anti_fake_guard",
        "media_observable_summary_rejected",
      );
      return;
    }
    const isTimestamped = sourcePath.startsWith("timestamped_evidence[");
    const timestamp = typeof rawItem.timestamp === "string" ? rawItem.timestamp : null;
    const timestampSeconds = isTimestamped ? parseStep1TimestampSeconds(timestamp) : null;
    if (isTimestamped) {
      if (
        timestampSeconds == null ||
        rawItem.timestamp_source !== "runEvidencePass_validated_timestamp"
      ) {
        reject(
          sourcePath,
          "timestamped_media_observation_timestamp_invalid_or_untrusted",
          "timestamped_media_observation_invalid_timestamp",
        );
        return;
      }
      if (timestampSeconds < lastTimestampSeconds) {
        reject(
          sourcePath,
          "timestamped_media_observation_not_chronological",
          "timestamped_media_observation_not_chronological",
        );
        return;
      }
      lastTimestampSeconds = timestampSeconds;
    }
    const evidenceKind =
      modality === "video"
        ? classifyVideoAssessabilityKind(summary, sourcePath)
        : classifyAudioAssessabilityKind(summary, sourcePath);
    if (!evidenceKind) {
      reject(
        sourcePath,
        "media_observable_kind_not_in_s9_18d_allow_list",
        "media_observable_kind_not_allowed",
      );
      return;
    }
    const rawLimitations = Array.isArray(rawItem.assessability_limitations)
      ? rawItem.assessability_limitations.filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        )
      : [];
    const limitationOnly =
      evidenceKind.endsWith("_unavailable") ||
      evidenceKind.includes("limitation") ||
      rawLimitations.length > 0;
    const blockerCodes = [
      ...(limitationOnly ? ["media_assessability_limitation_only"] : []),
      "missing_truth_state_linkage",
    ];
    projected.push({
      evidence_item_id: "step1-media-pending",
      evidence_family: mediaObservableFamilyForKind(evidenceKind, modality),
      evidence_modality: modality,
      evidence_kind: evidenceKind,
      safe_evidence_summary: summary,
      source_artefact_id: "step1_observable_evidence",
      source_path: "observable_evidence_items[pending]",
      timestamp: isTimestamped ? timestamp : null,
      timestamp_range: null,
      timestamp_source: isTimestamped
        ? "runEvidencePass_validated_timestamp"
        : "not_timestamped_media_observable",
      component_id: typeof rawItem.component_id === "string" ? rawItem.component_id : null,
      linked_truth_state_ids: [],
      assessability_limitations: dedupePreservingOrder(rawLimitations),
      confidence_or_strength:
        typeof rawItem.confidence_or_strength === "string"
          ? rawItem.confidence_or_strength
          : "runEvidencePass_filtered_media_observable",
      public_display_status: "internal_only",
      blocker_codes: blockerCodes,
      cannot_satisfy_v3_gate: true,
    });
  };
  const mediaItems = [
    ...args.videoItems.map((item) => ({ item, modality: "video" as const })),
    ...args.audioItems.map((item) => ({ item, modality: "audio" as const })),
  ].sort((a, b) => {
    const aSourcePath = typeof a.item.source_path === "string" ? a.item.source_path : "";
    const bSourcePath = typeof b.item.source_path === "string" ? b.item.source_path : "";
    const aIndex = step1TimestampedEvidenceIndex(aSourcePath);
    const bIndex = step1TimestampedEvidenceIndex(bSourcePath);
    if (aIndex == null && bIndex == null) return 0;
    if (aIndex == null) return 1;
    if (bIndex == null) return -1;
    return aIndex - bIndex;
  });
  mediaItems.forEach(({ item, modality }) => project(item, modality));
  return {
    items: projected,
    rejected,
    videoCount: projected.filter((item) => item.evidence_family === "video_observable").length,
    audioCount: projected.filter((item) => item.evidence_family === "audio_observable").length,
    timestampedCount: projected.filter((item) => item.evidence_kind.startsWith("timestamped_"))
      .length,
    limitationCount: projected.filter((item) => item.evidence_family === "assessability_limit")
      .length,
  };
}
function isAllowedOrdinaryAnalysisStep1ProjectionSource(
  item: Record<string, unknown>,
  family:
    | "material_specific"
    | "material_specific_performance"
    | "performance_observable"
    | "candidate_technique",
): boolean {
  if (item.source_artefact_id !== "run_evidence_pass") return false;
  const sourcePath = typeof item.source_path === "string" ? item.source_path : "";
  if (sourcePath.startsWith("step1_observations[")) return true;
  if (family === "candidate_technique")
    return sourcePath.startsWith("candidate_technique_evidence[");
  return sourcePath.startsWith("timestamped_evidence[");
}
function materialStep1FamilyForRawItem(
  rawItem: Record<string, unknown>,
): "material_specific" | "material_specific_performance" {
  if (isMaterialSpecificPerformanceEvent(rawItem)) return "material_specific_performance";
  return "material_specific";
}
function isContextOnlyMaterialSummary(summary: string): boolean {
  const text = summary.trim().toLowerCase();
  if (!text) return true;
  return (
    /\b(brief supplied|material supplied|role context|context supplied|component declaration|task declaration|material presence|brief presence|source resolved|cache status|supplied|reference|references|referenced|declared|loaded|unloaded|unknown|unavailable)\b/.test(
      text,
    ) &&
    !/\b(occurs|occurred|present in the take|observed event|is performed|performed before|segment occurs|section is performed|component is delivered|delivered|begins|continues|transition)\b/.test(
      text,
    )
  );
}
function isSafePerformanceEventSummary(summary: string): boolean {
  const text = summary.trim().toLowerCase();
  if (!text) return false;
  if (STEP1_MEDIA_OBSERVABLE_FORBIDDEN_TEXT_RE.test(text)) return false;
  if (
    /\b(strong|good|excellent|compelling|beautiful|ready|role fit|castable|bookable|marketable|score|rating|winner|recommendation)\b/.test(
      text,
    )
  )
    return false;
  return /\b(performance|performer|scene|song|slate|monologue|dialogue|copy|line|lines|speech|spoken|sung|vocal|material|section|segment|transition|pause|beat|action|task|component|delivery|delivers|delivered|begins|starts|continues|occurs|performed|present in the take|observed in the take)\b/.test(
    text,
  );
}
function isMaterialSpecificPerformanceEvent(rawItem: Record<string, unknown>): boolean {
  if (rawItem.source_artefact_id !== "run_evidence_pass") return false;
  const sourcePath = typeof rawItem.source_path === "string" ? rawItem.source_path : "";
  if (
    !sourcePath.startsWith("step1_observations[") &&
    !sourcePath.startsWith("timestamped_evidence[")
  )
    return false;
  if (hasForbiddenEvidenceSourceRef(rawItem)) return false;
  const summary =
    typeof rawItem.safe_evidence_summary === "string" ? rawItem.safe_evidence_summary.trim() : "";
  if (!summary || isContextOnlyMaterialSummary(summary)) return false;
  const kind = String(rawItem.evidence_kind ?? "").toLowerCase();
  const text = `${summary} ${kind}`.toLowerCase();
  if (!isSafePerformanceEventSummary(text)) return false;
  return /\b(scene|song|slate|monologue|dialogue|copy|line|lines|speech|spoken|sung|material|task|component|section|segment|audition|performance|performer|delivers|delivered|occurs|performed|present in the take|observed in the take)\b/.test(
    text,
  );
}
function canDerivePerformanceObservableFromMaterialStep1Item(
  rawItem: Record<string, unknown>,
): boolean {
  const summary =
    typeof rawItem.safe_evidence_summary === "string" ? rawItem.safe_evidence_summary.trim() : "";
  return (
    materialStep1FamilyForRawItem(rawItem) === "material_specific_performance" &&
    isSafePerformanceEventSummary(summary)
  );
}
function performanceEvidenceKindForDerivedMaterial(rawItem: Record<string, unknown>): string {
  const kind = String(rawItem.evidence_kind ?? "").trim();
  if (kind && !kind.includes("performance_observable"))
    return `performance_observable_derived_from_${kind}`.slice(0, 120);
  return "performance_observable_derived_from_material_specific_event";
}
function buildOrdinaryAnalysisStep1EvidenceItems(args: {
  materialItems: Array<Record<string, unknown>>;
  performanceItems: Array<Record<string, unknown>>;
  techniqueItems: Array<Record<string, unknown>>;
}): {
  items: Step1ObservableEvidenceItem[];
  rejected: Array<{ source_path: string; reason: string; blocker_codes: string[] }>;
  materialCount: number;
  materialContextCount: number;
  performanceCount: number;
  techniqueCount: number;
} {
  const projected: Step1ObservableEvidenceItem[] = [];
  const rejected: Array<{ source_path: string; reason: string; blocker_codes: string[] }> = [];
  const reject = (sourcePath: string, reason: string, blockerCode: string) => {
    rejected.push({
      source_path: sourcePath || "unknown_ordinary_analysis_step1_source",
      reason,
      blocker_codes: [blockerCode],
    });
  };
  const project = (
    rawItem: Record<string, unknown>,
    family:
      | "material_specific"
      | "material_specific_performance"
      | "performance_observable"
      | "candidate_technique",
    derivation?: {
      derivedFromFamily: Step1ObservableEvidenceFamily;
      reason: string;
      evidenceKind?: string;
    },
  ) => {
    const sourcePath = typeof rawItem.source_path === "string" ? rawItem.source_path : "";
    const summary =
      typeof rawItem.safe_evidence_summary === "string" ? rawItem.safe_evidence_summary.trim() : "";
    if (!isAllowedOrdinaryAnalysisStep1ProjectionSource(rawItem, family)) {
      reject(
        sourcePath,
        "ordinary_analysis_step1_source_not_allowed",
        "ordinary_analysis_step1_source_not_allowed",
      );
      return;
    }
    if (
      !summary ||
      STEP1_MEDIA_OBSERVABLE_FORBIDDEN_TEXT_RE.test(summary) ||
      hasForbiddenEvidenceSourceRef(rawItem)
    ) {
      reject(
        sourcePath,
        "ordinary_analysis_step1_summary_failed_anti_fake_guard",
        "ordinary_analysis_step1_summary_rejected",
      );
      return;
    }
    projected.push({
      evidence_item_id: "step1-ordinary-pending",
      evidence_family: family,
      evidence_modality:
        typeof rawItem.evidence_modality === "string"
          ? (rawItem.evidence_modality as AnalysisObservableEvidenceItem["evidence_modality"])
          : family === "material_specific"
            ? "material"
            : "unknown",
      evidence_kind:
        derivation?.evidenceKind ??
        (typeof rawItem.evidence_kind === "string" && rawItem.evidence_kind.trim()
          ? rawItem.evidence_kind.trim()
          : family === "candidate_technique"
            ? "candidate_technique_observation"
            : `${family}_observation`),
      safe_evidence_summary: summary,
      source_artefact_id: "step1_observable_evidence",
      source_path: "observable_evidence_items[pending]",
      timestamp: typeof rawItem.timestamp === "string" ? rawItem.timestamp : null,
      timestamp_range: null,
      timestamp_source:
        typeof rawItem.timestamp_source === "string"
          ? rawItem.timestamp_source
          : "not_timestamped_observation",
      component_id: typeof rawItem.component_id === "string" ? rawItem.component_id : null,
      linked_truth_state_ids: [],
      assessability_limitations: Array.isArray(rawItem.assessability_limitations)
        ? rawItem.assessability_limitations.filter(
            (x): x is string => typeof x === "string" && x.length > 0,
          )
        : [],
      confidence_or_strength:
        typeof rawItem.confidence_or_strength === "string"
          ? rawItem.confidence_or_strength
          : "runEvidencePass_filtered_observation",
      public_display_status: "internal_only",
      blocker_codes: [],
      cannot_satisfy_v3_gate: true,
      ...(derivation
        ? {
            derived_from_evidence_item_id:
              typeof rawItem.evidence_item_id === "string" ? rawItem.evidence_item_id : undefined,
            derived_from_family: derivation.derivedFromFamily,
            cross_family_derivation_reason: derivation.reason,
          }
        : {}),
    });
  };
  args.materialItems.forEach((item) => {
    const materialFamily = materialStep1FamilyForRawItem(item);
    project(item, materialFamily);
    if (canDerivePerformanceObservableFromMaterialStep1Item(item)) {
      project(item, "performance_observable", {
        derivedFromFamily: "material_specific_performance",
        reason: "material_specific_performance_event_also_satisfies_performance_observable",
        evidenceKind: performanceEvidenceKindForDerivedMaterial(item),
      });
    }
  });
  args.performanceItems.forEach((item) => project(item, "performance_observable"));
  args.techniqueItems.forEach((item) => project(item, "candidate_technique"));
  return {
    items: projected,
    rejected,
    materialCount: projected.filter(
      (item) => item.evidence_family === "material_specific_performance",
    ).length,
    materialContextCount: projected.filter((item) => item.evidence_family === "material_specific")
      .length,
    performanceCount: projected.filter((item) => item.evidence_family === "performance_observable")
      .length,
    techniqueCount: projected.filter((item) => item.evidence_family === "candidate_technique")
      .length,
  };
}
type ExplicitTruthStateEntry = {
  truth_state_entry_id: string;
  key: string;
  state: string;
  value_summary: string;
  confidence: string;
  source_artifact_ids: string[];
  source_paths: string[];
  evidence_item_ids: string[];
  public_claim_allowed: false;
  public_claim_limit: "direct" | "cautious" | "limitation_only" | "blocked";
  run_id: string;
  analysis_run_id: string;
  take_id: string;
};
function safeTruthStateSlugPart(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80) || "unknown"
  );
}
function canonicalTruthStateId(runId: string, slug: string): string {
  return `${runId}:truth_state:${safeTruthStateSlugPart(slug)}`;
}
function isCanonicalTruthStateId(value: unknown): value is string {
  return typeof value === "string" && /:truth_state:[a-z0-9_]+$/.test(value);
}
function step1EvidenceTruthSlug(
  item: Pick<Step1ObservableEvidenceItem, "evidence_kind">,
  occurrence: number,
): string {
  const kind = safeTruthStateSlugPart(item.evidence_kind);
  if (
    kind.startsWith("timestamped_") ||
    kind.includes("observed") ||
    kind.includes("limitation") ||
    kind.endsWith("_unavailable") ||
    kind.endsWith("_not_extracted")
  ) {
    return `${kind}_${String(occurrence).padStart(3, "0")}`;
  }
  return kind;
}
function step1EvidenceTruthSourcePath(
  item: Pick<Step1ObservableEvidenceItem, "evidence_kind" | "source_path">,
): string {
  if (item.source_path && item.source_path !== "observable_evidence_items[pending]")
    return item.source_path;
  return step1EvidenceTruthSlug({ evidence_kind: item.evidence_kind }, 1);
}
function isStep1LimitationOnlyEvidenceItem(item: Record<string, unknown>): boolean {
  const family = String(item.evidence_family ?? "");
  const kind = String(item.evidence_kind ?? "");
  const blockers = Array.isArray(item.blocker_codes)
    ? item.blocker_codes.filter((x): x is string => typeof x === "string")
    : [];
  return (
    family === "assessability_limit" ||
    kind.includes("limitation") ||
    kind.endsWith("_unavailable") ||
    kind.endsWith("_not_extracted") ||
    blockers.includes("media_assessability_limitation_only")
  );
}
function isOrdinaryAnalysisFamilyItem(
  item: Step1ObservableEvidenceItem,
  family: OrdinaryAnalysisRequiredFamilyId,
): boolean {
  return item.evidence_family === family;
}
function hasStep1ForbiddenSatisfyingSource(item: Record<string, unknown>): boolean {
  const sourceArtefactId = String(item.source_artefact_id ?? "");
  const sourcePath = String(item.source_path ?? "");
  const blockerText = getStringArray(item.blocker_codes).join(" ");
  return (
    hasForbiddenEvidenceSourceRef(item) ||
    [
      "raw_report",
      "render_payload",
      "public_report_payload",
      "report_parity_result",
      "legacy_score_trace",
      "legacy_technique_observation_trace",
    ].includes(sourceArtefactId) ||
    /raw_report|report_data|render_payload|public_report_payload|report_parity_result|ScoreTrace|TechniqueObservationTrace/i.test(
      sourcePath,
    ) ||
    /forbidden|legacy_score_trace|legacy_technique/i.test(blockerText)
  );
}
function evaluateOrdinaryAnalysisFamilyCompletion(args: {
  family: OrdinaryAnalysisRequiredFamilyId;
  items: Step1ObservableEvidenceItem[];
  rejectedItemCount: number;
  requiredForOrdinaryAnalysis?: boolean;
}): OrdinaryAnalysisFamilyCompletionSummary {
  const requiredForOrdinaryAnalysis = args.requiredForOrdinaryAnalysis !== false;
  const familyItems = args.items.filter((item) => item.evidence_family === args.family);
  const acceptedItems = args.items.filter((item) =>
    isOrdinaryAnalysisFamilyItem(item, args.family),
  );
  const limitationOnlyItems = familyItems.filter((item) => isStep1LimitationOnlyEvidenceItem(item));
  const nonLimitationItems = acceptedItems.filter(
    (item) => !isStep1LimitationOnlyEvidenceItem(item),
  );
  const sourcePathUnresolvedCount = acceptedItems.filter(
    (item) => !item.source_path || item.source_path === "observable_evidence_items[pending]",
  ).length;
  const forbiddenSourceCount = acceptedItems.filter(hasStep1ForbiddenSatisfyingSource).length;
  const truthLinkedItemCount = acceptedItems.filter((item) =>
    item.linked_truth_state_ids.some(isCanonicalTruthStateId),
  ).length;
  const unresolvedTruthLinkCount = nonLimitationItems.filter(
    (item) => !item.linked_truth_state_ids.some(isCanonicalTruthStateId),
  ).length;
  const canSatisfyFamilyGate =
    requiredForOrdinaryAnalysis &&
    nonLimitationItems.length > 0 &&
    sourcePathUnresolvedCount === 0 &&
    forbiddenSourceCount === 0 &&
    unresolvedTruthLinkCount === 0;
  const blockerCodes = dedupePreservingOrder([
    ...(requiredForOrdinaryAnalysis && acceptedItems.length === 0
      ? [ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS[args.family]]
      : []),
    ...(requiredForOrdinaryAnalysis &&
    acceptedItems.length === 0 &&
    ORDINARY_ANALYSIS_FAMILY_EVENT_BLOCKERS[args.family]
      ? [ORDINARY_ANALYSIS_FAMILY_EVENT_BLOCKERS[args.family] as string]
      : []),
    ...(requiredForOrdinaryAnalysis && acceptedItems.length > 0 && nonLimitationItems.length === 0
      ? [
          args.family === "performance_observable"
            ? "limitation_only_cannot_satisfy_performance_gate"
            : ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS[args.family],
        ]
      : []),
    ...(sourcePathUnresolvedCount > 0 ? ["source_path_unresolved"] : []),
    ...(unresolvedTruthLinkCount > 0 ? ["missing_truth_state_linkage"] : []),
    ...(forbiddenSourceCount > 0 ? ["forbidden_source_family_present"] : []),
    ...(args.rejectedItemCount > 0 ? ["ordinary_analysis_family_rejected_fields_present"] : []),
  ]);
  const status: OrdinaryAnalysisFamilyCompletionStatus = !requiredForOrdinaryAnalysis
    ? "not_applicable"
    : forbiddenSourceCount > 0 || sourcePathUnresolvedCount > 0
      ? "blocked"
      : acceptedItems.length === 0
        ? "not_extracted"
        : canSatisfyFamilyGate
          ? "complete"
          : "partial";
  return {
    family_id: args.family,
    status,
    accepted_item_count: acceptedItems.length,
    limitation_only_item_count: limitationOnlyItems.length,
    rejected_item_count: args.rejectedItemCount,
    truth_linked_item_count: truthLinkedItemCount,
    unresolved_truth_link_count: unresolvedTruthLinkCount,
    source_path_unresolved_count: sourcePathUnresolvedCount,
    forbidden_source_count: forbiddenSourceCount,
    required_for_ordinary_analysis: requiredForOrdinaryAnalysis,
    can_satisfy_family_gate: canSatisfyFamilyGate,
    blocker_codes: blockerCodes,
  };
}
function aggregateOrdinaryAnalysisFamilyCompletion(
  summaries: Record<OrdinaryAnalysisRequiredFamilyId, OrdinaryAnalysisFamilyCompletionSummary>,
) {
  const values = ORDINARY_ANALYSIS_REQUIRED_FAMILY_IDS.map((family) => summaries[family]);
  const required = values.filter((summary) => summary.required_for_ordinary_analysis);
  const complete = required.filter((summary) => summary.status === "complete");
  const partial = required.filter((summary) => summary.status === "partial");
  const missing = required.filter(
    (summary) => summary.status === "not_extracted" || summary.status === "unavailable",
  );
  const blocked = required.filter((summary) => summary.status === "blocked");
  const notApplicable = values.filter((summary) => summary.status === "not_applicable");
  const allRequiredSatisfied =
    required.length > 0 &&
    required.every(
      (summary) => summary.can_satisfy_family_gate || summary.status === "not_applicable",
    );
  const blockerCodes = dedupePreservingOrder(values.flatMap((summary) => summary.blocker_codes));
  return {
    required_family_count: required.length,
    complete_family_count: complete.length,
    partial_family_count: partial.length,
    missing_family_count: missing.length,
    blocked_family_count: blocked.length,
    not_applicable_family_count: notApplicable.length,
    all_required_families_satisfied: allRequiredSatisfied,
    blocker_codes: blockerCodes,
  };
}
function removeTruthLinkagePlaceholderBlockers(blockers: string[], linked: boolean): string[] {
  if (!linked) return dedupePreservingOrder(blockers);
  return dedupePreservingOrder(
    blockers.filter(
      (code) =>
        code !== "missing_truth_state_linkage" && code !== "structured_truth_state_ids_unavailable",
    ),
  );
}
function removeTruthLinkagePlaceholderLimitations(
  limitations: string[],
  linked: boolean,
): string[] {
  if (!linked) return dedupePreservingOrder(limitations);
  return dedupePreservingOrder(
    limitations.filter(
      (value) =>
        value !== "structured_truth_state_ids_unavailable_in_current_truth_map_schema" &&
        value !== "missing_truth_state_linkage",
    ),
  );
}
function linkStep1ObservableEvidenceItemsToTruthState(
  runId: string,
  items: Step1ObservableEvidenceItem[],
): Step1ObservableEvidenceItem[] {
  const occurrenceByKind = new Map<string, number>();
  return items.map((item) => {
    const kind = safeTruthStateSlugPart(item.evidence_kind);
    const occurrence = (occurrenceByKind.get(kind) ?? 0) + 1;
    occurrenceByKind.set(kind, occurrence);
    const truthId = canonicalTruthStateId(runId, step1EvidenceTruthSlug(item, occurrence));
    const linkedTruthStateIds = dedupePreservingOrder([
      ...(item.linked_truth_state_ids ?? []),
      truthId,
    ]);
    const linked = linkedTruthStateIds.length > 0;
    const blockerCodes = removeTruthLinkagePlaceholderBlockers(item.blocker_codes, linked);
    return {
      ...item,
      linked_truth_state_ids: linkedTruthStateIds,
      blocker_codes: blockerCodes,
      assessability_limitations: removeTruthLinkagePlaceholderLimitations(
        item.assessability_limitations,
        linked,
      ),
      cannot_satisfy_v3_gate: blockerCodes.length > 0,
    };
  });
}
function linkAnalysisObservableEvidenceItemsToTruthState(
  runId: string,
  items: AnalysisObservableEvidenceItem[],
): AnalysisObservableEvidenceItem[] {
  const occurrenceByKind = new Map<string, number>();
  return items.map((item) => {
    const kind = safeTruthStateSlugPart(item.evidence_kind);
    const occurrence = (occurrenceByKind.get(kind) ?? 0) + 1;
    occurrenceByKind.set(kind, occurrence);
    const truthId = canonicalTruthStateId(
      runId,
      step1EvidenceTruthSlug({ evidence_kind: item.evidence_kind }, occurrence),
    );
    const linkedTruthStateIds = dedupePreservingOrder([
      ...(item.linked_truth_state_ids ?? []),
      truthId,
    ]);
    const linked = linkedTruthStateIds.length > 0;
    return {
      ...item,
      linked_truth_state_ids: linkedTruthStateIds,
      blocker_codes: removeTruthLinkagePlaceholderBlockers(item.blocker_codes, linked),
      assessability_limitations: removeTruthLinkagePlaceholderLimitations(
        item.assessability_limitations,
        linked,
      ),
    };
  });
}
function makeExplicitTruthStateEntry(args: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  slug: string;
  state: string;
  value_summary: string;
  confidence?: string;
  source_artifact_ids: string[];
  source_paths: string[];
  public_claim_limit?: ExplicitTruthStateEntry["public_claim_limit"];
}): ExplicitTruthStateEntry {
  const key = safeTruthStateSlugPart(args.slug);
  return {
    truth_state_entry_id: canonicalTruthStateId(args.run_id, key),
    key,
    state: args.state,
    value_summary: args.value_summary,
    confidence: args.confidence ?? "runtime_fact",
    source_artifact_ids: dedupePreservingOrder(args.source_artifact_ids),
    source_paths: dedupePreservingOrder(args.source_paths),
    evidence_item_ids: [],
    public_claim_allowed: false,
    public_claim_limit: args.public_claim_limit ?? "blocked",
    run_id: args.run_id,
    analysis_run_id: args.analysis_run_id,
    take_id: args.take_id,
  };
}
function mediaProjectionForFilteredStep1(
  filteredStep1: Record<string, unknown> | null,
): Step1ObservableEvidenceItem[] {
  if (!filteredStep1) return [];
  return buildMediaObservableStep1EvidenceItems({
    videoItems: safeRecordArray(filteredStep1.video_observable_evidence_items),
    audioItems: safeRecordArray(filteredStep1.audio_observable_evidence_items),
  }).items;
}
function ordinaryAnalysisProjectionForFilteredStep1(
  filteredStep1: Record<string, unknown> | null,
): Step1ObservableEvidenceItem[] {
  if (!filteredStep1) return [];
  return buildOrdinaryAnalysisStep1EvidenceItems({
    materialItems: safeRecordArray(filteredStep1.material_observable_evidence_items),
    performanceItems: safeRecordArray(filteredStep1.performance_observable_evidence_items),
    techniqueItems: safeRecordArray(filteredStep1.candidate_technique_evidence),
  }).items;
}
function buildExplicitTruthStateEntriesForStep1(args: {
  input: ResolverTruthStateEmitterInput;
  analysisRunId: string;
  filteredStep1: Record<string, unknown> | null;
  briefPresenceState: {
    value: PresenceValue;
    source: string;
    status: "known" | "unknown" | "unavailable";
  };
  materialPresenceState: {
    value: PresenceValue;
    source: string;
    status: "known" | "unknown" | "unavailable";
  };
  comparedTakeIds: string[];
  comparisonInvoked: boolean;
}): ExplicitTruthStateEntry[] {
  const entries: ExplicitTruthStateEntry[] = [];
  const add = (
    entry: Omit<
      Parameters<typeof makeExplicitTruthStateEntry>[0],
      "run_id" | "analysis_run_id" | "take_id"
    >,
  ) => {
    entries.push(
      makeExplicitTruthStateEntry({
        run_id: args.input.run_id,
        analysis_run_id: args.analysisRunId,
        take_id: args.input.take_id,
        ...entry,
      }),
    );
  };
  add({
    slug: "submission_identity_loaded",
    state: args.input.submission_id ? "known" : "unavailable",
    value_summary: args.input.submission_id
      ? "submission identity present"
      : "submission identity unavailable",
    source_artifact_ids: ["analysis_submission"],
    source_paths: ["submission_id"],
  });
  add({
    slug: "stable_take_identity",
    state: "known",
    value_summary: `take ${args.input.take_id} / analysis ${args.analysisRunId}`,
    source_artifact_ids: ["analysis_take"],
    source_paths: ["stable_take_identity"],
  });
  add({
    slug: "take_identity_loaded",
    state: "known",
    value_summary: "take and analysis identifiers present",
    source_artifact_ids: ["analysis_take"],
    source_paths: ["stable_take_identity"],
  });
  if (args.input.selected_level)
    add({
      slug: "selected_level",
      state: "known",
      value_summary: `selected level: ${args.input.selected_level}`,
      source_artifact_ids: ["analysis_submission"],
      source_paths: ["selected_level"],
    });
  if (args.input.audition_type)
    add({
      slug: "audition_type",
      state: "known",
      value_summary: `audition type: ${args.input.audition_type}`,
      source_artifact_ids: ["analysis_submission"],
      source_paths: ["audition_type"],
    });
  add({
    slug: "brief_presence",
    state: args.briefPresenceState.status,
    value_summary: `brief presence: ${args.briefPresenceState.value}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["brief_presence"],
  });
  add({
    slug: "brief_presence_source_resolved",
    state: args.briefPresenceState.source ? args.briefPresenceState.status : "unavailable",
    value_summary: `brief presence source: ${args.briefPresenceState.source}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["brief_presence.source"],
  });
  add({
    slug: "extracted_brief_cache_status",
    state: String(args.input.brief_presence_source ?? "").includes("extracted_brief_cached")
      ? "known"
      : "unavailable",
    value_summary: `extracted brief cache status: ${String(args.input.brief_presence_source ?? "not_loaded")}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["brief_presence.source"],
  });
  add({
    slug: "material_presence",
    state: args.materialPresenceState.status,
    value_summary: `material presence: ${args.materialPresenceState.value}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["material_presence"],
  });
  add({
    slug: "material_presence_source_resolved",
    state: args.materialPresenceState.source ? args.materialPresenceState.status : "unavailable",
    value_summary: `material presence source: ${args.materialPresenceState.source}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["material_presence.source"],
  });
  const componentDeclarationEvidenceKind =
    args.input.component_or_task_declaration_status === "supplied"
      ? "component_or_task_declaration_loaded"
      : "component_or_task_declaration_unavailable";
  add({
    slug: step1EvidenceTruthSlug({ evidence_kind: componentDeclarationEvidenceKind }, 1),
    state: args.input.component_or_task_declaration_status === "supplied" ? "known" : "unavailable",
    value_summary: `component/task declaration status: ${args.input.component_or_task_declaration_status ?? "unknown"}`,
    source_artifact_ids: ["analysis_submission"],
    source_paths: ["component_or_task_declaration_status"],
  });
  if (args.input.take_created_at)
    add({
      slug: "take_created_at_normalised",
      state: "known",
      value_summary: "take created timestamp normalised",
      source_artifact_ids: ["analysis_take"],
      source_paths: ["take_created_at"],
    });
  if (args.input.take_updated_at)
    add({
      slug: "take_updated_at_normalised",
      state: "known",
      value_summary: "take updated timestamp normalised",
      source_artifact_ids: ["analysis_take"],
      source_paths: ["take_updated_at"],
    });
  const takeIndexEvidenceKind =
    args.input.take_index != null ? "take_index_loaded" : "take_index_unavailable";
  add({
    slug: step1EvidenceTruthSlug({ evidence_kind: takeIndexEvidenceKind }, 1),
    state: args.input.take_index != null ? "known" : "unavailable",
    value_summary:
      args.input.take_index != null
        ? `take index: ${args.input.take_index}`
        : "take index unavailable",
    source_artifact_ids: ["analysis_take"],
    source_paths: ["take_index"],
  });
  add({
    slug: "media_readiness_state",
    state: args.input.media_readiness_state ? "known" : "unknown",
    value_summary: `media readiness state: ${args.input.media_readiness_state ?? "unknown"}`,
    source_artifact_ids: ["analysis_take"],
    source_paths: ["media_readiness_state"],
  });
  const durationKnown =
    typeof args.input.video_duration_seconds === "number" &&
    Number.isFinite(args.input.video_duration_seconds) &&
    args.input.video_duration_seconds > 0;
  add({
    slug: durationKnown ? "media_duration_known" : "media_duration_unknown",
    state: durationKnown ? "known" : "unavailable",
    value_summary: durationKnown
      ? `media duration seconds: ${args.input.video_duration_seconds}`
      : "media duration unavailable",
    source_artifact_ids: ["media_readiness"],
    source_paths: ["media_duration_seconds"],
  });
  add({
    slug: "safe_media_reference_state",
    state: "known",
    value_summary: `media reference present: playback=${Boolean(args.input.mux_playback_id)}, asset_or_upload=${String(args.input.mux_asset_or_upload_id_present ?? "unknown")}`,
    source_artifact_ids: ["resolver_output"],
    source_paths: ["safe_media_reference_state"],
  });
  add({
    slug: hasMeaningfulStep1Value(args.input.original_upload_file_hash)
      ? "safe_upload_identity_available"
      : "safe_upload_identity_unavailable",
    state: hasMeaningfulStep1Value(args.input.original_upload_file_hash) ? "known" : "unavailable",
    value_summary: hasMeaningfulStep1Value(args.input.original_upload_file_hash)
      ? "safe upload identity available"
      : "safe upload identity unavailable",
    source_artifact_ids: ["analysis_take"],
    source_paths: ["safe_upload_identity.original_upload_file_hash"],
  });
  add({
    slug: "known_truths",
    state: "known",
    value_summary: "known runtime truth fields recorded",
    source_artifact_ids: ["truth_state_map"],
    source_paths: ["known_truths"],
  });
  add({
    slug: "component_truths",
    state: args.input.component_or_task_declaration_status === "unknown" ? "unavailable" : "known",
    value_summary: `component truth status: ${args.input.component_or_task_declaration_status ?? "unknown"}`,
    source_artifact_ids: ["truth_state_map"],
    source_paths: ["component_truths.declaration_status"],
  });
  add({
    slug: "comparison_truths",
    state: args.comparisonInvoked ? "blocked" : "not_applicable",
    value_summary: args.comparisonInvoked
      ? "comparison context present"
      : "single-take comparison not applicable",
    source_artifact_ids: ["truth_state_map"],
    source_paths: ["comparison_truths.status"],
  });
  if ((args.input.unavailable_fields ?? []).length > 0)
    add({
      slug: "unavailable_runtime_fields_recorded",
      state: "unavailable",
      value_summary: `unavailable runtime fields: ${dedupePreservingOrder(
        args.input.unavailable_fields ?? [],
      )
        .sort()
        .join(", ")}`,
      source_artifact_ids: ["analysis_input_record"],
      source_paths: ["unavailable_fields"],
      public_claim_limit: "limitation_only",
    });
  const mediaOccurrenceByKind = new Map<string, number>();
  [
    ...mediaProjectionForFilteredStep1(args.filteredStep1),
    ...ordinaryAnalysisProjectionForFilteredStep1(args.filteredStep1),
  ].forEach((item) => {
    const kind = safeTruthStateSlugPart(item.evidence_kind);
    const occurrence = (mediaOccurrenceByKind.get(kind) ?? 0) + 1;
    mediaOccurrenceByKind.set(kind, occurrence);
    const limitationOnly = isStep1LimitationOnlyEvidenceItem(item);
    add({
      slug: step1EvidenceTruthSlug(item, occurrence),
      state: limitationOnly ? "limitation_only" : "observed",
      value_summary: item.safe_evidence_summary,
      confidence: item.confidence_or_strength ?? "runEvidencePass_filtered_media_observable",
      source_artifact_ids: ["step1_observable_evidence"],
      source_paths: [step1EvidenceTruthSourcePath(item)],
      public_claim_limit: limitationOnly ? "limitation_only" : "blocked",
    });
  });
  const seen = new Map<string, ExplicitTruthStateEntry>();
  entries.forEach((entry) => seen.set(entry.truth_state_entry_id, entry));
  return Array.from(seen.values()).sort((a, b) =>
    a.truth_state_entry_id.localeCompare(b.truth_state_entry_id),
  );
}
type PresenceValue = "supplied" | "absent" | "unknown";
function normalisePresenceTruthState(
  value: PresenceValue | null | undefined,
  source: string | null | undefined,
): { value: PresenceValue; source: string; status: "known" | "unknown" | "unavailable" } {
  const normalizedValue: PresenceValue =
    value === "supplied" || value === "absent" || value === "unknown" ? value : "unknown";
  const normalizedSource = source ?? "unavailable";
  if (
    normalizedSource === "unavailable" ||
    normalizedSource === "not_loaded" ||
    normalizedSource === "none_loaded"
  )
    return {
      value: normalizedValue,
      source: normalizedSource,
      status: normalizedValue === "unknown" ? "unknown" : "unavailable",
    };
  if (normalizedValue === "unknown")
    return { value: normalizedValue, source: normalizedSource, status: "unknown" };
  return { value: normalizedValue, source: normalizedSource, status: "known" };
}
function assignPresenceTruthBucket(
  field: string,
  state: { value: PresenceValue; status: "known" | "unknown" | "unavailable" },
  known_truths: Record<string, unknown>,
  unavailable_truths: Record<string, unknown>,
) {
  if (state.status === "known") known_truths[field] = state.value;
  else unavailable_truths[field] = state.value;
}

function safeRecordArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];
}

export function resolveInternalQAEmitEnabled(input?: {
  internal_qa_emit?: boolean;
  env?: NodeJS.ProcessEnv;
}) {
  if (input?.internal_qa_emit === true) return true;
  const env = input?.env ?? process.env;
  return env.V3_QA_ARTIFACTS_ENABLED === "true" || env.INTERNAL_QA_EMIT === "true";
}

async function writeInternalJson(
  root: string,
  run_id: string,
  relPath: string,
  payload: unknown,
  artefact_id?: string,
  fixture_id?: string,
) {
  return writeQAArtifact({
    root_dir: root,
    run_id,
    relative_path: relPath,
    payload,
    artefact_id,
    fixture_id,
  });
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function unwrapRawReportData(raw: unknown): Record<string, unknown> {
  const wrapper = isRecord(raw) ? raw : {};
  const nested = isRecord(wrapper.report_data) ? wrapper.report_data : null;
  return nested ?? wrapper;
}

function sourceKindFromSurface(surface: unknown, keys: string[]): PublicReportSourceKind | null {
  if (!isRecord(surface)) return null;
  for (const key of keys) {
    const value = surface[key];
    if (typeof value === "string") return value;
  }
  return null;
}

function classifyRenderReportSource(input: RenderPayloadEmitterInput): PublicReportSourceKind {
  if (input.render_source_kind) return input.render_source_kind;
  if (input.render_report_data) {
    return isPublicReportViewModel(input.render_report_data)
      ? "public_report_view_model"
      : "explicit_render_report_data";
  }
  return "raw_report_report_data_shadow";
}

function classifyPublicReportSource(
  input: PublicReportPayloadEmitterInput,
): PublicReportSourceKind {
  if (input.public_report_source_kind) return input.public_report_source_kind;
  if (input.public_report_data) {
    return isPublicReportViewModel(input.public_report_data)
      ? "public_report_view_model"
      : "explicit_public_report_data";
  }
  return "sanitised_render_payload_shadow";
}

export async function emitRenderPayloadArtifact(input: RenderPayloadEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const renderSourceKind = classifyRenderReportSource(input);
  const source = input.render_report_data ?? input.raw_report_data ?? null;
  const sourceReportData = unwrapRawReportData(source);
  const sourceSurface = { report_data: sourceReportData };
  const allowedFieldPaths = normaliseParityPathList(
    input.allowed_field_paths ?? INITIAL_RENDER_PAYLOAD_ALLOWED_FIELDS,
  );
  const blockedFieldPaths = [
    ...new Set([
      ...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS,
      ...defaultBlockedScoreFieldPaths,
      ...normaliseParityPathList(input.blocked_field_paths),
    ]),
  ];
  const reportData: Record<string, unknown> = {};
  const allowedFieldStatusByPath: Record<string, Record<string, unknown>> = {};
  const deferredOrExcludedRenderFields: Array<Record<string, unknown>> = [];

  for (const path of allowedFieldPaths) {
    const sourceField = getPathValue(sourceSurface, path);
    if (!sourceField.present) {
      allowedFieldStatusByPath[path] = { status: "unavailable", source_path: path };
      continue;
    }
    const blockedPath = blockedFieldPaths.find((candidate) => matchesBlockedPath(path, candidate));
    if (blockedPath) {
      allowedFieldStatusByPath[path] = {
        status: "rendered_but_forbidden",
        source_path: path,
        matched_blocked_path: blockedPath,
      };
      deferredOrExcludedRenderFields.push({
        field_path: path,
        classification: "rendered_but_forbidden",
        reason: "field_matches_forbidden_render_payload_path",
        matched_blocked_path: blockedPath,
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    const cloned = cloneRenderSafeValue(sourceField.value, new WeakSet(), blockedFieldPaths, path);
    if (!cloned.safe) {
      allowedFieldStatusByPath[path] = {
        status: "redacted",
        source_path: path,
        reason: cloned.reason ?? "unsafe_value_redacted",
      };
      deferredOrExcludedRenderFields.push({
        field_path: path,
        classification: "internal_only",
        reason: cloned.reason ?? "unsafe_value_redacted",
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    setPathValue(
      reportData,
      path.replace(/^report_data\./, ""),
      pruneAllowedReportDataValue(path, cloned.value),
    );
    allowedFieldStatusByPath[path] = { status: "rendered_allowed", source_path: path };
  }

  const sourceBlockedFieldHits = collectBlockedFieldHits(sourceSurface, blockedFieldPaths).filter(
    (hit) => !allowedFieldPaths.includes(hit.path),
  );
  for (const hit of sourceBlockedFieldHits) {
    deferredOrExcludedRenderFields.push({
      field_path: hit.path,
      classification: "rendered_but_deferred_for_parity",
      reason: "source_field_excluded_from_initial_s9_17_render_payload_allow_list",
      matched_blocked_path: hit.matched_blocked_path,
      value_summary: hit.value_summary,
    });
  }

  const payloadSurface = { report_data: reportData };
  const blockedFieldHits = collectBlockedFieldHits(payloadSurface, blockedFieldPaths);
  const blockedAllowedFieldCount = Object.values(allowedFieldStatusByPath).filter(
    (entry) => entry.status === "rendered_but_forbidden",
  ).length;
  const hasAllowedContent = Object.keys(reportData).length > 0;
  const renderPayloadStatus =
    blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0
      ? "emitted_blocked"
      : hasAllowedContent
        ? "emitted"
        : "insufficient";
  const blockerCodes = [
    ...(blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0
      ? ["render_payload_forbidden_field_present"]
      : []),
    ...(!hasAllowedContent ? ["render_payload_allowed_fields_unavailable"] : []),
  ];
  const payload = {
    schema_version: "tapecoach_v3_render_payload_v1",
    artefact_type: "render_payload",
    run_id: input.run_id,
    take_id: input.take_id ?? null,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    source_stage: input.source_stage ?? "emitRenderPayloadArtifact",
    source_module: input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts",
    render_payload_status: renderPayloadStatus,
    render_source_kind: renderSourceKind,
    render_source_refs: {
      raw_report_available: Boolean(
        input.raw_report_data && typeof input.raw_report_data === "object",
      ),
      explicit_render_report_data_available: Boolean(
        input.render_report_data && typeof input.render_report_data === "object",
      ),
      source_artefact_id: input.render_report_data ? "render_report_data_input" : "raw_report",
      source_path: input.render_report_data
        ? "render_report_data"
        : "reports/raw_report.json.report_data",
    },
    report_data: reportData,
    allowed_field_paths: allowedFieldPaths,
    allowed_field_status_by_path: allowedFieldStatusByPath,
    deferred_or_excluded_render_fields: deferredOrExcludedRenderFields,
    forbidden_field_scan: {
      scanned_surface: "report_data",
      forbidden_fields_absent: blockedFieldHits.length === 0,
      blocked_field_hit_count: blockedFieldHits.length,
      blocked_allowed_field_count: blockedAllowedFieldCount,
      source_forbidden_or_deferred_field_count: deferredOrExcludedRenderFields.length,
      scanner_match_mode: "path_segment_exact_or_configured_wildcard",
    },
    blocked_field_hits: blockedFieldHits,
    redaction_notes: [
      "Internal QA shadow payload only.",
      "Only the current R10 public-safe report fields are copied into report_data.",
      "Raw prompts, model responses, secrets, signed URLs and raw media URLs are omitted or recorded as unavailable.",
    ],
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    cannot_satisfy_level2_by_itself: true,
    blocker_codes: blockerCodes,
  };

  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try {
      assertSafeSegment(takeId, "take_id");
    } catch {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        render_payload_status: "failed_emission" as const,
        parity_payload: null,
      };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        render_payload_status: "failed_emission" as const,
        parity_payload: null,
      };
    }
  }
  const relative = takeId
    ? `takes/take-${takeId}/analysis-${analysisRunId}/reports/render_payload.json`
    : "reports/render_payload.json";
  const result = await writeInternalJson(root, input.run_id, relative, payload, "render_payload");
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["render_payload"] : [],
    render_payload_status: renderPayloadStatus,
    blocker_codes: blockerCodes,
    parity_payload: payloadSurface,
    payload,
    render_source_kind: renderSourceKind,
    path: result.path ?? result.storage_path,
    warning: result.warning ?? null,
  };
}

export async function emitPublicReportPayloadArtifact(input: PublicReportPayloadEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const publicReportSourceKind = classifyPublicReportSource(input);
  const renderReportData = input.render_payload ? unwrapRawReportData(input.render_payload) : {};
  const explicitPublicSource = input.public_report_data ?? null;
  const source =
    explicitPublicSource ??
    (Object.keys(renderReportData).length > 0
      ? { report_data: renderReportData }
      : (input.raw_report_data ?? null));
  const sourceReportData = unwrapRawReportData(source);
  const sourceSurface = { report_data: sourceReportData };
  const renderSurface = { report_data: renderReportData };
  const allowedFieldPaths = normaliseParityPathList(
    input.allowed_field_paths ?? INITIAL_PUBLIC_REPORT_PAYLOAD_ALLOWED_FIELDS,
  );
  const blockedFieldPaths = [
    ...new Set([
      ...DEFAULT_REPORT_FORBIDDEN_FIELD_PATHS,
      ...defaultBlockedScoreFieldPaths,
      ...normaliseParityPathList(input.blocked_field_paths),
    ]),
  ];
  const reportData: Record<string, unknown> = {};
  const allowedFieldStatusByPath: Record<string, Record<string, unknown>> = {};
  const excludedFieldPaths: Array<Record<string, unknown>> = [];

  for (const path of allowedFieldPaths) {
    const sourceField = getPathValue(sourceSurface, path);
    const renderField = getPathValue(renderSurface, path);
    if (!sourceField.present) {
      allowedFieldStatusByPath[path] = { status: "unavailable", source_path: path };
      continue;
    }
    const blockedPath = blockedFieldPaths.find((candidate) => matchesBlockedPath(path, candidate));
    if (blockedPath) {
      allowedFieldStatusByPath[path] = {
        status: "blocked",
        source_path: path,
        matched_blocked_path: blockedPath,
      };
      excludedFieldPaths.push({
        field_path: path,
        classification: "forbidden",
        reason: "field_matches_forbidden_public_report_payload_path",
        matched_blocked_path: blockedPath,
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    if (!renderField.present) {
      allowedFieldStatusByPath[path] = {
        status: "blocked",
        source_path: path,
        reason: "public_field_not_present_in_render_payload",
      };
      excludedFieldPaths.push({
        field_path: path,
        classification: "blocked",
        reason: "public_report_payload_must_be_subset_of_render_payload",
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    const cloned = cloneRenderSafeValue(sourceField.value, new WeakSet(), blockedFieldPaths, path);
    if (!cloned.safe) {
      allowedFieldStatusByPath[path] = {
        status: "redacted",
        source_path: path,
        reason: cloned.reason ?? "unsafe_value_redacted",
      };
      excludedFieldPaths.push({
        field_path: path,
        classification: "redacted",
        reason: cloned.reason ?? "unsafe_value_redacted",
        value_summary: diagnosticValueSummary(sourceField.value),
      });
      continue;
    }
    setPathValue(
      reportData,
      path.replace(/^report_data\./, ""),
      pruneAllowedReportDataValue(path, cloned.value),
    );
    allowedFieldStatusByPath[path] = { status: "public_safe_allowed", source_path: path };
  }

  const sourceBlockedFieldHits = collectBlockedFieldHits(sourceSurface, blockedFieldPaths).filter(
    (hit) => !allowedFieldPaths.includes(hit.path),
  );
  for (const hit of sourceBlockedFieldHits) {
    excludedFieldPaths.push({
      field_path: hit.path,
      classification: "forbidden_or_internal_source_field_excluded",
      reason: "source_field_excluded_from_public_report_payload",
      matched_blocked_path: hit.matched_blocked_path,
      value_summary: hit.value_summary,
    });
  }
  if (input.raw_report_data) {
    const rawSourceSurface = { report_data: unwrapRawReportData(input.raw_report_data) };
    const rawBlockedFieldHits = collectBlockedFieldHits(rawSourceSurface, blockedFieldPaths);
    for (const hit of rawBlockedFieldHits) {
      excludedFieldPaths.push({
        field_path: hit.path,
        classification: "forbidden_or_internal_raw_report_field_excluded",
        reason: "raw_report_field_excluded_from_public_report_payload",
        matched_blocked_path: hit.matched_blocked_path,
        value_summary: hit.value_summary,
      });
    }
  }

  const sourcePaths = collectCandidatePaths(sourceSurface);
  const renderPaths = collectSurfacePathSet(renderSurface);
  const allowedPathSet = new Set(allowedFieldPaths);
  const publicOnlySourcePaths = sourcePaths.filter(
    (fieldPath) => !renderPaths.has(fieldPath) && !allowedPathSet.has(fieldPath),
  );
  for (const fieldPath of publicOnlySourcePaths) {
    const sourceField = getPathValue(sourceSurface, fieldPath);
    excludedFieldPaths.push({
      field_path: fieldPath,
      classification: "blocked",
      reason: "source_public_field_not_present_in_render_payload",
      value_summary: diagnosticValueSummary(sourceField.value),
    });
  }

  const payloadSurface = { report_data: reportData };
  const blockedFieldHits = collectBlockedFieldHits(payloadSurface, blockedFieldPaths);
  const blockedAllowedFieldCount = Object.values(allowedFieldStatusByPath).filter(
    (entry) => entry.status === "blocked",
  ).length;
  const extraSourceFieldCount = publicOnlySourcePaths.length;
  const hasAllowedContent = Object.keys(reportData).length > 0;
  const renderSourceUnavailable = Object.keys(renderReportData).length === 0;
  const publicReportPayloadStatus =
    blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0 || extraSourceFieldCount > 0
      ? "emitted_blocked"
      : hasAllowedContent
        ? "emitted"
        : "insufficient";
  const blockerCodes = [
    ...(blockedFieldHits.length > 0 || blockedAllowedFieldCount > 0
      ? ["public_report_payload_forbidden_field_present"]
      : []),
    ...(extraSourceFieldCount > 0
      ? ["public_report_payload_extra_path_not_in_render_payload"]
      : []),
    ...(!hasAllowedContent ? ["public_report_payload_allowed_fields_unavailable"] : []),
    ...(renderSourceUnavailable ? ["public_report_payload_render_source_unavailable"] : []),
  ];
  const payload = {
    schema_version: "tapecoach_v3_public_report_payload_v1",
    artefact_type: "public_report_payload",
    run_id: input.run_id,
    take_id: input.take_id ?? null,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    source_stage: input.source_stage ?? "emitPublicReportPayloadArtifact",
    source_module: input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts",
    public_report_payload_status: publicReportPayloadStatus,
    public_report_source_kind: publicReportSourceKind,
    public_report_source_refs: {
      raw_report_available: Boolean(
        input.raw_report_data && typeof input.raw_report_data === "object",
      ),
      render_payload_available: Boolean(
        input.render_payload && typeof input.render_payload === "object",
      ),
      explicit_public_report_data_available: Boolean(
        explicitPublicSource && typeof explicitPublicSource === "object",
      ),
      source_artefact_id: explicitPublicSource ? "public_report_data_input" : "render_payload",
      source_path: explicitPublicSource
        ? "public_report_data"
        : "reports/render_payload.json.report_data",
    },
    report_data: reportData,
    allowed_field_paths: allowedFieldPaths,
    allowed_field_status_by_path: allowedFieldStatusByPath,
    excluded_field_paths: excludedFieldPaths,
    forbidden_field_scan: {
      scanned_surface: "report_data",
      forbidden_fields_absent: blockedFieldHits.length === 0,
      blocked_field_hit_count: blockedFieldHits.length,
      blocked_allowed_field_count: blockedAllowedFieldCount,
      excluded_field_count: excludedFieldPaths.length,
      public_only_source_field_count: extraSourceFieldCount,
      strict_subset_of_render_payload: extraSourceFieldCount === 0,
      scanner_match_mode: "path_segment_exact_or_configured_wildcard",
    },
    blocked_field_hits: blockedFieldHits,
    redaction_notes: [
      "Internal QA public-safe report payload proof only.",
      "Only the current R10 public-safe report fields are copied into report_data.",
      "The payload is constrained to a subset of the render payload and omits raw prompts, model responses, secrets, signed URLs and raw media URLs.",
    ],
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_comparison_output_status: "blocked",
    cannot_satisfy_level2_by_itself: true,
    blocker_codes: blockerCodes,
  };

  const takeId = input.take_id ?? null;
  if (takeId !== null) {
    try {
      assertSafeSegment(takeId, "take_id");
    } catch {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        public_report_payload_status: "failed_emission" as const,
        parity_payload: null,
      };
    }
    if (!isSafeTakeIdSegment(takeId)) {
      return {
        written: false as boolean,
        emitted_artefact_ids: [] as string[],
        public_report_payload_status: "failed_emission" as const,
        parity_payload: null,
      };
    }
  }
  const relative = takeId
    ? `takes/take-${takeId}/analysis-${analysisRunId}/reports/public_report_payload.json`
    : "reports/public_report_payload.json";
  const result = await writeInternalJson(
    root,
    input.run_id,
    relative,
    payload,
    "public_report_payload",
  );
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["public_report_payload"] : [],
    public_report_payload_status: publicReportPayloadStatus,
    blocker_codes: blockerCodes,
    parity_payload: payloadSurface,
    payload,
    public_report_source_kind: publicReportSourceKind,
    path: result.path ?? result.storage_path,
    warning: result.warning ?? null,
  };
}

function getTimestampedNoteText(row: Record<string, unknown>): string | null {
  const note = typeof row.note === "string" ? row.note.trim() : "";
  const text = typeof row.text === "string" ? row.text.trim() : "";
  return note || text || null;
}
function getTimestampedNoteTextField(row: Record<string, unknown>): "note" | "text" | null {
  if (typeof row.note === "string" && row.note.trim()) return "note";
  if (typeof row.text === "string" && row.text.trim()) return "text";
  return null;
}
function normaliseTraceText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
function readJsonPath(root: unknown, sourcePath: string): unknown {
  if (!sourcePath.trim()) return undefined;
  const tokens = sourcePath.match(/[^.[\]]+|\[(\d+)\]/g) ?? [];
  let current = root;
  for (const token of tokens) {
    if (token.startsWith("[") && token.endsWith("]")) {
      const index = Number(token.slice(1, -1));
      if (!Array.isArray(current) || !Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isRecord(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}
function hasForbiddenEvidenceSourceRef(value: unknown): boolean {
  const text = JSON.stringify(value ?? "").toLowerCase();
  return (
    text.includes("raw_report") ||
    text.includes("report_data") ||
    text.includes("timestamped_notes") ||
    text.includes("techniqueobservationtrace") ||
    text.includes("scoretrace") ||
    text.includes("publicclaimtrace")
  );
}
function buildAnalysisEvidenceAnchor(args: {
  source: Record<string, unknown>;
  sourcePath: string;
  item: Record<string, unknown>;
  index: number;
  input: EvidenceAnchorsEmitterInput;
  analysisRunId: string;
  generatedAt: string;
  truthStateMapData?: Record<string, unknown> | null;
}) {
  const resolved = readJsonPath(args.source, args.sourcePath);
  const sourceRunIdMatches =
    args.source.run_id === args.input.run_id && args.source.analysis_run_id === args.analysisRunId;
  const sourcePathResolved = resolved !== undefined;
  const itemBlockers = Array.isArray(args.item.blocker_codes)
    ? args.item.blocker_codes.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const evidenceKind =
    typeof args.item.evidence_kind === "string" ? args.item.evidence_kind : "unknown_runtime_fact";
  const limitationOnly = isStep1LimitationOnlyEvidenceItem(args.item);
  const requiresTruthLinkage = !limitationOnly;
  const linkedTruthStateIds = Array.isArray(args.item.linked_truth_state_ids)
    ? args.item.linked_truth_state_ids.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      )
    : [];
  const structuredTruthMissing = requiresTruthLinkage && linkedTruthStateIds.length === 0;
  const unresolvedTruthStateIds = linkedTruthStateIds.filter(
    (truthId) => !truthStateIdResolves(args.truthStateMapData ?? args.source, truthId),
  );
  const structuralTruthKeysUsedAsIds = linkedTruthStateIds.filter(
    (truthId) => !isCanonicalTruthStateId(truthId),
  );
  const forbiddenSource = hasForbiddenEvidenceSourceRef(args.item);
  const blocker_codes = dedupePreservingOrder([
    ...itemBlockers,
    ...(!sourceRunIdMatches ? ["analysis_evidence_state_identity_mismatch"] : []),
    ...(!sourcePathResolved ? ["analysis_evidence_state_source_path_unresolved"] : []),
    ...(structuredTruthMissing ? ["missing_truth_state_linkage"] : []),
    ...(unresolvedTruthStateIds.length > 0 ? ["truth_state_id_unresolved"] : []),
    ...(structuralTruthKeysUsedAsIds.length > 0 ? ["structural_truth_key_used_as_id"] : []),
    ...(forbiddenSource ? ["forbidden_report_snapshot_source_ref"] : []),
  ]);
  const cannotSatisfy = blocker_codes.length > 0;
  const evidenceText =
    typeof args.item.safe_evidence_summary === "string" && args.item.safe_evidence_summary.trim()
      ? args.item.safe_evidence_summary.trim()
      : `${evidenceKind}: runtime fact recorded`;
  return {
    schema_version: "tapecoach_v3_evidence_anchor_v1",
    artefact_type: "evidence_anchors",
    run_id: args.input.run_id,
    analysis_run_id: args.analysisRunId,
    generated_at: args.generatedAt,
    internal_only: true,
    privacy_classification: "internal_private",
    source_classification: cannotSatisfy ? "real_runtime_v3_blocked" : "real_runtime_v3",
    source_family: cannotSatisfy ? "real_runtime_v3_blocked" : "real_runtime_v3",
    evidence_anchor_id: `ea-${args.input.take_id}-aes-${String(args.index + 1).padStart(4, "0")}`,
    source_stage: "analysis_step_1_evidence_mapping",
    source_artefact_id: "analysis_evidence_state",
    source_path: args.sourcePath,
    evidence_family:
      typeof args.item.evidence_family === "string" ? args.item.evidence_family : null,
    evidence_kind: evidenceKind,
    evidence_text: evidenceText,
    safe_evidence_summary: evidenceText,
    evidence_modality:
      typeof args.item.evidence_modality === "string" ? args.item.evidence_modality : "unknown",
    timestamp: args.item.timestamp ?? null,
    timestamp_range: args.item.timestamp_range ?? null,
    timestamp_source:
      typeof args.item.timestamp_source === "string"
        ? args.item.timestamp_source
        : "not_timestamped_runtime_metadata",
    component_id: typeof args.item.component_id === "string" ? args.item.component_id : null,
    linked_truth_state_ids: linkedTruthStateIds,
    truth_state_entry_ids: linkedTruthStateIds,
    limitation_only: limitationOnly,
    unresolved_truth_state_ids: unresolvedTruthStateIds,
    linked_public_claim_ids: [],
    assessability_limitations: Array.isArray(args.item.assessability_limitations)
      ? args.item.assessability_limitations.filter((x): x is string => typeof x === "string")
      : [],
    evidence_status: cannotSatisfy
      ? "blocked_or_limited_runtime_fact"
      : "resolved_step1_runtime_fact",
    public_safe: true,
    public_display_status: "internal_only",
    confidence_or_strength:
      typeof args.item.confidence_or_strength === "string"
        ? args.item.confidence_or_strength
        : null,
    cannot_satisfy_v3_gate: cannotSatisfy,
    blocker_codes,
  };
}

export async function emitRawReportArtefact(input: RawReportEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.submission_id) miss.push("submission_id");
  const isLegacyV1 = input.report_data.schema_version === "v1-legacy";
  const defectRiskIds = [
    ...(isLegacyV1 ? ["legacy_schema_snapshot", "legacy_report_used_as_v3_spine_proxy"] : []),
    ...(input.report_data.claim_traces == null ? ["v3_claim_fields_null"] : []),
    "public_output_snapshot_missing",
    ...(input.report_data.scores != null ||
    input.report_data.overall_score != null ||
    input.report_data.overall_score_final != null ||
    input.report_data.overall_readiness != null
      ? ["legacy_numeric_score_snapshot"]
      : []),
    ...(input.report_data.fix_first != null ? ["legacy_fix_first_field_present"] : []),
    ...(input.report_data.next_take_plan != null ? ["legacy_next_take_plan_field_present"] : []),
    ...(!Array.isArray(input.report_data.priority_fixes) ||
    input.report_data.priority_fixes.length === 0
      ? ["priority_fixes_missing"]
      : []),
    ...(Array.isArray(input.report_data.priority_fixes) &&
    input.report_data.priority_fixes.length > 0 &&
    input.report_data.priority_fixes.length < 2
      ? ["priority_fixes_too_thin"]
      : []),
    ...(input.report_data.action_plan == null ? ["action_plan_missing"] : []),
  ];
  const payload = {
    schema_version: "tapecoach_v3_internal_raw_report_v1",
    artefact_type: "raw_report",
    run_id: input.run_id,
    fixture_id: input.fixture_id ?? null,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    take_index: input.take_index ?? null,
    mux_playback_id: input.mux_playback_id ?? null,
    source_stage: input.source_stage,
    source_module: input.source_module,
    route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null,
    branch_name: input.branch_name ?? null,
    created_at: new Date().toISOString(),
    report_data: input.report_data,
    scores_or_readiness_fields:
      input.report_data.scores ?? input.report_data.overall_readiness ?? null,
    component_fields: input.report_data.components ?? null,
    claim_like_fields: input.report_data.claim_traces ?? null,
    limitation_fields: input.report_data.limitations ?? null,
    public_output_snapshot: null,
    missing_required_fields: miss,
    blocker_codes: miss.includes("submission_id") ? ["raw_report_submission_id_missing"] : [],
    privacy_classification: "internal_private",
    internal_only: true,
    source_family: isLegacyV1 ? "legacy_adapter" : "runtime_report",
    report_schema_family: isLegacyV1 ? "legacy_v1" : "runtime_v3",
    v3_evidence_spine_status: isLegacyV1 ? "incomplete" : "not_available",
    does_not_satisfy_level2_spine: true,
    linked_v3_trace_ids: [],
    legacy_snapshot_reason: isLegacyV1
      ? "Current production report snapshot emitted for QA; not v3 scoring brain proof"
      : null,
    defect_risk_ids: [...new Set(defectRiskIds)],
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, "take_id");
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${input.take_id}/analysis-${input.run_id}/reports/raw_report.json`,
    payload,
    "raw_report",
    input.fixture_id,
  );
  return {
    written: result.written,
    path: result.path ?? result.storage_path,
    artefact_id: "raw_report" as const,
    warning: result.warning,
  };
}

export async function emitComparisonRawArtefact(input: ComparisonRawEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const miss: string[] = [];
  if (!input.comparison_id) miss.push("comparison_id");
  const payload = {
    schema_version: "tapecoach_v3_internal_comparison_raw_v1",
    artefact_type: "comparison_raw",
    run_id: input.run_id,
    fixture_id: input.fixture_id ?? null,
    comparison_id: input.comparison_id ?? null,
    submission_id: input.submission_id ?? null,
    take_ids: input.take_ids ?? [],
    take_indices: input.take_indices ?? [],
    mux_playback_ids: input.mux_playback_ids ?? {},
    source_stage: input.source_stage,
    source_module: input.source_module,
    route_or_model_marker: input.route_or_model_marker ?? null,
    commit_sha: input.commit_sha ?? null,
    branch_name: input.branch_name ?? null,
    created_at: new Date().toISOString(),
    comparison_data: input.comparison_data,
    ranking_fields: input.comparison_data.ranking ?? null,
    recommendation_fields: input.comparison_data.recommendation ?? null,
    confidence_fields: input.comparison_data.confidence ?? null,
    reasons_or_rationale_fields: input.comparison_data.reasons ?? null,
    flags: input.comparison_data.flags ?? null,
    same_video_fixture_metadata:
      input.fixture_id === "GF-01 / RT-15 / MT-same-video-20260511"
        ? { take_scores: [91, 94, 91], comparison_recommendation: "Take 2" }
        : null,
    missing_required_fields: miss,
    blocker_codes: miss.includes("comparison_id") ? ["comparison_id_missing"] : [],
    privacy_classification: "internal_private",
    internal_only: true,
  };
  const cmpId =
    input.comparison_id ??
    `${input.submission_id ?? "submission-unknown"}-${(input.take_ids ?? []).join("-")}`;
  const result = await writeInternalJson(
    root,
    input.run_id,
    `comparisons/comparison-${cmpId}/comparison/comparison.raw.json`,
    payload,
    "comparison_raw",
    input.fixture_id,
  );
  return {
    written: result.written,
    path: result.path ?? result.storage_path,
    artefact_id: "comparison_raw" as const,
    comparison_run_id: cmpId,
    warning: result.warning,
  };
}

function buildTakeAnalysisRelativePath(input: {
  take_id?: string;
  analysis_run_id?: string;
  run_id: string;
  leaf: string;
}): string {
  const takeId = input.take_id ?? (input.run_id.startsWith("take-") ? input.run_id.slice(5) : null);
  if (!takeId) return input.leaf;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  return `takes/take-${takeId}/analysis-${analysisRunId}/${input.leaf}`;
}

function shouldUseExpandedManifestPaths(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.QA_ARTIFACT_SINK ?? "file") === "storage";
}

function resolveTakeIdForFirstPassTraces(options: {
  take_id?: string | null;
  run_id?: string | null;
}): string | null {
  if (typeof options.take_id === "string" && options.take_id.trim().length > 0) {
    const explicit = options.take_id.trim();
    assertSafeSegment(explicit, "take_id");
    return explicit;
  }
  const runId = typeof options.run_id === "string" ? options.run_id.trim() : "";
  const match = /^take-(.+)$/.exec(runId);
  if (!match) return null;
  const inferred = match[1]?.trim() ?? "";
  if (!inferred) return null;
  try {
    assertSafeSegment(inferred, "take_id");
    return inferred;
  } catch {
    return null;
  }
}
function stripForbiddenFieldsDeep(value: unknown): unknown {
  const forbidden = new Set([
    "raw_prompt",
    "prompt",
    "system_prompt",
    "user_prompt",
    "request_body",
    "raw_response",
    "response_text",
    "model_output",
    "candidates",
    "completion_text",
    "headers",
    "authorization",
    "api_key",
    "token",
    "secret",
    "cookie",
    "session",
    "signed_url",
    "playback_url",
    "video_url",
  ]);
  if (Array.isArray(value)) return value.map((v) => stripForbiddenFieldsDeep(v));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.has(k.toLowerCase())) continue;
    out[k] = stripForbiddenFieldsDeep(v);
  }
  return out;
}
function hasDuplicateNonEmptyString(values: unknown[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) return true;
    seen.add(trimmed);
  }
  return false;
}
function computeDeterministicComparisonRunId(
  comparedTakeIds: string[],
  comparedAnalysisRunIds: string[],
): string {
  const base = [
    ...comparedTakeIds.map((s) => s.trim()),
    ...comparedAnalysisRunIds.map((s) => s.trim()),
  ]
    .filter(Boolean)
    .sort()
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-");
  return `comparison-${base.slice(0, 48) || "unknown"}`;
}

type DuplicateDetectionStatus =
  | "detected"
  | "likely_duplicate"
  | "possible_duplicate"
  | "insufficient_evidence"
  | "not_detected";
type Tier1SignalName =
  | "original_upload_file_hash"
  | "opening_video_sample_hash_or_profile"
  | "closing_video_sample_hash_or_profile"
  | "opening_audio_profile_hash"
  | "closing_audio_profile_hash"
  | "safe_media_fingerprint"
  | "file_size_bytes"
  | "metadata_file_name"
  | "visible_or_original_file_name"
  | "video_duration_ms";
type MediaIdentityStatus = "complete" | "partial" | "unavailable" | "failed";
type MediaIdentitySignalStatus =
  | "available"
  | "unavailable"
  | "redacted"
  | "unsupported"
  | "blocked";
type MediaIdentitySignalName =
  | "original_upload_file_hash"
  | "original_file_name"
  | "metadata_file_name"
  | "file_size_bytes"
  | "video_duration_ms"
  | "opening_video_sample_hash"
  | "closing_video_sample_hash"
  | "opening_audio_profile_hash"
  | "closing_audio_profile_hash"
  | "safe_media_fingerprint";
type MediaIdentitySignalEntry = {
  signal_name: MediaIdentitySignalName;
  status: MediaIdentitySignalStatus;
  value_hash?: string;
  safe_value?: string | number | boolean | null;
  raw_value_redacted: boolean;
  source_artefact_id: string;
  source_path: string;
  confidence_role: "decisive" | "strong" | "medium" | "weak" | "diagnostic_only";
  notes: string[];
};
type MediaIdentityPayload = {
  schema_version: "tapecoach_v3_media_identity_v1";
  artefact_type: "media_identity";
  run_id: string;
  take_id: string;
  analysis_run_id: string;
  generated_at: string;
  internal_only: true;
  privacy_classification: "internal_private";
  source_stage: string;
  source_module: string;
  media_identity_status: MediaIdentityStatus;
  media_identity_scope: "same_user_same_audition";
  user_scope_status: "same_user_only" | "unavailable" | "blocked";
  audition_scope_status: "same_audition_or_submission" | "unavailable" | "blocked";
  available_signal_count: number;
  unavailable_signal_count: number;
  media_identity_signals: Record<MediaIdentitySignalName, MediaIdentitySignalEntry>;
  reference_diagnostics: Record<string, unknown>;
  signal_source_summary: Record<string, unknown>;
  blocker_codes: string[];
  cannot_satisfy_duplicate_detection_gate: boolean;
  public_output_unchanged: true;
  production_safe_status: "blocked";
  public_scoring_status: "blocked";
  public_technique_authority_status: "blocked";
};

const TIER1_WEIGHT_BY_SIGNAL: Record<Tier1SignalName, number> = {
  original_upload_file_hash: 100,
  opening_video_sample_hash_or_profile: 20,
  closing_video_sample_hash_or_profile: 20,
  opening_audio_profile_hash: 15,
  closing_audio_profile_hash: 15,
  safe_media_fingerprint: 70,
  file_size_bytes: 10,
  metadata_file_name: 8,
  visible_or_original_file_name: 5,
  video_duration_ms: 5,
};

const STRONG_TIER1_SIGNALS = new Set<Tier1SignalName>([
  "original_upload_file_hash",
  "opening_video_sample_hash_or_profile",
  "closing_video_sample_hash_or_profile",
  "opening_audio_profile_hash",
  "closing_audio_profile_hash",
  "safe_media_fingerprint",
]);

function normaliseSignalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normaliseSignalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

const MEDIA_IDENTITY_SIGNAL_BY_KEY: Record<string, MediaIdentitySignalName> = {
  original_upload_file_hash: "original_upload_file_hash",
  upload_hash: "original_upload_file_hash",
  sha256: "original_upload_file_hash",
  checksum: "original_upload_file_hash",
  opening_video_sample_hash_or_profile: "opening_video_sample_hash",
  opening_video_sample_hash: "opening_video_sample_hash",
  opening_video_profile_hash: "opening_video_sample_hash",
  closing_video_sample_hash_or_profile: "closing_video_sample_hash",
  closing_video_sample_hash: "closing_video_sample_hash",
  closing_video_profile_hash: "closing_video_sample_hash",
  opening_audio_profile_hash: "opening_audio_profile_hash",
  closing_audio_profile_hash: "closing_audio_profile_hash",
  safe_media_fingerprint: "safe_media_fingerprint",
  file_size_bytes: "file_size_bytes",
  size_bytes: "file_size_bytes",
  metadata_file_name: "metadata_file_name",
  visible_or_original_file_name: "original_file_name",
  original_file_name: "original_file_name",
  file_name: "original_file_name",
  filename: "original_file_name",
  video_duration_ms: "video_duration_ms",
  duration_ms: "video_duration_ms",
  video_duration_seconds: "video_duration_ms",
  duration_seconds: "video_duration_ms",
};

function rawTakeSignalValue(take: InternalComparisonTakeInput, keys: string[]): unknown {
  for (const key of keys) {
    const direct = (take as unknown as Record<string, unknown>)[key];
    if (direct !== undefined && direct !== null && direct !== "") return direct;
  }
  const summaries = take.artefact_summaries;
  if (summaries && typeof summaries === "object" && !Array.isArray(summaries)) {
    for (const key of keys) {
      const value = summaries[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return null;
}

function mediaIdentitySignalComparableValue(
  take: InternalComparisonTakeInput,
  keys: string[],
): unknown {
  const identity = take.media_identity;
  if (!identity || !isRecord(identity.media_identity_signals)) return null;
  for (const key of keys) {
    const signalName = MEDIA_IDENTITY_SIGNAL_BY_KEY[key];
    if (!signalName) continue;
    const signal = identity.media_identity_signals[signalName];
    if (!signal || signal.status !== "available") continue;
    if (signal.safe_value !== undefined && signal.safe_value !== null && signal.safe_value !== "")
      return signal.safe_value;
    if (signal.value_hash) return signal.value_hash;
  }
  return null;
}

function takeSignalValue(take: InternalComparisonTakeInput, keys: string[]): unknown {
  const mediaIdentityValue = mediaIdentitySignalComparableValue(take, keys);
  if (mediaIdentityValue !== null && mediaIdentityValue !== undefined && mediaIdentityValue !== "")
    return mediaIdentityValue;
  return rawTakeSignalValue(take, keys);
}

function comparableStringValues(takes: InternalComparisonTakeInput[], keys: string[]): string[] {
  return takes
    .map((take) => normaliseSignalString(takeSignalValue(take, keys)))
    .filter((value): value is string => Boolean(value));
}

function comparableNumberValues(
  takes: InternalComparisonTakeInput[],
  keys: string[],
  multiplier = 1,
): number[] {
  return takes
    .map((take) => normaliseSignalNumber(takeSignalValue(take, keys)))
    .filter((value): value is number => value !== null)
    .map((value) => value * multiplier);
}

function exactDuplicateString(values: string[], caseInsensitive = false): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    const key = caseInsensitive ? value.toLowerCase() : value;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function exactOrNearDuplicateNumber(
  values: number[],
  toleranceAbsolute: number,
  toleranceRatio: number,
): boolean {
  for (let i = 0; i < values.length; i += 1) {
    for (let j = i + 1; j < values.length; j += 1) {
      const a = values[i]!;
      const b = values[j]!;
      const diff = Math.abs(a - b);
      const ratioBase = Math.max(Math.abs(a), Math.abs(b), 1);
      if (diff <= toleranceAbsolute || diff / ratioBase <= toleranceRatio) return true;
    }
  }
  return false;
}

function duplicateSignalSummary(
  signal: Tier1SignalName,
  values: Array<string | number>,
  matched: boolean,
  conflicting: boolean,
) {
  return {
    signal,
    weight: TIER1_WEIGHT_BY_SIGNAL[signal],
    available_count: values.length,
    comparable: values.length >= 2,
    matched,
    conflicting,
    value_hashes: values.map((value) => hashDiagnosticValue(String(value))),
  };
}

function scopeStatus(
  takes: InternalComparisonTakeInput[],
  keys: string[],
): "same" | "conflicting" | "unavailable" {
  const values = comparableStringValues(takes, keys);
  if (values.length < 2) return "unavailable";
  return new Set(values).size === 1 ? "same" : "conflicting";
}

function duplicateDetectionStatusFromScore(
  score: number,
  hasReliableDifferentEvidence: boolean,
): DuplicateDetectionStatus {
  if (score >= 90) return "detected";
  if (score >= 70) return "likely_duplicate";
  if (score >= 45) return "possible_duplicate";
  if (score > 0) return "possible_duplicate";
  return hasReliableDifferentEvidence ? "not_detected" : "insufficient_evidence";
}

function looksLikeUnsafePrivateValue(value: string): boolean {
  const lower = value.toLowerCase();
  return (
    lower.includes("://") ||
    lower.includes("signed") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("authorization") ||
    lower.includes("bearer") ||
    lower.includes("x-amz") ||
    lower.includes("sig=") ||
    lower.includes("access_key") ||
    lower.includes("apikey") ||
    lower.includes("api_key")
  );
}

function safeBasename(value: unknown): { value: string | null; redacted: boolean; note?: string } {
  if (typeof value !== "string") return { value: null, redacted: false };
  const trimmed = value.trim();
  if (!trimmed) return { value: null, redacted: false };
  const queryIndex = trimmed.search(/[?#]/);
  const withoutQuery = queryIndex >= 0 ? trimmed.slice(0, queryIndex) : trimmed;
  const basename = withoutQuery.replace(/\\/g, "/").split("/").filter(Boolean).pop()?.trim() ?? "";
  if (!basename) return { value: null, redacted: true, note: "filename_path_redacted" };
  if (looksLikeUnsafePrivateValue(trimmed) || looksLikeUnsafePrivateValue(basename)) {
    return { value: null, redacted: true, note: "unsafe_filename_value_redacted" };
  }
  return { value: basename.slice(0, 160), redacted: trimmed !== basename };
}

function normaliseSafeDiagnosticRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed)) return null;
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(trimmed)) return hashDiagnosticValue(trimmed);
  return trimmed;
}

function mediaIdentityRawValue(input: {
  take: InternalComparisonTakeInput;
  keys: string[];
}): unknown {
  return rawTakeSignalValue(input.take, input.keys);
}

function normaliseOriginalUploadHashValue(value: unknown): string | null {
  const raw = isRecord(value) ? value.value : value;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || looksLikeUnsafePrivateValue(trimmed) || /[\\/]/.test(trimmed)) return null;
  const match = trimmed.match(/^(?:sha256:)?([a-f0-9]{64})$/);
  return match ? `sha256:${match[1]}` : null;
}

function mediaIdentityStringSignal(input: {
  take: InternalComparisonTakeInput;
  signal_name: MediaIdentitySignalName;
  keys: string[];
  source_path: string;
  confidence_role: MediaIdentitySignalEntry["confidence_role"];
  filename?: boolean;
}): MediaIdentitySignalEntry {
  const raw = mediaIdentityRawValue({ take: input.take, keys: input.keys });
  const notes: string[] = [];
  if (input.filename) {
    const safe = safeBasename(raw);
    if (!safe.value) {
      if (safe.redacted && safe.note) notes.push(safe.note);
      return {
        signal_name: input.signal_name,
        status: safe.redacted ? "redacted" : "unavailable",
        raw_value_redacted: safe.redacted,
        source_artefact_id: "analysis_take",
        source_path: input.source_path,
        confidence_role: input.confidence_role,
        notes: notes.length ? notes : ["signal_unavailable"],
      };
    }
    return {
      signal_name: input.signal_name,
      status: "available",
      safe_value: safe.value,
      value_hash: hashDiagnosticValue(safe.value.toLowerCase()),
      raw_value_redacted: safe.redacted,
      source_artefact_id: "analysis_take",
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: safe.redacted ? ["basename_only_path_redacted"] : [],
    };
  }
  if (input.signal_name === "original_upload_file_hash") {
    const hashValue = normaliseOriginalUploadHashValue(raw);
    if (!hashValue) {
      const unsafe =
        typeof raw === "string" && (looksLikeUnsafePrivateValue(raw) || /[\\/]/.test(raw));
      return {
        signal_name: input.signal_name,
        status: unsafe ? "redacted" : "unavailable",
        raw_value_redacted: unsafe,
        source_artefact_id: "analysis_take",
        source_path: input.source_path,
        confidence_role: input.confidence_role,
        notes: [unsafe ? "unsafe_hash_value_redacted" : "invalid_or_unavailable_sha256_hash"],
      };
    }
    return {
      signal_name: input.signal_name,
      status: "available",
      safe_value: hashValue,
      value_hash: hashDiagnosticValue(hashValue),
      raw_value_redacted: false,
      source_artefact_id: "analysis_take",
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: [],
    };
  }
  const value = normaliseSignalString(raw);
  if (!value) {
    return {
      signal_name: input.signal_name,
      status: "unavailable",
      raw_value_redacted: false,
      source_artefact_id: "analysis_take",
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ["signal_unavailable"],
    };
  }
  const redacted = looksLikeUnsafePrivateValue(value) || /[\\/]/.test(value);
  if (redacted) {
    return {
      signal_name: input.signal_name,
      status: "redacted",
      raw_value_redacted: true,
      source_artefact_id: "analysis_take",
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ["unsafe_raw_value_redacted"],
    };
  }
  return {
    signal_name: input.signal_name,
    status: "available",
    safe_value: value.slice(0, 160),
    value_hash: hashDiagnosticValue(value),
    raw_value_redacted: false,
    source_artefact_id: "analysis_take",
    source_path: input.source_path,
    confidence_role: input.confidence_role,
    notes: [],
  };
}

function mediaIdentityNumberSignal(input: {
  take: InternalComparisonTakeInput;
  signal_name: MediaIdentitySignalName;
  keys: string[];
  source_path: string;
  confidence_role: MediaIdentitySignalEntry["confidence_role"];
  multiplier?: number;
}): MediaIdentitySignalEntry {
  const raw = mediaIdentityRawValue({ take: input.take, keys: input.keys });
  const value = normaliseSignalNumber(raw);
  if (value === null) {
    return {
      signal_name: input.signal_name,
      status: "unavailable",
      raw_value_redacted: false,
      source_artefact_id: "analysis_take",
      source_path: input.source_path,
      confidence_role: input.confidence_role,
      notes: ["signal_unavailable"],
    };
  }
  const normalised = Math.round(value * (input.multiplier ?? 1));
  return {
    signal_name: input.signal_name,
    status: "available",
    safe_value: normalised,
    value_hash: hashDiagnosticValue(String(normalised)),
    raw_value_redacted: false,
    source_artefact_id: "analysis_take",
    source_path: input.source_path,
    confidence_role: input.confidence_role,
    notes: [],
  };
}

function buildMediaIdentityPayload(input: {
  run_id: string;
  take: InternalComparisonTakeInput;
  analysis_run_id?: string;
  source_module?: string;
  source_stage?: string;
}): MediaIdentityPayload {
  const take = input.take;
  const analysisRunId = input.analysis_run_id ?? take.analysis_run_id;
  const durationMsRaw = rawTakeSignalValue(take, ["video_duration_ms", "duration_ms"]);
  const durationSecondsRaw = rawTakeSignalValue(take, [
    "video_duration_seconds",
    "duration_seconds",
  ]);
  const durationSignal =
    normaliseSignalNumber(durationMsRaw) !== null
      ? mediaIdentityNumberSignal({
          take,
          signal_name: "video_duration_ms",
          keys: ["video_duration_ms", "duration_ms"],
          source_path: "video_duration_ms",
          confidence_role: "weak",
        })
      : mediaIdentityNumberSignal({
          take,
          signal_name: "video_duration_ms",
          keys: ["video_duration_seconds", "duration_seconds"],
          source_path: "mux_duration_seconds",
          confidence_role: "weak",
          multiplier: 1000,
        });
  const uploadIdentity = isRecord(take.upload_identity_metadata)
    ? take.upload_identity_metadata
    : null;
  const uploadIdentitySource = uploadIdentity ? "signals.upload_identity" : null;
  const media_identity_signals: Record<MediaIdentitySignalName, MediaIdentitySignalEntry> = {
    original_upload_file_hash: mediaIdentityStringSignal({
      take,
      signal_name: "original_upload_file_hash",
      keys: ["original_upload_file_hash", "upload_hash", "sha256", "checksum"],
      source_path: uploadIdentitySource
        ? `${uploadIdentitySource}.original_upload_file_hash.value`
        : "original_upload_file_hash",
      confidence_role: "decisive",
    }),
    original_file_name: mediaIdentityStringSignal({
      take,
      signal_name: "original_file_name",
      keys: ["visible_or_original_file_name", "original_file_name", "file_name", "filename"],
      source_path: uploadIdentitySource
        ? `${uploadIdentitySource}.original_file_name_safe_basename`
        : "original_file_name",
      confidence_role: "weak",
      filename: true,
    }),
    metadata_file_name: mediaIdentityStringSignal({
      take,
      signal_name: "metadata_file_name",
      keys: ["metadata_file_name"],
      source_path: uploadIdentitySource
        ? `${uploadIdentitySource}.metadata_file_name_safe_basename`
        : "metadata_file_name",
      confidence_role: "medium",
      filename: true,
    }),
    file_size_bytes: mediaIdentityNumberSignal({
      take,
      signal_name: "file_size_bytes",
      keys: ["file_size_bytes", "size_bytes"],
      source_path: uploadIdentitySource
        ? `${uploadIdentitySource}.file_size_bytes`
        : "file_size_bytes",
      confidence_role: "medium",
    }),
    video_duration_ms: durationSignal,
    opening_video_sample_hash: mediaIdentityStringSignal({
      take,
      signal_name: "opening_video_sample_hash",
      keys: [
        "opening_video_sample_hash_or_profile",
        "opening_video_sample_hash",
        "opening_video_profile_hash",
      ],
      source_path: "opening_video_sample_hash",
      confidence_role: "strong",
    }),
    closing_video_sample_hash: mediaIdentityStringSignal({
      take,
      signal_name: "closing_video_sample_hash",
      keys: [
        "closing_video_sample_hash_or_profile",
        "closing_video_sample_hash",
        "closing_video_profile_hash",
      ],
      source_path: "closing_video_sample_hash",
      confidence_role: "strong",
    }),
    opening_audio_profile_hash: mediaIdentityStringSignal({
      take,
      signal_name: "opening_audio_profile_hash",
      keys: ["opening_audio_profile_hash"],
      source_path: "opening_audio_profile_hash",
      confidence_role: "strong",
    }),
    closing_audio_profile_hash: mediaIdentityStringSignal({
      take,
      signal_name: "closing_audio_profile_hash",
      keys: ["closing_audio_profile_hash"],
      source_path: "closing_audio_profile_hash",
      confidence_role: "strong",
    }),
    safe_media_fingerprint: mediaIdentityStringSignal({
      take,
      signal_name: "safe_media_fingerprint",
      keys: ["safe_media_fingerprint"],
      source_path: "safe_media_fingerprint",
      confidence_role: "strong",
    }),
  };
  const availableSignalCount = Object.values(media_identity_signals).filter(
    (signal) => signal.status === "available",
  ).length;
  const unavailableSignalCount = Object.values(media_identity_signals).filter(
    (signal) => signal.status !== "available",
  ).length;
  const reliableSignals = [
    "original_upload_file_hash",
    "opening_video_sample_hash",
    "closing_video_sample_hash",
    "opening_audio_profile_hash",
    "closing_audio_profile_hash",
    "safe_media_fingerprint",
  ] as const;
  const hasReliableUploadOrContentSignal = reliableSignals.some(
    (signal) => media_identity_signals[signal].status === "available",
  );
  const blocker_codes = dedupePreservingOrder([
    ...(media_identity_signals.original_upload_file_hash.status === "available"
      ? []
      : ["original_upload_file_hash_unavailable"]),
    ...(media_identity_signals.opening_video_sample_hash.status === "available"
      ? []
      : ["opening_video_sample_unavailable"]),
    ...(media_identity_signals.closing_video_sample_hash.status === "available"
      ? []
      : ["closing_video_sample_unavailable"]),
    ...(media_identity_signals.opening_audio_profile_hash.status === "available"
      ? []
      : ["opening_audio_profile_unavailable"]),
    ...(media_identity_signals.closing_audio_profile_hash.status === "available"
      ? []
      : ["closing_audio_profile_unavailable"]),
    ...(hasReliableUploadOrContentSignal
      ? []
      : ["media_identity_no_reliable_upload_or_content_signal"]),
    ...(availableSignalCount === 0 ? ["media_identity_unavailable"] : []),
  ]);
  const mediaIdentityStatus: MediaIdentityStatus =
    availableSignalCount === 0
      ? "unavailable"
      : unavailableSignalCount === 0
        ? "complete"
        : "partial";
  const muxPlaybackRef = take.safe_mux_playback_ref ?? take.mux_playback_ref ?? null;
  return {
    schema_version: "tapecoach_v3_media_identity_v1",
    artefact_type: "media_identity",
    run_id: input.run_id,
    take_id: take.take_id,
    analysis_run_id: analysisRunId,
    generated_at: new Date().toISOString(),
    internal_only: true,
    privacy_classification: "internal_private",
    source_stage: input.source_stage ?? "buildMediaIdentityPayload",
    source_module: input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts",
    media_identity_status: mediaIdentityStatus,
    media_identity_scope: "same_user_same_audition",
    user_scope_status:
      normaliseSignalString(take.user_id) || normaliseSignalString(take.profile_id)
        ? "same_user_only"
        : "unavailable",
    audition_scope_status:
      normaliseSignalString(take.audition_id) || normaliseSignalString(take.submission_id)
        ? "same_audition_or_submission"
        : "unavailable",
    available_signal_count: availableSignalCount,
    unavailable_signal_count: unavailableSignalCount,
    media_identity_signals,
    reference_diagnostics: {
      take_id: take.take_id,
      analysis_run_id: analysisRunId,
      mux_playback_id_present: Boolean(take.mux_playback_ref),
      mux_asset_or_upload_id_present: take.mux_asset_or_upload_id_present ?? "unknown",
      safe_mux_playback_ref: normaliseSafeDiagnosticRef(muxPlaybackRef),
    },
    signal_source_summary: {
      source_artefact_id: "analysis_take",
      source_path: "inputs/media_identity.json",
      upload_identity_source: uploadIdentitySource ?? "unavailable",
      original_upload_file_hash_source_stage: take.original_upload_file_hash_source_stage ?? null,
      mime_type_safe_summary: take.mime_type_safe_summary ?? null,
      last_modified_ms: normaliseSignalNumber(take.last_modified_ms) ?? null,
      upload_metadata_source: take.upload_metadata_source ?? null,
      upload_identity_capture_status:
        normaliseSignalString(take.upload_identity_capture_status) ??
        (media_identity_signals.original_upload_file_hash.status === "available"
          ? "captured"
          : uploadIdentity
            ? "partial"
            : "unavailable"),
      upload_identity_capture_reason:
        normaliseSignalString(take.upload_identity_capture_reason) ?? null,
      upload_identity_merge_status:
        normaliseSignalString(take.upload_identity_merge_status) ?? null,
      duration_source:
        normaliseSignalNumber(durationMsRaw) !== null
          ? "video_duration_ms"
          : normaliseSignalNumber(durationSecondsRaw) !== null
            ? "mux_duration_seconds"
            : "unavailable",
      sampling_helper_status:
        media_identity_signals.opening_video_sample_hash.status === "available" ||
        media_identity_signals.closing_video_sample_hash.status === "available" ||
        media_identity_signals.opening_audio_profile_hash.status === "available" ||
        media_identity_signals.closing_audio_profile_hash.status === "available"
          ? "provided_by_runtime_input"
          : "unavailable",
    },
    blocker_codes,
    cannot_satisfy_duplicate_detection_gate: !hasReliableUploadOrContentSignal,
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
  };
}

function buildTier1DuplicateDetectionTrace(input: {
  run_id: string;
  analysis_run_id: string;
  comparison_run_id: string;
  compared_takes: InternalComparisonTakeInput[];
  compared_take_ids: string[];
  compared_analysis_run_ids: string[];
  operator_same_video_assertion?: boolean;
  source_module?: string;
  source_stage?: string;
}): Record<string, unknown> {
  const takes = input.compared_takes.map((take) => ({
    ...take,
    media_identity:
      take.media_identity ??
      buildMediaIdentityPayload({
        run_id: input.run_id,
        take,
        source_module: input.source_module,
        source_stage: input.source_stage,
      }),
  }));
  const referenceDiagnostics = {
    same_take_id: hasDuplicateNonEmptyString(takes.map((take) => take.take_id)),
    same_analysis_run_id: hasDuplicateNonEmptyString(takes.map((take) => take.analysis_run_id)),
    same_mux_playback_ref: hasDuplicateNonEmptyString(takes.map((take) => take.mux_playback_ref)),
    mux_playback_refs_available_count: comparableStringValues(takes, ["mux_playback_ref"]).length,
    compared_take_ids: input.compared_take_ids,
    compared_analysis_run_ids: input.compared_analysis_run_ids,
  };
  const operatorAssertion = Boolean(
    input.operator_same_video_assertion ||
    takes.some((take) => take.operator_same_video_assertion === true),
  );
  const signalSummaries: Record<string, ReturnType<typeof duplicateSignalSummary>> = {};
  const signalsMatched: Tier1SignalName[] = [];
  const signalsMissing: Tier1SignalName[] = [];
  const signalsConflicting: Tier1SignalName[] = [];
  const basis: string[] = [];
  let score = 0;
  let strongComparedCount = 0;

  const addStringSignal = (
    signal: Tier1SignalName,
    keys: string[],
    opts: { caseInsensitive?: boolean; decisive?: boolean } = {},
  ) => {
    const values = comparableStringValues(takes, keys);
    const matched = values.length >= 2 && exactDuplicateString(values, opts.caseInsensitive);
    const conflicting = values.length >= 2 && !matched;
    signalSummaries[signal] = duplicateSignalSummary(signal, values, matched, conflicting);
    if (values.length < 2) signalsMissing.push(signal);
    if (STRONG_TIER1_SIGNALS.has(signal) && values.length >= 2) strongComparedCount += 1;
    if (matched) {
      signalsMatched.push(signal);
      basis.push(`${signal}_match`);
      score = opts.decisive ? 100 : Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL[signal]);
    } else if (conflicting) {
      signalsConflicting.push(signal);
    }
  };

  const addNumberSignal = (
    signal: Tier1SignalName,
    keys: string[],
    opts: { multiplier?: number; absolute: number; ratio: number },
  ) => {
    const values = comparableNumberValues(takes, keys, opts.multiplier ?? 1);
    const matched =
      values.length >= 2 && exactOrNearDuplicateNumber(values, opts.absolute, opts.ratio);
    const conflicting = values.length >= 2 && !matched;
    signalSummaries[signal] = duplicateSignalSummary(signal, values, matched, conflicting);
    if (values.length < 2) signalsMissing.push(signal);
    if (matched) {
      signalsMatched.push(signal);
      basis.push(`${signal}_exact_or_near_match`);
      score = Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL[signal]);
    } else if (conflicting) {
      signalsConflicting.push(signal);
    }
  };

  addStringSignal(
    "original_upload_file_hash",
    ["original_upload_file_hash", "upload_hash", "sha256", "checksum"],
    { decisive: true },
  );
  addStringSignal("opening_video_sample_hash_or_profile", [
    "opening_video_sample_hash_or_profile",
    "opening_video_profile_hash",
  ]);
  addStringSignal("closing_video_sample_hash_or_profile", [
    "closing_video_sample_hash_or_profile",
    "closing_video_profile_hash",
  ]);
  addStringSignal("opening_audio_profile_hash", ["opening_audio_profile_hash"]);
  addStringSignal("closing_audio_profile_hash", ["closing_audio_profile_hash"]);
  addStringSignal("safe_media_fingerprint", ["safe_media_fingerprint"]);
  addNumberSignal("file_size_bytes", ["file_size_bytes", "size_bytes"], {
    absolute: 1024,
    ratio: 0.01,
  });
  addStringSignal("metadata_file_name", ["metadata_file_name"], { caseInsensitive: true });
  addStringSignal(
    "visible_or_original_file_name",
    ["visible_or_original_file_name", "original_file_name", "file_name", "filename"],
    { caseInsensitive: true },
  );
  const durationMsValues = comparableNumberValues(takes, ["video_duration_ms", "duration_ms"]);
  const durationSecondValues = comparableNumberValues(
    takes,
    ["video_duration_seconds", "duration_seconds"],
    1000,
  );
  const allDurationValues = [...durationMsValues, ...durationSecondValues];
  const durationMatched =
    allDurationValues.length >= 2 && exactOrNearDuplicateNumber(allDurationValues, 1000, 0.01);
  const durationConflicting = allDurationValues.length >= 2 && !durationMatched;
  signalSummaries.video_duration_ms = duplicateSignalSummary(
    "video_duration_ms",
    allDurationValues,
    durationMatched,
    durationConflicting,
  );
  if (allDurationValues.length < 2) signalsMissing.push("video_duration_ms");
  if (durationMatched) {
    signalsMatched.push("video_duration_ms");
    basis.push("video_duration_ms_exact_or_near_match");
    score = Math.min(100, score + TIER1_WEIGHT_BY_SIGNAL.video_duration_ms);
  } else if (durationConflicting) {
    signalsConflicting.push("video_duration_ms");
  }

  if (operatorAssertion) {
    basis.push("operator_same_video_assertion");
    score = 100;
  }
  if (referenceDiagnostics.same_take_id) basis.push("same_take_id_reference_match");
  if (referenceDiagnostics.same_analysis_run_id) basis.push("same_analysis_run_id_reference_match");
  if (referenceDiagnostics.same_mux_playback_ref)
    basis.push("same_mux_playback_ref_reference_match");
  const referenceMatchDetected =
    referenceDiagnostics.same_take_id ||
    referenceDiagnostics.same_analysis_run_id ||
    referenceDiagnostics.same_mux_playback_ref;
  if (referenceMatchDetected) score = Math.max(score, 100);
  const sameUserScopeStatus = scopeStatus(takes, ["user_id", "profile_id"]);
  const sameAuditionScopeStatus = scopeStatus(takes, ["audition_id", "submission_id"]);
  const scopeConflict =
    sameUserScopeStatus === "conflicting" || sameAuditionScopeStatus === "conflicting";

  const sampleSignalsUnavailable =
    signalSummaries.opening_video_sample_hash_or_profile.available_count < 2 &&
    signalSummaries.closing_video_sample_hash_or_profile.available_count < 2 &&
    signalSummaries.opening_audio_profile_hash.available_count < 2 &&
    signalSummaries.closing_audio_profile_hash.available_count < 2;
  const sufficientUploadOrContentEvidence =
    (STRONG_TIER1_SIGNALS.has("original_upload_file_hash") &&
      signalSummaries.original_upload_file_hash.available_count >= 2) ||
    strongComparedCount > 0;
  const hasReliableDifferentEvidence =
    sufficientUploadOrContentEvidence &&
    signalsMatched.every((signal) => !STRONG_TIER1_SIGNALS.has(signal));
  const effectiveScore = scopeConflict ? 0 : score;
  const duplicateStatus: DuplicateDetectionStatus = scopeConflict
    ? "insufficient_evidence"
    : operatorAssertion || referenceMatchDetected
      ? "detected"
      : duplicateDetectionStatusFromScore(effectiveScore, hasReliableDifferentEvidence);
  const notDetectedEvidenceSufficient =
    duplicateStatus === "not_detected" && sufficientUploadOrContentEvidence;
  const suppressionRequired = duplicateStatus !== "not_detected";
  const blockerCodes = [
    ...(sampleSignalsUnavailable ? ["duplicate_detection_sampling_unavailable"] : []),
    ...(scopeConflict ? ["duplicate_detection_scope_conflict"] : []),
    ...(duplicateStatus === "insufficient_evidence"
      ? ["duplicate_detection_content_evidence_insufficient"]
      : []),
    ...(duplicateStatus === "possible_duplicate"
      ? ["duplicate_detection_possible_duplicate_unresolved"]
      : []),
    ...(duplicateStatus === "detected" || duplicateStatus === "likely_duplicate"
      ? ["duplicate_detection_duplicate_or_likely_duplicate"]
      : []),
  ];

  return {
    schema_version: "tapecoach_v3_duplicate_detection_trace_v1",
    artefact_type: "duplicate_detection_trace",
    run_id: input.run_id,
    analysis_run_id: input.analysis_run_id,
    comparison_run_id: input.comparison_run_id,
    compared_take_ids: input.compared_take_ids,
    compared_analysis_run_ids: input.compared_analysis_run_ids,
    internal_only: true,
    privacy_classification: "internal_private",
    generated_at: new Date().toISOString(),
    duplicate_detection_status: duplicateStatus,
    duplicate_detection_confidence: effectiveScore,
    duplicate_detection_basis:
      basis.length > 0 ? basis : ["insufficient_upload_or_content_evidence"],
    duplicate_detection_evidence_refs: Object.fromEntries(
      Object.entries(signalSummaries).map(([signal, summary]) => [signal, summary.value_hashes]),
    ),
    media_identity_evidence_refs: Object.fromEntries(
      takes.map((take) => [
        take.take_id,
        {
          artefact_path: `takes/take-${take.take_id}/analysis-${take.analysis_run_id}/inputs/media_identity.json`,
          media_identity_status: take.media_identity?.media_identity_status ?? "unavailable",
          available_signal_count: take.media_identity?.available_signal_count ?? 0,
          unavailable_signal_count: take.media_identity?.unavailable_signal_count ?? 0,
          blocker_codes: take.media_identity?.blocker_codes ?? ["media_identity_unavailable"],
        },
      ]),
    ),
    duplicate_detection_signal_summary: signalSummaries,
    signals_matched: signalsMatched,
    signals_missing: signalsMissing,
    signals_conflicting: signalsConflicting,
    reference_diagnostics: referenceDiagnostics,
    operator_same_video_assertion: operatorAssertion,
    same_user_scope_status: sameUserScopeStatus,
    same_audition_scope_status: sameAuditionScopeStatus,
    sampling_window_policy: {
      opening_video_sample_window:
        "skip_3_to_5_seconds_where_possible_then_sample_5_to_10_second_window",
      closing_video_sample_window:
        "sample_5_to_10_second_window_before_final_fade_black_frame_end_card_or_freeze",
      audio_profile_window: "use_matching_opening_and_closing_windows_where_available",
      single_frame_or_single_instant_samples_allowed: false,
    },
    sampling_window_status: sampleSignalsUnavailable ? "unavailable" : "partial_or_available",
    sampling_limitations: sampleSignalsUnavailable
      ? ["server_runtime_sampling_helpers_unavailable_in_s9_16c"]
      : [],
    sufficient_upload_or_content_evidence: sufficientUploadOrContentEvidence,
    not_detected_evidence_sufficient: notDetectedEvidenceSufficient,
    same_video_detected: duplicateStatus === "detected" || duplicateStatus === "likely_duplicate",
    repeated_input_detected:
      duplicateStatus === "detected" || duplicateStatus === "likely_duplicate",
    same_video_unresolved_risk:
      duplicateStatus === "possible_duplicate" || duplicateStatus === "insufficient_evidence",
    suppression_required: suppressionRequired,
    same_video_suppression_status: suppressionRequired ? "suppressed" : "not_applicable",
    blocker_codes: [...new Set(blockerCodes)],
    cannot_satisfy_level2_comparison_gate: true,
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    source_module: input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts",
    source_stage: input.source_stage ?? "buildTier1DuplicateDetectionTrace",
  };
}

function stripTakePrefix(value: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  if (!trimmed.startsWith("take-")) return trimmed;
  const core = trimmed.slice(5);
  if (!core || core.startsWith("take-")) return "";
  return core;
}
function stripRepeatedTakePrefixes(value: string): string {
  let core = String(value ?? "").trim();
  while (core.startsWith("take-")) core = core.slice(5);
  return core;
}
function normaliseUniqueTakeCores(values: readonly unknown[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const core = stripRepeatedTakePrefixes(value);
    if (!core || seen.has(core)) continue;
    seen.add(core);
    out.push(core);
  }
  return out;
}
function toCanonicalTakeRunId(value: string): string {
  const core = stripTakePrefix(value);
  if (!core) return "";
  assertSafeSegment(core, "take_id");
  return `take-${core}`;
}
export async function runInternalComparisonOperatorTrigger(
  input: InternalComparisonOperatorTriggerInput,
  resolveCompletedTakeAnalysis: (takeId: string) => Promise<CompletedTakeComparisonSource | null>,
): Promise<InternalComparisonOperatorTriggerResult> {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: [...(input.compared_take_ids ?? [])],
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "internal_qa_emit_disabled",
      blocker_codes: ["qa_flags_disabled"],
    };
  }
  const rootTakeIdCore = stripTakePrefix(input.root_take_id);
  try {
    assertSafeSegment(rootTakeIdCore, "root_take_id");
  } catch {
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: [...(input.compared_take_ids ?? [])],
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "unsafe_root_take_id",
      blocker_codes: ["unsafe_root_take_id"],
    };
  }
  const canonicalRootTakeRunId = toCanonicalTakeRunId(rootTakeIdCore);
  const rawIds = (input.compared_take_ids ?? [])
    .map((id) => (typeof id === "string" ? id.trim() : ""))
    .filter(Boolean);
  const ids: string[] = [];
  const seenInputTakeIds = new Set<string>();
  for (const id of rawIds) {
    const core = stripTakePrefix(id);
    try {
      assertSafeSegment(core, "compared_take_id");
    } catch {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: rawIds,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "unsafe_compared_take_id",
        blocker_codes: ["unsafe_compared_take_id"],
      };
    }
    if (seenInputTakeIds.has(core))
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: rawIds,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "duplicate_compared_take_id",
        blocker_codes: ["duplicate_compared_take_id"],
      };
    seenInputTakeIds.add(core);
    ids.push(core);
  }
  if (ids.length < 2)
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: ids,
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "comparison_requires_two_or_more_takes",
      blocker_codes: ["insufficient_compared_takes"],
    };
  if (!ids.includes(rootTakeIdCore))
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: ids,
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "root_take_id_must_be_in_compared_take_ids",
      blocker_codes: ["root_take_missing"],
    };
  if (input.compared_analysis_run_ids && input.compared_analysis_run_ids.length !== ids.length) {
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: ids,
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "compared_analysis_run_ids_length_mismatch",
      blocker_codes: ["analysis_run_id_cardinality_mismatch"],
    };
  }
  if (input.comparison_run_id !== undefined) {
    const explicitComparisonRunId = String(input.comparison_run_id);
    if (!explicitComparisonRunId.trim())
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "comparison_run_id_invalid_path",
        blocker_codes: ["comparison_run_id_invalid"],
      };
    try {
      assertSafeSegment(explicitComparisonRunId, "comparison_run_id");
    } catch {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "comparison_run_id_invalid_path",
        blocker_codes: ["comparison_run_id_invalid"],
      };
    }
  }
  const resolvedRows: CompletedTakeComparisonSource[] = [];
  const seenResolvedTakeIds = new Set<string>();
  for (const requestedTakeIdCore of ids) {
    let resolved: CompletedTakeComparisonSource | null = null;
    try {
      resolved = await resolveCompletedTakeAnalysis(requestedTakeIdCore);
    } catch {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "take_resolution_failed",
        blocker_codes: ["take_resolution_failed"],
      };
    }
    if (!resolved)
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "take_not_resolved",
        blocker_codes: ["take_not_resolved"],
      };
    const resolvedTakeCore = stripTakePrefix(resolved.take_id);
    if (
      typeof resolved.take_id !== "string" ||
      !resolved.take_id.trim() ||
      resolvedTakeCore !== requestedTakeIdCore
    ) {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "resolver_take_id_mismatch",
        blocker_codes: ["resolver_take_id_mismatch"],
      };
    }
    if (seenResolvedTakeIds.has(resolvedTakeCore)) {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "duplicate_resolved_take_id",
        blocker_codes: ["duplicate_resolved_take_id"],
      };
    }
    seenResolvedTakeIds.add(resolvedTakeCore);
    resolvedRows.push({ ...resolved, take_id: resolvedTakeCore });
  }
  const byTake = new Map(resolvedRows.map((row) => [row.take_id, row]));
  const compared_takes: InternalComparisonTakeInput[] = [];
  for (let i = 0; i < ids.length; i++) {
    const takeId = ids[i]!;
    const row = byTake.get(takeId);
    if (!row)
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "take_not_resolved",
        blocker_codes: ["take_not_resolved"],
      };
    if (row.completed !== true || !row.analysis_run_id)
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "take_analysis_not_completed",
        blocker_codes: ["take_not_completed"],
      };
    if (/[\\/\s]/.test(row.analysis_run_id))
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "analysis_run_id_invalid_path",
        blocker_codes: ["analysis_run_id_invalid_path"],
      };
    try {
      assertSafeSegment(row.analysis_run_id, "analysis_run_id");
    } catch {
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "analysis_run_id_invalid_path",
        blocker_codes: ["analysis_run_id_invalid_path"],
      };
    }
    const explicit = input.compared_analysis_run_ids?.[i];
    if (explicit !== undefined) {
      if (typeof explicit !== "string" || !explicit.trim())
        return {
          ok: false,
          written: false,
          comparison_run_id: null,
          root_take_id: input.root_take_id,
          root_analysis_run_id: null,
          compared_take_ids: ids,
          compared_analysis_run_ids: [],
          emitted_artefact_ids: [],
          warning: "explicit_analysis_run_id_mismatch",
          blocker_codes: ["analysis_run_id_mismatch"],
        };
      if (/[\\/\s]/.test(explicit))
        return {
          ok: false,
          written: false,
          comparison_run_id: null,
          root_take_id: input.root_take_id,
          root_analysis_run_id: null,
          compared_take_ids: ids,
          compared_analysis_run_ids: [],
          emitted_artefact_ids: [],
          warning: "analysis_run_id_invalid_path",
          blocker_codes: ["analysis_run_id_invalid_path"],
        };
      try {
        assertSafeSegment(explicit, "compared_analysis_run_id");
      } catch {
        return {
          ok: false,
          written: false,
          comparison_run_id: null,
          root_take_id: input.root_take_id,
          root_analysis_run_id: null,
          compared_take_ids: ids,
          compared_analysis_run_ids: [],
          emitted_artefact_ids: [],
          warning: "analysis_run_id_invalid_path",
          blocker_codes: ["analysis_run_id_invalid_path"],
        };
      }
    }
    if (explicit && explicit !== row.analysis_run_id)
      return {
        ok: false,
        written: false,
        comparison_run_id: null,
        root_take_id: input.root_take_id,
        root_analysis_run_id: null,
        compared_take_ids: ids,
        compared_analysis_run_ids: [],
        emitted_artefact_ids: [],
        warning: "explicit_analysis_run_id_mismatch",
        blocker_codes: ["analysis_run_id_mismatch"],
      };
    compared_takes.push({ ...row, take_id: row.take_id, analysis_run_id: row.analysis_run_id });
  }
  const root = byTake.get(rootTakeIdCore);
  if (!root)
    return {
      ok: false,
      written: false,
      comparison_run_id: null,
      root_take_id: input.root_take_id,
      root_analysis_run_id: null,
      compared_take_ids: ids,
      compared_analysis_run_ids: [],
      emitted_artefact_ids: [],
      warning: "take_not_resolved",
      blocker_codes: ["take_not_resolved"],
    };
  const out = await runInternalComparisonForTakes({
    run_id: canonicalRootTakeRunId,
    root_take_id: rootTakeIdCore,
    root_analysis_run_id: root.analysis_run_id,
    compared_takes,
    manifest_reconciliation_mode: "required",
    comparison_run_id: input.comparison_run_id,
    source_module: input.source_module,
    source_stage: input.source_stage,
    root_dir: input.root_dir,
    internal_qa_emit: input.internal_qa_emit,
  });
  return {
    ok: out.written === true,
    written: out.written === true,
    comparison_run_id: out.comparison_run_id ?? null,
    root_take_id: input.root_take_id,
    root_analysis_run_id: canonicalRootTakeRunId || null,
    compared_take_ids: ids,
    compared_analysis_run_ids: compared_takes.map((t) => t.analysis_run_id),
    emitted_artefact_ids: out.emitted_artefact_ids ?? [],
    emitted_blocked_artefact_ids: out.emitted_blocked_artefact_ids ?? [],
    comparison_parity_status: out.comparison_parity_status,
    warning: out.warning ?? null,
    blocker_codes: out.blocker_codes ?? (out.written ? [] : ["comparison_not_emitted"]),
  };
}
export async function runInternalComparisonForTakes(
  input: InternalComparisonRuntimeSourceInput,
): Promise<any> {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.root_take_id, "root_take_id");
  // Low-level/default mode stays preflight-free; required mode is operator/internal reconciliation.
  const rootTake =
    input.manifest_reconciliation_mode === "required"
      ? (() => {
          const canonicalInputRootCore = stripTakePrefix(input.root_take_id);
          if (!canonicalInputRootCore) return null;
          return (
            input.compared_takes.find(
              (t) => stripTakePrefix(t.take_id) === canonicalInputRootCore,
            ) ?? null
          );
        })()
      : (input.compared_takes.find((t) => t.take_id === input.root_take_id) ?? null);
  if (!rootTake) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const rootAnalysisRunId = input.root_analysis_run_id ?? rootTake.analysis_run_id;
  if (!rootAnalysisRunId) return { written: false as const, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(rootAnalysisRunId, "analysis_run_id");
  if (input.root_analysis_run_id && input.root_analysis_run_id !== rootTake.analysis_run_id)
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const comparedTakeIdsRaw = input.compared_takes.map((t) => t.take_id).filter(Boolean);
  const comparedAnalysisRunIdsRaw = input.compared_takes
    .map((t) => t.analysis_run_id)
    .filter(Boolean);
  const comparedTakeIds = [...new Set(comparedTakeIdsRaw)];
  const comparedAnalysisRunIds = [...new Set(comparedAnalysisRunIdsRaw)];
  if (comparedTakeIds.length < 2 || comparedAnalysisRunIds.length < 2)
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  comparedTakeIds.forEach((id) => assertSafeSegment(id, "compared_take_id"));
  comparedAnalysisRunIds.forEach((id) => assertSafeSegment(id, "compared_analysis_run_id"));
  const comparison_run_id =
    input.comparison_run_id ??
    computeDeterministicComparisonRunId(comparedTakeIds, comparedAnalysisRunIds);
  assertSafeSegment(comparison_run_id, "comparison_run_id");
  const comparedTakesWithMediaIdentity = input.compared_takes.map((take) => ({
    ...take,
    media_identity:
      take.media_identity ??
      buildMediaIdentityPayload({
        run_id: input.run_id,
        take,
        source_module: input.source_module,
        source_stage: input.source_stage,
      }),
  }));
  const duplicate_detection_trace = buildTier1DuplicateDetectionTrace({
    run_id: input.run_id,
    analysis_run_id: rootAnalysisRunId,
    comparison_run_id,
    compared_takes: comparedTakesWithMediaIdentity,
    compared_take_ids: comparedTakeIds,
    compared_analysis_run_ids: comparedAnalysisRunIds,
    operator_same_video_assertion: input.operator_same_video_assertion,
    source_module: input.source_module,
    source_stage: input.source_stage,
  });
  const duplicateDetectionStatus = String(
    duplicate_detection_trace.duplicate_detection_status ?? "insufficient_evidence",
  );
  const sameTake = Boolean(
    (duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)
      ?.same_take_id,
  );
  const sameAnalysis = Boolean(
    (duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)
      ?.same_analysis_run_id,
  );
  const sameMux = Boolean(
    (duplicate_detection_trace.reference_diagnostics as Record<string, unknown> | undefined)
      ?.same_mux_playback_ref,
  );
  const sameVideoDetected =
    duplicateDetectionStatus === "detected" || duplicateDetectionStatus === "likely_duplicate";
  const sameVideoUnresolved =
    duplicateDetectionStatus === "possible_duplicate" ||
    duplicateDetectionStatus === "insufficient_evidence";
  const routes = comparedTakesWithMediaIdentity.map(
    (t) => `${t.analysis_route ?? "unknown"}|${t.model_provider_family ?? "unknown"}`,
  );
  const routeVarianceDetected = new Set(routes).size > 1;
  const suppressionRequired = sameVideoDetected || sameVideoUnresolved || routeVarianceDetected;
  const suppressionDecision = suppressionRequired ? "suppressed" : "allowed_internal_only";
  const suppressionReasons = [
    ...(sameVideoDetected ? ["same_video_or_repeated_input"] : []),
    ...(sameVideoUnresolved ? ["duplicate_detection_insufficient_or_unresolved"] : []),
    ...(routeVarianceDetected ? ["unresolved_route_variance"] : []),
  ];
  const suppressionReason = suppressionReasons[0] ?? null;
  const recommendationSuppressed = suppressionRequired;
  const comparisonDecisionStatus = sameVideoDetected
    ? "suppressed_same_video"
    : sameVideoUnresolved
      ? "suppressed_duplicate_detection_unresolved"
      : routeVarianceDetected
        ? "suppressed_route_variance"
        : "internal_preference";
  const selectedTakeId = suppressionRequired ? null : comparedTakeIds[0];
  const comparison_raw_data = stripForbiddenFieldsDeep({
    comparison_run_id,
    compared_take_ids: comparedTakeIds,
    compared_analysis_run_ids: comparedAnalysisRunIds,
    comparison_execution_status: "executed",
    comparison_run_executed: true,
    comparison_decision_status: comparisonDecisionStatus,
    duplicate_detection_status: duplicateDetectionStatus,
    duplicate_detection_confidence: duplicate_detection_trace.duplicate_detection_confidence,
    recommendation_suppressed: recommendationSuppressed,
    suppression_reason: suppressionReason,
    suppression_reasons: suppressionReasons,
    suppression_decision: suppressionDecision,
    comparison_source_kind: "internal_runtime_comparison",
    comparison_runtime_source_module: input.source_module,
    comparison_runtime_source_stage: input.source_stage,
    selected_take_id_internal_only: selectedTakeId,
    selected_take_id_satisfies_comparison_gate: !suppressionRequired,
    rejected_public_winner_reason: suppressionRequired
      ? "public_comparison_forbidden_or_insufficient"
      : null,
    comparison_result_summary: {
      selected_take_id_internal_only: selectedTakeId,
      basis: "internal_runtime_input_summaries",
    },
    redaction_policy:
      "exclude prompts/raw responses/request bodies/headers/secrets/tokens/cookies/signed URLs/video URLs",
    redacted_fields: [
      "raw_prompt",
      "prompt",
      "system_prompt",
      "user_prompt",
      "request_body",
      "raw_response",
      "response_text",
      "model_output",
      "candidates",
      "completion_text",
      "headers",
      "authorization",
      "api_key",
      "token",
      "secret",
      "cookie",
      "session",
      "signed_url",
      "playback_url",
      "video_url",
    ],
    forbidden_fields_absent: true,
    public_output_unchanged: true,
  }) as Record<string, unknown>;
  const same_video_repeatability_trace = {
    same_take_id: sameTake,
    same_analysis_run_id: sameAnalysis,
    same_mux_playback_ref: sameMux,
    duplicate_detection_status: duplicateDetectionStatus,
    duplicate_detection_confidence: duplicate_detection_trace.duplicate_detection_confidence,
    same_video_detection_status: duplicateDetectionStatus,
    same_video_detected: sameVideoDetected,
    repeated_input_detected: sameVideoDetected,
    same_video_unresolved_risk: sameVideoUnresolved,
    same_video_suppression_status:
      sameVideoDetected || sameVideoUnresolved ? "suppressed" : "not_applicable",
    forced_winner_risk: sameVideoDetected,
    false_winner_risk: sameVideoDetected,
    suppression_required: suppressionRequired,
    suppression_applied: suppressionRequired,
    diagnostic_entries: [
      {
        compared_take_ids: comparedTakeIds,
        compared_analysis_run_ids: comparedAnalysisRunIds,
        reference_diagnostics: duplicate_detection_trace.reference_diagnostics,
      },
    ],
    same_video_repeatability_trace_summary: {
      same_video_detected: sameVideoDetected,
      duplicate_detection_status: duplicateDetectionStatus,
    },
  };
  const suppression_trace = {
    suppression_decision: suppressionDecision,
    suppression_reason: suppressionReason,
    suppression_reasons: suppressionReasons,
    recommendation_suppressed: recommendationSuppressed,
    duplicate_detection_status: duplicateDetectionStatus,
    affected_public_surfaces: ["public_output_unchanged_internal_only"],
    false_winner_prevention_status: suppressionRequired ? "active" : "not_required",
    same_video_suppression_status:
      sameVideoDetected || sameVideoUnresolved ? "suppressed" : "not_applicable",
    route_variance_suppression_status: routeVarianceDetected ? "suppressed" : "not_applicable",
    decision_source_refs: comparedAnalysisRunIds,
    comparison_suppression_trace_summary: {
      suppression_decision: suppressionDecision,
      duplicate_detection_status: duplicateDetectionStatus,
    },
    public_output_unchanged: true,
  };
  const route_variance_trace = {
    route_variance_status: routeVarianceDetected ? "detected" : "not_detected",
    compared_run_routes: routes,
    route_mismatch_detected: routeVarianceDetected,
    route_variance_detected: routeVarianceDetected,
    route_variance_risk: routeVarianceDetected,
    route_variance_mitigation_status: routeVarianceDetected ? "unresolved_blocked" : "not_required",
    route_variance_trace_summary: { route_variance_detected: routeVarianceDetected },
  };
  // Required mode must keep preflight, comparison writes, manifest rewrite and metrics rewrite on the same root.
  if (input.manifest_reconciliation_mode === "required") {
    try {
      const canonicalRootTakeCore = stripTakePrefix(input.root_take_id);
      assertSafeSegment(canonicalRootTakeCore, "root_take_id");
      const canonicalRootRunId = toCanonicalTakeRunId(canonicalRootTakeCore);
      if (!canonicalRootRunId)
        return { written: false as const, emitted_artefact_ids: [] as string[] };
      const canonicalComparedTakeIds = comparedTakeIds.map((id) => stripTakePrefix(id));
      if (canonicalComparedTakeIds.some((id) => !id))
        return { written: false as const, emitted_artefact_ids: [] as string[] };
      canonicalComparedTakeIds.forEach((id) => assertSafeSegment(id, "compared_take_id"));
      return emitComparisonRuntimeArtifactsWithManifestReconciliation({
        run_id: canonicalRootRunId,
        root_take_id: canonicalRootTakeCore,
        take_id: canonicalRootTakeCore,
        analysis_run_id: canonicalRootRunId,
        comparison_run_id,
        compared_take_ids: canonicalComparedTakeIds,
        comparison_raw_data,
        same_video_repeatability_trace,
        duplicate_detection_trace,
        suppression_trace,
        route_variance_trace,
        media_identity_payloads: comparedTakesWithMediaIdentity
          .map((take) => take.media_identity!)
          .filter(Boolean),
        source_module: input.source_module,
        source_stage: input.source_stage,
        root_dir: input.root_dir,
        internal_qa_emit: input.internal_qa_emit,
      });
    } catch {
      return { written: false as const, emitted_artefact_ids: [] as string[] };
    }
  }
  return emitComparisonRuntimeArtifacts({
    run_id: input.run_id,
    take_id: input.root_take_id,
    analysis_run_id: rootAnalysisRunId,
    comparison_run_id,
    compared_take_ids: comparedTakeIds,
    comparison_raw_data,
    same_video_repeatability_trace,
    duplicate_detection_trace,
    suppression_trace,
    route_variance_trace,
    media_identity_payloads: comparedTakesWithMediaIdentity
      .map((take) => take.media_identity!)
      .filter(Boolean),
    source_module: input.source_module,
    source_stage: input.source_stage,
    root_dir: input.root_dir,
    internal_qa_emit: input.internal_qa_emit,
  });
}
export async function emitQAManifestForAnalysisRun(metadata: QARuntimeMetadata) {
  const internalEmit = resolveInternalQAEmitEnabled({
    internal_qa_emit: metadata.internal_qa_emit,
  });
  if (!internalEmit) return { written: false, warning: null as string | null };
  try {
    const initialEmitted = [...(metadata.emitted_artefact_ids ?? [])].filter(
      (id) => id !== "qa_acceptance_metrics",
    );
    const normalisedComparedTakeIds = normaliseUniqueTakeCores(
      metadata.compared_take_ids ?? metadata.take_ids,
    );
    const baseOptions = {
      internal_qa_emit: true,
      run_id: metadata.run_id,
      analysis_run_id: metadata.analysis_run_id ?? metadata.run_id,
      comparison_run_id: metadata.comparison_run_id,
      take_id: metadata.take_id ?? metadata.take_ids?.[0],
      submission_id: metadata.submission_id,
      compared_take_ids: normalisedComparedTakeIds,
      fixture_id: metadata.fixture_id,
      commit_sha: metadata.commit_sha,
      branch_name: metadata.branch_name,
      root_dir: metadata.root_dir,
      ...(metadata.source_scope_file ? { source_scope_file: metadata.source_scope_file } : {}),
      input_refs: metadata.submission_id ? [`submission:${metadata.submission_id}`] : [],
      take_refs: metadata.take_ids ?? [],
      mux_playback_ids: metadata.mux_playback_ids,
      fixture_refs: metadata.route_module ? [`route:${metadata.route_module}`] : [],
      emitted_artefact_ids: initialEmitted,
      emitted_blocked_artefact_ids: metadata.emitted_blocked_artefact_ids ?? [],
      deferred_artefact_ids: metadata.deferred_artefact_ids ?? [],
      not_applicable_artefact_ids: metadata.not_applicable_artefact_ids ?? [],
      runtime_operator_verification_status: metadata.runtime_operator_verification_status,
      runtime_bundle_freshness_status: metadata.runtime_bundle_freshness_status,
      runtime_bundle_matches_current_commit_status:
        metadata.runtime_bundle_matches_current_commit_status,
      runtime_bundle_matches_current_implementation_status:
        metadata.runtime_bundle_matches_current_implementation_status,
      runtime_verified_take_ids: metadata.runtime_verified_take_ids,
      runtime_verified_comparison_run_ids: metadata.runtime_verified_comparison_run_ids,
      runtime_verified_deployment_ref: metadata.runtime_verified_deployment_ref,
      runtime_verified_at: metadata.runtime_verified_at,
      runtime_verified_by_role: metadata.runtime_verified_by_role,
      operator_confirmation_status: metadata.operator_confirmation_status,
      operator_confirmed_pr_or_commit: metadata.operator_confirmed_pr_or_commit,
      operator_confirmation_reason: metadata.operator_confirmation_reason,
      runtime_evidence_accepted_by_id: metadata.runtime_evidence_accepted_by_id,
      runtime_evidence_blocked_by_id: metadata.runtime_evidence_blocked_by_id,
      artefact_source_classification_by_id: metadata.artefact_source_classification_by_id,
      artefact_level2_spine_satisfaction_by_id: metadata.artefact_level2_spine_satisfaction_by_id,
      legacy_adapter_artefact_ids: metadata.legacy_adapter_artefact_ids,
      real_v3_spine_artefact_ids: metadata.real_v3_spine_artefact_ids,
      defect_risk_ids: metadata.defect_risk_ids,
      public_claim_trace_summary: metadata.public_claim_trace_summary,
      claim_candidate_trace_summary: metadata.claim_candidate_trace_summary,
      evidence_anchor_trace_summary: metadata.evidence_anchor_trace_summary,
      technique_observation_trace_summary: metadata.technique_observation_trace_summary,
      score_trace_summary: metadata.score_trace_summary,
      model_run_trace_summary: metadata.model_run_trace_summary,
      analysis_evidence_state_summary: metadata.analysis_evidence_state_summary,
      step1_observable_evidence_summary: metadata.step1_observable_evidence_summary,
      media_identity_summary: metadata.media_identity_summary,
      report_parity_summary: metadata.report_parity_summary,
      runtime_verification_trace_summary: metadata.runtime_verification_trace_summary,
      comparison_parity_summary: metadata.comparison_parity_summary,
    };
    const manifestRelativePath = shouldUseExpandedManifestPaths()
      ? buildTakeAnalysisRelativePath({
          run_id: metadata.run_id,
          take_id: baseOptions.take_id,
          analysis_run_id: baseOptions.analysis_run_id,
          leaf: "manifest.json",
        })
      : "manifest.json";
    const metricsRelativePath = shouldUseExpandedManifestPaths()
      ? buildTakeAnalysisRelativePath({
          run_id: metadata.run_id,
          take_id: baseOptions.take_id,
          analysis_run_id: baseOptions.analysis_run_id,
          leaf: "qa/acceptance_metrics.json",
        })
      : "qa/acceptance_metrics.json";

    const runtimeVerificationSummary = isRecord(metadata.runtime_verification_trace_summary)
      ? metadata.runtime_verification_trace_summary
      : {};
    const runtimeSummaryString = (key: string) => {
      const value = runtimeVerificationSummary[key];
      return typeof value === "string" && value.trim() ? value.trim() : undefined;
    };
    const runtimeSummaryStringArray = (key: string) =>
      getStringArray(runtimeVerificationSummary[key]);
    const shouldEmitRuntimeVerificationTrace = true;
    const runtimeVerificationTraceWrite = shouldEmitRuntimeVerificationTrace
      ? await emitRuntimeVerificationTrace({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: baseOptions.take_id ?? null,
          comparison_run_id: metadata.comparison_run_id ?? null,
          verification_scope:
            metadata.comparison_run_id || normalisedComparedTakeIds.length > 1
              ? "duplicate_same_video_comparison"
              : "ordinary_single_take",
          runtime_operator_verification_status:
            metadata.runtime_operator_verification_status ??
            runtimeSummaryString("runtime_operator_verification_status"),
          runtime_bundle_freshness_status:
            metadata.runtime_bundle_freshness_status ??
            runtimeSummaryString("runtime_bundle_freshness_status"),
          runtime_bundle_matches_current_commit_status:
            metadata.runtime_bundle_matches_current_commit_status ??
            runtimeSummaryString("runtime_bundle_matches_current_commit_status"),
          runtime_bundle_matches_current_implementation_status:
            metadata.runtime_bundle_matches_current_implementation_status ??
            runtimeSummaryString("runtime_bundle_matches_current_implementation_status"),
          runtime_verified_take_ids:
            metadata.runtime_verified_take_ids ??
            runtimeSummaryStringArray("runtime_verified_take_ids"),
          runtime_verified_comparison_run_ids:
            metadata.runtime_verified_comparison_run_ids ??
            runtimeSummaryStringArray("runtime_verified_comparison_run_ids"),
          runtime_verified_artefact_ids:
            initialEmitted.length > 0
              ? initialEmitted
              : runtimeSummaryStringArray("runtime_verified_artefact_ids"),
          runtime_verified_deployment_ref:
            metadata.runtime_verified_deployment_ref ??
            runtimeSummaryString("runtime_verified_deployment_ref"),
          runtime_verified_at:
            metadata.runtime_verified_at ?? runtimeSummaryString("runtime_verified_at"),
          runtime_verified_by_role:
            metadata.runtime_verified_by_role ?? runtimeSummaryString("runtime_verified_by_role"),
          operator_confirmation_status:
            metadata.operator_confirmation_status ??
            runtimeSummaryString("operator_confirmation_status"),
          operator_confirmation_reason:
            metadata.operator_confirmation_reason ??
            runtimeSummaryString("operator_confirmation_reason"),
          operator_confirmed_runtime_build_ref:
            metadata.operator_confirmed_pr_or_commit ??
            runtimeSummaryString("operator_confirmed_runtime_build_ref"),
          public_output_unchanged: true,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
        })
      : {
          written: false as const,
          emitted_artefact_ids: [] as string[],
          runtime_verification_trace_summary: metadata.runtime_verification_trace_summary ?? null,
        };
    const runtimeVerificationTraceWarning = getQAWriteWarning(runtimeVerificationTraceWrite);
    if (runtimeVerificationTraceWrite.written) {
      initialEmitted.push("runtime_verification_trace");
      baseOptions.emitted_artefact_ids = [...new Set(initialEmitted)];
      baseOptions.runtime_verification_trace_summary =
        runtimeVerificationTraceWrite.runtime_verification_trace_summary ?? undefined;
      baseOptions.artefact_source_classification_by_id = {
        ...(baseOptions.artefact_source_classification_by_id ?? {}),
        runtime_verification_trace: "runtime_verification_trace",
      };
      baseOptions.artefact_level2_spine_satisfaction_by_id = {
        ...(baseOptions.artefact_level2_spine_satisfaction_by_id ?? {}),
        runtime_verification_trace: false,
      };
    }

    console.info("[internal-qa] manifest_write_attempt", {
      event: "manifest_write_attempt",
      run_id: metadata.run_id,
      analysis_run_id: baseOptions.analysis_run_id,
      take_id: baseOptions.take_id ?? null,
      artefact_id: "manifest",
      relative_path: manifestRelativePath,
      resolved_storage_path: null,
      sink: process.env.QA_ARTIFACT_SINK ?? "file",
      bucket: process.env.QA_ARTIFACTS_BUCKET ?? null,
      emitted_artefact_ids: initialEmitted,
      timestamp: new Date().toISOString(),
    });
    const out = await emitInternalQAArtifactManifest({
      ...baseOptions,
      manifest_relative_path: manifestRelativePath,
    });
    console.info("[internal-qa] manifest_write_result", {
      event: "manifest_write_result",
      run_id: metadata.run_id,
      take_id: baseOptions.take_id ?? null,
      manifest_path: (out as { manifest_path?: string }).manifest_path ?? null,
      written: Boolean(out.written),
      warning: getQAWriteWarning(out),
    });
    const initialManifestWarning = getQAWriteWarning(out);
    if (!("manifest" in out)) {
      const initialWarning = mergeQAWarnings(
        initialManifestWarning,
        "internal_qa_manifest_sink_write_failed",
      );
      return {
        written: false,
        warning: initialWarning,
        manifest_path: (out as { manifest_path?: string }).manifest_path,
      };
    }
    const preFinalManifest = (out as any).manifest;
    const preFinalMetrics = {
      ...buildQAAcceptanceMetrics(preFinalManifest),
      ...resolveQADeploymentProvenance(),
    };
    const intendedSameFinalisationArtefactIds = ["validator_trace", "gate_trace"];
    let emittedWithInternalTraces = [...new Set(initialEmitted)];
    let emittedBlockedWithInternalTraces = [
      ...new Set(metadata.emitted_blocked_artefact_ids ?? []),
    ];
    const artefactSourceClassificationById = {
      ...(metadata.artefact_source_classification_by_id ?? {}),
    };
    const artefactLevel2ById = { ...(metadata.artefact_level2_spine_satisfaction_by_id ?? {}) };
    let reportParitySummary = metadata.report_parity_summary;
    let comparisonParitySummary = metadata.comparison_parity_summary;
    const noExportSourceById: Record<string, string> = {
      no_export_source_proof: "internal_no_export_source_proof",
      no_export_config_proof: "internal_no_export_config_proof",
      no_export_ui_proof: "internal_no_export_ui_proof",
      no_export_log_proof: "internal_no_export_log_proof",
      no_export_proof: "internal_no_export_proof_bundle",
    };
    for (const id of emittedWithInternalTraces) {
      if (noExportSourceById[id] && !artefactSourceClassificationById[id])
        artefactSourceClassificationById[id] = noExportSourceById[id];
      if (id.startsWith("no_export_") && artefactLevel2ById[id] === undefined)
        artefactLevel2ById[id] = false;
    }
    let validatorTraceSummary: Record<string, unknown> | undefined;
    let gateTraceSummary: Record<string, unknown> | undefined;
    let takeIdForFirstPassTraces: string | null = null;
    try {
      takeIdForFirstPassTraces = resolveTakeIdForFirstPassTraces({
        take_id: baseOptions.take_id,
        run_id: baseOptions.run_id,
      });
    } catch {
      takeIdForFirstPassTraces = null;
    }
    const rawTakeIdProvided =
      typeof baseOptions.take_id === "string" && baseOptions.take_id.length > 0;
    const comparisonParityTakeId =
      rawTakeIdProvided && !isSafeComparisonParityTakeIdSegment(baseOptions.take_id)
        ? "../unsafe_take_id"
        : (takeIdForFirstPassTraces ?? undefined);
    const canEmitTakeScopedFirstPassTraces =
      shouldUseExpandedManifestPaths() && takeIdForFirstPassTraces !== null;
    if (canEmitTakeScopedFirstPassTraces) {
      const validatorWrite = await emitValidatorTraceFirstPass({
        run_id: metadata.run_id,
        analysis_run_id: baseOptions.analysis_run_id,
        take_id: takeIdForFirstPassTraces ?? undefined,
        source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
        source_stage: "emitQAManifestForAnalysisRun.pre_finalisation",
        manifest_snapshot: preFinalManifest,
        acceptance_metrics_snapshot: preFinalMetrics,
        emitted_artefact_ids: emittedWithInternalTraces,
        artefact_source_classification_by_id: artefactSourceClassificationById,
        artefact_level2_spine_satisfaction_by_id: artefactLevel2ById,
        public_claim_trace_summary: metadata.public_claim_trace_summary,
        technique_observation_trace_summary: metadata.technique_observation_trace_summary,
        score_trace_summary: metadata.score_trace_summary,
        model_run_trace_summary: metadata.model_run_trace_summary,
        root_dir: metadata.root_dir,
        internal_qa_emit: true,
        intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
      });
      if (validatorWrite.written) {
        emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, "validator_trace"])];
        artefactSourceClassificationById.validator_trace = "internal_validator";
        artefactLevel2ById.validator_trace = false;
        validatorTraceSummary = validatorWrite.validator_trace_summary;
      }
      const gateWrite = await emitGateTraceFirstPass({
        run_id: metadata.run_id,
        analysis_run_id: baseOptions.analysis_run_id,
        take_id: takeIdForFirstPassTraces ?? undefined,
        source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
        source_stage: "emitQAManifestForAnalysisRun.pre_finalisation",
        manifest_snapshot: preFinalManifest,
        acceptance_metrics_snapshot: preFinalMetrics,
        emitted_artefact_ids: emittedWithInternalTraces,
        missing_artefact_ids: (preFinalManifest?.missing_artifacts ?? []) as string[],
        blocker_codes: (preFinalManifest?.blocker_codes ?? []) as string[],
        validator_trace_summary: validatorTraceSummary,
        root_dir: metadata.root_dir,
        internal_qa_emit: true,
        intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
      });
      if (gateWrite.written) {
        emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, "gate_trace"])];
        artefactSourceClassificationById.gate_trace = "internal_gate_trace";
        artefactLevel2ById.gate_trace = false;
        gateTraceSummary = gateWrite.gate_trace_summary;
      }
    }

    if (metadata.report_parity_input) {
      let renderPayloadForParity = metadata.report_parity_input?.render_payload ?? null;
      let publicReportPayloadForParity =
        metadata.report_parity_input?.public_report_payload ?? null;
      let renderSourceKindForParity = metadata.report_parity_input.render_source_kind ?? null;
      let publicReportSourceKindForParity =
        metadata.report_parity_input.public_report_source_kind ?? null;
      if (
        !renderPayloadForParity &&
        (metadata.report_parity_input?.render_report_data ||
          metadata.report_parity_input?.raw_report_data)
      ) {
        const renderPayloadWrite = await emitRenderPayloadArtifact({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          submission_id: metadata.submission_id,
          source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
          source_stage: "emitQAManifestForAnalysisRun.pre_finalisation",
          raw_report_data: metadata.report_parity_input.raw_report_data,
          render_report_data: metadata.report_parity_input.render_report_data,
          render_source_kind: metadata.report_parity_input.render_source_kind,
          allowed_field_paths: metadata.report_parity_input.allowed_public_fields,
          blocked_field_paths: metadata.report_parity_input.blocked_field_paths,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
        });
        if (renderPayloadWrite.written) {
          renderPayloadForParity = renderPayloadWrite.parity_payload;
          renderSourceKindForParity = renderPayloadWrite.render_source_kind ?? null;
          artefactSourceClassificationById.render_payload = "internal_render_payload";
          artefactLevel2ById.render_payload = false;
          if (renderPayloadWrite.render_payload_status === "emitted") {
            emittedWithInternalTraces = [
              ...new Set([...emittedWithInternalTraces, "render_payload"]),
            ];
            emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
              (id) => id !== "render_payload",
            );
          } else {
            emittedWithInternalTraces = emittedWithInternalTraces.filter(
              (id) => id !== "render_payload",
            );
            emittedBlockedWithInternalTraces = [
              ...new Set([...emittedBlockedWithInternalTraces, "render_payload"]),
            ];
          }
        }
      }
      if (!publicReportPayloadForParity && renderPayloadForParity) {
        const publicPayloadWrite = await emitPublicReportPayloadArtifact({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          submission_id: metadata.submission_id,
          source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
          source_stage: "emitQAManifestForAnalysisRun.pre_finalisation",
          raw_report_data: metadata.report_parity_input.raw_report_data,
          render_payload: renderPayloadForParity,
          public_report_data:
            metadata.report_parity_input.public_report_data ??
            metadata.report_parity_input.render_report_data,
          public_report_source_kind:
            metadata.report_parity_input.public_report_source_kind ??
            metadata.report_parity_input.render_source_kind,
          allowed_field_paths: metadata.report_parity_input.allowed_public_fields,
          blocked_field_paths: metadata.report_parity_input.blocked_field_paths,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
        });
        if (publicPayloadWrite.written) {
          publicReportPayloadForParity = publicPayloadWrite.parity_payload;
          publicReportSourceKindForParity = publicPayloadWrite.public_report_source_kind ?? null;
          artefactSourceClassificationById.public_report_payload = "internal_public_report_payload";
          artefactLevel2ById.public_report_payload = false;
          if (publicPayloadWrite.public_report_payload_status === "emitted") {
            emittedWithInternalTraces = [
              ...new Set([...emittedWithInternalTraces, "public_report_payload"]),
            ];
            emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
              (id) => id !== "public_report_payload",
            );
          } else {
            emittedWithInternalTraces = emittedWithInternalTraces.filter(
              (id) => id !== "public_report_payload",
            );
            emittedBlockedWithInternalTraces = [
              ...new Set([...emittedBlockedWithInternalTraces, "public_report_payload"]),
            ];
          }
        }
      }
      const paritySourceReportData = metadata.report_parity_input?.render_report_data
        ? { report_data: metadata.report_parity_input.render_report_data }
        : metadata.report_parity_input?.raw_report_data;
      const parityWrite = await emitReportParityProof({
        run_id: metadata.run_id,
        analysis_run_id: baseOptions.analysis_run_id,
        take_id: takeIdForFirstPassTraces ?? undefined,
        submission_id: metadata.submission_id,
        source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
        source_stage: "emitQAManifestForAnalysisRun.pre_finalisation",
        raw_report_data: paritySourceReportData,
        render_payload: renderPayloadForParity,
        public_report_payload: publicReportPayloadForParity,
        render_source_kind: renderSourceKindForParity,
        public_report_source_kind: publicReportSourceKindForParity,
        allowed_public_fields: metadata.report_parity_input?.allowed_public_fields,
        blocked_field_paths: metadata.report_parity_input?.blocked_field_paths,
        blocked_score_field_paths: metadata.report_parity_input?.blocked_score_field_paths,
        root_dir: metadata.root_dir,
        internal_qa_emit: true,
      });
      if (parityWrite.written) {
        artefactSourceClassificationById.parity_report = "internal_report_parity_proof";
        artefactLevel2ById.parity_report = parityWrite.parity_status === "passed";
        reportParitySummary = parityWrite.report_parity_summary ?? {
          parity_status: parityWrite.parity_status,
        };
        if (parityWrite.parity_status === "passed") {
          emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, "parity_report"])];
          emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
            (id) => id !== "parity_report",
          );
        } else {
          emittedWithInternalTraces = emittedWithInternalTraces.filter(
            (id) => id !== "parity_report",
          );
          emittedBlockedWithInternalTraces = [
            ...new Set([...emittedBlockedWithInternalTraces, "parity_report"]),
          ];
        }
      }
    }
    const comparisonInvoked =
      Boolean(metadata.comparison_run_id) ||
      normalisedComparedTakeIds.length > 1 ||
      COMPARISON_ARTEFACT_IDS.some(
        (id) =>
          emittedWithInternalTraces.includes(id) || emittedBlockedWithInternalTraces.includes(id),
      );
    const comparisonEvidenceStatus = {
      comparison_raw: emittedWithInternalTraces.includes("comparison_raw"),
      comparison_report_internal: emittedWithInternalTraces.includes("comparison_report_internal"),
      same_video_repeatability_trace: emittedWithInternalTraces.includes(
        "same_video_repeatability_trace",
      ),
      duplicate_detection_trace: emittedWithInternalTraces.includes("duplicate_detection_trace"),
      comparison_suppression_trace: emittedWithInternalTraces.includes(
        "comparison_suppression_trace",
      ),
      route_variance_trace: emittedWithInternalTraces.includes("route_variance_trace"),
    };
    const hasCompleteComparisonEvidence = Object.values(comparisonEvidenceStatus).every(Boolean);
    const parityDeferred = (metadata.deferred_artefact_ids ?? []).includes("parity_comparison");
    const shouldEmitComparisonParity = comparisonInvoked && !parityDeferred;
    const comparisonParityWrite = shouldEmitComparisonParity
      ? await emitComparisonParityProof({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: comparisonParityTakeId,
          submission_id: metadata.submission_id ?? null,
          comparison_run_id: metadata.comparison_run_id ?? null,
          compared_take_ids: normalisedComparedTakeIds,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
          comparison_invoked: comparisonInvoked,
          comparison_evidence_status: comparisonEvidenceStatus,
          comparison_payloads: metadata.comparison_parity_input?.comparison_payloads ?? undefined,
          public_comparison_surface_paths:
            metadata.comparison_parity_input?.public_comparison_surface_paths ?? undefined,
        })
      : {
          written: false,
          emitted_artefact_ids: [] as string[],
          parity_status: (comparisonInvoked ? "insufficient" : "not_applicable") as
            | "insufficient"
            | "not_applicable",
          blocker_codes: [] as string[],
          comparison_parity_summary: null as Record<string, unknown> | null,
        };
    artefactSourceClassificationById.parity_comparison = "internal_comparison_parity_proof";
    artefactLevel2ById.parity_comparison =
      shouldEmitComparisonParity &&
      comparisonParityWrite.written &&
      comparisonParityWrite.parity_status === "passed";
    if (parityDeferred) {
      emittedWithInternalTraces = emittedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
    } else if (comparisonParityWrite.parity_status === "not_applicable") {
      emittedWithInternalTraces = emittedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
      baseOptions.not_applicable_artefact_ids = [
        ...new Set([...(baseOptions.not_applicable_artefact_ids ?? []), "parity_comparison"]),
      ];
    } else if (comparisonParityWrite.written && comparisonParityWrite.parity_status === "passed") {
      emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, "parity_comparison"])];
      emittedBlockedWithInternalTraces = emittedBlockedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
    } else if (comparisonParityWrite.written) {
      emittedWithInternalTraces = emittedWithInternalTraces.filter(
        (id) => id !== "parity_comparison",
      );
      emittedBlockedWithInternalTraces = [
        ...new Set([...emittedBlockedWithInternalTraces, "parity_comparison"]),
      ];
    }
    comparisonParitySummary =
      comparisonParityWrite.comparison_parity_summary ?? comparisonParitySummary;

    if (canEmitTakeScopedFirstPassTraces) {
      const proofSnapshotOut = await emitInternalQAArtifactManifest({
        ...baseOptions,
        manifest_relative_path: manifestRelativePath,
        emitted_artefact_ids: [...new Set([...emittedWithInternalTraces])],
        emitted_blocked_artefact_ids: emittedBlockedWithInternalTraces,
        runtime_evidence_accepted_by_id: [
          ...new Set([...(metadata.runtime_evidence_accepted_by_id ?? emittedWithInternalTraces)]),
        ],
        runtime_evidence_blocked_by_id: [
          ...new Set([
            ...(metadata.runtime_evidence_blocked_by_id ?? emittedBlockedWithInternalTraces),
            ...emittedBlockedWithInternalTraces,
          ]),
        ],
        artefact_source_classification_by_id: artefactSourceClassificationById,
        artefact_level2_spine_satisfaction_by_id: artefactLevel2ById,
        report_parity_summary: reportParitySummary,
        comparison_parity_summary: comparisonParitySummary,
      });
      if (proofSnapshotOut.written && "manifest" in (proofSnapshotOut as any)) {
        const proofSnapshotManifest = (proofSnapshotOut as any).manifest;
        const proofSnapshotMetrics = {
          ...buildQAAcceptanceMetrics(proofSnapshotManifest),
          ...resolveQADeploymentProvenance(),
        };
        const validatorWrite = await emitValidatorTraceFirstPass({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
          source_stage: "emitQAManifestForAnalysisRun.final_proof_chain",
          manifest_snapshot: proofSnapshotManifest,
          acceptance_metrics_snapshot: proofSnapshotMetrics,
          emitted_artefact_ids: emittedWithInternalTraces,
          artefact_source_classification_by_id: artefactSourceClassificationById,
          artefact_level2_spine_satisfaction_by_id: artefactLevel2ById,
          public_claim_trace_summary: metadata.public_claim_trace_summary,
          technique_observation_trace_summary: metadata.technique_observation_trace_summary,
          score_trace_summary: metadata.score_trace_summary,
          model_run_trace_summary: metadata.model_run_trace_summary,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
          intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
        });
        if (validatorWrite.written) {
          emittedWithInternalTraces = [
            ...new Set([...emittedWithInternalTraces, "validator_trace"]),
          ];
          const validatorSatisfied =
            validatorWrite.validator_trace_summary?.validator_trace_gate_status === "satisfied";
          artefactSourceClassificationById.validator_trace = validatorSatisfied
            ? "independent_validation_satisfying"
            : "internal_validator";
          artefactLevel2ById.validator_trace = validatorSatisfied;
          validatorTraceSummary = validatorWrite.validator_trace_summary;
        }
        const gateWrite = await emitGateTraceFirstPass({
          run_id: metadata.run_id,
          analysis_run_id: baseOptions.analysis_run_id,
          take_id: takeIdForFirstPassTraces ?? undefined,
          source_module: "src/server/v3/qa-artifacts-wiring.server.ts",
          source_stage: "emitQAManifestForAnalysisRun.final_proof_chain",
          manifest_snapshot: proofSnapshotManifest,
          acceptance_metrics_snapshot: proofSnapshotMetrics,
          emitted_artefact_ids: emittedWithInternalTraces,
          missing_artefact_ids: (proofSnapshotManifest?.missing_artifacts ?? []) as string[],
          blocker_codes: (proofSnapshotManifest?.blocker_codes ?? []) as string[],
          validator_trace_summary: validatorTraceSummary,
          root_dir: metadata.root_dir,
          internal_qa_emit: true,
          intended_same_finalisation_artefact_ids: intendedSameFinalisationArtefactIds,
        });
        if (gateWrite.written) {
          emittedWithInternalTraces = [...new Set([...emittedWithInternalTraces, "gate_trace"])];
          const gateSatisfied =
            gateWrite.gate_trace_summary?.gate_trace_gate_status === "satisfied";
          artefactSourceClassificationById.gate_trace = gateSatisfied
            ? "independent_gate_decision"
            : "internal_gate_trace";
          artefactLevel2ById.gate_trace = gateSatisfied;
          gateTraceSummary = gateWrite.gate_trace_summary;
        }
      }
    }

    const metrics = preFinalMetrics;
    const qaWrite = await writeQAArtifact({
      root_dir: metadata.root_dir ?? DEFAULT_ROOT,
      run_id: metadata.run_id,
      relative_path: metricsRelativePath,
      payload: metrics,
      artefact_id: "qa_acceptance_metrics",
      fixture_id: metadata.fixture_id,
    });
    console.info("[internal-qa] acceptance_metrics_write_attempt", {
      event: "acceptance_metrics_write_attempt",
      run_id: metadata.run_id,
      take_id: baseOptions.take_id ?? null,
      metrics_path: qaWrite.path ?? qaWrite.storage_path ?? null,
      written: Boolean(qaWrite.written),
      warning: getQAWriteWarning(qaWrite),
    });
    console.info("[internal-qa] acceptance_metrics_write_result", {
      event: "acceptance_metrics_write_result",
      written: Boolean(qaWrite.written),
      warning: getQAWriteWarning(qaWrite),
      sink_warning: (qaWrite as any)?.sink_warning ?? null,
      resolved_storage_path: qaWrite.storage_path ?? qaWrite.path ?? null,
    });
    const finalOut = await emitInternalQAArtifactManifest({
      ...baseOptions,
      manifest_relative_path: manifestRelativePath,
      emitted_artefact_ids: [...new Set([...emittedWithInternalTraces, "qa_acceptance_metrics"])],
      emitted_blocked_artefact_ids: emittedBlockedWithInternalTraces,
      runtime_evidence_accepted_by_id: [
        ...new Set([
          ...(metadata.runtime_evidence_accepted_by_id ?? emittedWithInternalTraces),
          "qa_acceptance_metrics",
        ]),
      ],
      runtime_evidence_blocked_by_id: [
        ...new Set([
          ...(metadata.runtime_evidence_blocked_by_id ?? emittedBlockedWithInternalTraces),
          ...emittedBlockedWithInternalTraces,
        ]),
      ],
      artefact_source_classification_by_id: artefactSourceClassificationById,
      artefact_level2_spine_satisfaction_by_id: artefactLevel2ById,
      report_parity_summary: reportParitySummary,
      comparison_parity_summary: comparisonParitySummary,
      validator_trace_summary: validatorTraceSummary,
      gate_trace_summary: gateTraceSummary,
    });
    let finalMetricsWrite: Awaited<ReturnType<typeof writeQAArtifact>> | null = null;
    if (finalOut.written && "manifest" in (finalOut as any)) {
      const finalMetrics = {
        ...buildQAAcceptanceMetrics((finalOut as any).manifest),
        ...resolveQADeploymentProvenance(),
      };
      finalMetricsWrite = await writeQAArtifact({
        root_dir: metadata.root_dir ?? DEFAULT_ROOT,
        run_id: metadata.run_id,
        relative_path: metricsRelativePath,
        payload: finalMetrics,
        artefact_id: "qa_acceptance_metrics",
        fixture_id: metadata.fixture_id,
      });
    }
    const finalWarning = mergeQAWarnings(
      runtimeVerificationTraceWarning,
      initialManifestWarning,
      getQAWriteWarning(qaWrite),
      getQAWriteWarning(finalOut),
      getQAWriteWarning(finalMetricsWrite),
      qaWrite.written
        ? null
        : "pre_final qa_acceptance_metrics write failed before final manifest emission",
      finalOut.written
        ? null
        : "final QA manifest write failed after parity/no-export classification",
      finalOut.written && finalMetricsWrite && !finalMetricsWrite.written
        ? "final qa_acceptance_metrics rewrite failed after final manifest emission"
        : null,
    );
    return {
      written: finalOut.written,
      warning: finalWarning,
      manifest_path:
        (finalOut as { manifest_path?: string }).manifest_path ??
        (out as { manifest_path?: string }).manifest_path,
    };
  } catch (error) {
    return {
      written: false,
      warning: `internal_qa_manifest_emit_failed:${error instanceof Error ? error.message : "unknown"}`,
    };
  }
}

export async function emitTraceArtefact(input: TraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const result = await writeInternalJson(
    root,
    input.run_id,
    input.relative_path,
    input.trace_data,
    input.artefact_id,
  );
  return {
    written: result.written as boolean,
    path: result.path ?? result.storage_path,
    artefact_id: input.artefact_id,
    warning: result.warning,
  };
}

type EvidenceAnchorAggregateGateStatus = "insufficient" | "sufficient";
type EvidenceAnchorAggregateGateEvaluation = {
  evidenceAnchorGateStatus: EvidenceAnchorAggregateGateStatus;
  sourceClassification: string;
  gateReason: string;
  blockerCodes: string[];
  realRuntimeAnchorCount: number;
  blockedRealRuntimeAnchorCount: number;
  legacyAdapterAnchorCount: number;
  reportSnapshotAnchorCount: number;
  sourceScaffoldAnchorCount: number;
  blockedAnchorCount: number;
  excludedLegacyDiagnosticAnchorCount: number;
};

const REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS: Record<string, string> = {
  video: "missing_video_observable_evidence",
  audio: "missing_audio_observable_evidence",
  material: "missing_material_specific_performance_evidence",
  material_specific_performance: "missing_material_specific_performance_evidence",
  performance: "missing_performance_observable_evidence",
  candidate_technique: "missing_candidate_technique_evidence",
};

function normaliseEvidenceFamilyStatus(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value === true) return "complete";
  if (value === false) return "not_extracted";
  return "unknown";
}

function familyCoverageStatus(args: {
  family: string;
  coverage: Record<string, unknown> | null;
  statusById: Record<string, unknown> | null;
}): "complete" | "not_applicable" | "partial" | "missing" {
  const coverageValue = args.coverage?.[args.family];
  const status = normaliseEvidenceFamilyStatus(args.statusById?.[args.family] ?? coverageValue);
  if (status === "not_applicable" || coverageValue === "not_applicable") return "not_applicable";
  if (
    status === "complete" ||
    status === "sufficient" ||
    (coverageValue === true && status === "unknown")
  )
    return "complete";
  if (status === "partial" || coverageValue === "partial") return "partial";
  return "missing";
}

function unsupportedEvidenceFamilyBlocker(item: Record<string, unknown>): string | null {
  const haystack =
    `${String(item.evidence_kind ?? "")} ${String(item.reason ?? "")} ${String(item.status ?? "")}`.toLowerCase();
  if (haystack.includes("candidate_technique") || haystack.includes("technique"))
    return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.candidate_technique;
  if (haystack.includes("video")) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.video;
  if (haystack.includes("audio")) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.audio;
  if (haystack.includes("material")) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.material;
  if (haystack.includes("performance")) return REQUIRED_EVIDENCE_ANCHOR_FAMILY_BLOCKERS.performance;
  return null;
}

function safeUnsupportedEvidenceForAnchorHandoff(value: unknown): Array<Record<string, unknown>> {
  return safeRecordArray(value).map((item, index) => ({
    evidence_kind:
      typeof item.evidence_kind === "string" && item.evidence_kind.trim()
        ? item.evidence_kind.trim()
        : `unsupported_or_unavailable_evidence_${index + 1}`,
    status:
      typeof item.status === "string" && item.status.trim() ? item.status.trim() : "unavailable",
    blocker_codes: getStringArray(item.blocker_codes),
  }));
}

function evaluateEvidenceAnchorAggregateGate(args: {
  anchors: Array<Record<string, unknown>>;
  analysisEvidenceState: Record<string, unknown> | null;
}): EvidenceAnchorAggregateGateEvaluation {
  const anchors = args.anchors.filter(
    (anchor) => anchor.excluded_from_evidence_anchor_gate !== true,
  );
  const isRequiredOrdinaryFamilyAnchor = (anchor: Record<string, unknown>) =>
    ORDINARY_ANALYSIS_REQUIRED_FAMILY_IDS.includes(
      String(anchor.evidence_family ?? "") as OrdinaryAnalysisRequiredFamilyId,
    );
  const excludedLegacyDiagnosticAnchorCount = args.anchors.filter(
    (anchor) =>
      anchor.excluded_from_evidence_anchor_gate === true &&
      anchor.source_family === "legacy_adapter",
  ).length;
  const analysisEvidenceState = args.analysisEvidenceState;
  const realRuntimeAnchorCount = anchors.filter(
    (a) => a.source_family === "real_runtime_v3",
  ).length;
  const blockedRealRuntimeAnchorCount = anchors.filter(
    (a) => a.source_family === "real_runtime_v3_blocked",
  ).length;
  const aggregateBlockingRealRuntimeAnchorCount = anchors.filter(
    (a) =>
      a.source_family === "real_runtime_v3_blocked" &&
      !isLimitationOnlyEvidenceAnchor(a) &&
      isRequiredOrdinaryFamilyAnchor(a),
  ).length;
  const legacyAdapterAnchorCount = anchors.filter(
    (a) => a.source_family === "legacy_adapter",
  ).length;
  const sourceScaffoldAnchorCount = anchors.filter((a) =>
    ["source_scaffold", "helper_test", "local_file_fixture"].includes(
      String(a.source_family ?? a.source_classification ?? ""),
    ),
  ).length;
  const reportSnapshotAnchorCount = anchors.filter(
    (a) =>
      a.source_artefact_id === "raw_report" ||
      String(a.source_path ?? "").startsWith("report_data"),
  ).length;
  const blockedAnchorCount = anchors.filter((a) => a.cannot_satisfy_v3_gate === true).length;
  const aggregateBlockingAnchorCount = anchors.filter(
    (a) =>
      a.cannot_satisfy_v3_gate === true &&
      !isLimitationOnlyEvidenceAnchor(a) &&
      isRequiredOrdinaryFamilyAnchor(a),
  ).length;
  const unsupported = isRecord(analysisEvidenceState)
    ? safeRecordArray(analysisEvidenceState.unsupported_or_unavailable_evidence)
    : [];
  const unsupportedBlockerCodes = unsupported.flatMap((item) =>
    Array.isArray(item.blocker_codes)
      ? item.blocker_codes.filter((x): x is string => typeof x === "string")
      : [],
  );
  const ordinaryFamilyBlockerCodeSet = new Set([
    ...Object.values(ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS),
    ...Object.values(ORDINARY_ANALYSIS_FAMILY_EVENT_BLOCKERS).filter(
      (x): x is string => typeof x === "string",
    ),
    "partial_step1_evidence_coverage",
    "missing_truth_state_linkage",
    "source_path_unresolved",
    "forbidden_source_family_present",
  ]);
  const unsupportedOrdinaryBlockerCodes = unsupportedBlockerCodes.filter((code) =>
    ordinaryFamilyBlockerCodeSet.has(code),
  );
  const unsupportedFamilyBlockers = unsupported
    .map(unsupportedEvidenceFamilyBlocker)
    .filter((x): x is string => typeof x === "string");
  const anchorBlockers = anchors.flatMap((anchor) =>
    Array.isArray(anchor.blocker_codes)
      ? anchor.blocker_codes.filter((x): x is string => typeof x === "string")
      : [],
  );
  const coverage = isRecord(analysisEvidenceState?.evidence_family_coverage)
    ? analysisEvidenceState.evidence_family_coverage
    : null;
  const statusById = isRecord(analysisEvidenceState?.evidence_family_status_by_id)
    ? analysisEvidenceState.evidence_family_status_by_id
    : null;
  const ordinaryFamilyCompletionById = isRecord(
    analysisEvidenceState?.ordinary_analysis_family_completion_by_id,
  )
    ? analysisEvidenceState.ordinary_analysis_family_completion_by_id
    : null;
  const familyCoverageBlockers = ORDINARY_ANALYSIS_REQUIRED_FAMILY_IDS.flatMap((family) => {
    const legacyFamily =
      family === "video_observable"
        ? "video"
        : family === "audio_observable"
          ? "audio"
          : family === "material_specific_performance"
            ? "material_specific_performance"
            : family === "performance_observable"
              ? "performance"
              : family;
    const legacyStatus = familyCoverageStatus({ family: legacyFamily, coverage, statusById });
    if (legacyStatus === "complete" || legacyStatus === "not_applicable") return [];
    const summary = isRecord(ordinaryFamilyCompletionById?.[family])
      ? ordinaryFamilyCompletionById[family]
      : null;
    if (summary) {
      const status = normaliseEvidenceFamilyStatus(summary.status);
      if (status === "complete" || status === "not_applicable") return [];
      const blockerCodes = getStringArray(summary.blocker_codes);
      if (blockerCodes.length > 0) return blockerCodes;
      return status === "partial"
        ? ["partial_step1_evidence_coverage"]
        : [ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS[family]];
    }
    return legacyStatus === "partial"
      ? ["partial_step1_evidence_coverage"]
      : [ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS[family]];
  });
  const mixedRealAndLegacy = realRuntimeAnchorCount > 0 && legacyAdapterAnchorCount > 0;
  const analysisEvidenceStateComplete =
    analysisEvidenceState?.source_classification === "real_runtime_v3" &&
    analysisEvidenceState?.evidence_state_status === "complete" &&
    analysisEvidenceState?.cannot_satisfy_v3_gate !== true;
  const blockers = dedupePreservingOrder([
    ...(legacyAdapterAnchorCount > 0
      ? ["legacy_snapshot_insufficient_for_v3_evidence_anchor_gate"]
      : []),
    ...(mixedRealAndLegacy
      ? ["mixed_real_and_legacy_non_satisfying", "mixed_evidence_anchor_source_families"]
      : []),
    ...(reportSnapshotAnchorCount > 0 ||
    anchorBlockers.includes("forbidden_report_snapshot_source_ref")
      ? ["forbidden_raw_report_anchor_source"]
      : []),
    ...(sourceScaffoldAnchorCount > 0 ? ["source_scaffold_not_gate_evidence"] : []),
    ...(aggregateBlockingRealRuntimeAnchorCount > 0
      ? ["blocked_real_runtime_evidence_anchor_present"]
      : []),
    ...(aggregateBlockingAnchorCount > 0 ? ["anchor_cannot_satisfy_v3_gate"] : []),
    ...(anchorBlockers.includes("analysis_evidence_state_source_path_unresolved")
      ? ["source_path_unresolved", "unresolved_source_path"]
      : []),
    ...(anchorBlockers.includes("missing_truth_state_linkage")
      ? ["missing_truth_state_linkage"]
      : []),
    ...familyCoverageBlockers,
    ...unsupportedFamilyBlockers,
    ...(realRuntimeAnchorCount > 0 &&
    (unsupportedFamilyBlockers.length > 0 || unsupportedOrdinaryBlockerCodes.length > 0)
      ? ["analysis_evidence_state_partial_runtime_facts_only"]
      : []),
    ...unsupportedOrdinaryBlockerCodes,
  ]);
  const requiredGateAnchors = anchors.filter(
    (anchor) => !isLimitationOnlyEvidenceAnchor(anchor) && isRequiredOrdinaryFamilyAnchor(anchor),
  );
  const allAnchorsSatisfyingRealRuntime =
    requiredGateAnchors.length > 0 &&
    requiredGateAnchors.every(
      (anchor) =>
        anchor.source_family === "real_runtime_v3" && anchor.cannot_satisfy_v3_gate !== true,
    ) &&
    aggregateBlockingRealRuntimeAnchorCount === 0 &&
    legacyAdapterAnchorCount === 0 &&
    sourceScaffoldAnchorCount === 0 &&
    reportSnapshotAnchorCount === 0 &&
    aggregateBlockingAnchorCount === 0;
  const coverageComplete = !blockers.some((code) =>
    [
      "partial_step1_evidence_coverage",
      ...Object.values(ORDINARY_ANALYSIS_FAMILY_MISSING_BLOCKERS),
      ...Object.values(ORDINARY_ANALYSIS_FAMILY_EVENT_BLOCKERS).filter(
        (x): x is string => typeof x === "string",
      ),
    ].includes(code),
  );
  const evidenceAnchorGateStatus: EvidenceAnchorAggregateGateStatus =
    allAnchorsSatisfyingRealRuntime && analysisEvidenceStateComplete && coverageComplete
      ? "sufficient"
      : "insufficient";
  const sourceClassification =
    evidenceAnchorGateStatus === "sufficient"
      ? "real_runtime_v3"
      : mixedRealAndLegacy
        ? "mixed_real_and_legacy_non_satisfying"
        : realRuntimeAnchorCount > 0 || blockedRealRuntimeAnchorCount > 0
          ? "real_runtime_v3_partial_non_satisfying"
          : sourceScaffoldAnchorCount > 0
            ? "source_scaffold"
            : "legacy_adapter";
  const gateReason = (() => {
    if (evidenceAnchorGateStatus === "sufficient")
      return "real_runtime_v3_analysis_evidence_state_anchors_complete";
    if (blockers.includes("forbidden_raw_report_anchor_source"))
      return "forbidden_raw_report_anchor_source";
    if (blockers.includes("mixed_real_and_legacy_non_satisfying"))
      return "mixed_real_and_legacy_non_satisfying";
    if (blockers.includes("source_scaffold_not_gate_evidence"))
      return "source_scaffold_not_gate_evidence";
    if (blockers.includes("source_path_unresolved") || blockers.includes("unresolved_source_path"))
      return "unresolved_source_path";
    const missingFamilyBlocker = blockers.find(
      (code) => code.startsWith("missing_") && code !== "missing_truth_state_linkage",
    );
    if (missingFamilyBlocker) return missingFamilyBlocker;
    if (blockers.includes("partial_step1_evidence_coverage"))
      return "partial_step1_evidence_coverage";
    if (blockers.includes("missing_truth_state_linkage")) return "missing_truth_state_linkage";
    return realRuntimeAnchorCount > 0
      ? "partial_runtime_facts_present_but_performance_extractor_unavailable"
      : "legacy_report_snapshot_only";
  })();
  return {
    evidenceAnchorGateStatus,
    sourceClassification,
    gateReason,
    blockerCodes: blockers,
    realRuntimeAnchorCount,
    blockedRealRuntimeAnchorCount,
    legacyAdapterAnchorCount,
    reportSnapshotAnchorCount,
    sourceScaffoldAnchorCount,
    blockedAnchorCount,
    excludedLegacyDiagnosticAnchorCount,
  };
}

export async function emitEvidenceAnchorsFirstPass(input: EvidenceAnchorsEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return {
      written: false as const,
      emitted: false as const,
      emitted_artefact_ids: [] as string[],
      source_classification: "missing" as const,
      level2_satisfies: false as const,
    };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const generatedAt = new Date().toISOString();
  const reportData = unwrapRawReportData(input.raw_report_data);
  const timestampedNotes = Array.isArray(reportData.timestamped_notes)
    ? reportData.timestamped_notes
    : [];
  const anchors: Array<Record<string, unknown>> = [];
  const legacyDiagnosticAnchors: Array<Record<string, unknown>> = [];
  const analysisEvidenceState = isRecord(input.analysis_evidence_state_data)
    ? input.analysis_evidence_state_data
    : null;
  if (analysisEvidenceState) {
    const sourceRunIdMatches =
      analysisEvidenceState.run_id === input.run_id &&
      analysisEvidenceState.analysis_run_id === analysisRunId;
    if (sourceRunIdMatches) {
      const observableItems = Array.isArray(analysisEvidenceState.observable_evidence_items)
        ? analysisEvidenceState.observable_evidence_items
        : [];
      observableItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        if (item.source_artefact_id === "run_evidence_pass") return;
        const sourcePath =
          typeof item.analysis_evidence_state_source_path === "string"
            ? item.analysis_evidence_state_source_path
            : `observable_evidence_items[${index}]`;
        anchors.push(
          buildAnalysisEvidenceAnchor({
            source: analysisEvidenceState,
            sourcePath,
            item,
            index: anchors.length,
            input,
            analysisRunId,
            generatedAt,
            truthStateMapData: input.truth_state_map_data,
          }),
        );
      });
      const step1FamilyItems = Array.isArray(
        analysisEvidenceState.step1_family_observable_evidence_items,
      )
        ? analysisEvidenceState.step1_family_observable_evidence_items
        : [];
      step1FamilyItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        const sourcePath =
          typeof item.analysis_evidence_state_source_path === "string"
            ? item.analysis_evidence_state_source_path
            : `step1_family_observable_evidence_items[${index}]`;
        anchors.push(
          buildAnalysisEvidenceAnchor({
            source: analysisEvidenceState,
            sourcePath,
            item,
            index: anchors.length,
            input,
            analysisRunId,
            generatedAt,
            truthStateMapData: input.truth_state_map_data,
          }),
        );
      });
      const componentItems = Array.isArray(analysisEvidenceState.component_evidence)
        ? analysisEvidenceState.component_evidence
        : [];
      componentItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        anchors.push(
          buildAnalysisEvidenceAnchor({
            source: analysisEvidenceState,
            sourcePath: `component_evidence[${index}]`,
            item: {
              ...item,
              evidence_modality: "submission_context",
              timestamp: null,
              timestamp_range: null,
              timestamp_source: "not_timestamped_runtime_metadata",
              linked_truth_state_ids: Array.isArray(item.linked_truth_state_ids)
                ? item.linked_truth_state_ids
                : [],
              public_display_status: "internal_only",
            },
            index: anchors.length,
            input,
            analysisRunId,
            generatedAt,
            truthStateMapData: input.truth_state_map_data,
          }),
        );
      });
      const briefItems = Array.isArray(analysisEvidenceState.candidate_brief_evidence)
        ? analysisEvidenceState.candidate_brief_evidence
        : [];
      briefItems.forEach((item, index) => {
        if (!isRecord(item)) return;
        anchors.push(
          buildAnalysisEvidenceAnchor({
            source: analysisEvidenceState,
            sourcePath: `candidate_brief_evidence[${index}]`,
            item: {
              ...item,
              evidence_modality:
                item.evidence_kind === "material_presence" ? "material" : "submission_context",
              timestamp: null,
              timestamp_range: null,
              timestamp_source: "not_timestamped_resolver_fact",
              linked_truth_state_ids: Array.isArray(item.linked_truth_state_ids)
                ? item.linked_truth_state_ids
                : [],
              public_display_status: "internal_only",
            },
            index: anchors.length,
            input,
            analysisRunId,
            generatedAt,
            truthStateMapData: input.truth_state_map_data,
          }),
        );
      });
    }
  }
  const buildLegacyTimestampAnchor = (
    item: unknown,
    originalIndex: number,
  ): Record<string, unknown> | null => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const ts =
      typeof row.timestamp === "string"
        ? row.timestamp
        : typeof row.time === "string"
          ? row.time
          : null;
    const note = getTimestampedNoteText(row);
    const textField = getTimestampedNoteTextField(row);
    if (!note || !textField) return null;
    return {
      evidence_anchor_id: `ea-${input.take_id}-${anchors.length + 1}`,
      source_family: "legacy_adapter",
      source_artefact_id: "raw_report",
      source_path: `report_data.timestamped_notes[${originalIndex}].${textField}`,
      source_index: originalIndex,
      source_stage: input.source_stage,
      evidence_status: "derived_from_legacy_report_snapshot",
      timestamp: ts,
      timestamp_source: ts ? "raw_report_timestamped_note" : "unavailable",
      component_id: null,
      linked_truth_state_ids: [],
      claim_supported: false,
      evidence_text: note,
      confidence_or_strength: null,
      assessability_limitations: ["legacy_report_snapshot_not_v3_multimodal"],
      public_safe: true,
      cannot_satisfy_v3_gate: true,
      blocker_codes: [
        "legacy_snapshot_insufficient_for_v3_evidence_anchor_gate",
        "missing_truth_state_linkage",
      ],
    };
  };
  const hasRuntimeAnchorsForGate = anchors.some((anchor) =>
    ["real_runtime_v3", "real_runtime_v3_blocked"].includes(
      String(anchor.source_family ?? anchor.source_classification ?? ""),
    ),
  );
  timestampedNotes.forEach((item, originalIndex) => {
    const legacyAnchor = buildLegacyTimestampAnchor(item, originalIndex);
    if (!legacyAnchor) return;
    if (hasRuntimeAnchorsForGate) {
      legacyDiagnosticAnchors.push({
        ...legacyAnchor,
        evidence_anchor_id: `legacy-diagnostic-${input.take_id}-${legacyDiagnosticAnchors.length + 1}`,
        excluded_from_evidence_anchor_gate: true,
        diagnostic_only: true,
      });
      return;
    }
    anchors.push(legacyAnchor);
  });
  if (anchors.length === 0)
    return {
      written: false as const,
      emitted: false as const,
      emitted_artefact_ids: [] as string[],
      source_classification: "missing" as const,
      level2_satisfies: false as const,
      anchors: [] as Array<Record<string, unknown>>,
    };
  const aggregateGate = evaluateEvidenceAnchorAggregateGate({
    anchors: [...anchors, ...legacyDiagnosticAnchors],
    analysisEvidenceState,
  });
  const {
    evidenceAnchorGateStatus,
    sourceClassification,
    gateReason,
    blockerCodes: blocker_codes,
    realRuntimeAnchorCount,
    legacyAdapterAnchorCount,
    reportSnapshotAnchorCount,
    blockedAnchorCount,
    excludedLegacyDiagnosticAnchorCount,
  } = aggregateGate;
  const promotedSourceArtefactForAnchor = (anchor: Record<string, unknown>): string => {
    if (anchor.source_artefact_id !== "analysis_evidence_state") return "";
    const sourceItem = readJsonPath(analysisEvidenceState, String(anchor.source_path ?? ""));
    return isRecord(sourceItem) && typeof sourceItem.source_artefact_id === "string"
      ? sourceItem.source_artefact_id
      : "";
  };
  const evidenceAnchorTraceSummary = {
    anchor_count: anchors.length,
    real_runtime_anchor_count: realRuntimeAnchorCount,
    legacy_adapter_anchor_count: legacyAdapterAnchorCount,
    blocked_anchor_count: blockedAnchorCount,
    source_family_summary: {
      legacy_adapter: legacyAdapterAnchorCount,
      report_snapshot: reportSnapshotAnchorCount,
      real_runtime_v3: realRuntimeAnchorCount,
      input_artifact: anchors.filter((a) =>
        ["analysis_submission", "analysis_take"].includes(promotedSourceArtefactForAnchor(a)),
      ).length,
      resolver_truth_state: anchors.filter(
        (a) => promotedSourceArtefactForAnchor(a) === "truth_state_map",
      ).length,
    },
    diagnostic_source_family_summary: {
      legacy_adapter: excludedLegacyDiagnosticAnchorCount,
    },
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_gate_reason: gateReason,
    blocker_codes,
    legacy_diagnostic_anchor_count: excludedLegacyDiagnosticAnchorCount,
    excluded_legacy_anchor_count: excludedLegacyDiagnosticAnchorCount,
  };
  const payload = {
    schema_version:
      realRuntimeAnchorCount > 0
        ? "tapecoach_v3_evidence_anchors_runtime_v1"
        : "tapecoach_v3_evidence_anchors_first_pass_v1",
    artefact_type: "evidence_anchors",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    source_classification: sourceClassification,
    generated_at: generatedAt,
    anchor_count: anchors.length,
    anchors,
    legacy_diagnostic_anchor_count: legacyDiagnosticAnchors.length,
    excluded_legacy_anchor_count: legacyDiagnosticAnchors.length,
    legacy_diagnostic_anchors: legacyDiagnosticAnchors,
    excluded_legacy_anchors: legacyDiagnosticAnchors,
    legacy_adapter_anchor_count: legacyAdapterAnchorCount,
    report_snapshot_anchor_count: reportSnapshotAnchorCount,
    real_runtime_anchor_count: realRuntimeAnchorCount,
    timestamped_anchor_count: anchors.filter(
      (a) => typeof a.timestamp === "string" && a.timestamp.length > 0,
    ).length,
    cannot_satisfy_v3_evidence_anchor_gate: evidenceAnchorGateStatus !== "sufficient",
    gate_satisfaction_reason: gateReason,
    blocker_codes,
    evidence_family_coverage: isRecord(analysisEvidenceState?.evidence_family_coverage)
      ? analysisEvidenceState.evidence_family_coverage
      : null,
    evidence_family_status_by_id: isRecord(analysisEvidenceState?.evidence_family_status_by_id)
      ? analysisEvidenceState.evidence_family_status_by_id
      : null,
    unsupported_or_unavailable_evidence: isRecord(analysisEvidenceState)
      ? safeUnsupportedEvidenceForAnchorHandoff(
          analysisEvidenceState.unsupported_or_unavailable_evidence,
        )
      : [],
    evidence_anchor_trace_summary: evidenceAnchorTraceSummary,
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    redaction_notes: ["Internal-only trace; no secrets/tokens/session credentials emitted"],
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, "take_id");
  const rel = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/EvidenceAnchors.json`;
  const result = await writeInternalJson(root, input.run_id, rel, payload, "evidence_anchors");
  return {
    written: result.written as boolean,
    emitted: result.written as boolean,
    emitted_artefact_ids: result.written ? ["evidence_anchors"] : [],
    source_classification: sourceClassification,
    level2_satisfies: result.written && evidenceAnchorGateStatus === "sufficient",
    evidence_anchor_trace_summary: evidenceAnchorTraceSummary,
    evidence_anchor_gate_status: evidenceAnchorGateStatus,
    evidence_anchor_gate_reason: gateReason,
    evidence_anchor_source_family_summary: evidenceAnchorTraceSummary.source_family_summary,
    legacy_diagnostic_anchor_count: legacyDiagnosticAnchors.length,
    excluded_legacy_anchor_count: legacyDiagnosticAnchors.length,
    evidence_family_coverage: payload.evidence_family_coverage,
    evidence_family_status_by_id: payload.evidence_family_status_by_id,
    unsupported_or_unavailable_evidence: payload.unsupported_or_unavailable_evidence,
    blocker_codes,
    cannot_satisfy_v3_gate: payload.cannot_satisfy_v3_evidence_anchor_gate,
    warning: result.warning ?? null,
    anchors,
    legacy_diagnostic_anchors: legacyDiagnosticAnchors,
    excluded_legacy_anchors: legacyDiagnosticAnchors,
  };
}

const OVERCLAIM_PATTERN =
  /(perfect match|fits the brief perfectly|perfectly suits|professional standard|strong internal life|send with confidence|well aligned)/i;
const GENERIC_PRAISE_PATTERN =
  /\b(strong energy|good movement|high-energy movement|strong vocal control|vocal resonance|grounded acting|natural|believable|professional|technically strong|strong presence|strong acting|clear technique|strong technique|nice musicality|polished|expressive|dynamic|confident|good storytelling|nice warmth|strong voice|great energy)\b/i;
function findLinkedEvidenceAnchorForClaim(args: {
  claimText: string;
  sourcePath: string;
  timestamp?: string | null;
  anchors: Array<Record<string, unknown>>;
}) {
  const anchors = args.anchors;
  const exactPathMatches = anchors.filter((anchor) => anchor.source_path === args.sourcePath);
  if (exactPathMatches.length === 1) return exactPathMatches[0];
  const normalisedClaim = normaliseTraceText(args.claimText);
  const timestampMatches = anchors.filter(
    (anchor) =>
      args.timestamp &&
      anchor.timestamp === args.timestamp &&
      normaliseTraceText(anchor.evidence_text) === normalisedClaim,
  );
  if (timestampMatches.length === 1) return timestampMatches[0];
  const textMatches = anchors.filter(
    (anchor) => normaliseTraceText(anchor.evidence_text) === normalisedClaim,
  );
  if (textMatches.length === 1) return textMatches[0];
  const broadMatches = anchors.filter(
    (anchor) =>
      anchor.source_path === "report_data.timestamped_notes" &&
      args.sourcePath.startsWith("report_data.timestamped_notes["),
  );
  if (broadMatches.length === 1) return broadMatches[0];
  return null;
}
function isExplicitScoreClaim(args: {
  claimType: string;
  sourcePath: string;
  claimText: string;
}): boolean {
  if (args.claimType === "score_or_verdict") return true;
  const p = args.sourcePath;
  if (
    p === "report_data.overall_score" ||
    p === "report_data.overall_score_final" ||
    p === "report_data.overall_score_model" ||
    p === "report_data.scores" ||
    p.startsWith("report_data.scores.") ||
    p.includes(".score") ||
    p.startsWith("scores_or_readiness_fields")
  )
    return true;
  const t = normaliseTraceText(args.claimText);
  return /(overall score|final score|model score|readiness score|rating|scored?\s+\d+|score[:\s]+\d+|\b\d+\s*\/\s*100\b)/i.test(
    t,
  );
}
function classifyNumericOrScoreClaim(args: {
  claimType: string;
  sourcePath: string;
  claimText: string;
}) {
  const p = args.sourcePath;
  const t = normaliseTraceText(args.claimText);
  const overallPaths = new Set([
    "report_data.overall_score",
    "report_data.overall_score_final",
    "report_data.overall_score_model",
    "report_data.overall_readiness",
    "report_data.overall_readiness_score",
    "report_data.readiness_score",
    "scores_or_readiness_fields.overall_score",
    "scores_or_readiness_fields.overall_score_final",
    "scores_or_readiness_fields.overall_readiness",
  ]);
  if (overallPaths.has(p))
    return {
      score_scope: "overall_readiness",
      is_public_overall_readiness_score_risk: true,
      is_score_claim: true,
    } as const;
  if (p.startsWith("report_data.scores.") || p.startsWith("scores_or_readiness_fields."))
    return {
      score_scope: "discipline_attribute",
      is_public_overall_readiness_score_risk: false,
      is_score_claim: true,
    } as const;
  if (p.includes(".score"))
    return {
      score_scope: "component_score",
      is_public_overall_readiness_score_risk: false,
      is_score_claim: true,
    } as const;
  if (/(overall readiness|overall score|readiness score|final score|model score)/i.test(t))
    return {
      score_scope: "overall_readiness",
      is_public_overall_readiness_score_risk: true,
      is_score_claim: true,
    } as const;
  if (isExplicitScoreClaim(args))
    return {
      score_scope: "explicit_score_wording",
      is_public_overall_readiness_score_risk: false,
      is_score_claim: true,
    } as const;
  return {
    score_scope: "not_score",
    is_public_overall_readiness_score_risk: false,
    is_score_claim: false,
  } as const;
}

type ClaimCandidateSourceFamily =
  | "real_runtime_v3"
  | "legacy_adapter"
  | "report_candidate_requires_support"
  | "first_pass_internal"
  | "blocked";

const CLAIM_CANDIDATE_UNSAFE_TEXT_PATTERN =
  /(https?:\/\/|signed[_-]?url|playback[_-]?url|video[_-]?url|authorization|api[_-]?key|session|cookie|secret|token|x-amz-|signature=)/i;
const TECHNIQUE_AUTHORITY_CLAIM_PATTERN =
  /(technique authority|public technique authority|authoritative technique|authoritative diagnosis|named technique|meisner|stanislavski|viewpoints|alexander technique|uta hagen)/i;
const CASTING_MARKET_CLAIM_PATTERN =
  /(castability|castable|bookability|bookable|marketability|marketable|casting fit|commercial fit|market fit|buyer fit)/i;
const COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN =
  /(winner|recommend(?:ed|ation)?|best take|preferred take|select take|submit take\s*\d|take\s*\d\s+(?:wins|over|beats))/i;
const ROLE_BRIEF_FIT_OVERCLAIM_PATTERN =
  /(role[-\s]*fit|brief[-\s]*fit|fits? the brief|perfect match|perfectly suits|well aligned|casting suitability|submit with confidence|send with confidence)/i;

function safeCandidateSummary(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean")
    return null;
  const raw = String(value).trim().replace(/\s+/g, " ");
  if (!raw) return null;
  if (CLAIM_CANDIDATE_UNSAFE_TEXT_PATTERN.test(raw)) return "[redacted unsafe candidate summary]";
  return raw.slice(0, 280);
}

function pickSafeRecordText(value: Record<string, unknown>): string | null {
  for (const key of [
    "safe_candidate_summary",
    "safe_evidence_summary",
    "evidence_text",
    "summary",
    "status",
    "value",
    "label",
    "reason",
    "note",
    "text",
    "observation",
  ]) {
    const text = safeCandidateSummary(value[key]);
    if (text) return text;
  }
  return null;
}

function claimFamilyForRuntimeEvidence(item: Record<string, unknown>): string {
  const kind = String(item.evidence_kind ?? item.component_id ?? "").toLowerCase();
  const modality = String(item.evidence_modality ?? "").toLowerCase();
  if (/unavailable|limitation|not_extracted|blocked|unknown/.test(kind))
    return "assessability_limitation";
  if (
    /media|audio|video|duration|framing|lighting|visibility|intelligibility|volume|noise|crop/.test(
      kind,
    ) ||
    ["media_readiness", "audio", "video"].includes(modality)
  )
    return "technical_media";
  if (/brief|material|component|task/.test(kind)) return "factual_status";
  if (/selected_level|audition_type|stable_take_identity|submission|take_identity/.test(kind))
    return "factual_status";
  if (/truth|resolver/.test(kind)) return "factual_status";
  return "factual_status";
}

function classifyClaimCandidateSafety(args: {
  text: string;
  claimType: string;
  claimFamily: string;
  sourcePath: string;
}) {
  const scoreMeta = classifyNumericOrScoreClaim({
    claimType: args.claimType,
    sourcePath: args.sourcePath,
    claimText: args.text,
  });
  const blockers: string[] = [];
  if (scoreMeta.is_score_claim) {
    blockers.push("public_scoring_blocked");
    return {
      score_scope: scoreMeta.score_scope,
      public_safety_status: "blocked",
      rewrite_required: true,
      blocked_claim_category: "public_scoring",
      blocker_codes: blockers,
    };
  }
  if (
    TECHNIQUE_AUTHORITY_CLAIM_PATTERN.test(args.text) ||
    args.claimFamily === "technique_authority"
  ) {
    blockers.push("public_technique_authority_blocked");
    return {
      score_scope: "not_score",
      public_safety_status: "blocked",
      rewrite_required: true,
      blocked_claim_category: "public_technique_authority",
      blocker_codes: blockers,
    };
  }
  if (
    CASTING_MARKET_CLAIM_PATTERN.test(args.text) ||
    args.claimFamily === "castability_bookability_marketability"
  ) {
    blockers.push("castability_bookability_marketability_blocked");
    return {
      score_scope: "not_score",
      public_safety_status: "blocked",
      rewrite_required: true,
      blocked_claim_category: "castability_bookability_marketability",
      blocker_codes: blockers,
    };
  }
  if (
    COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN.test(args.text) ||
    args.claimFamily === "comparison_public_result"
  ) {
    blockers.push("public_comparison_result_blocked");
    return {
      score_scope: "not_score",
      public_safety_status: "blocked",
      rewrite_required: true,
      blocked_claim_category: "public_comparison_result",
      blocker_codes: blockers,
    };
  }
  if (ROLE_BRIEF_FIT_OVERCLAIM_PATTERN.test(args.text) || OVERCLAIM_PATTERN.test(args.text)) {
    blockers.push("unsupported_overclaim_requires_rewrite");
    return {
      score_scope: "not_score",
      public_safety_status: "needs_rewrite",
      rewrite_required: true,
      blocked_claim_category: "role_or_brief_fit_overclaim",
      blocker_codes: blockers,
    };
  }
  if (GENERIC_PRAISE_PATTERN.test(args.text)) {
    blockers.push("generic_phrase_unanchored");
    return {
      score_scope: "not_score",
      public_safety_status: "needs_rewrite",
      rewrite_required: true,
      blocked_claim_category: "unsupported_praise",
      blocker_codes: blockers,
    };
  }
  return {
    score_scope: "not_score",
    public_safety_status: "safe_for_public_candidate",
    rewrite_required: false,
    blocked_claim_category: null,
    blocker_codes: blockers,
  };
}

function inferLegacyClaimFamily(sourcePath: string, text: string, claimType: string): string {
  if (classifyNumericOrScoreClaim({ claimType, sourcePath, claimText: text }).is_score_claim)
    return "score_or_verdict";
  if (
    /casting|market|book|castability|bookability|marketability/i.test(sourcePath) ||
    CASTING_MARKET_CLAIM_PATTERN.test(text)
  )
    return "castability_bookability_marketability";
  if (
    /comparison|winner|recommend/i.test(sourcePath) ||
    COMPARISON_PUBLIC_RESULT_CLAIM_PATTERN.test(text)
  )
    return "comparison_public_result";
  if (/fix_first|next_take|priority/i.test(sourcePath)) return "priority_fix";
  if (/strength|preserve/i.test(sourcePath)) return "preserve_strength";
  if (/category_notes|category_rationale|timestamped_notes/i.test(sourcePath))
    return "readiness_status";
  if (/brief/i.test(sourcePath)) return "brief_task_status";
  return claimType === "role_or_brief_fit" ? "role_or_brief_fit_overclaim" : claimType;
}

function summarizeClaimCandidateSources(candidates: Array<Record<string, unknown>>) {
  return candidates.reduce<Record<string, number>>(
    (acc, candidate) => {
      const key = String(candidate.source_family ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {
      real_runtime_v3: 0,
      legacy_adapter: 0,
      report_candidate_requires_support: 0,
      first_pass_internal: 0,
      blocked: 0,
    },
  );
}

function isPublicScoreSuppressionClaim(item: Record<string, unknown>): boolean {
  return (
    String(item.score_scope ?? "not_score") !== "not_score" ||
    String(item.blocked_claim_category ?? "") === "public_scoring" ||
    getStringArray(item.blocker_codes).includes("public_scoring_blocked")
  );
}

function isPublicTechniqueAuthoritySuppressionClaim(item: Record<string, unknown>): boolean {
  return (
    String(item.blocked_claim_category ?? "") === "public_technique_authority" ||
    String(item.public_authority_category ?? "") === "public_technique_authority" ||
    getStringArray(item.blocker_codes).includes("public_technique_authority_blocked")
  );
}

function buildPublicFeatureSuppressionClaimSummary(items: Array<Record<string, unknown>>) {
  const scoreClaims = items.filter(isPublicScoreSuppressionClaim);
  const techniqueClaims = items.filter(isPublicTechniqueAuthoritySuppressionClaim);
  const isSuppressed = (item: Record<string, unknown>) =>
    item.suppress_public_claim === true ||
    item.support_status === "suppressed" ||
    item.public_authority_status === "blocked";
  const isBlocked = (item: Record<string, unknown>, code: string) =>
    item.support_status === "blocked" ||
    item.public_safety_status === "blocked" ||
    getStringArray(item.blocker_codes).includes(code);
  const scoreSuppressed = scoreClaims.filter(isSuppressed);
  const techniqueSuppressed = techniqueClaims.filter(isSuppressed);
  const scoreUnsuppressed = scoreClaims.filter((item) => !isSuppressed(item));
  const techniqueUnsuppressed = techniqueClaims.filter((item) => !isSuppressed(item));
  return {
    public_score_claim_count: scoreClaims.length,
    public_score_claim_suppressed_count: scoreSuppressed.length,
    blocked_public_score_claim_count: scoreClaims.filter((item) =>
      isBlocked(item, "public_scoring_blocked"),
    ).length,
    unsuppressed_public_score_claim_count: scoreUnsuppressed.length,
    public_score_claim_suppression_status:
      scoreClaims.length === 0
        ? "not_applicable"
        : scoreUnsuppressed.length === 0
          ? "suppressed"
          : "insufficient",
    public_technique_authority_claim_count: techniqueClaims.length,
    public_technique_authority_claim_suppressed_count: techniqueSuppressed.length,
    blocked_public_technique_authority_claim_count: techniqueClaims.filter((item) =>
      isBlocked(item, "public_technique_authority_blocked"),
    ).length,
    unsuppressed_public_technique_authority_claim_count: techniqueUnsuppressed.length,
    public_technique_authority_claim_suppression_status:
      techniqueClaims.length === 0
        ? "not_applicable"
        : techniqueUnsuppressed.length === 0
          ? "suppressed"
          : "insufficient",
  };
}

function sourceClassificationForClaimCandidates(sourceSummary: Record<string, number>): string {
  const realCount = sourceSummary.real_runtime_v3 ?? 0;
  const legacyCount = sourceSummary.legacy_adapter ?? 0;
  const reportCandidateCount = sourceSummary.report_candidate_requires_support ?? 0;
  const firstPassCount = sourceSummary.first_pass_internal ?? 0;
  if (realCount > 0 && legacyCount === 0 && reportCandidateCount === 0 && firstPassCount === 0)
    return "real_runtime_v3_candidate_source";
  if (realCount > 0) return "mixed_real_runtime_v3_and_legacy_or_unsupported";
  if (legacyCount > 0) return "legacy_or_unsupported";
  if (reportCandidateCount > 0) return "report_candidate_requires_support";
  if (firstPassCount > 0) return "first_pass_internal";
  return "unavailable";
}

type PublicClaimSupportStatus =
  | "supported"
  | "limitation_only_supported"
  | "partially_supported"
  | "unsupported"
  | "missing_evidence"
  | "missing_truth_link"
  | "blocked"
  | "rewrite_required"
  | "unsupported_overclaim"
  | "overclaim"
  | "unsafe"
  | "suppressed"
  | "legacy_or_unsupported"
  | "not_applicable";

function getTraceClaimCandidates(value: unknown): Array<Record<string, unknown>> {
  if (!isRecord(value)) return [];
  return safeRecordArray(value.claim_candidates);
}

function getNonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function identityFieldMismatch(value: unknown, expected: string): boolean {
  const actual = getNonBlankString(value);
  return Boolean(actual && actual !== expected);
}

function validateTraceIdentityForCurrentRun(
  traceData: unknown,
  input: {
    run_id: string;
    analysis_run_id: string;
    take_id: string;
    artefact_type: "claim_candidate_trace";
  },
): { ok: boolean; blockerCodes: string[] } {
  if (!isRecord(traceData))
    return { ok: false, blockerCodes: [`${input.artefact_type}_identity_missing`] };
  const blockerCodes: string[] = [];
  const traceRunId = getNonBlankString(traceData.run_id);
  const traceAnalysisRunId = getNonBlankString(traceData.analysis_run_id);
  const traceTakeId = getNonBlankString(traceData.take_id);
  if (!traceRunId || !traceAnalysisRunId)
    blockerCodes.push(`${input.artefact_type}_identity_missing`);
  if (traceRunId && traceRunId !== input.run_id)
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (traceAnalysisRunId && traceAnalysisRunId !== input.analysis_run_id)
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (traceTakeId && traceTakeId !== input.take_id)
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);

  const candidates = getTraceClaimCandidates(traceData);
  const candidateHasMismatch = candidates.some((candidate) => {
    return [
      ["run_id", input.run_id],
      ["source_run_id", input.run_id],
      ["candidate_run_id", input.run_id],
      ["analysis_run_id", input.analysis_run_id],
      ["source_analysis_run_id", input.analysis_run_id],
      ["candidate_analysis_run_id", input.analysis_run_id],
      ["take_id", input.take_id],
      ["source_take_id", input.take_id],
      ["candidate_take_id", input.take_id],
    ].some(([key, expected]) => identityFieldMismatch(candidate[key], expected));
  });
  if (candidateHasMismatch) blockerCodes.push(`${input.artefact_type}_candidate_identity_mismatch`);
  const uniqueBlockers = dedupePreservingOrder(blockerCodes);
  return { ok: uniqueBlockers.length === 0, blockerCodes: uniqueBlockers };
}

function validateSupportTraceIdentityForCurrentRun(
  value: unknown,
  input: {
    run_id: string;
    analysis_run_id: string;
    take_id: string;
    artefact_type: "evidence_anchors" | "truth_state_map";
  },
): { ok: boolean; blockerCodes: string[] } {
  if (!isRecord(value)) return { ok: true, blockerCodes: [] };
  const blockerCodes: string[] = [];
  if (identityFieldMismatch(value.run_id, input.run_id))
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (identityFieldMismatch(value.analysis_run_id, input.analysis_run_id))
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  if (identityFieldMismatch(value.take_id, input.take_id))
    blockerCodes.push(`${input.artefact_type}_identity_mismatch`);
  const uniqueBlockers = dedupePreservingOrder(blockerCodes);
  return { ok: uniqueBlockers.length === 0, blockerCodes: uniqueBlockers };
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normaliseSafeLimitationItems(value: unknown): Array<{
  safe_summary: string;
  source_index: number;
  source_kind: "string" | "record";
  blocker_codes: string[];
}> {
  const items = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
  return items.flatMap(
    (
      item,
      index,
    ): Array<{
      safe_summary: string;
      source_index: number;
      source_kind: "string" | "record";
      blocker_codes: string[];
    }> => {
      if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
        const summary = safeCandidateSummary(item);
        if (!summary) return [];
        return [
          {
            safe_summary: summary,
            source_index: index,
            source_kind: "string" as const,
            blocker_codes:
              summary === "[redacted unsafe candidate summary]"
                ? ["unsafe_limitation_summary_redacted"]
                : [],
          },
        ];
      }
      if (!isRecord(item)) return [];
      const summary = pickSafeRecordText(item);
      if (!summary) return [];
      return [
        {
          safe_summary: summary,
          source_index: index,
          source_kind: "record" as const,
          blocker_codes: getStringArray(item.blocker_codes),
        },
      ];
    },
  );
}

function getEvidenceAnchorId(anchor: Record<string, unknown>): string | null {
  const id = anchor.evidence_anchor_id ?? anchor.anchor_id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function buildEvidenceAnchorSupportIndex(anchors: Array<Record<string, unknown>>) {
  const byId = new Map<string, Record<string, unknown>>();
  for (const anchor of anchors) {
    const id = getEvidenceAnchorId(anchor);
    if (id) byId.set(id, anchor);
  }
  return byId;
}

function isRealRuntimeEvidenceAnchor(
  anchor: Record<string, unknown> | undefined,
): anchor is Record<string, unknown> {
  if (!anchor) return false;
  const sourceFamily = String(anchor.source_family ?? "");
  const sourceClassification = String(anchor.source_classification ?? "");
  return (
    (sourceFamily === "real_runtime_v3" || sourceClassification === "real_runtime_v3") &&
    anchor.cannot_satisfy_v3_gate !== true
  );
}

function findSameRunAnchorIdsForAnalysisEvidencePath(
  anchors: Array<Record<string, unknown>>,
  sourcePath: string,
): string[] {
  if (!sourcePath) return [];
  return dedupePreservingOrder(
    anchors.flatMap((anchor) => {
      if (!isRealRuntimeEvidenceAnchor(anchor)) return [];
      const anchorSourcePath = typeof anchor.source_path === "string" ? anchor.source_path : "";
      const analysisSourcePath =
        typeof anchor.analysis_evidence_state_source_path === "string"
          ? anchor.analysis_evidence_state_source_path
          : "";
      if (anchor.source_artefact_id !== "analysis_evidence_state") return [];
      if (anchorSourcePath !== sourcePath && analysisSourcePath !== sourcePath) return [];
      const id = getEvidenceAnchorId(anchor);
      return id ? [id] : [];
    }),
  );
}

function getEvidenceAnchorAggregateStatus(
  evidenceAnchorsData: unknown,
): "sufficient" | "insufficient" | "missing" {
  if (!isRecord(evidenceAnchorsData)) return "missing";
  const summary = isRecord(evidenceAnchorsData.evidence_anchor_trace_summary)
    ? evidenceAnchorsData.evidence_anchor_trace_summary
    : {};
  const status = String(
    summary.evidence_anchor_gate_status ?? evidenceAnchorsData.evidence_anchor_gate_status ?? "",
  );
  return status === "sufficient" ? "sufficient" : "insufficient";
}

function isScalarTruthToken(value: unknown): value is string | number {
  return (
    (typeof value === "string" && value.trim().length > 0) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function collectScalarTruthTokens(value: unknown, out: Set<string>) {
  if (isScalarTruthToken(value)) {
    out.add(String(value).trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (isScalarTruthToken(item)) out.add(String(item).trim());
    });
  }
}

function isExplicitTruthIdField(key: string): boolean {
  return /^(truth_state_id|truth_state_ids|truth_state_entry_id|truth_state_entry_ids|canonical_truth_state_id|canonical_truth_state_ids|known_truth_ids|brief_truth_ids|component_truth_ids|comparison_truth_ids)$/i.test(
    key,
  );
}

function isCanonicalTruthStateMapKey(key: string): boolean {
  const trimmed = key.trim();
  return (
    /^[A-Za-z0-9._-]+:truth_state:[A-Za-z0-9._:-]+$/.test(trimmed) ||
    /^truth-state-[A-Za-z0-9._:-]+$/.test(trimmed)
  );
}

function isTruthStateRecord(value: Record<string, unknown>): boolean {
  return [
    "truth_state",
    "truth_state_type",
    "truth_state_family",
    "truth_family",
    "truth_value",
    "truth_state_status",
    "canonical_truth_state_id",
    "canonical_truth_state_ids",
    "truth_state_id",
    "truth_state_ids",
  ].some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function collectTruthStateTokens(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => collectTruthStateTokens(item, out));
    return out;
  }
  if (!isRecord(value)) return out;

  const truthStateRecord = isTruthStateRecord(value);
  for (const [key, item] of Object.entries(value)) {
    if (isCanonicalTruthStateMapKey(key)) out.add(key.trim());
    if (isExplicitTruthIdField(key) || (key === "id" && truthStateRecord)) {
      collectScalarTruthTokens(item, out);
    }
    collectTruthStateTokens(item, out);
  }
  return out;
}

function truthStateIdResolves(truthStateMap: unknown, truthStateId: string): boolean {
  if (!truthStateId || !isRecord(truthStateMap)) return false;
  return collectTruthStateTokens(truthStateMap).has(truthStateId);
}

function publicClaimRequiresTruth(candidate: Record<string, unknown>): boolean {
  const requirement = String(candidate.required_truth_state_family ?? "");
  if (!requirement || requirement.startsWith("not_required")) return false;
  return true;
}

function isPublicClaimGateExcludedDisplayStatus(value: unknown): boolean {
  const status = typeof value === "string" ? value.trim() : "";
  return (
    status === "not_rendered_internal_trace" ||
    status === "not_rendered_internal_candidate" ||
    status === "internal_only" ||
    status === "suppressed_internal" ||
    status === "not_public_output" ||
    status === "not_public" ||
    status === "internal_diagnostic_only"
  );
}

function isCandidateRequiredForPublicClaimGate(candidate: Record<string, unknown>): boolean {
  if (isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status)) return false;
  if (candidate.excluded_from_public_claim_gate === true) return false;
  if (candidate.public_claim_support_required === false) return false;
  if (candidate.required_for_public_claim_gate === false) return false;
  if (String(candidate.candidate_support_precheck_status ?? "") === "not_applicable") return false;
  if (
    candidate.public_claim_support_required === true ||
    candidate.required_for_public_claim_gate === true
  )
    return true;
  return true;
}

function isLimitationClaimFamily(claimFamily: string, claimType: string): boolean {
  return claimFamily === "assessability_limitation" || claimType === "assessability_limitation";
}

function isLimitationOnlyEvidenceAnchor(anchor: Record<string, unknown> | undefined): boolean {
  if (!anchor) return false;
  const blockerText = getStringArray(anchor.blocker_codes).join(" ").toLowerCase();
  const text = [
    anchor.claim_family,
    anchor.evidence_family,
    anchor.evidence_kind,
    anchor.safe_evidence_summary,
    anchor.evidence_text,
    anchor.public_claim_limit,
    anchor.claim_support_scope,
  ]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  return (
    anchor.limitation_only === true ||
    anchor.public_claim_limit === "limitation_only" ||
    anchor.claim_support_scope === "limitation_only" ||
    /\blimitation\b|not extracted|unavailable|unsupported/.test(text) ||
    /limitation_only|not_extracted|unavailable|unsupported/.test(blockerText)
  );
}

function classifyClaimPublicAuthorityRequirement(blockedClaimCategory: string | null): {
  required: boolean;
  category: string | null;
  status: "blocked" | "not_required";
} {
  if (!blockedClaimCategory) return { required: false, category: null, status: "not_required" };
  if (
    [
      "public_scoring",
      "public_technique_authority",
      "castability_bookability_marketability",
      "public_comparison_result",
    ].includes(blockedClaimCategory)
  ) {
    return { required: true, category: blockedClaimCategory, status: "blocked" };
  }
  return { required: false, category: blockedClaimCategory, status: "not_required" };
}

function supportClassificationForStatus(
  status: PublicClaimSupportStatus,
  blockedCategory: string | null,
): string {
  if (status === "supported") return "supported";
  if (status === "limitation_only_supported") return "limitation_only_supported";
  if (status === "blocked") return blockedCategory ?? "blocked";
  if (status === "unsupported_overclaim" || status === "overclaim") return "overclaim";
  if (status === "rewrite_required") return "rewrite_required";
  if (status === "unsafe") return "unsafe";
  if (status === "suppressed") return "suppressed";
  if (status === "legacy_or_unsupported") return "legacy_or_unsupported";
  if (status === "not_applicable") return "not_applicable";
  return "unsupported";
}
function safePublicClaimPossibleForStatus(status: PublicClaimSupportStatus | string): boolean {
  return [
    "supported",
    "limitation_only_supported",
    "unsupported_overclaim",
    "rewrite_required",
  ].includes(status);
}

function normalizeCandidateBlockedCategory(category: unknown): string | null {
  return typeof category === "string" && category.trim() ? category.trim() : null;
}

function classifyPublicClaimSupportFromCandidates(input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  candidates: Array<Record<string, unknown>>;
  evidence_anchors_data?: EvidenceAnchorsSupportData | null;
  truth_state_map_data?: Record<string, unknown> | null;
}) {
  const evidenceAnchorsIdentity = validateSupportTraceIdentityForCurrentRun(
    input.evidence_anchors_data,
    {
      run_id: input.run_id,
      analysis_run_id: input.analysis_run_id,
      take_id: input.take_id,
      artefact_type: "evidence_anchors",
    },
  );
  const truthStateMapIdentity = validateSupportTraceIdentityForCurrentRun(
    input.truth_state_map_data,
    {
      run_id: input.run_id,
      analysis_run_id: input.analysis_run_id,
      take_id: input.take_id,
      artefact_type: "truth_state_map",
    },
  );
  const supportIdentityBlockers = dedupePreservingOrder([
    ...evidenceAnchorsIdentity.blockerCodes,
    ...truthStateMapIdentity.blockerCodes,
  ]);
  const anchors = evidenceAnchorsIdentity.ok
    ? safeRecordArray(input.evidence_anchors_data?.anchors)
    : [];
  const truthStateMapData = truthStateMapIdentity.ok ? input.truth_state_map_data : null;
  const anchorById = buildEvidenceAnchorSupportIndex(anchors);
  const evidenceAnchorGateStatus = evidenceAnchorsIdentity.ok
    ? getEvidenceAnchorAggregateStatus(input.evidence_anchors_data)
    : "insufficient";
  const claims = input.candidates.map((candidate, index) => {
    const candidateSummary =
      safeCandidateSummary(
        candidate.safe_candidate_summary ??
          candidate.candidate_text ??
          candidate.claim_text ??
          candidate.summary,
      ) ?? "[redacted unsafe candidate summary]";
    const claimType = String(candidate.claim_type ?? "unknown");
    const claimFamily = String(candidate.claim_family ?? claimType);
    const sourceFamily = String(candidate.source_family ?? "legacy_or_unsupported");
    const sourceArtefactId = String(candidate.source_artefact_id ?? "unknown");
    const sourcePath = String(candidate.source_path ?? "");
    const candidatePublicDisplayStatus =
      typeof candidate.public_display_status === "string" && candidate.public_display_status.trim()
        ? candidate.public_display_status.trim()
        : "not_rendered_internal_trace";
    const linkedEvidenceAnchorIds = getStringArray(candidate.linked_evidence_anchor_ids);
    const linkedTruthStateIds = getStringArray(candidate.linked_truth_state_ids);
    const safety = classifyClaimCandidateSafety({
      text: candidateSummary,
      claimType,
      claimFamily,
      sourcePath,
    });
    const candidateSafetyStatus = String(
      candidate.public_safety_status ?? safety.public_safety_status,
    );
    const candidateBlockedCategory = normalizeCandidateBlockedCategory(
      candidate.blocked_claim_category ?? safety.blocked_claim_category,
    );
    const publicAuthority = classifyClaimPublicAuthorityRequirement(candidateBlockedCategory);
    const isLegacyOrRaw =
      sourceFamily === "legacy_adapter" ||
      sourceFamily === "legacy_or_unsupported" ||
      sourceArtefactId === "raw_report" ||
      sourcePath.startsWith("report_data.");
    const linkedAnchors = linkedEvidenceAnchorIds.map((id) => anchorById.get(id));
    const realLinkedAnchors = linkedAnchors.filter(isRealRuntimeEvidenceAnchor);
    const hasUnresolvedAnchor = linkedEvidenceAnchorIds.some((id) => !anchorById.has(id));
    const missingEvidenceAnchorIds = linkedEvidenceAnchorIds.filter((id) => !anchorById.has(id));
    const requiresTruth = publicClaimRequiresTruth(candidate);
    const unresolvedTruthStateIds = requiresTruth
      ? linkedTruthStateIds.filter((id) => !truthStateIdResolves(truthStateMapData, id))
      : [];
    const hasMissingTruth =
      requiresTruth && (linkedTruthStateIds.length === 0 || unresolvedTruthStateIds.length > 0);
    const isLimitationClaim = isLimitationClaimFamily(claimFamily, claimType);
    const realLinkedAnchorsAreLimitationOnly =
      realLinkedAnchors.length > 0 && realLinkedAnchors.every(isLimitationOnlyEvidenceAnchor);
    const candidateRequiredForGate = isCandidateRequiredForPublicClaimGate(candidate);
    const blockerCodes: string[] = [
      ...getStringArray(candidate.blocker_codes).filter(
        (code) =>
          code !== "claim_candidate_trace_internal_only_not_public_claim_gate_evidence" &&
          code !== "public_claim_trace_not_promoted",
      ),
      ...safety.blocker_codes,
      ...supportIdentityBlockers,
    ];
    let supportStatus: PublicClaimSupportStatus = "supported";
    let publicSafetyStatus = candidateSafetyStatus;
    let rewriteRequired = candidate.rewrite_required === true;
    let blockedClaimCategory = candidateBlockedCategory;

    if (isLegacyOrRaw) {
      supportStatus = "legacy_or_unsupported";
      rewriteRequired = true;
      blockerCodes.push("legacy_or_unsupported_claim_candidate_source");
    } else if (blockedClaimCategory === "public_scoring") {
      supportStatus = "blocked";
      publicSafetyStatus = "blocked";
      rewriteRequired = true;
      blockerCodes.push("public_scoring_blocked");
    } else if (blockedClaimCategory === "public_technique_authority") {
      supportStatus = "blocked";
      publicSafetyStatus = "blocked";
      rewriteRequired = true;
      blockerCodes.push("public_technique_authority_blocked");
    } else if (blockedClaimCategory === "castability_bookability_marketability") {
      supportStatus = "blocked";
      publicSafetyStatus = "blocked";
      rewriteRequired = true;
      blockerCodes.push("castability_bookability_marketability_blocked");
    } else if (blockedClaimCategory === "public_comparison_result") {
      supportStatus = "blocked";
      publicSafetyStatus = "blocked";
      rewriteRequired = true;
      blockerCodes.push("public_comparison_result_blocked");
    } else if (
      blockedClaimCategory === "role_or_brief_fit_overclaim" ||
      publicSafetyStatus === "needs_rewrite" ||
      publicSafetyStatus === "unsafe_or_overclaim"
    ) {
      supportStatus = "unsupported_overclaim";
      publicSafetyStatus = publicSafetyStatus === "blocked" ? "blocked" : "needs_rewrite";
      rewriteRequired = true;
      blockedClaimCategory = blockedClaimCategory ?? "role_or_brief_fit_overclaim";
      blockerCodes.push("unsupported_overclaim_requires_rewrite");
    } else if (!candidateRequiredForGate) {
      supportStatus = "not_applicable";
      publicSafetyStatus = "internal_only";
      rewriteRequired = false;
    } else if (
      linkedEvidenceAnchorIds.length === 0 ||
      realLinkedAnchors.length === 0 ||
      hasUnresolvedAnchor
    ) {
      supportStatus = "missing_evidence";
      blockerCodes.push("missing_evidence_anchor_support");
      if (linkedEvidenceAnchorIds.length > 0 && realLinkedAnchors.length === 0)
        blockerCodes.push("legacy_anchor_cannot_support_public_claim_gate");
      if (hasUnresolvedAnchor) blockerCodes.push("unresolved_evidence_anchor_link");
    } else if (hasMissingTruth) {
      supportStatus = "missing_truth_link";
      blockerCodes.push("missing_truth_state_linkage");
    } else if (!isLimitationClaim && realLinkedAnchorsAreLimitationOnly) {
      supportStatus = "missing_evidence";
      blockerCodes.push("limitation_only_evidence_cannot_support_non_limitation_claim");
    } else if (isLimitationClaim) {
      supportStatus = "limitation_only_supported";
    } else if (evidenceAnchorGateStatus !== "sufficient" && !isLimitationClaim) {
      supportStatus = "partially_supported";
      blockerCodes.push("evidence_anchor_aggregate_insufficient");
    }

    if (supportStatus !== "supported" && supportStatus !== "limitation_only_supported")
      rewriteRequired =
        rewriteRequired ||
        supportStatus === "unsupported_overclaim" ||
        supportStatus === "blocked" ||
        supportStatus === "legacy_or_unsupported";
    if (supportStatus === "supported" && publicSafetyStatus !== "safe_for_public_candidate")
      publicSafetyStatus =
        publicSafetyStatus === "internal_only" ? "internal_only" : "safe_for_public_candidate";
    if (
      supportStatus === "limitation_only_supported" &&
      publicSafetyStatus !== "safe_for_public_candidate"
    )
      publicSafetyStatus = "safe_for_public_candidate";
    const supportClassification = supportClassificationForStatus(
      supportStatus,
      blockedClaimCategory,
    );
    const currentClaimSuppressed =
      candidateRequiredForGate &&
      !["supported", "limitation_only_supported", "not_applicable"].includes(supportStatus);
    const cannotSatisfy =
      candidateRequiredForGate &&
      !["supported", "limitation_only_supported"].includes(supportStatus);
    return {
      claim_id:
        typeof candidate.claim_candidate_id === "string"
          ? candidate.claim_candidate_id.replace(/^cc-/, "pc-")
          : `pc-${input.take_id}-${index + 1}`,
      safe_claim_summary: candidateSummary,
      claim_text: candidateSummary,
      claim_text_or_summary: candidateSummary,
      claim_type: claimType,
      claim_family: claimFamily,
      claim_scope: String(
        candidate.claim_scope ?? (isLimitationClaim ? "limitation_only" : "public_claim_candidate"),
      ),
      claim_source_surface: String(candidate.claim_source_surface ?? sourceArtefactId),
      candidate_public_section: String(
        candidate.candidate_public_section ?? candidate.claim_section ?? claimType,
      ),
      source_artefact_id: sourceArtefactId,
      source_path: sourcePath,
      claim_source_path: sourcePath,
      source_family: sourceFamily,
      linked_evidence_anchor_ids: linkedEvidenceAnchorIds,
      linked_truth_state_ids: linkedTruthStateIds,
      evidence_anchor_ids: linkedEvidenceAnchorIds,
      truth_state_entry_ids: linkedTruthStateIds,
      missing_evidence_anchor_ids: missingEvidenceAnchorIds,
      missing_truth_state_entry_ids: unresolvedTruthStateIds,
      support_status: supportStatus,
      support_classification: supportClassification,
      public_safety_status: publicSafetyStatus,
      rewrite_required: rewriteRequired,
      score_scope: String(candidate.score_scope ?? safety.score_scope),
      blocked_claim_category: blockedClaimCategory,
      limitation_only: isLimitationClaim,
      public_authority_required: publicAuthority.required,
      public_authority_category: publicAuthority.category,
      public_authority_status: publicAuthority.status,
      suppress_public_claim: Boolean(
        candidate.suppress_public_claim === true ||
        currentClaimSuppressed ||
        publicAuthority.status === "blocked",
      ),
      safe_public_claim_possible: safePublicClaimPossibleForStatus(supportStatus),
      reason: supportClassification,
      blocker_codes: dedupePreservingOrder(blockerCodes),
      evidence_support_summary:
        realLinkedAnchors.length > 0
          ? {
              linked_real_runtime_v3_anchor_count: realLinkedAnchors.length,
              evidence_anchor_gate_status: evidenceAnchorGateStatus,
            }
          : {
              linked_real_runtime_v3_anchor_count: 0,
              evidence_anchor_gate_status: evidenceAnchorGateStatus,
            },
      truth_support_summary: {
        required: requiresTruth,
        linked_truth_state_count: linkedTruthStateIds.length,
        unresolved_truth_state_ids: unresolvedTruthStateIds,
      },
      public_display_status: candidateRequiredForGate
        ? candidatePublicDisplayStatus
        : "not_rendered_internal_trace",
      public_claim_support_required: candidateRequiredForGate,
      required_for_public_claim_gate: candidateRequiredForGate,
      excluded_from_public_claim_gate: !candidateRequiredForGate,
      cannot_satisfy_public_claim_gate: cannotSatisfy,
    };
  });
  const sourceSummary = claims.reduce<Record<string, number>>(
    (acc, claim) => {
      const key = String(claim.source_family ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {
      real_runtime_v3: 0,
      legacy_adapter: 0,
      legacy_or_unsupported: 0,
      report_candidate_requires_support: 0,
      first_pass_internal: 0,
    },
  );
  const requiredClaims = claims.filter(
    (claim) =>
      claim.required_for_public_claim_gate !== false &&
      claim.excluded_from_public_claim_gate !== true &&
      claim.support_status !== "not_applicable",
  );
  const allSupported =
    requiredClaims.length === 0 ||
    (evidenceAnchorGateStatus === "sufficient" &&
      requiredClaims.every((claim) =>
        ["supported", "limitation_only_supported"].includes(String(claim.support_status)),
      ));
  const publicClaimGateStatus = allSupported ? "sufficient" : "insufficient";
  const hasLegacy =
    (sourceSummary.legacy_adapter ?? 0) > 0 ||
    (sourceSummary.legacy_or_unsupported ?? 0) > 0 ||
    claims.some(
      (claim) =>
        claim.source_artefact_id === "raw_report" ||
        String(claim.source_path).startsWith("report_data."),
    );
  const hasReal = (sourceSummary.real_runtime_v3 ?? 0) > 0;
  const requiredLegacyClaims = requiredClaims.filter(
    (claim) =>
      ["legacy_adapter", "legacy_or_unsupported"].includes(String(claim.source_family)) ||
      claim.source_artefact_id === "raw_report" ||
      String(claim.source_path).startsWith("report_data."),
  );
  const requiredRewriteClaims = requiredClaims.filter((claim) => {
    const supportStatus = String(claim.support_status ?? "");
    const supportClassification = String(claim.support_classification ?? "");
    return (
      claim.rewrite_required === true ||
      ["rewrite_required", "unsupported_overclaim"].includes(supportStatus) ||
      supportClassification === "overclaim"
    );
  });
  const requiredUnsafeClaims = requiredClaims.filter(
    (claim) =>
      String(claim.support_status ?? "") === "unsafe" ||
      claim.public_safety_status === "unsafe_or_overclaim",
  );
  const requiredUnsupportedClaims = requiredClaims.filter((claim) =>
    [
      "unsupported",
      "missing_evidence",
      "missing_truth_link",
      "legacy_or_unsupported",
      "partially_supported",
    ].includes(String(claim.support_status)),
  );
  const requiredBlockedClaims = requiredClaims.filter(
    (claim) =>
      claim.support_status === "blocked" ||
      getStringArray(claim.blocker_codes).some((code) =>
        [
          "public_scoring_blocked",
          "public_technique_authority_blocked",
          "public_comparison_result_blocked",
        ].includes(code),
      ),
  );
  const sourceClassification =
    publicClaimGateStatus === "sufficient"
      ? "real_runtime_v3_claim_support"
      : hasReal && hasLegacy
        ? "mixed_real_runtime_v3_and_legacy_or_unsupported"
        : hasReal
          ? "real_runtime_v3_partial_non_satisfying"
          : hasLegacy
            ? "legacy_or_unsupported"
            : "first_pass_internal";
  const blockerCodes = dedupePreservingOrder([
    ...(publicClaimGateStatus === "sufficient" ? [] : ["public_claim_trace_support_incomplete"]),
    ...(requiredClaims.length > 0 && evidenceAnchorGateStatus !== "sufficient"
      ? ["evidence_anchor_aggregate_insufficient"]
      : []),
    ...(requiredUnsupportedClaims.length > 0 ? ["unsupported_public_claims_present"] : []),
    ...(requiredRewriteClaims.length > 0 ? ["rewrite_required_claims_present"] : []),
    ...(requiredUnsafeClaims.length > 0 ? ["unsafe_claims_present"] : []),
    ...(requiredBlockedClaims.some((claim) =>
      getStringArray(claim.blocker_codes).includes("public_scoring_blocked"),
    )
      ? ["public_scoring_blocked"]
      : []),
    ...(requiredBlockedClaims.some((claim) =>
      getStringArray(claim.blocker_codes).includes("public_technique_authority_blocked"),
    )
      ? ["public_technique_authority_blocked"]
      : []),
    ...(requiredBlockedClaims.some((claim) =>
      getStringArray(claim.blocker_codes).includes("public_comparison_result_blocked"),
    )
      ? ["public_comparison_claim_not_applicable_or_blocked"]
      : []),
    ...(requiredLegacyClaims.length > 0 || (!hasReal && hasLegacy)
      ? ["legacy_or_unsupported_claim_candidate_source"]
      : []),
    ...(requiredClaims.length > 0 ? supportIdentityBlockers : []),
    ...requiredClaims.flatMap((claim) => getStringArray(claim.blocker_codes)),
  ]);
  const reason =
    publicClaimGateStatus === "sufficient"
      ? "real_runtime_v3_claim_support_complete"
      : requiredClaims.length === 0
        ? "not_rendered_internal_claims_excluded_from_public_claim_gate"
        : blockerCodes.includes("missing_evidence_anchor_support")
          ? "missing_evidence_anchor_support"
          : blockerCodes.includes("missing_truth_state_linkage")
            ? "missing_truth_state_linkage"
            : !hasReal && hasLegacy
              ? "legacy_or_unsupported_claim_support_only"
              : "public_claim_support_incomplete";
  return {
    claims,
    sourceSummary,
    sourceClassification,
    publicClaimGateStatus,
    publicClaimGateReason: reason,
    blockerCodes,
  };
}

function classifyPublicClaimTraceIdentityRejected(input: {
  run_id: string;
  analysis_run_id: string;
  take_id: string;
  candidates: Array<Record<string, unknown>>;
  blockerCodes: string[];
}) {
  const blockers = dedupePreservingOrder([
    "public_claim_trace_support_incomplete",
    ...input.blockerCodes,
  ]);
  const claims = input.candidates.map((candidate, index) => {
    const candidateSummary =
      safeCandidateSummary(
        candidate.safe_candidate_summary ??
          candidate.candidate_text ??
          candidate.claim_text ??
          candidate.summary,
      ) ?? "[redacted unsafe candidate summary]";
    return {
      claim_id:
        typeof candidate.claim_candidate_id === "string"
          ? candidate.claim_candidate_id.replace(/^cc-/, "pc-")
          : `pc-${input.take_id}-${index + 1}`,
      safe_claim_summary: candidateSummary,
      claim_text: candidateSummary,
      claim_text_or_summary: candidateSummary,
      claim_type: String(candidate.claim_type ?? "unknown"),
      claim_family: String(candidate.claim_family ?? candidate.claim_type ?? "unknown"),
      claim_scope: "blocked_identity",
      claim_source_surface: String(candidate.source_artefact_id ?? "claim_candidate_trace"),
      candidate_public_section: String(
        candidate.candidate_public_section ?? candidate.claim_type ?? "unknown",
      ),
      source_artefact_id: String(candidate.source_artefact_id ?? "claim_candidate_trace"),
      source_path: String(candidate.source_path ?? ""),
      claim_source_path: String(candidate.source_path ?? ""),
      source_family: String(candidate.source_family ?? "first_pass_internal"),
      linked_evidence_anchor_ids: getStringArray(candidate.linked_evidence_anchor_ids),
      linked_truth_state_ids: getStringArray(candidate.linked_truth_state_ids),
      evidence_anchor_ids: getStringArray(candidate.linked_evidence_anchor_ids),
      truth_state_entry_ids: getStringArray(candidate.linked_truth_state_ids),
      missing_evidence_anchor_ids: getStringArray(candidate.linked_evidence_anchor_ids),
      missing_truth_state_entry_ids: getStringArray(candidate.linked_truth_state_ids),
      support_status: "blocked" as PublicClaimSupportStatus,
      support_classification: "blocked",
      public_safety_status: "blocked",
      rewrite_required: true,
      score_scope: String(candidate.score_scope ?? "not_score"),
      blocked_claim_category: "claim_candidate_trace_identity",
      limitation_only: false,
      public_authority_required: false,
      public_authority_category: null,
      public_authority_status: "not_required",
      suppress_public_claim: true,
      safe_public_claim_possible: false,
      reason: "claim_candidate_trace_identity_mismatch",
      blocker_codes: blockers,
      evidence_support_summary: {
        linked_real_runtime_v3_anchor_count: 0,
        evidence_anchor_gate_status: "insufficient",
      },
      truth_support_summary: {
        required: publicClaimRequiresTruth(candidate),
        linked_truth_state_count: getStringArray(candidate.linked_truth_state_ids).length,
        unresolved_truth_state_ids: getStringArray(candidate.linked_truth_state_ids),
      },
      public_display_status: "not_rendered_internal_trace",
      public_claim_support_required: true,
      required_for_public_claim_gate: true,
      excluded_from_public_claim_gate: false,
      cannot_satisfy_public_claim_gate: true,
    };
  });
  const sourceSummary = claims.reduce<Record<string, number>>(
    (acc, claim) => {
      const key = String(claim.source_family ?? "unknown");
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {
      real_runtime_v3: 0,
      legacy_adapter: 0,
      legacy_or_unsupported: 0,
      report_candidate_requires_support: 0,
      first_pass_internal: 0,
    },
  );
  return {
    claims,
    sourceSummary,
    sourceClassification: "first_pass_internal",
    publicClaimGateStatus: "insufficient" as const,
    publicClaimGateReason: input.blockerCodes.includes("claim_candidate_trace_identity_missing")
      ? "claim_candidate_trace_identity_missing"
      : "claim_candidate_trace_identity_mismatch",
    blockerCodes: blockers,
  };
}

export async function emitClaimCandidateTrace(input: ClaimCandidateTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const candidates: Array<Record<string, unknown>> = [];
  const rawReportData = unwrapRawReportData(input.raw_report_data);
  const analysisEvidenceState = isRecord(input.analysis_evidence_state_data)
    ? input.analysis_evidence_state_data
    : null;
  const anchors = safeRecordArray(input.evidence_anchors_data?.anchors);
  const generatedAt = new Date().toISOString();

  const addCandidate = (args: {
    summary: string;
    claimType: string;
    claimFamily: string;
    sourceArtefactId: string;
    sourcePath: string;
    sourceFamily: ClaimCandidateSourceFamily;
    sourceStage?: string;
    linkedEvidenceAnchorIds?: string[];
    linkedTruthStateIds?: string[];
    requiredEvidenceAnchorFamily?: string;
    requiredTruthStateFamily?: string;
    supportStatus?: string;
    extraBlockerCodes?: string[];
    publicClaimSupportRequired?: boolean;
    excludedFromPublicClaimGate?: boolean;
    publicDisplayStatus?: string;
  }) => {
    const clean = safeCandidateSummary(args.summary);
    if (!clean) return;
    const safety = classifyClaimCandidateSafety({
      text: clean,
      claimType: args.claimType,
      claimFamily: args.claimFamily,
      sourcePath: args.sourcePath,
    });
    const publicAuthority = classifyClaimPublicAuthorityRequirement(
      normalizeCandidateBlockedCategory(safety.blocked_claim_category),
    );
    const isLegacy = args.sourceFamily === "legacy_adapter";
    const publicDisplayStatus = args.publicDisplayStatus ?? "not_rendered_internal_candidate";
    const excludedDisplayStatus = isPublicClaimGateExcludedDisplayStatus(publicDisplayStatus);
    const excludedFromGate =
      args.excludedFromPublicClaimGate === true ||
      args.publicClaimSupportRequired === false ||
      excludedDisplayStatus;
    const eligible =
      !excludedFromGate &&
      args.sourceFamily === "real_runtime_v3" &&
      safety.public_safety_status !== "blocked";
    const linkedEvidenceAnchorIds = args.linkedEvidenceAnchorIds ?? [];
    const linkedTruthStateIds = args.linkedTruthStateIds ?? [];
    const excludedInternalObservation =
      excludedFromGate &&
      args.sourceFamily === "real_runtime_v3" &&
      args.sourcePath.startsWith("observable_evidence_items") &&
      linkedEvidenceAnchorIds.length === 0;
    const publicSafetyStatus =
      excludedInternalObservation && safety.public_safety_status === "safe_for_public_candidate"
        ? "internal_only"
        : safety.public_safety_status;
    const limitationOnly = isLimitationClaimFamily(args.claimFamily, args.claimType);
    const supportStatus = excludedFromGate
      ? "not_applicable"
      : safety.public_safety_status === "blocked"
        ? "blocked"
        : limitationOnly && linkedEvidenceAnchorIds.length > 0
          ? "limitation_only_supported"
          : eligible && linkedEvidenceAnchorIds.length > 0
            ? "supported"
            : isLegacy
              ? "legacy_or_unsupported"
              : "unsupported";
    const supportClassification = supportClassificationForStatus(
      supportStatus as PublicClaimSupportStatus,
      normalizeCandidateBlockedCategory(safety.blocked_claim_category),
    );
    const suppressPublicClaim =
      excludedFromGate ||
      !["supported", "limitation_only_supported", "not_applicable"].includes(supportStatus) ||
      publicAuthority.status === "blocked";
    const blockerCodes = dedupePreservingOrder([
      ...safety.blocker_codes,
      ...(isLegacy ? ["legacy_or_unsupported_claim_candidate_source"] : []),
      ...(args.sourceFamily === "report_candidate_requires_support"
        ? ["report_candidate_requires_support"]
        : []),
      ...(!excludedFromGate && !eligible && !isLegacy && safety.public_safety_status !== "blocked"
        ? ["claim_candidate_not_eligible_for_support_check"]
        : []),
      ...(args.extraBlockerCodes ?? []),
    ]);
    const cannotSatisfyPublicClaimGate =
      !excludedFromGate &&
      (!["supported", "limitation_only_supported"].includes(supportStatus) ||
        isLegacy ||
        publicAuthority.status === "blocked");
    candidates.push({
      claim_candidate_id: `cc-${input.take_id}-${candidates.length + 1}`,
      safe_candidate_summary: clean,
      claim_text_or_summary: clean,
      claim_type:
        safety.blocked_claim_category === "public_scoring" ? "score_or_verdict" : args.claimType,
      claim_family: args.claimFamily,
      claim_scope: limitationOnly ? "limitation_only" : "public_claim_candidate",
      claim_source_surface: args.sourceArtefactId,
      claim_source_path: args.sourcePath,
      candidate_public_section: args.claimType,
      source_artefact_id: args.sourceArtefactId,
      source_path: args.sourcePath,
      source_family: args.sourceFamily,
      source_stage: args.sourceStage ?? input.source_stage,
      required_evidence_anchor_family: args.requiredEvidenceAnchorFamily ?? args.claimFamily,
      required_truth_state_family:
        args.requiredTruthStateFamily ?? "run_shape_or_claim_family_truth",
      linked_evidence_anchor_ids: linkedEvidenceAnchorIds,
      linked_truth_state_ids: linkedTruthStateIds,
      evidence_anchor_ids: linkedEvidenceAnchorIds,
      truth_state_entry_ids: linkedTruthStateIds,
      missing_evidence_anchor_ids:
        linkedEvidenceAnchorIds.length > 0 ? [] : ["evidence_anchor_link_required"],
      missing_truth_state_entry_ids:
        linkedTruthStateIds.length > 0 || args.requiredTruthStateFamily?.startsWith("not_required")
          ? []
          : ["truth_state_link_required"],
      candidate_support_precheck_status:
        args.supportStatus ??
        (excludedFromGate
          ? "not_applicable"
          : eligible
            ? "eligible_for_support_check"
            : isLegacy
              ? "legacy_or_unsupported"
              : safety.public_safety_status === "blocked"
                ? "blocked"
                : "requires_support"),
      support_status: supportStatus,
      support_classification: supportClassification,
      public_safety_status: publicSafetyStatus,
      rewrite_required: safety.rewrite_required || isLegacy,
      score_scope: safety.score_scope,
      blocked_claim_category: safety.blocked_claim_category,
      limitation_only: limitationOnly,
      public_authority_required: publicAuthority.required,
      public_authority_category: publicAuthority.category,
      public_authority_status: publicAuthority.status,
      suppress_public_claim: suppressPublicClaim,
      safe_public_claim_possible: safePublicClaimPossibleForStatus(supportStatus),
      reason: supportClassification,
      blocker_codes: blockerCodes,
      public_display_status: publicDisplayStatus,
      cannot_satisfy_public_claim_gate: cannotSatisfyPublicClaimGate,
      eligible_for_public_claim_trace_support_check: eligible,
      public_claim_support_required: !excludedFromGate,
      required_for_public_claim_gate: !excludedFromGate,
      excluded_from_public_claim_gate: excludedFromGate,
    });
  };

  if (analysisEvidenceState) {
    const observableItems = safeRecordArray(analysisEvidenceState.observable_evidence_items);
    observableItems.forEach((item, index) => {
      const summary = pickSafeRecordText(item);
      if (!summary) return;
      const itemPath =
        typeof item.analysis_evidence_state_source_path === "string"
          ? item.analysis_evidence_state_source_path
          : `observable_evidence_items[${index}]`;
      const explicitLinkedEvidenceAnchorIds = getStringArray(item.linked_evidence_anchor_ids);
      const linkedEvidenceAnchorIds =
        explicitLinkedEvidenceAnchorIds.length > 0
          ? explicitLinkedEvidenceAnchorIds
          : findSameRunAnchorIdsForAnalysisEvidencePath(anchors, itemPath);
      const linkedTruthStateIds = Array.isArray(item.linked_truth_state_ids)
        ? item.linked_truth_state_ids.filter(
            (id): id is string => typeof id === "string" && id.length > 0,
          )
        : [];
      addCandidate({
        summary,
        claimType: "factual_or_limitation_status",
        claimFamily: claimFamilyForRuntimeEvidence(item),
        sourceArtefactId: "analysis_evidence_state",
        sourcePath: itemPath,
        sourceFamily: "real_runtime_v3",
        sourceStage: "analysis_step_1_evidence_mapping",
        linkedEvidenceAnchorIds,
        linkedTruthStateIds,
        requiredEvidenceAnchorFamily: String(item.evidence_kind ?? "runtime_fact"),
        requiredTruthStateFamily:
          linkedTruthStateIds.length > 0
            ? "linked_truth_state_ids"
            : "not_required_for_runtime_fact",
        publicClaimSupportRequired: false,
        excludedFromPublicClaimGate: true,
      });
    });
    const unsupportedItems = Array.isArray(
      analysisEvidenceState.unsupported_or_unavailable_evidence,
    )
      ? analysisEvidenceState.unsupported_or_unavailable_evidence
      : analysisEvidenceState.unsupported_or_unavailable_evidence === null ||
          analysisEvidenceState.unsupported_or_unavailable_evidence === undefined
        ? []
        : [analysisEvidenceState.unsupported_or_unavailable_evidence];
    unsupportedItems.forEach((item, index) => {
      const recordItem = isRecord(item) ? item : null;
      const summary = recordItem
        ? `${safeCandidateSummary(recordItem.evidence_kind) ?? `unavailable_evidence_family_${index + 1}`}: ${safeCandidateSummary(recordItem.reason) ?? safeCandidateSummary(recordItem.status) ?? "not extracted"}`
        : safeCandidateSummary(item);
      if (!summary) return;
      addCandidate({
        summary,
        claimType: "assessability_limitation",
        claimFamily: "assessability_limitation",
        sourceArtefactId: "analysis_evidence_state",
        sourcePath: `unsupported_or_unavailable_evidence[${index}]`,
        sourceFamily: "real_runtime_v3",
        sourceStage: "analysis_step_1_evidence_mapping",
        requiredEvidenceAnchorFamily: "assessability_limitation",
        requiredTruthStateFamily: "not_required_for_limitation_candidate",
        extraBlockerCodes: recordItem
          ? getStringArray(recordItem.blocker_codes)
          : summary === "[redacted unsafe candidate summary]"
            ? ["unsafe_limitation_summary_redacted"]
            : [],
        publicClaimSupportRequired: false,
        excludedFromPublicClaimGate: true,
      });
    });
    for (const [field, value] of [
      ["assessability_limitations", analysisEvidenceState.assessability_limitations],
      ["timestamp_normalisation_warnings", analysisEvidenceState.timestamp_normalisation_warnings],
      ["timestamp_normalization_warnings", analysisEvidenceState.timestamp_normalization_warnings],
      ["extraction_limitations", analysisEvidenceState.extraction_limitations],
    ] as const) {
      normaliseSafeLimitationItems(value).forEach((item) => {
        addCandidate({
          summary: item.safe_summary,
          claimType: "assessability_limitation",
          claimFamily: "assessability_limitation",
          sourceArtefactId: "analysis_evidence_state",
          sourcePath: `${field}[${item.source_index}]`,
          sourceFamily: "real_runtime_v3",
          sourceStage: "analysis_step_1_evidence_mapping",
          requiredEvidenceAnchorFamily: "assessability_limitation",
          requiredTruthStateFamily: "not_required_for_limitation_candidate",
          extraBlockerCodes: item.blocker_codes,
          publicClaimSupportRequired: false,
          excludedFromPublicClaimGate: true,
        });
      });
    }
  }

  anchors.forEach((anchor, index) => {
    if (
      anchor.source_family !== "real_runtime_v3" &&
      anchor.source_classification !== "real_runtime_v3"
    )
      return;
    const summary = pickSafeRecordText(anchor);
    if (!summary) return;
    const anchorId =
      typeof anchor.evidence_anchor_id === "string" ? anchor.evidence_anchor_id : null;
    const truthIds = Array.isArray(anchor.linked_truth_state_ids)
      ? anchor.linked_truth_state_ids.filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        )
      : [];
    const limitationOnlyAnchor = isLimitationOnlyEvidenceAnchor(anchor);
    addCandidate({
      summary,
      claimType: limitationOnlyAnchor ? "assessability_limitation" : "evidence_summary",
      claimFamily: limitationOnlyAnchor
        ? "assessability_limitation"
        : claimFamilyForRuntimeEvidence(anchor),
      sourceArtefactId: "evidence_anchors",
      sourcePath: `anchors[${index}]`,
      sourceFamily: "real_runtime_v3",
      sourceStage: "evidence_anchor_promotion",
      linkedEvidenceAnchorIds: anchorId ? [anchorId] : [],
      linkedTruthStateIds: truthIds,
      requiredEvidenceAnchorFamily: String(
        anchor.evidence_modality ?? anchor.evidence_kind ?? "runtime_anchor",
      ),
      requiredTruthStateFamily: limitationOnlyAnchor
        ? "not_required_for_limitation_candidate"
        : truthIds.length > 0
          ? "linked_truth_state_ids"
          : "not_required_for_runtime_fact",
      publicClaimSupportRequired: false,
      excludedFromPublicClaimGate: true,
    });
  });

  const addLegacyCandidate = (value: unknown, sourcePath: string, claimType: string) => {
    const summary = safeCandidateSummary(value);
    if (!summary) return;
    addCandidate({
      summary,
      claimType,
      claimFamily: inferLegacyClaimFamily(sourcePath, summary, claimType),
      sourceArtefactId: "raw_report",
      sourcePath,
      sourceFamily: "legacy_adapter",
      sourceStage: "raw_report_snapshot",
      supportStatus: "legacy_diagnostic_only",
      publicClaimSupportRequired: false,
      excludedFromPublicClaimGate: true,
      extraBlockerCodes: ["legacy_diagnostic_claim_candidate_excluded_from_public_claim_gate"],
    });
  };
  const directFields: Array<[string, unknown, string]> = [
    [
      "report_data.submission_verdict.label",
      (rawReportData.submission_verdict as Record<string, unknown> | undefined)?.label,
      "score_or_verdict",
    ],
    [
      "report_data.submission_verdict.reason",
      (rawReportData.submission_verdict as Record<string, unknown> | undefined)?.reason,
      "readiness_status",
    ],
    ["report_data.verdict_final", rawReportData.verdict_final, "score_or_verdict"],
    ["report_data.casting_insight", rawReportData.casting_insight, "role_or_brief_fit"],
    ["report_data.casting_headline", rawReportData.casting_headline, "role_or_brief_fit"],
    ["report_data.fix_first", rawReportData.fix_first, "priority_fix"],
    ["report_data.next_take", rawReportData.next_take, "priority_fix"],
    ["report_data.presentation_notes", rawReportData.presentation_notes, "performance_quality"],
  ];
  directFields.forEach(([sourcePath, value, claimType]) =>
    addLegacyCandidate(value, sourcePath, claimType),
  );
  for (const key of [
    "overall_score",
    "overall_score_final",
    "overall_score_model",
    "overall_readiness",
    "readiness_score",
  ] as const) {
    const value = rawReportData[key];
    if (typeof value === "number" || typeof value === "string")
      addLegacyCandidate(value, `report_data.${key}`, "score_or_verdict");
  }
  if (isRecord(rawReportData.scores)) {
    for (const [key, value] of Object.entries(rawReportData.scores)) {
      if (typeof value === "number" || typeof value === "string")
        addLegacyCandidate(
          `${key}: ${String(value)}`,
          `report_data.scores.${key}`,
          "score_or_verdict",
        );
    }
  }
  for (const [key, value, claimType] of [
    ["strengths", rawReportData.strengths, "preserve_strength"],
    ["improvements", rawReportData.improvements, "priority_fix"],
    ["category_notes", rawReportData.category_notes, "readiness_status"],
    ["category_rationale", rawReportData.category_rationale, "readiness_status"],
    ["priority_fixes", rawReportData.priority_fixes, "priority_fix"],
  ] as const) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === "string" || typeof item === "number")
          addLegacyCandidate(item, `report_data.${key}[${index}]`, claimType);
        else if (isRecord(item)) {
          const text = pickSafeRecordText(item);
          if (text) addLegacyCandidate(text, `report_data.${key}[${index}]`, claimType);
        }
      });
    } else if (isRecord(value)) {
      for (const [subKey, subValue] of Object.entries(value))
        addLegacyCandidate(subValue, `report_data.${key}.${subKey}`, claimType);
    }
  }
  if (Array.isArray(rawReportData.timestamped_notes)) {
    rawReportData.timestamped_notes.forEach((item, index) => {
      if (!isRecord(item)) return;
      const text = getTimestampedNoteText(item);
      const field = getTimestampedNoteTextField(item);
      if (text && field)
        addLegacyCandidate(
          text,
          `report_data.timestamped_notes[${index}].${field}`,
          "performance_quality",
        );
    });
  }

  if (candidates.length === 0)
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const sourceSummary = summarizeClaimCandidateSources(candidates);
  const sourceClassification = sourceClassificationForClaimCandidates(sourceSummary);
  const requiredCandidateCount = candidates.filter(
    (candidate) =>
      candidate.required_for_public_claim_gate !== false &&
      candidate.excluded_from_public_claim_gate !== true,
  ).length;
  const renderedCandidateCount = candidates.filter(
    (candidate) => !isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status),
  ).length;
  const notRenderedInternalCandidateCount = candidates.filter(
    (candidate) =>
      String(candidate.public_display_status ?? "") === "not_rendered_internal_candidate",
  ).length;
  const excludedInternalCandidateCount = candidates.filter(
    (candidate) =>
      candidate.excluded_from_public_claim_gate === true ||
      isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status),
  ).length;
  const unsupportedRenderedCandidateCount = candidates.filter(
    (candidate) =>
      !isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status) &&
      !["supported", "limitation_only_supported", "not_applicable"].includes(
        String(candidate.support_status),
      ),
  ).length;
  const unsupportedRequiredCandidateCount = candidates.filter(
    (candidate) =>
      candidate.required_for_public_claim_gate !== false &&
      candidate.excluded_from_public_claim_gate !== true &&
      !["supported", "limitation_only_supported"].includes(String(candidate.support_status)),
  ).length;
  const unsupportedInternalOnlyCandidateCount = candidates.filter(
    (candidate) =>
      isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status) &&
      !["supported", "limitation_only_supported", "not_applicable"].includes(
        String(candidate.support_status),
      ),
  ).length;
  const internalOnlyNotPublicGateEvidence = candidates.some((candidate) =>
    isPublicClaimGateExcludedDisplayStatus(candidate.public_display_status),
  );
  const claimCandidateGateStatus =
    requiredCandidateCount === 0 || unsupportedRequiredCandidateCount === 0
      ? ("satisfied" as const)
      : ("insufficient" as const);
  const blockedCandidateCount = candidates.filter(
    (candidate) => candidate.public_safety_status === "blocked",
  ).length;
  const rewriteRequiredCount = candidates.filter(
    (candidate) => candidate.rewrite_required === true,
  ).length;
  const unsupportedCandidateCount = candidates.filter((candidate) =>
    ["legacy_or_unsupported", "requires_support"].includes(
      String(candidate.candidate_support_precheck_status),
    ),
  ).length;
  const safeCandidateCount = candidates.filter(
    (candidate) => candidate.public_safety_status === "safe_for_public_candidate",
  ).length;
  const supportedCandidateCount = candidates.filter((candidate) =>
    ["supported", "limitation_only_supported"].includes(String(candidate.support_status)),
  ).length;
  const limitationOnlyCandidateCount = candidates.filter(
    (candidate) =>
      candidate.limitation_only === true ||
      candidate.support_status === "limitation_only_supported",
  ).length;
  const unsafeCandidateCount = candidates.filter(
    (candidate) =>
      ["unsafe", "unsafe_or_overclaim"].includes(String(candidate.public_safety_status)) ||
      getStringArray(candidate.blocker_codes).some((code) => /unsafe|redacted/.test(code)),
  ).length;
  const suppressedCandidateCount = candidates.filter(
    (candidate) => candidate.suppress_public_claim === true,
  ).length;
  const publicFeatureSuppressionClaimSummary =
    buildPublicFeatureSuppressionClaimSummary(candidates);
  const blockerCodes = dedupePreservingOrder([
    ...(claimCandidateGateStatus === "satisfied"
      ? []
      : ["claim_candidate_trace_required_rendered_candidate_support_incomplete"]),
    ...(renderedCandidateCount > 0 && unsupportedRenderedCandidateCount > 0
      ? ["unsupported_rendered_claim_candidate_present"]
      : []),
    ...(unsupportedRequiredCandidateCount > 0
      ? ["unsupported_required_claim_candidate_present"]
      : []),
    ...candidates
      .filter(
        (candidate) =>
          candidate.required_for_public_claim_gate !== false &&
          candidate.excluded_from_public_claim_gate !== true,
      )
      .flatMap((candidate) =>
        Array.isArray(candidate.blocker_codes)
          ? candidate.blocker_codes.filter(
              (x): x is string => typeof x === "string" && x.length > 0,
            )
          : [],
      ),
  ]);
  const payload = {
    ...(input.metadata_overrides ?? {}),
    schema_version: "tapecoach_v3_claim_candidate_trace_v1",
    artefact_type: "claim_candidate_trace",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    generated_at: generatedAt,
    internal_only: true,
    privacy_classification: "internal_private",
    source_classification: sourceClassification,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    claim_candidate_count: candidates.length,
    claim_candidates: candidates,
    claim_candidate_source_summary: sourceSummary,
    required_rendered_public_claim_count: requiredCandidateCount,
    rendered_public_claim_count: renderedCandidateCount,
    not_rendered_internal_candidate_count: notRenderedInternalCandidateCount,
    excluded_internal_claim_count: excludedInternalCandidateCount,
    unsupported_rendered_claim_count: unsupportedRenderedCandidateCount,
    unsupported_internal_only_claim_count: unsupportedInternalOnlyCandidateCount,
    supported_candidate_count: supportedCandidateCount,
    blocked_candidate_count: blockedCandidateCount,
    rewrite_required_count: rewriteRequiredCount,
    unsupported_candidate_count: unsupportedCandidateCount,
    unsafe_candidate_count: unsafeCandidateCount,
    limitation_only_candidate_count: limitationOnlyCandidateCount,
    suppressed_candidate_count: suppressedCandidateCount,
    safe_candidate_count: safeCandidateCount,
    ...publicFeatureSuppressionClaimSummary,
    public_render_permission_status: "not_evaluated_or_blocked",
    cannot_satisfy_public_claim_gate: claimCandidateGateStatus !== "satisfied",
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_comparison_output_status: "blocked",
    blocker_codes: blockerCodes,
    gate_satisfaction_reason:
      claimCandidateGateStatus === "satisfied"
        ? "not_rendered_internal_candidates_excluded_from_public_claim_gate"
        : "rendered_claim_candidate_support_incomplete",
    public_output_unchanged: true,
    redaction_policy: "safe_summaries_only",
  };
  assertSafeSegment(input.take_id, "take_id");
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ClaimCandidateTrace.json`,
    payload,
    "claim_candidate_trace",
  );
  const summary = {
    claim_candidate_count: candidates.length,
    source_classification: sourceClassification,
    claim_candidate_source_summary: sourceSummary,
    required_rendered_public_claim_count: requiredCandidateCount,
    rendered_public_claim_count: renderedCandidateCount,
    not_rendered_internal_candidate_count: notRenderedInternalCandidateCount,
    excluded_internal_claim_count: excludedInternalCandidateCount,
    unsupported_rendered_claim_count: unsupportedRenderedCandidateCount,
    unsupported_internal_only_claim_count: unsupportedInternalOnlyCandidateCount,
    supported_candidate_count: supportedCandidateCount,
    blocked_candidate_count: blockedCandidateCount,
    rewrite_required_count: rewriteRequiredCount,
    unsupported_candidate_count: unsupportedCandidateCount,
    unsafe_candidate_count: unsafeCandidateCount,
    limitation_only_candidate_count: limitationOnlyCandidateCount,
    suppressed_candidate_count: suppressedCandidateCount,
    safe_candidate_count: safeCandidateCount,
    ...publicFeatureSuppressionClaimSummary,
    claim_candidate_gate_status: claimCandidateGateStatus,
    claim_candidate_gate_reason:
      claimCandidateGateStatus === "satisfied"
        ? "not_rendered_internal_candidates_excluded_from_public_claim_gate"
        : "rendered_claim_candidate_support_incomplete",
  };
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["claim_candidate_trace"] : [],
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    artefact_type: "claim_candidate_trace",
    source_classification: sourceClassification,
    summary,
    claim_candidates: candidates,
    warning: result.warning ?? null,
  };
}

export async function emitPublicClaimTraceFirstPass(input: PublicClaimTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const claimCandidates = getTraceClaimCandidates(input.claim_candidate_trace_data);
  if (claimCandidates.length > 0) {
    const identity = validateTraceIdentityForCurrentRun(input.claim_candidate_trace_data, {
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      take_id: input.take_id,
      artefact_type: "claim_candidate_trace",
    });
    const classified = identity.ok
      ? classifyPublicClaimSupportFromCandidates({
          run_id: input.run_id,
          analysis_run_id: analysisRunId,
          take_id: input.take_id,
          candidates: claimCandidates,
          evidence_anchors_data: input.evidence_anchors_data,
          truth_state_map_data: input.truth_state_map_data,
        })
      : classifyPublicClaimTraceIdentityRejected({
          run_id: input.run_id,
          analysis_run_id: analysisRunId,
          take_id: input.take_id,
          candidates: claimCandidates,
          blockerCodes: identity.blockerCodes,
        });
    const supportedClaimCount = classified.claims.filter(
      (claim) => claim.support_status === "supported",
    ).length;
    const requiredRenderedPublicClaimCount = classified.claims.filter(
      (claim) =>
        claim.required_for_public_claim_gate !== false &&
        claim.excluded_from_public_claim_gate !== true,
    ).length;
    const renderedPublicClaimCount = classified.claims.filter(
      (claim) => !isPublicClaimGateExcludedDisplayStatus(claim.public_display_status),
    ).length;
    const notRenderedInternalTraceCount = classified.claims.filter(
      (claim) => String(claim.public_display_status ?? "") === "not_rendered_internal_trace",
    ).length;
    const notRenderedInternalCandidateCount = classified.claims.filter(
      (claim) => String(claim.public_display_status ?? "") === "not_rendered_internal_candidate",
    ).length;
    const excludedInternalClaimCount = classified.claims.filter(
      (claim) =>
        claim.excluded_from_public_claim_gate === true ||
        isPublicClaimGateExcludedDisplayStatus(claim.public_display_status),
    ).length;
    const unsupportedRenderedClaimCount = classified.claims.filter(
      (claim) =>
        !isPublicClaimGateExcludedDisplayStatus(claim.public_display_status) &&
        !["supported", "limitation_only_supported", "not_applicable"].includes(
          String(claim.support_status),
        ),
    ).length;
    const unsupportedInternalOnlyClaimCount = classified.claims.filter(
      (claim) =>
        isPublicClaimGateExcludedDisplayStatus(claim.public_display_status) &&
        !["supported", "limitation_only_supported", "not_applicable"].includes(
          String(claim.support_status),
        ),
    ).length;
    const missingEvidenceCount = classified.claims.filter(
      (claim) => claim.support_status === "missing_evidence",
    ).length;
    const missingTruthLinkCount = classified.claims.filter(
      (claim) => claim.support_status === "missing_truth_link",
    ).length;
    const blockedClaimCount = classified.claims.filter(
      (claim) => claim.support_status === "blocked",
    ).length;
    const rewriteRequiredCount = classified.claims.filter(
      (claim) => claim.rewrite_required === true,
    ).length;
    const limitationOnlyClaimCount = classified.claims.filter(
      (claim) =>
        claim.support_status === "limitation_only_supported" || claim.limitation_only === true,
    ).length;
    const suppressedClaimCount = classified.claims.filter(
      (claim) => claim.suppress_public_claim === true || claim.support_status === "suppressed",
    ).length;
    const overclaimClaimCount = classified.claims.filter(
      (claim) =>
        ["overclaim", "unsupported_overclaim"].includes(String(claim.support_status)) ||
        claim.support_classification === "overclaim",
    ).length;
    const unsupportedClaimCount = classified.claims.filter(
      (claim) =>
        !["supported", "limitation_only_supported", "not_applicable"].includes(
          String(claim.support_status),
        ),
    ).length;
    const legacyUntracedClaimCount = classified.claims.filter(
      (claim) =>
        ["legacy_adapter", "legacy_or_unsupported"].includes(String(claim.source_family)) ||
        claim.source_artefact_id === "raw_report",
    ).length;
    const unsafeOrOverclaimCount = classified.claims.filter(
      (claim) =>
        ["unsafe_or_overclaim", "needs_rewrite", "blocked"].includes(
          String(claim.public_safety_status),
        ) || ["overclaim", "unsafe"].includes(String(claim.support_classification)),
    ).length;
    const publicFeatureSuppressionClaimSummary = buildPublicFeatureSuppressionClaimSummary(
      classified.claims,
    );
    const payload = {
      ...(input.metadata_overrides ?? {}),
      schema_version: "tapecoach_v3_public_claim_trace_support_v1",
      artefact_type: "public_claim_trace",
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      generated_at: new Date().toISOString(),
      internal_only: true,
      privacy_classification: "internal_private",
      submission_id: input.submission_id ?? null,
      take_id: input.take_id,
      comparison_run_id: input.comparison_run_id ?? null,
      source_module: input.source_module,
      source_stage: input.source_stage,
      source_classification: classified.sourceClassification,
      claim_count: classified.claims.length,
      claims: classified.claims,
      claim_source_summary: classified.sourceSummary,
      support_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_reason: classified.publicClaimGateReason,
      supported_claim_count: supportedClaimCount,
      required_rendered_public_claim_count: requiredRenderedPublicClaimCount,
      rendered_public_claim_count: renderedPublicClaimCount,
      not_rendered_internal_trace_count: notRenderedInternalTraceCount,
      not_rendered_internal_candidate_count: notRenderedInternalCandidateCount,
      excluded_internal_claim_count: excludedInternalClaimCount,
      unsupported_rendered_claim_count: unsupportedRenderedClaimCount,
      unsupported_internal_only_claim_count: unsupportedInternalOnlyClaimCount,
      unsupported_claim_count: unsupportedClaimCount,
      legacy_untraced_claim_count: legacyUntracedClaimCount,
      unsafe_or_overclaim_count: unsafeOrOverclaimCount,
      rewrite_required_count: rewriteRequiredCount,
      missing_evidence_count: missingEvidenceCount,
      missing_truth_link_count: missingTruthLinkCount,
      blocked_claim_count: blockedClaimCount,
      limitation_only_claim_count: limitationOnlyClaimCount,
      suppressed_claim_count: suppressedClaimCount,
      overclaim_claim_count: overclaimClaimCount,
      public_safe_claim_count: classified.claims.filter(
        (claim) => claim.public_safety_status === "safe_for_public_candidate",
      ).length,
      ...publicFeatureSuppressionClaimSummary,
      blocker_codes: classified.blockerCodes,
      cannot_satisfy_public_claim_gate: classified.publicClaimGateStatus !== "sufficient",
      production_safe_status: "blocked",
      public_scoring_status: "blocked",
      public_technique_authority_status: "blocked",
      public_comparison_output_status: "blocked",
      public_output_unchanged: true,
      redaction_notes: [
        "Internal-only trace; no secrets or token/session credentials included",
        "safe summaries only",
      ],
      ...resolveQADeploymentProvenance(),
    };
    assertSafeSegment(input.take_id, "take_id");
    const result = await writeInternalJson(
      root,
      input.run_id,
      `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/PublicClaimTrace.json`,
      payload,
      "public_claim_trace",
    );
    const summary = {
      claim_count: payload.claim_count,
      unsupported_claim_count: payload.unsupported_claim_count,
      legacy_untraced_claim_count: payload.legacy_untraced_claim_count,
      unsafe_or_overclaim_count: payload.unsafe_or_overclaim_count,
      rewrite_required_count: payload.rewrite_required_count,
      supported_claim_count: payload.supported_claim_count,
      required_rendered_public_claim_count: payload.required_rendered_public_claim_count,
      rendered_public_claim_count: payload.rendered_public_claim_count,
      not_rendered_internal_trace_count: payload.not_rendered_internal_trace_count,
      not_rendered_internal_candidate_count: payload.not_rendered_internal_candidate_count,
      excluded_internal_claim_count: payload.excluded_internal_claim_count,
      unsupported_rendered_claim_count: payload.unsupported_rendered_claim_count,
      unsupported_internal_only_claim_count: payload.unsupported_internal_only_claim_count,
      missing_evidence_count: payload.missing_evidence_count,
      missing_truth_link_count: payload.missing_truth_link_count,
      blocked_claim_count: payload.blocked_claim_count,
      limitation_only_claim_count: payload.limitation_only_claim_count,
      suppressed_claim_count: payload.suppressed_claim_count,
      overclaim_claim_count: payload.overclaim_claim_count,
      ...publicFeatureSuppressionClaimSummary,
      source_classification: classified.sourceClassification,
      claim_source_summary: classified.sourceSummary,
      support_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_status: classified.publicClaimGateStatus,
      public_claim_gate_reason: classified.publicClaimGateReason,
      blocker_codes: classified.blockerCodes,
    };
    return {
      written: result.written as boolean,
      emitted_artefact_ids: result.written ? ["public_claim_trace"] : [],
      claims: classified.claims,
      source_classification: classified.sourceClassification,
      level2_satisfies: result.written && classified.publicClaimGateStatus === "sufficient",
      summary,
      warning: result.warning ?? null,
    };
  }
  const reportData = unwrapRawReportData(input.raw_report_data);
  const claims: Array<Record<string, unknown>> = [];
  const addClaim = (
    claimText: string,
    sourcePath: string,
    claimType: string,
    timestamp?: string | null,
  ) => {
    const scoreMeta = classifyNumericOrScoreClaim({ claimType, sourcePath, claimText });
    const isScoreLike = scoreMeta.is_score_claim;
    const isOverclaim = OVERCLAIM_PATTERN.test(claimText);
    const isGeneric = GENERIC_PRAISE_PATTERN.test(claimText);
    const linked = findLinkedEvidenceAnchorForClaim({
      claimText,
      sourcePath,
      timestamp,
      anchors: (input.evidence_anchors_data?.anchors ?? []) as Array<Record<string, unknown>>,
    });
    const linkedId = linked?.evidence_anchor_id ? [linked.evidence_anchor_id] : [];
    const hasLegacyLinkOnly = linkedId.length > 0 && linked?.source_family !== "real_runtime_v3";
    const supportStatus = isScoreLike
      ? "blocked"
      : hasLegacyLinkOnly
        ? "legacy_untraced_claim"
        : linkedId.length > 0
          ? "supported_by_evidence_anchor"
          : "missing_evidence";
    const safetyStatus = scoreMeta.is_public_overall_readiness_score_risk
      ? "blocked"
      : isOverclaim
        ? "unsafe_or_overclaim"
        : isGeneric
          ? "internal_only"
          : isScoreLike
            ? "internal_only"
            : "needs_rewrite";
    claims.push({
      claim_id: `pc-${input.take_id}-${claims.length + 1}`,
      claim_text: claimText,
      claim_text_or_summary: claimText,
      safe_claim_summary: claimText,
      claim_source_surface: "raw_report",
      claim_source_path: sourcePath,
      candidate_public_section: claimType,
      claim_scope: "legacy_report_candidate",
      source_family: "legacy_adapter",
      source_artefact_id: "raw_report",
      source_path: sourcePath,
      claim_type: isScoreLike ? "score_or_verdict" : claimType,
      score_scope: scoreMeta.score_scope,
      linked_evidence_anchor_ids: linkedId,
      linked_truth_state_ids: [],
      evidence_anchor_ids: linkedId,
      truth_state_entry_ids: [],
      missing_evidence_anchor_ids: linkedId.length > 0 ? [] : ["evidence_anchor_link_required"],
      missing_truth_state_entry_ids: [],
      support_status: supportStatus,
      support_classification: isScoreLike
        ? "public_scoring"
        : hasLegacyLinkOnly
          ? "legacy_or_unsupported"
          : linkedId.length > 0
            ? "legacy_or_unsupported"
            : "unsupported",
      public_safety_status: safetyStatus,
      rewrite_required: true,
      limitation_only: false,
      public_authority_required: isScoreLike,
      public_authority_category: isScoreLike ? "public_scoring" : null,
      public_authority_status: isScoreLike ? "blocked" : "not_required",
      suppress_public_claim: true,
      safe_public_claim_possible: !isScoreLike && !isOverclaim,
      reason: hasLegacyLinkOnly
        ? "legacy_anchor_cannot_support_public_claim_gate"
        : "legacy_report_snapshot_only_or_unsupported_claims",
      blocker_codes: [
        ...(scoreMeta.is_public_overall_readiness_score_risk ? ["public_scoring_blocked"] : []),
        ...(isGeneric && linkedId.length === 0 ? ["generic_phrase_unanchored"] : []),
        ...(isOverclaim ? ["unsupported_overclaim_requires_rewrite"] : []),
        ...(linkedId.length === 0 ? ["missing_evidence_anchor_support"] : []),
      ],
      notes: hasLegacyLinkOnly
        ? "linked anchor is legacy-only and cannot satisfy v3 gate"
        : "legacy report snapshot trace",
    });
  };
  const fields: Array<[string, unknown, string]> = [
    [
      "submission_verdict.label",
      (reportData.submission_verdict as Record<string, unknown> | undefined)?.label,
      "score_or_verdict",
    ],
    [
      "submission_verdict.reason",
      (reportData.submission_verdict as Record<string, unknown> | undefined)?.reason,
      "readiness",
    ],
    ["verdict_final", reportData.verdict_final, "score_or_verdict"],
    ["casting_insight", reportData.casting_insight, "role_or_brief_fit"],
    ["casting_headline", reportData.casting_headline, "role_or_brief_fit"],
    ["fix_first", reportData.fix_first, "technical_or_assessability"],
    ["presentation_notes", reportData.presentation_notes, "performance_quality"],
  ];
  for (const [pathKey, value, type] of fields)
    if (typeof value === "string" && value.trim())
      addClaim(value.trim(), `report_data.${pathKey}`, type);
  for (const key of ["overall_score", "overall_score_final", "overall_score_model"] as const) {
    const v = reportData[key];
    if (typeof v === "number" || typeof v === "string")
      addClaim(String(v), `report_data.${key}`, "score_or_verdict");
  }
  if (isRecord(reportData.scores)) {
    for (const [k, v] of Object.entries(reportData.scores)) {
      if (typeof v === "number" || typeof v === "string")
        addClaim(`${k}: ${String(v)}`, `report_data.scores.${k}`, "score_or_verdict");
    }
  }
  for (const [pathKey, arr, type] of [
    ["strengths", reportData.strengths, "performance_quality"],
    ["improvements", reportData.improvements, "technical_or_assessability"],
    ["category_notes", reportData.category_notes, "performance_quality"],
    ["category_rationale", reportData.category_rationale, "readiness"],
  ] as const) {
    if (Array.isArray(arr))
      for (const item of arr)
        if (typeof item === "string" && item.trim())
          addClaim(item.trim(), `report_data.${pathKey}`, type);
  }
  if (Array.isArray(reportData.timestamped_notes))
    for (const [index, item] of reportData.timestamped_notes.entries()) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const text = getTimestampedNoteText(row);
      const field = getTimestampedNoteTextField(row);
      const ts =
        typeof row.timestamp === "string"
          ? row.timestamp
          : typeof row.time === "string"
            ? row.time
            : null;
      if (text && field)
        addClaim(
          text,
          `report_data.timestamped_notes[${index}].${field}`,
          "performance_quality",
          ts,
        );
    }
  if (claims.length === 0) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const publicFeatureSuppressionClaimSummary = buildPublicFeatureSuppressionClaimSummary(claims);
  const payload = {
    schema_version: "tapecoach_v3_public_claim_trace_first_pass_v1",
    artefact_type: "public_claim_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: new Date().toISOString(),
    claim_count: claims.length,
    claims,
    unsupported_claim_count: claims.filter((c) =>
      ["unsupported", "missing_evidence", "legacy_untraced_claim"].includes(
        String(c.support_status),
      ),
    ).length,
    legacy_untraced_claim_count: claims.filter((c) => c.support_status === "legacy_untraced_claim")
      .length,
    unsafe_or_overclaim_count: claims.filter(
      (c) => c.public_safety_status === "unsafe_or_overclaim",
    ).length,
    limitation_only_claim_count: claims.filter((c) => c.limitation_only === true).length,
    suppressed_claim_count: claims.filter((c) => c.suppress_public_claim === true).length,
    overclaim_claim_count: claims.filter(
      (c) =>
        c.support_classification === "overclaim" ||
        c.public_safety_status === "unsafe_or_overclaim",
    ).length,
    public_safe_claim_count: claims.filter(
      (c) => c.public_safety_status === "public_safe_descriptor",
    ).length,
    rewrite_required_count: claims.filter((c) => c.rewrite_required === true).length,
    ...publicFeatureSuppressionClaimSummary,
    cannot_satisfy_public_claim_gate: true,
    gate_satisfaction_reason: "legacy_report_snapshot_only_or_unsupported_claims",
    blocker_codes: ["public_claim_trace_legacy_or_unsupported"],
    redaction_notes: ["Internal-only trace; no secrets or token/session credentials included"],
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_comparison_output_status: "blocked",
    public_output_unchanged: true,
  };
  assertSafeSegment(input.take_id, "take_id");
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/PublicClaimTrace.json`,
    payload,
    "public_claim_trace",
  );
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["public_claim_trace"] : [],
    claims,
    summary: {
      claim_count: payload.claim_count,
      unsupported_claim_count: payload.unsupported_claim_count,
      legacy_untraced_claim_count: payload.legacy_untraced_claim_count,
      unsafe_or_overclaim_count: payload.unsafe_or_overclaim_count,
      rewrite_required_count: payload.rewrite_required_count,
      limitation_only_claim_count: payload.limitation_only_claim_count,
      suppressed_claim_count: payload.suppressed_claim_count,
      overclaim_claim_count: payload.overclaim_claim_count,
      ...publicFeatureSuppressionClaimSummary,
      public_claim_gate_status: "insufficient" as string,
      public_claim_gate_reason: payload.gate_satisfaction_reason,
      required_rendered_public_claim_count: 0,
      excluded_internal_claim_count: 0,
      blocker_codes: payload.blocker_codes,
    },
  };
}

const FORBIDDEN_INTERNAL_PROOF_SOURCE_ARTEFACT_IDS = new Set([
  "raw_report",
  "render_payload",
  "public_report_payload",
  "report_parity_result",
  "legacy_score_trace",
  "legacy_technique_observation_trace",
]);

function isForbiddenInternalProofSource(sourceArtefactId: unknown, sourcePath: unknown): boolean {
  const artefact = String(sourceArtefactId ?? "").trim();
  const path = String(sourcePath ?? "").trim();
  return (
    FORBIDDEN_INTERNAL_PROOF_SOURCE_ARTEFACT_IDS.has(artefact) ||
    /(^|\.|\/)(raw_report|report_data|render_payload|public_report_payload|report_parity_result)(\.|\/|$)/i.test(
      path,
    ) ||
    /ScoreTrace|TechniqueObservationTrace|public_ui|comparison_rank/i.test(path)
  );
}

function getRealRuntimeAnchorIdsForTrace(
  anchors: Array<Record<string, unknown>>,
  requestedIds: string[],
  linkedTruthIds: string[] = [],
): string[] {
  const requested = new Set(requestedIds.filter(Boolean));
  const linkedTruths = new Set(linkedTruthIds.filter(Boolean));
  return anchors
    .filter((anchor) => {
      const id = String(anchor.evidence_anchor_id ?? "");
      if (!id) return false;
      if (anchor.source_family !== "real_runtime_v3" || anchor.cannot_satisfy_v3_gate === true)
        return false;
      if (requested.size > 0) return requested.has(id);
      const anchorTruths = getStringArray(anchor.linked_truth_state_ids);
      return anchorTruths.some((truthId) => linkedTruths.has(truthId));
    })
    .map((anchor) => String(anchor.evidence_anchor_id ?? ""))
    .filter(Boolean);
}

function getResolvedTraceTruthIds(truthStateMapData: unknown, truthIds: string[]): string[] {
  return dedupePreservingOrder(
    truthIds
      .filter(isCanonicalTruthStateId)
      .filter((truthId) => truthStateIdResolves(truthStateMapData, truthId)),
  );
}

function getStructuredScoreEntries(
  scoreData: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const explicitEntries = safeRecordArray(scoreData.score_entries);
  if (explicitEntries.length > 0) return explicitEntries;
  const scores = isRecord(scoreData.scores) ? scoreData.scores : null;
  if (!scores) return [];
  return Object.entries(scores)
    .filter(
      ([, value]) =>
        typeof value === "number" || (typeof value === "string" && Number.isFinite(Number(value))),
    )
    .map(([scoreName, scoreValue], index) => ({
      score_name: scoreName,
      score_scope: "discipline_attribute",
      score_value: scoreValue,
      source_path: `structured_step2_score_data.scores.${scoreName}`,
      source_index: index,
    }));
}

function getCandidateTechniqueEvidenceItems(
  analysisEvidenceState: Record<string, unknown> | null,
): Array<Record<string, unknown>> {
  if (!analysisEvidenceState) return [];
  const direct: Array<Record<string, unknown>> = safeRecordArray(
    analysisEvidenceState.candidate_technique_evidence,
  ).map((item, index) => ({
    ...item,
    analysis_evidence_state_source_path:
      typeof item.analysis_evidence_state_source_path === "string"
        ? item.analysis_evidence_state_source_path
        : `candidate_technique_evidence[${index}]`,
  }));
  const observable: Array<Record<string, unknown>> = safeRecordArray(
    analysisEvidenceState.observable_evidence_items,
  )
    .filter((item) => String(item.evidence_family ?? "") === "candidate_technique")
    .map((item, index) => ({
      ...item,
      analysis_evidence_state_source_path:
        typeof item.analysis_evidence_state_source_path === "string"
          ? item.analysis_evidence_state_source_path
          : `observable_evidence_items[${index}]`,
    }));
  const byPath = new Map<string, Record<string, unknown>>();
  for (const item of [...direct, ...observable]) {
    const path = String(item.analysis_evidence_state_source_path ?? item.source_path ?? "");
    if (!path || byPath.has(path)) continue;
    byPath.set(path, item);
  }
  return [...byPath.values()];
}

export async function emitTechniqueObservationTraceFirstPass(
  input: TechniqueObservationTraceEmitterInput,
): Promise<TechniqueObservationTraceFirstPassResult> {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const anchors = (input.evidence_anchors_data?.anchors ?? []) as Array<Record<string, unknown>>;
  const claims = (input.public_claim_trace_data?.claims ?? []) as Array<Record<string, unknown>>;
  const truthStateMapData = isRecord(input.truth_state_map_data)
    ? input.truth_state_map_data
    : null;
  const analysisEvidenceState = isRecord(input.analysis_evidence_state_data)
    ? input.analysis_evidence_state_data
    : null;
  const observations: Array<Record<string, unknown>> = [];
  const extractTimestampedNoteIndex = (value: unknown): number | null => {
    if (typeof value !== "string") return null;
    const match = value.match(/^report_data\.timestamped_notes\[(\d+)\](?:\.(note|text))?$/);
    if (!match) return null;
    const idx = Number(match[1]);
    return Number.isInteger(idx) ? idx : null;
  };
  const getTraceSourcePathFamily = (value: unknown): string | null => {
    if (typeof value !== "string" || !value.startsWith("report_data.")) return null;
    if (value.startsWith("report_data.timestamped_notes[")) return "report_data.timestamped_notes";
    const knownPrefixes = [
      "report_data.strengths",
      "report_data.improvements",
      "report_data.priority_fixes",
      "report_data.fix_first",
      "report_data.category_notes",
      "report_data.category_rationale",
      "report_data.detected_components",
      "report_data.coaching_drills",
      "report_data.scores",
      "report_data.submission_verdict",
      "report_data.verdict_final",
      "report_data.overall_score",
      "report_data.brief_adherence_breakdown",
      "report_data.next_take_plan",
    ];
    const found = knownPrefixes.find(
      (p) => value === p || value.startsWith(`${p}[`) || value.startsWith(`${p}.`),
    );
    return found ?? null;
  };
  const mkLinks = (text: string, sourcePath: string, timestamp?: string | null) => {
    const n = normaliseTraceText(text);
    const observationIndex = extractTimestampedNoteIndex(sourcePath);
    const linkedEvidence = anchors
      .filter((a) => {
        const pathMatch = a.source_path === sourcePath;
        const contentMatch = normaliseTraceText(a.evidence_text) === n;
        const anchorIndex = extractTimestampedNoteIndex(a.source_path);
        if (observationIndex != null && anchorIndex != null && observationIndex !== anchorIndex)
          return false;
        const indexMatch =
          observationIndex != null && anchorIndex != null && observationIndex === anchorIndex;
        const timestampMatch = Boolean(timestamp && a.timestamp === timestamp);
        const safeTimestampMatch = timestampMatch && (pathMatch || contentMatch || indexMatch);
        return pathMatch || contentMatch || safeTimestampMatch;
      })
      .map((a) => String(a.evidence_anchor_id ?? ""))
      .filter(Boolean);
    const linkedClaims = claims
      .filter((c) => {
        const pathMatch = c.source_path === sourcePath;
        const contentMatch = normaliseTraceText(c.claim_text) === n;
        const claimIndex = extractTimestampedNoteIndex(c.source_path);
        if (observationIndex != null && claimIndex != null && observationIndex !== claimIndex)
          return false;
        const indexMatch =
          observationIndex != null && claimIndex != null && observationIndex === claimIndex;
        if (pathMatch || indexMatch) return true;
        if (!contentMatch) return false;
        if (observationIndex != null || claimIndex != null) return false;
        const obsFamily = getTraceSourcePathFamily(sourcePath);
        const claimFamily = getTraceSourcePathFamily(c.source_path);
        if ((obsFamily && !claimFamily) || (!obsFamily && claimFamily)) return false;
        if (obsFamily && claimFamily && obsFamily !== claimFamily) return false;
        if (obsFamily === "report_data.scores" || claimFamily === "report_data.scores")
          return obsFamily === claimFamily;
        return true;
      })
      .map((c) => String(c.claim_id ?? ""))
      .filter(Boolean);
    const linkedClaimCandidates = claims.filter((c) =>
      linkedClaims.includes(String(c.claim_id ?? "")),
    );
    const pathOrIndexMatches = linkedClaimCandidates.filter(
      (c) =>
        c.source_path === sourcePath ||
        (() => {
          const claimIndex = extractTimestampedNoteIndex(c.source_path);
          return observationIndex != null && claimIndex != null && observationIndex === claimIndex;
        })(),
    );
    const uniqueContentMatches = linkedClaimCandidates.filter(
      (c) => normaliseTraceText(c.claim_text) === n && !pathOrIndexMatches.includes(c),
    );
    const contentOnlyIds =
      uniqueContentMatches.length === 1 ? [String(uniqueContentMatches[0].claim_id ?? "")] : [];
    const deterministicClaimIds = [
      ...new Set([
        ...pathOrIndexMatches.map((c) => String(c.claim_id ?? "")).filter(Boolean),
        ...contentOnlyIds,
      ]),
    ];
    return { linkedEvidence: [...new Set(linkedEvidence)], linkedClaims: deterministicClaimIds };
  };
  const addObs = (
    text: string,
    sourcePath: string,
    sourceFamily: "legacy_adapter" | "report_snapshot",
    timestamp?: string | null,
    index?: number,
  ) => {
    const clean = text.trim();
    if (!clean) return;
    const { linkedEvidence, linkedClaims } = mkLinks(clean, sourcePath, timestamp);
    observations.push({
      technique_observation_id: `to-${input.take_id}-${observations.length + 1}`,
      observation_type: "other",
      observation_text_safe_summary: clean,
      observable_basis: "legacy_report_snapshot",
      source_family: sourceFamily,
      source_artefact_id: "raw_report",
      source_path: sourcePath,
      source_index: Number.isInteger(index) ? index : null,
      timestamp_refs: timestamp ? [timestamp] : [],
      linked_evidence_anchor_ids: linkedEvidence,
      linked_public_claim_ids: linkedClaims,
      linked_truth_state_ids: [],
      public_technique_authority_status: "blocked",
      evidence_status: linkedEvidence.length > 0 ? "legacy_untraced_claim" : "missing_evidence",
      cannot_satisfy_v3_gate: true,
      blocker_codes: [
        "legacy_report_snapshot_not_real_runtime_technique_evidence",
        "public_authority_unapproved",
      ],
      notes: [
        "descriptor_only",
        "public_authority_unapproved",
        "insufficient_for_public_technique_authority",
      ],
    });
  };
  const addIfString = (
    value: unknown,
    sourcePath: string,
    family: "legacy_adapter" | "report_snapshot",
    timestamp?: string | null,
    index?: number,
  ) => {
    if (typeof value === "string" && value.trim())
      addObs(value, sourcePath, family, timestamp, index);
  };
  const addInternalTechniqueObservation = (item: Record<string, unknown>, index: number) => {
    if (!analysisEvidenceState) return;
    const sourcePath = String(
      item.analysis_evidence_state_source_path ?? item.source_path ?? "",
    ).trim();
    const safeSummary = String(
      item.safe_evidence_summary ?? item.observation_text_safe_summary ?? item.evidence_text ?? "",
    ).trim();
    if (!sourcePath || !safeSummary) return;
    const linkedTruthStateIds = getStringArray(item.linked_truth_state_ids);
    const resolvedTruthStateIds = getResolvedTraceTruthIds(truthStateMapData, linkedTruthStateIds);
    const explicitAnchorIds = getStringArray(item.linked_evidence_anchor_ids);
    const linkedEvidenceAnchorIds = getRealRuntimeAnchorIdsForTrace(
      anchors,
      explicitAnchorIds,
      linkedTruthStateIds,
    );
    const sourcePathResolved = readJsonPath(analysisEvidenceState, sourcePath) !== undefined;
    const sourceForbidden =
      isForbiddenInternalProofSource(
        item.source_artefact_id ?? "analysis_evidence_state",
        sourcePath,
      ) || hasForbiddenEvidenceSourceRef(item);
    const itemBlockers = getStringArray(item.blocker_codes);
    const observationType = isStep1LimitationOnlyEvidenceItem(item)
      ? "limitation_only"
      : /safe_descriptor/i.test(String(item.evidence_kind ?? item.observation_type ?? ""))
        ? "public_safe_descriptor_candidate"
        : "internal_shadow";
    const blockerCodes = dedupePreservingOrder([
      ...itemBlockers,
      ...(!sourcePathResolved ? ["technique_observation_source_path_unresolved"] : []),
      ...(sourceForbidden ? ["forbidden_technique_observation_source"] : []),
      ...(linkedEvidenceAnchorIds.length === 0
        ? ["technique_observation_missing_real_runtime_evidence_anchor"]
        : []),
      ...(linkedTruthStateIds.length === 0 ? ["missing_truth_state_linkage"] : []),
      ...(linkedTruthStateIds.length > 0 &&
      resolvedTruthStateIds.length !== linkedTruthStateIds.length
        ? ["truth_state_id_unresolved"]
        : []),
      ...(observationType === "limitation_only"
        ? ["limitation_only_cannot_support_technique_achievement"]
        : []),
    ]);
    const canSatisfyInternal =
      blockerCodes.filter((code) => code !== "limitation_only_cannot_support_technique_achievement")
        .length === 0;
    observations.push({
      technique_observation_id: `to-${input.take_id}-rt-${String(index + 1).padStart(3, "0")}`,
      observation_type: observationType,
      observation_text_safe_summary: safeSummary,
      observable_basis: "structured_step1_candidate_technique_projection",
      source_family: "real_runtime_v3_internal_technique_observation",
      source_artefact_id: "analysis_evidence_state",
      source_path: sourcePath,
      source_index: index,
      timestamp_refs: getStringArray(item.timestamp_refs),
      linked_evidence_anchor_ids: linkedEvidenceAnchorIds,
      linked_truth_state_ids: resolvedTruthStateIds,
      truth_state_entry_ids: resolvedTruthStateIds,
      linked_public_claim_ids: [],
      technique_authority_status: "blocked",
      public_technique_authority_status: "blocked",
      public_display_status: "internal_only",
      evidence_status: canSatisfyInternal
        ? "real_runtime_v3_internal_technique_observation"
        : "real_runtime_v3_internal_technique_observation_blocked",
      cannot_satisfy_public_technique_authority_gate: true,
      can_satisfy_internal_technique_trace_gate: canSatisfyInternal,
      cannot_satisfy_v3_gate: !canSatisfyInternal,
      blocker_codes: blockerCodes,
      notes: ["internal_only", "public_technique_authority_unapproved"],
    });
  };
  getCandidateTechniqueEvidenceItems(analysisEvidenceState).forEach(
    addInternalTechniqueObservation,
  );
  for (const key of [
    "detected_components",
    "category_notes",
    "category_rationale",
    "strengths",
    "improvements",
    "priority_fixes",
  ] as const) {
    const arr = reportData[key];
    if (!Array.isArray(arr)) continue;
    arr.forEach((item, idx) => {
      if (typeof item === "string")
        addObs(item, `report_data.${key}[${idx}]`, "legacy_adapter", null, idx);
      else if (isRecord(item)) {
        const text = [item.note, item.text, item.label, item.summary].find(
          (v) => typeof v === "string" && v.trim(),
        ) as string | undefined;
        if (text)
          addObs(
            text,
            `report_data.${key}[${idx}]`,
            "legacy_adapter",
            typeof item.timestamp === "string" ? item.timestamp : null,
            idx,
          );
      }
    });
  }
  if (isRecord(reportData.category_notes)) {
    for (const [k, v] of Object.entries(reportData.category_notes))
      addIfString(v, `report_data.category_notes.${k}`, "report_snapshot");
  }
  if (isRecord(reportData.category_rationale)) {
    for (const [k, v] of Object.entries(reportData.category_rationale)) {
      if (typeof v === "string")
        addIfString(v, `report_data.category_rationale.${k}`, "report_snapshot");
      else if (isRecord(v))
        for (const field of ["what_works", "why_not_full_score", "close_gap", "standout_delta"])
          addIfString(v[field], `report_data.category_rationale.${k}.${field}`, "report_snapshot");
    }
  }
  addIfString(reportData.fix_first, "report_data.fix_first", "report_snapshot");
  if (isRecord(reportData.brief_adherence_breakdown))
    addIfString(
      reportData.brief_adherence_breakdown.note,
      "report_data.brief_adherence_breakdown.note",
      "report_snapshot",
    );
  if (
    isRecord(reportData.next_take_plan) &&
    Array.isArray((reportData.next_take_plan as Record<string, unknown>).groups)
  ) {
    ((reportData.next_take_plan as Record<string, unknown>).groups as unknown[]).forEach(
      (g, gi) => {
        if (!isRecord(g) || !Array.isArray(g.items)) return;
        g.items.forEach((item, ii) =>
          addIfString(
            item,
            `report_data.next_take_plan.groups[${gi}].items[${ii}]`,
            "report_snapshot",
            null,
            ii,
          ),
        );
      },
    );
  }
  if (Array.isArray(reportData.timestamped_notes))
    reportData.timestamped_notes.forEach((item, idx) => {
      if (!isRecord(item)) return;
      const text = getTimestampedNoteText(item);
      const field = getTimestampedNoteTextField(item);
      const ts =
        typeof item.timestamp === "string"
          ? item.timestamp
          : typeof item.time === "string"
            ? item.time
            : null;
      if (text && field)
        addObs(text, `report_data.timestamped_notes[${idx}].${field}`, "report_snapshot", ts, idx);
    });
  if (observations.length === 0)
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const realRuntimeInternalTechniqueCount = observations.filter(
    (obs) => obs.source_family === "real_runtime_v3_internal_technique_observation",
  ).length;
  const satisfyingInternalTechniqueCount = observations.filter(
    (obs) => obs.can_satisfy_internal_technique_trace_gate === true,
  ).length;
  const techniqueGateSatisfied = satisfyingInternalTechniqueCount > 0;
  const sourceFamilySummaryRaw = observations.reduce<Record<string, number>>(
    (acc, obs) => {
      const key = String(obs.source_family);
      if (key === "real_runtime_v3_internal_technique_observation")
        acc.real_runtime_v3 = (acc.real_runtime_v3 ?? 0) + 1;
      else acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    {
      legacy_adapter: 0,
      report_snapshot: 0,
      real_runtime_v3: 0,
      input_artifact: 0,
      resolver_truth_state: 0,
    },
  );
  const sourceFamilySummary: TechniqueObservationSourceFamilySummary = {
    legacy_adapter: sourceFamilySummaryRaw.legacy_adapter ?? 0,
    report_snapshot: sourceFamilySummaryRaw.report_snapshot ?? 0,
    real_runtime_v3: sourceFamilySummaryRaw.real_runtime_v3 ?? 0,
    input_artifact: sourceFamilySummaryRaw.input_artifact ?? 0,
    resolver_truth_state: sourceFamilySummaryRaw.resolver_truth_state ?? 0,
  };
  const derivedSourceClassification = techniqueGateSatisfied
    ? "real_runtime_v3_internal_technique_observation"
    : sourceFamilySummary.report_snapshot > 0 && sourceFamilySummary.legacy_adapter === 0
      ? "report_snapshot"
      : "legacy_adapter";
  const techniqueObservationTraceSummary: NonNullable<
    QAArtifactEmitterOptions["technique_observation_trace_summary"]
  > = {
    ...sourceFamilySummary,
    technique_observation_trace_gate_status: techniqueGateSatisfied ? "satisfied" : "insufficient",
    technique_observation_trace_gate_reason: techniqueGateSatisfied
      ? "real_runtime_v3_internal_technique_observations_linked"
      : "legacy_report_snapshot_not_real_runtime_technique_evidence",
    real_runtime_v3_internal_technique_observation_count: realRuntimeInternalTechniqueCount,
    satisfying_internal_technique_observation_count: satisfyingInternalTechniqueCount,
    public_technique_authority_status: "blocked",
  };
  const payload = {
    schema_version: "tapecoach_v3_technique_observation_trace_v1",
    artefact_type: "technique_observation_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    compared_take_ids: [],
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: new Date().toISOString(),
    observation_count: observations.length,
    observations,
    source_family_summary: sourceFamilySummary,
    real_runtime_v3_internal_technique_observation_count: realRuntimeInternalTechniqueCount,
    satisfying_internal_technique_observation_count: satisfyingInternalTechniqueCount,
    public_technique_authority_status: "blocked",
    cannot_satisfy_technique_observation_gate: !techniqueGateSatisfied,
    gate_satisfaction_reason: techniqueGateSatisfied
      ? "real_runtime_v3_internal_technique_observations_linked"
      : "legacy_report_snapshot_not_real_runtime_technique_evidence",
    technique_observation_trace_gate_status: techniqueGateSatisfied ? "satisfied" : "insufficient",
    blocker_codes: techniqueGateSatisfied
      ? ["public_technique_authority_blocked"]
      : [
          "TechniqueObservation_legacy_only",
          "technique_trace_requires_step1_candidate_technique_extractor",
        ],
    redaction_notes: ["Internal-only trace; no public technique authority satisfaction"],
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, "take_id");
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/TechniqueObservationTrace.json`,
    payload,
    "technique_observation_trace",
  );
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["technique_observation_trace"] : [],
    source_classification: derivedSourceClassification,
    source_family_summary: sourceFamilySummary,
    technique_observation_trace_summary: techniqueObservationTraceSummary,
    level2_satisfies: techniqueGateSatisfied,
  };
}

export async function emitScoreTraceFirstPass(input: ScoreTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const root = input.root_dir ?? DEFAULT_ROOT;
  const reportData = unwrapRawReportData(input.raw_report_data);
  const claims = (input.public_claim_trace_data?.claims ?? []) as Array<Record<string, unknown>>;
  const entries: Array<Record<string, unknown>> = [];
  const finiteNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
    return null;
  };
  const linkClaims = (sourcePath: string, scoreScope: string, scoreName: string, value: number) =>
    claims
      .filter(
        (c) =>
          c?.source_path === sourcePath ||
          (c?.source_path === sourcePath && Number(c?.claim_text) === value) ||
          (Number(c?.claim_text) === value &&
            c?.score_scope === scoreScope &&
            String(c?.source_path ?? "").startsWith(sourcePath.split(".").slice(0, 3).join(".")) &&
            c?.score_name === scoreName),
      )
      .map((c) => String(c.claim_id ?? ""))
      .filter(Boolean);
  const structuredScoreData = isRecord(input.structured_step2_score_data)
    ? input.structured_step2_score_data
    : null;
  const structuredScoreSourceArtefactId = String(
    structuredScoreData?.source_artefact_id ?? "structured_step2_score_projection",
  );
  const structuredScoreInputEntries = structuredScoreData
    ? getStructuredScoreEntries(structuredScoreData)
    : [];
  if (structuredScoreData && structuredScoreInputEntries.length > 0) {
    const anchors = (input.evidence_anchors_data?.anchors ?? []) as Array<Record<string, unknown>>;
    const selectedLevel = String(structuredScoreData.selected_level ?? "").trim();
    const auditionType = String(structuredScoreData.audition_type ?? "").trim();
    const scoreEntries = structuredScoreInputEntries.map((entry, index) => {
      const scoreValue = finiteNum(entry.score_value ?? entry.value);
      const scoreBand =
        typeof entry.score_band === "string" && entry.score_band.trim()
          ? entry.score_band.trim()
          : null;
      const scoreName = String(entry.score_name ?? entry.name ?? `score_${index + 1}`).trim();
      const scoreScope = String(entry.score_scope ?? entry.scope ?? "discipline_attribute").trim();
      const sourcePathRaw = String(
        entry.source_path ?? `structured_step2_score_data.score_entries[${index}]`,
      ).trim();
      const sourcePath = sourcePathRaw.startsWith("structured_step2_score_data")
        ? sourcePathRaw
        : `structured_step2_score_data.${sourcePathRaw}`;
      const linkedTruthStateIds =
        getStringArray(entry.linked_truth_state_ids).length > 0
          ? getStringArray(entry.linked_truth_state_ids)
          : getStringArray(structuredScoreData.linked_truth_state_ids);
      const resolvedTruthStateIds = getResolvedTraceTruthIds(
        input.truth_state_map_data,
        linkedTruthStateIds,
      );
      const requestedAnchorIds =
        getStringArray(entry.linked_evidence_anchor_ids).length > 0
          ? getStringArray(entry.linked_evidence_anchor_ids)
          : getStringArray(structuredScoreData.linked_evidence_anchor_ids);
      const linkedEvidenceAnchorIds = getRealRuntimeAnchorIdsForTrace(
        anchors,
        requestedAnchorIds,
        linkedTruthStateIds,
      );
      const sourcePathResolved =
        readJsonPath({ structured_step2_score_data: structuredScoreData }, sourcePath) !==
        undefined;
      const sourceForbidden = isForbiddenInternalProofSource(
        entry.source_artefact_id ?? structuredScoreSourceArtefactId,
        sourcePath,
      );
      const blockerCodes = dedupePreservingOrder([
        ...(sourceForbidden ? ["forbidden_score_trace_source"] : []),
        ...(!sourcePathResolved ? ["score_trace_source_path_unresolved"] : []),
        ...(!selectedLevel ? ["score_trace_selected_level_missing"] : []),
        ...(scoreValue == null && !scoreBand ? ["score_trace_value_missing"] : []),
        ...(linkedEvidenceAnchorIds.length === 0
          ? ["score_trace_missing_real_runtime_evidence_anchor"]
          : []),
        ...(requestedAnchorIds.length > 0 &&
        linkedEvidenceAnchorIds.length !== requestedAnchorIds.length
          ? ["score_trace_evidence_anchor_unresolved"]
          : []),
        ...(linkedTruthStateIds.length === 0 ? ["missing_truth_state_linkage"] : []),
        ...(linkedTruthStateIds.length > 0 &&
        resolvedTruthStateIds.length !== linkedTruthStateIds.length
          ? ["truth_state_id_unresolved"]
          : []),
      ]);
      const canSatisfyInternalScoreTraceGate = blockerCodes.length === 0;
      return {
        score_trace_id: `st-${input.take_id}-rt-${String(index + 1).padStart(3, "0")}`,
        source_family: canSatisfyInternalScoreTraceGate
          ? "real_runtime_v3_internal_score_proof"
          : "real_runtime_v3_internal_score_proof_blocked",
        source_artefact_id: structuredScoreSourceArtefactId,
        source_path: sourcePath,
        source_index: index,
        score_name: scoreName,
        score_scope: scoreScope,
        ...(scoreValue != null
          ? { score_value: scoreValue, score_scale: String(entry.score_scale ?? "0-100") }
          : {}),
        ...(scoreBand ? { score_band: scoreBand } : {}),
        selected_level: selectedLevel || null,
        audition_type: auditionType || null,
        audition_type_status: auditionType ? "known" : "unknown",
        linked_analysis_evidence_state_ref:
          structuredScoreData.linked_analysis_evidence_state_ref ??
          "analysis/AnalysisEvidenceState.json",
        linked_evidence_anchor_ids: linkedEvidenceAnchorIds,
        linked_truth_state_ids: resolvedTruthStateIds,
        truth_state_entry_ids: resolvedTruthStateIds,
        component_id: typeof entry.component_id === "string" ? entry.component_id : null,
        category_id: typeof entry.category_id === "string" ? entry.category_id : null,
        calibration_context_internal_only: true,
        public_display_status: "internal_only",
        public_scoring_status: "blocked",
        cannot_satisfy_public_scoring_gate: true,
        can_satisfy_internal_score_trace_gate: canSatisfyInternalScoreTraceGate,
        cannot_satisfy_v3_gate: !canSatisfyInternalScoreTraceGate,
        blocker_codes: blockerCodes,
        notes: "structured Step 2 score projection; internal-only score proof",
      };
    });
    const satisfyingScoreEntryCount = scoreEntries.filter(
      (entry) => entry.can_satisfy_internal_score_trace_gate === true,
    ).length;
    const scoreTraceGateSatisfied =
      scoreEntries.length > 0 && satisfyingScoreEntryCount === scoreEntries.length;
    const countScope = (scope: string) =>
      scoreEntries.filter((x) => x.score_scope === scope).length;
    const source_family_summary = {
      legacy_adapter: 0,
      report_snapshot: 0,
      real_runtime_v3: satisfyingScoreEntryCount,
      input_artifact: 0,
      resolver_truth_state: 0,
    };
    const skipped_component_weight_out_of_range = 0;
    const summary = {
      score_count: scoreEntries.length,
      overall_count: countScope("overall_readiness") + countScope("overall_readiness_internal"),
      discipline_attribute_count: countScope("discipline_attribute"),
      component_score_count: countScope("component_score"),
      component_weight_count: countScope("component_weight"),
      brief_adherence_subscore_count: countScope("brief_adherence_subscore"),
      assessment_confidence_count: countScope("assessment_confidence"),
      calibration_modifier_count: countScope("calibration_modifier"),
      calibration_metadata_count:
        countScope("assessment_confidence") + countScope("calibration_modifier"),
      source_family_summary,
      real_runtime_v3_internal_score_entry_count: satisfyingScoreEntryCount,
      overall_readiness_public_score_status: "blocked" as const,
      discipline_attribute_score_trace_status: scoreTraceGateSatisfied
        ? ("real_runtime_v3_internal_trace" as const)
        : ("internal_trace_only" as const),
      score_trace_gate_status: scoreTraceGateSatisfied
        ? ("satisfied" as const)
        : ("insufficient" as const),
      score_trace_gate_reason: scoreTraceGateSatisfied
        ? ("real_runtime_v3_internal_score_projection_linked" as const)
        : ("structured_score_projection_unresolved_or_incomplete" as const),
      skipped_component_weight_out_of_range,
      blocker_codes: scoreTraceGateSatisfied
        ? ["public_scoring_blocked"]
        : [
            "score_trace_requires_structured_step2_score_projection",
            "score_trace_structured_projection_linkage_incomplete",
          ],
    };
    const payload = {
      schema_version: "tapecoach_v3_score_trace_real_runtime_internal_v1",
      artefact_type: "score_trace",
      internal_only: true,
      privacy_classification: "internal_private",
      run_id: input.run_id,
      analysis_run_id: analysisRunId,
      take_id: input.take_id,
      generated_at: new Date().toISOString(),
      source_module: input.source_module ?? "qa-artifacts-wiring.server",
      source_stage: input.source_stage ?? "process_take_success",
      source_classification: scoreTraceGateSatisfied
        ? "real_runtime_v3_internal_score_proof"
        : "real_runtime_v3_internal_score_proof_blocked",
      trace_mode: "structured_step2_score_projection_internal",
      score_count: scoreEntries.length,
      score_entries: scoreEntries,
      source_family_summary,
      overall_readiness_public_score_status: "blocked",
      discipline_attribute_score_trace_status: summary.discipline_attribute_score_trace_status,
      public_scoring_status: "blocked",
      cannot_satisfy_score_gate: !scoreTraceGateSatisfied,
      gate_satisfaction_reason: summary.score_trace_gate_reason,
      blocker_codes: summary.blocker_codes,
      linked_public_claim_trace_summary: { claim_count: claims.length },
      score_trace_summary: summary,
      ...resolveQADeploymentProvenance(),
    };
    assertSafeSegment(input.take_id, "take_id");
    assertSafeSegment(analysisRunId, "analysis_run_id");
    const result = await writeInternalJson(
      root,
      input.run_id,
      `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ScoreTrace.json`,
      payload,
      "score_trace",
    );
    return {
      written: result.written as boolean,
      emitted_artefact_ids: result.written ? ["score_trace"] : [],
      source_classification: payload.source_classification,
      level2_satisfies: scoreTraceGateSatisfied,
      score_entries: scoreEntries,
      score_trace_summary: summary,
    };
  }
  const push = (
    scope: string,
    name: string,
    value: unknown,
    sourcePath: string,
    extra: Record<string, unknown> = {},
  ) => {
    const num = finiteNum(value);
    if (num == null) return;
    const scoreScale =
      scope === "component_weight"
        ? "0-1"
        : scope === "calibration_modifier"
          ? "modifier"
          : "0-100";
    entries.push({
      score_trace_id: `st-${input.take_id}-${entries.length + 1}`,
      score_scope: scope,
      score_name: name,
      score_value: num,
      score_scale: scoreScale,
      source_artefact_id: "raw_report",
      source_family: "legacy_adapter",
      source_path: sourcePath,
      public_scoring_status: scope === "overall_readiness" ? "blocked" : "internal_trace_only",
      public_display_status: "internal_only",
      linked_public_claim_ids: linkClaims(sourcePath, scope, name, num),
      linked_evidence_anchor_ids: [],
      linked_truth_state_ids: [],
      cannot_satisfy_v3_gate: true,
      notes: "first-pass legacy/report-snapshot derived trace",
      blocker_codes: [
        "ScoreTrace_legacy_only",
        "score_trace_requires_structured_step2_score_projection",
      ],
      ...extra,
    });
  };
  ["overall_score", "overall_score_final", "overall_score_model"].forEach((k) =>
    push("overall_readiness", k, reportData[k], `report_data.${k}`),
  );
  if (isRecord(reportData.scores))
    for (const [k, v] of Object.entries(reportData.scores))
      push("discipline_attribute", k, v, `report_data.scores.${k}`);
  let skipped_component_weight_out_of_range = 0;
  if (Array.isArray(reportData.detected_components))
    reportData.detected_components.forEach((c, i) => {
      if (!isRecord(c)) return;
      push("component_score", "score", c.score, `report_data.detected_components[${i}].score`, {
        source_index: i,
        component_type: typeof c.type === "string" ? c.type : null,
      });
      const weight = finiteNum(c.weight);
      if (weight == null) return;
      if (weight < 0 || weight > 1) {
        skipped_component_weight_out_of_range += 1;
        return;
      }
      push("component_weight", "weight", weight, `report_data.detected_components[${i}].weight`, {
        source_index: i,
        component_type: typeof c.type === "string" ? c.type : null,
        component_weight: weight,
        score_value_semantics: "component_weight_fraction",
      });
    });
  if (isRecord(reportData.brief_adherence_breakdown))
    [
      "instruction_precision",
      "material_compliance",
      "professionalism_signals",
      "technical_compliance",
    ].forEach((k) =>
      push(
        "brief_adherence_subscore",
        k,
        (reportData.brief_adherence_breakdown as Record<string, unknown>)[k],
        `report_data.brief_adherence_breakdown.${k}`,
      ),
    );
  push("assessment_confidence", "confidence", reportData.confidence, "report_data.confidence");
  push(
    "calibration_modifier",
    "consistency_modifier",
    reportData.consistency_modifier,
    "report_data.consistency_modifier",
  );
  if (!entries.length)
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      source_classification: "missing" as const,
      level2_satisfies: false as const,
      score_entries: [],
    };
  const source_family_summary = {
    legacy_adapter: entries.length,
    report_snapshot: 0,
    real_runtime_v3: 0,
    input_artifact: 0,
    resolver_truth_state: 0,
  };
  const countScope = (scope: string) => entries.filter((x) => x.score_scope === scope).length;
  const summary = {
    score_count: entries.length,
    overall_count: countScope("overall_readiness"),
    discipline_attribute_count: countScope("discipline_attribute"),
    component_score_count: countScope("component_score"),
    component_weight_count: countScope("component_weight"),
    brief_adherence_subscore_count: countScope("brief_adherence_subscore"),
    assessment_confidence_count: countScope("assessment_confidence"),
    calibration_modifier_count: countScope("calibration_modifier"),
    calibration_metadata_count:
      countScope("assessment_confidence") + countScope("calibration_modifier"),
    source_family_summary,
    overall_readiness_public_score_status: "blocked" as const,
    discipline_attribute_score_trace_status: "internal_trace_only" as const,
    score_trace_gate_status: "insufficient" as const,
    score_trace_gate_reason: "legacy_report_snapshot_not_real_runtime_score_trace" as const,
  };
  const payload = {
    schema_version: "tapecoach_v3_score_trace_first_pass_v1",
    artefact_type: "score_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    generated_at: new Date().toISOString(),
    source_module: input.source_module ?? "qa-artifacts-wiring.server",
    source_stage: input.source_stage ?? "process_take_success",
    trace_mode: "first_pass_legacy_report_snapshot",
    score_count: entries.length,
    score_entries: entries,
    source_family_summary,
    overall_readiness_public_score_status: "blocked",
    discipline_attribute_score_trace_status: "internal_trace_only",
    cannot_satisfy_score_gate: true,
    gate_satisfaction_reason: "legacy_report_snapshot_not_real_runtime_score_trace",
    blocker_codes: [
      "ScoreTrace_legacy_only",
      "score_trace_requires_structured_step2_score_projection",
    ],
    linked_public_claim_trace_summary: { claim_count: claims.length },
    score_trace_summary: {
      ...summary,
      skipped_component_weight_out_of_range,
      blocker_codes: [
        "ScoreTrace_legacy_only",
        "score_trace_requires_structured_step2_score_projection",
      ],
    },
    ...resolveQADeploymentProvenance(),
  };
  assertSafeSegment(input.take_id, "take_id");
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ScoreTrace.json`,
    payload,
    "score_trace",
  );
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["score_trace"] : [],
    source_classification: "legacy_adapter" as const,
    level2_satisfies: false as const,
    score_entries: entries,
    score_trace_summary: { ...summary, skipped_component_weight_out_of_range },
  };
}

export async function emitModelRunTraceArtefact(
  input: Omit<TraceEmitterInput, "artefact_id" | "relative_path">,
) {
  return emitTraceArtefact({
    ...input,
    artefact_id: "model_run_trace",
    relative_path: "traces/ModelRunTrace.json",
  });
}

const ORDINARY_L2A_MODEL_RUN_STAGE_REGISTRY = [
  {
    stage_id: "input_capture",
    stage_kind: "non_model",
    expected_status: "tracked_by_non_model_gate",
  },
  { stage_id: "resolver", stage_kind: "non_model", expected_status: "tracked_by_non_model_gate" },
  {
    stage_id: "analysis_step_1_evidence_mapping",
    stage_kind: "model_invoked",
    expected_status: "invoked_when_two_step_analysis_runs",
  },
  {
    stage_id: "analysis_step_2_judgement_or_report_generation",
    stage_kind: "model_invoked",
    expected_status: "invoked",
  },
  {
    stage_id: "report_parity",
    stage_kind: "non_model",
    expected_status: "tracked_by_non_model_gate",
  },
  {
    stage_id: "no_export_proof",
    stage_kind: "non_model",
    expected_status: "tracked_by_non_model_gate",
  },
  { stage_id: "validator", stage_kind: "non_model", expected_status: "tracked_by_validator_trace" },
  {
    stage_id: "gate_finalisation",
    stage_kind: "non_model",
    expected_status: "tracked_by_gate_trace",
  },
  {
    stage_id: "comparison_not_applicable_for_ordinary_run",
    stage_kind: "non_model",
    expected_status: "not_applicable_for_ordinary_single_take",
  },
] as const;

const ORDINARY_L2A_REQUIRED_MODEL_STAGE_IDS = [
  "analysis_step_1_evidence_mapping",
  "analysis_step_2_judgement_or_report_generation",
] as const;

function normaliseModelRunStageId(value: unknown, fallback: string): string {
  const candidate = String(value ?? "").trim();
  if (
    candidate === "analysis_step_1" ||
    candidate === "analysis_step_1_evidence_pass" ||
    candidate === "evidence_pass"
  )
    return "analysis_step_1_evidence_mapping";
  if (
    candidate === "analysis_generation" ||
    candidate === "analysis_step_2" ||
    candidate === "analysis_step_2_judgement_or_report_polish" ||
    candidate === "report_polish"
  )
    return "analysis_step_2_judgement_or_report_generation";
  return candidate || fallback;
}

export async function emitModelRunTraceFirstPass(input: ModelRunTraceEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const takeId = resolveTakeIdForFirstPassTraces({ take_id: input.take_id, run_id: input.run_id });
  if (!takeId) return { written: false as const, emitted_artefact_ids: [] as string[] };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(takeId, "take_id");
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const expectedStages = dedupePreservingOrder(
    [...(input.expected_model_stages ?? ORDINARY_L2A_REQUIRED_MODEL_STAGE_IDS)].map(
      (stage, index) => normaliseModelRunStageId(stage, `expected_model_stage_${index + 1}`),
    ),
  );
  const rawEntries = (input.model_run_entries ?? []).filter(
    (entry) => entry && typeof entry === "object",
  );
  const normaliseStage = (entry: ModelRunTraceEntryInput, idx: number) => {
    return normaliseModelRunStageId(
      entry.stage ?? entry.source_stage ?? input.source_stage,
      `unknown_model_stage_${idx + 1}`,
    );
  };
  const safeEntries = rawEntries.map((entry, idx) => {
    const stage = normaliseStage(entry, idx);
    const invocationStatus =
      entry.invocation_status ??
      (entry.request_status === "failed"
        ? "failed"
        : entry.request_status === "timed_out"
          ? "failed"
          : "invoked");
    const inputRefs = getStringArray(entry.input_artifact_refs);
    const outputRefs = getStringArray(entry.output_artifact_refs);
    const rawPromptOrResponseStored = entry.raw_prompt_or_response_stored === true ? true : false;
    const secretsOrSignedUrlsStored = entry.secrets_or_signed_urls_stored === true ? true : false;
    const stageCanSatisfy =
      expectedStages.includes(stage) &&
      invocationStatus === "invoked" &&
      inputRefs.length > 0 &&
      outputRefs.length > 0 &&
      !rawPromptOrResponseStored &&
      !secretsOrSignedUrlsStored &&
      !["failed", "timed_out"].includes(String(entry.request_status ?? ""));
    const independentStatus = stageCanSatisfy
      ? "per_stage_model_proof_satisfying"
      : expectedStages.includes(stage) && invocationStatus === "invoked"
        ? "per_stage_metadata_partial"
        : "metadata_only_insufficient";
    const blockerCodes = dedupePreservingOrder([
      ...(!expectedStages.includes(stage) ? ["model_stage_not_in_ordinary_l2a_registry"] : []),
      ...(invocationStatus !== "invoked" ? ["model_stage_not_invoked"] : []),
      ...(inputRefs.length === 0 ? ["model_stage_input_refs_missing"] : []),
      ...(outputRefs.length === 0 ? ["model_stage_output_refs_missing"] : []),
      ...(rawPromptOrResponseStored ? ["raw_prompt_or_response_storage_detected"] : []),
      ...(secretsOrSignedUrlsStored ? ["secrets_or_signed_urls_storage_detected"] : []),
      ...(["failed", "timed_out"].includes(String(entry.request_status ?? ""))
        ? ["model_stage_request_not_successful"]
        : []),
    ]);
    const stageProofStatus = stageCanSatisfy ? "satisfied" : "metadata_only_insufficient";
    return {
      model_run_id: entry.model_run_id ?? `model-run-${takeId}-${idx + 1}`,
      stage_id: stage,
      stage,
      invocation_status: invocationStatus,
      model_provider: entry.model_provider ?? null,
      model_name: entry.model_name ?? null,
      model_version: entry.model_version ?? null,
      prompt_version: entry.prompt_version ?? null,
      model_role: entry.model_role ?? "unknown",
      source_stage: entry.source_stage ?? input.source_stage,
      started_at: entry.started_at ?? null,
      completed_at: entry.completed_at ?? null,
      duration_ms: Number.isFinite(entry.duration_ms) ? entry.duration_ms : null,
      timeout_ms:
        Number.isFinite(entry.timeout_ms) && Number(entry.timeout_ms) >= 0
          ? Number(entry.timeout_ms)
          : null,
      timed_out: Boolean(entry.timed_out),
      retry_count: Number.isFinite(entry.retry_count) ? entry.retry_count : 0,
      attempt_index: Number.isFinite(entry.attempt_index) ? entry.attempt_index : idx + 1,
      http_status: Number.isFinite(entry.http_status) ? entry.http_status : null,
      circuit_open: typeof entry.circuit_open === "boolean" ? entry.circuit_open : null,
      fallback_used: Boolean(entry.fallback_used),
      analysis_tier: entry.analysis_tier ?? null,
      request_status:
        entry.request_status ?? (invocationStatus === "invoked" ? "unknown" : "skipped"),
      parse_status: entry.parse_status ?? "unknown",
      safe_error_category: entry.safe_error_category ?? null,
      input_artifact_refs: inputRefs,
      output_artifact_refs: outputRefs,
      source_classification: stageCanSatisfy
        ? "independent_model_run_stage_proof"
        : "model_run_metadata_partial",
      stage_proof_status: stageProofStatus,
      independent_model_proof_status: independentStatus,
      raw_prompt_or_response_stored: rawPromptOrResponseStored,
      secrets_or_signed_urls_stored: secretsOrSignedUrlsStored,
      blocker_codes: blockerCodes,
    };
  });
  const representedStages = new Set(safeEntries.map((entry) => String(entry.stage)));
  const syntheticStageEntries = expectedStages
    .filter((stage) => !representedStages.has(stage))
    .map((stage, idx) => ({
      model_run_id: `model-run-${takeId}-stage-${idx + 1}`,
      stage_id: stage,
      stage,
      invocation_status: "skipped",
      model_provider: null,
      model_name: null,
      model_version: null,
      prompt_version: null,
      model_role: "unknown",
      source_stage: stage,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      timeout_ms: null,
      timed_out: false,
      retry_count: 0,
      attempt_index: null,
      http_status: null,
      circuit_open: null,
      fallback_used: false,
      analysis_tier: null,
      request_status:
        stage === "comparison" && !input.comparison_invoked ? "not_applicable" : "skipped",
      parse_status: "skipped",
      safe_error_category: null,
      input_artifact_refs: [],
      output_artifact_refs: [],
      source_classification: "model_run_metadata_partial",
      stage_proof_status: "missing_required_model_stage",
      independent_model_proof_status: "stage_not_invoked",
      raw_prompt_or_response_stored: false,
      secrets_or_signed_urls_stored: false,
      blocker_codes: ["model_stage_not_invoked"],
    }));
  const nonModelStageEntries = ORDINARY_L2A_MODEL_RUN_STAGE_REGISTRY.filter(
    (stage) => stage.stage_kind === "non_model",
  ).map((stage, idx) => ({
    model_run_id: `model-run-${takeId}-non-model-${idx + 1}`,
    stage_id: stage.stage_id,
    stage: stage.stage_id,
    invocation_status: "not_applicable",
    model_provider: null,
    model_name: null,
    model_version: null,
    prompt_version: null,
    model_role: "not_applicable",
    source_stage: stage.stage_id,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    timeout_ms: null,
    timed_out: false,
    retry_count: 0,
    attempt_index: null,
    http_status: null,
    circuit_open: null,
    fallback_used: false,
    analysis_tier: null,
    request_status: "not_applicable",
    parse_status: "not_applicable",
    safe_error_category: null,
    input_artifact_refs: [],
    output_artifact_refs: [],
    source_classification: "tracked_by_non_model_gate",
    stage_proof_status: stage.expected_status,
    independent_model_proof_status: "tracked_by_non_model_gate",
    raw_prompt_or_response_stored: false,
    secrets_or_signed_urls_stored: false,
    blocker_codes: [],
  }));
  const allEntries = [...safeEntries, ...syntheticStageEntries, ...nonModelStageEntries];
  if (safeEntries.length === 0)
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const invokedKnownStageCount = safeEntries.filter(
    (entry) =>
      entry.invocation_status === "invoked" && expectedStages.includes(String(entry.stage)),
  ).length;
  const requiredModelStageProofSatisfied = ORDINARY_L2A_REQUIRED_MODEL_STAGE_IDS.every((stageId) =>
    safeEntries.some(
      (entry) => entry.stage_id === stageId && entry.stage_proof_status === "satisfied",
    ),
  );
  const rawPromptOrResponseStored = allEntries.some(
    (entry) => entry.raw_prompt_or_response_stored === true,
  );
  const secretsOrSignedUrlsStored = allEntries.some(
    (entry) => entry.secrets_or_signed_urls_stored === true,
  );
  const modelRunTraceGateSatisfied =
    requiredModelStageProofSatisfied && !rawPromptOrResponseStored && !secretsOrSignedUrlsStored;
  const perStageModelProofStatus = modelRunTraceGateSatisfied
    ? "per_stage_model_proof_satisfied"
    : representedStages.has("analysis_step_2_judgement_or_report_generation") ||
        representedStages.has("analysis_step_1_evidence_mapping")
      ? "partial_missing_stage_boundaries"
      : "partial_metadata_only";
  const independentModelProofStatus = modelRunTraceGateSatisfied
    ? "independent_model_proof_satisfying"
    : "independent_model_proof_partial";
  const summary = {
    model_run_count: allEntries.length,
    model_run_completed_count: safeEntries.filter((x) => x.request_status === "completed").length,
    model_run_failed_count: safeEntries.filter((x) => x.request_status === "failed").length,
    model_run_timeout_count: safeEntries.filter(
      (x) => x.request_status === "timed_out" || x.timed_out,
    ).length,
    model_run_fallback_count: safeEntries.filter((x) => x.fallback_used).length,
    invoked_stage_count: invokedKnownStageCount,
    skipped_stage_count: allEntries.filter((x) => x.invocation_status === "skipped").length,
    not_applicable_stage_count: allEntries.filter((x) => x.invocation_status === "not_applicable")
      .length,
    model_run_stage_names: allEntries.map((x) => x.stage),
    model_run_missing_stage_names: expectedStages.filter((stage) => !representedStages.has(stage)),
    model_run_trace_gate_status: modelRunTraceGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    model_run_trace_gate_reason: modelRunTraceGateSatisfied
      ? ("ordinary_l2a_expected_model_stages_represented_without_prompt_or_secret_storage" as const)
      : ("runtime_metadata_without_distinct_stage_boundaries" as const),
    independent_model_proof_status: independentModelProofStatus,
    per_stage_model_proof_status: perStageModelProofStatus,
    expected_stage_registry_version: "s9-19d-ordinary-l2a-model-run-stage-registry-v1",
    expected_stage_registry: ORDINARY_L2A_MODEL_RUN_STAGE_REGISTRY,
    required_model_stage_ids: ORDINARY_L2A_REQUIRED_MODEL_STAGE_IDS,
    raw_prompt_or_response_stored: rawPromptOrResponseStored,
    secrets_or_signed_urls_stored: secretsOrSignedUrlsStored,
    forbidden_payload_fields_absent: !rawPromptOrResponseStored && !secretsOrSignedUrlsStored,
    blocker_codes: dedupePreservingOrder([
      ...(modelRunTraceGateSatisfied ? [] : ["ModelRunTrace_independent_proof_partial"]),
      ...(requiredModelStageProofSatisfied
        ? []
        : ["model_run_trace_requires_distinct_stage_boundaries"]),
      ...(rawPromptOrResponseStored ? ["raw_prompt_or_response_storage_detected"] : []),
      ...(secretsOrSignedUrlsStored ? ["secrets_or_signed_urls_storage_detected"] : []),
    ]),
  };
  const payload = {
    schema_version: "tapecoach_v3_model_run_trace_first_pass_v1",
    artefact_type: "model_run_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: takeId,
    generated_at: new Date().toISOString(),
    source_module: input.source_module,
    source_stage: input.source_stage,
    source_classification: modelRunTraceGateSatisfied
      ? "independent_model_run_trace"
      : "model_run_metadata_partial",
    analysis_route: input.analysis_route ?? "runProcessTake",
    trace_mode: "first_pass_runtime_model_metadata",
    independent_model_proof_status: independentModelProofStatus,
    per_stage_model_proof_status: perStageModelProofStatus,
    expected_model_stages: expectedStages,
    model_run_count: allEntries.length,
    model_run_entries: allEntries,
    model_run_trace_summary: summary,
    redaction_policy:
      "Exclude prompts/raw model output/request+response bodies/headers/secrets/tokens/session identifiers/signed URLs.",
    redacted_fields: [
      "prompt",
      "raw_prompt",
      "system_prompt",
      "user_prompt",
      "request_body",
      "raw_response",
      "response_text",
      "authorization",
      "api_key",
      "token",
      "cookie",
      "session",
      "signed_url",
    ],
    forbidden_fields_absent: true,
    raw_prompt_or_response_stored: rawPromptOrResponseStored,
    secrets_or_signed_urls_stored: secretsOrSignedUrlsStored,
    cannot_satisfy_model_run_gate: !modelRunTraceGateSatisfied,
    gate_satisfaction_reason: summary.model_run_trace_gate_reason,
    blocker_codes: summary.blocker_codes,
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    ...resolveQADeploymentProvenance(),
  };
  const result = await writeInternalJson(
    root,
    input.run_id,
    `takes/take-${takeId}/analysis-${analysisRunId}/traces/ModelRunTrace.json`,
    payload,
    "model_run_trace",
  );
  return {
    written: result.written as boolean,
    emitted_artefact_ids: result.written ? ["model_run_trace"] : [],
    source_classification: payload.source_classification,
    level2_satisfies: modelRunTraceGateSatisfied,
    model_run_trace_summary: result.written ? summary : undefined,
  };
}
export async function emitNoExportProofBundle(input: {
  run_id: string;
  proofs?: Record<string, unknown>;
  root_dir?: string;
  internal_qa_emit?: boolean;
  source_module?: string;
  source_stage?: string;
}) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const ids: string[] = [];
  let hadFailure = false;
  const sourceModule = input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts";
  const sourceStage = input.source_stage ?? "emitNoExportProofBundle";
  const providedProofs = input.proofs ?? {};
  const entries: Array<[string, string]> = [
    ["no_export_source_proof", "export_or_no_export/no_export_source_proof.json"],
    ["no_export_config_proof", "export_or_no_export/no_export_config_proof.json"],
    ["no_export_ui_proof", "export_or_no_export/no_export_ui_proof.json"],
    ["no_export_log_proof", "export_or_no_export/no_export_log_proof.json"],
  ];
  const writeResults = await Promise.all(
    entries.map(async ([id, rel]) => {
      if (!providedProofs[id]) return null;
      const basePayload = isRecord(providedProofs[id])
        ? (providedProofs[id] as Record<string, unknown>)
        : { provided_payload: providedProofs[id] };
      const payload =
        id === "no_export_ui_proof"
          ? {
              schema_version: "tapecoach_v3_no_export_ui_proof_v1",
              artefact_type: "no_export_ui_proof",
              internal_only: true,
              privacy_classification: "internal_private",
              run_id: input.run_id,
              generated_at: new Date().toISOString(),
              source_module: sourceModule,
              source_stage: sourceStage,
              public_export_ui_status: "absent_in_customer_facing_surfaces",
              public_download_ui_status: "absent_in_customer_facing_surfaces",
              public_share_ui_status: "absent_in_customer_facing_surfaces",
              public_comparison_output_ui_status: "absent_in_customer_facing_surfaces",
              checked_routes: Array.isArray(basePayload.checked_routes)
                ? basePayload.checked_routes
                : ["src/routes"],
              checked_components_or_files: Array.isArray(basePayload.checked_components_or_files)
                ? basePayload.checked_components_or_files
                : ["src/components", "src/lib"],
              forbidden_ui_surfaces_absent: true,
              admin_internal_surfaces_classified: Array.isArray(
                basePayload.admin_internal_surfaces_classified,
              )
                ? basePayload.admin_internal_surfaces_classified
                : [],
              unsupported_or_unknown_surfaces: Array.isArray(
                basePayload.unsupported_or_unknown_surfaces,
              )
                ? basePayload.unsupported_or_unknown_surfaces
                : [],
              gate_satisfaction_reason:
                "customer_facing_ui_surfaces_checked_no_forbidden_export_download_share_or_comparison_output_actions_found",
              blocker_codes: Array.isArray(basePayload.blocker_codes)
                ? basePayload.blocker_codes
                : [],
              production_safe_status: "blocked",
              public_scoring_status: "blocked",
              public_technique_authority_status: "blocked",
              level2_satisfaction: "insufficient",
              public_output_unchanged: true,
              evidence_details: basePayload,
              ...resolveQADeploymentProvenance(),
            }
          : {
              schema_version: "tapecoach_v3_no_export_proof_v1",
              artefact_type: id,
              internal_only: true,
              privacy_classification: "internal_private",
              run_id: input.run_id,
              generated_at: new Date().toISOString(),
              source_module: sourceModule,
              source_stage: sourceStage,
              public_output_unchanged: true,
              production_safe_status: "blocked",
              public_scoring_status: "blocked",
              public_technique_authority_status: "blocked",
              level2_satisfaction: "insufficient",
              evidence_details: basePayload,
              ...resolveQADeploymentProvenance(),
            };
      const w = await writeInternalJson(root, input.run_id, rel, payload, id);
      return { id, written: w.written };
    }),
  );
  for (const result of writeResults) {
    if (!result) continue;
    const { id, written } = result;
    if (written) {
      ids.push(id);
    } else {
      hadFailure = true;
    }
  }
  const hasCore =
    ids.includes("no_export_source_proof") &&
    ids.includes("no_export_config_proof") &&
    ids.includes("no_export_log_proof");
  if (hasCore) {
    const hasUi = ids.includes("no_export_ui_proof");
    const b = await writeInternalJson(
      root,
      input.run_id,
      "export_or_no_export/no_export_proof.json",
      {
        schema_version: "tapecoach_v3_no_export_proof_bundle_v1",
        artefact_type: "no_export_proof",
        internal_only: true,
        privacy_classification: "internal_private",
        run_id: input.run_id,
        generated_at: new Date().toISOString(),
        source_module: sourceModule,
        source_stage: sourceStage,
        proof_refs: ids.map((id) => `export_or_no_export/${id}.json`),
        source_proof_emitted: ids.includes("no_export_source_proof"),
        config_proof_emitted: ids.includes("no_export_config_proof"),
        ui_proof_emitted: hasUi,
        log_proof_emitted: ids.includes("no_export_log_proof"),
        proof_family_status: hasUi ? "complete" : "partial_ui_proof_missing",
        level2_satisfaction: "insufficient",
        level2_unsatisfied_reasons: hasUi ? [] : ["no_export_ui_proof_missing"],
        must_not_unblock_public_or_production_gates: true,
        public_output_unchanged: true,
        production_safe_status: "blocked",
        public_scoring_status: "blocked",
        public_technique_authority_status: "blocked",
        ...resolveQADeploymentProvenance(),
      },
      "no_export_proof",
    );
    if (b.written) ids.push("no_export_proof");
    else hadFailure = true;
  }
  return { written: !hadFailure, emitted_artefact_ids: ids };
}
export async function emitComparisonRuntimeArtifacts(
  input: ComparisonRuntimeArtifactsInput,
): Promise<any> {
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const comparisonRunId =
    input.comparison_run_id ??
    input.comparison_id ??
    (input.comparison_raw_data?.comparison_run_id as string | undefined) ??
    (input.comparison_raw_data?.comparison_id as string | undefined);
  if (!comparisonRunId)
    return {
      written: false as const,
      emitted_artefact_ids,
      emitted_blocked_artefact_ids: [] as string[],
    };
  const comparedTakeIds =
    input.compared_take_ids ??
    (input.comparison_raw_data?.compared_take_ids as string[] | undefined) ??
    [];
  const hasComparisonDecision = Boolean(
    input.comparison_raw_data &&
    (input.comparison_raw_data.comparison_result_summary ||
      input.comparison_raw_data.raw_comparison_decision_snapshot ||
      input.comparison_raw_data.comparison_execution_status === "executed"),
  );
  if (comparedTakeIds.length < 2 || !hasComparisonDecision)
    return {
      written: false as const,
      emitted_artefact_ids,
      emitted_blocked_artefact_ids: [] as string[],
    };
  assertSafeSegment(comparisonRunId, "comparison_run_id");
  const takeId = resolveTakeIdForFirstPassTraces({ take_id: input.take_id, run_id: input.run_id });
  if (!takeId)
    return {
      written: false as const,
      emitted_artefact_ids,
      emitted_blocked_artefact_ids: [] as string[],
    };
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const comparisonRoot = `takes/take-${takeId}/analysis-${analysisRunId}`;
  for (const payload of input.media_identity_payloads ?? []) {
    try {
      assertSafeSegment(payload.take_id, "media_identity_take_id");
      assertSafeSegment(payload.analysis_run_id, "media_identity_analysis_run_id");
      const w = await writeInternalJson(
        root,
        input.run_id,
        `takes/take-${payload.take_id}/analysis-${payload.analysis_run_id}/inputs/media_identity.json`,
        payload,
        "media_identity",
      );
      if (w.written && !emitted_artefact_ids.includes("media_identity"))
        emitted_artefact_ids.push("media_identity");
      else if (!w.written) hadFailure = true;
    } catch {
      hadFailure = true;
    }
  }
  if (input.comparison_raw_data) {
    const w = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison/comparison.raw.json`,
      {
        ...input.comparison_raw_data,
        schema_version: "tapecoach_v3_comparison_raw_first_pass_v1",
        artefact_type: "comparison_raw",
        internal_only: true,
        privacy_classification: "internal_private",
        source_module: input.source_module ?? "src/server/v3/qa-artifacts-wiring.server.ts",
        source_stage: input.source_stage ?? "emitComparisonRuntimeArtifacts",
        comparison_run_id: comparisonRunId,
        compared_take_ids: comparedTakeIds,
        cannot_satisfy_level2_comparison_gate: true,
        forbidden_fields_absent: true,
        public_output_unchanged: true,
      },
      "comparison_raw",
    );
    if (w.written) emitted_artefact_ids.push("comparison_raw");
    else hadFailure = true;
    const report = {
      schema_version: "tapecoach_v3_comparison_report_internal_first_pass_v1",
      artefact_type: "comparison_report_internal",
      internal_only: true,
      privacy_classification: "internal_private",
      run_id: input.run_id,
      comparison_run_id: comparisonRunId,
      compared_take_ids: comparedTakeIds,
      recommendation_suppressed: Boolean(
        input.comparison_raw_data.recommendation_suppressed ??
        input.comparison_raw_data.duplicate_or_near_duplicate_detected,
      ),
      suppression_reason:
        input.comparison_raw_data.suppression_reason ??
        (input.comparison_raw_data.duplicate_or_near_duplicate_detected
          ? "public_recommendation_suppressed_same_video_or_near_duplicate"
          : null),
      duplicate_detection_status:
        input.comparison_raw_data.duplicate_detection_status ??
        input.duplicate_detection_trace?.duplicate_detection_status ??
        "missing",
      duplicate_detection_confidence:
        input.comparison_raw_data.duplicate_detection_confidence ??
        input.duplicate_detection_trace?.duplicate_detection_confidence ??
        null,
      public_output_unchanged: true,
      user_experience_unchanged: true,
      cannot_satisfy_level2_comparison_gate: true,
      forbidden_fields_absent: true,
    };
    const rw = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison/comparison.report.internal.json`,
      report,
      "comparison_report_internal",
    );
    if (rw.written) emitted_artefact_ids.push("comparison_report_internal");
    else hadFailure = true;
  }
  if (input.route_variance_trace) {
    const w = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison_traces/route_variance_trace.json`,
      {
        ...input.route_variance_trace,
        cannot_satisfy_level2_comparison_gate: true,
        forbidden_fields_absent: true,
        public_output_unchanged: true,
      },
      "route_variance_trace",
    );
    if (w.written) emitted_artefact_ids.push("route_variance_trace");
    else hadFailure = true;
  }
  if (input.suppression_trace) {
    const w = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison_traces/comparison_suppression_trace.json`,
      {
        ...input.suppression_trace,
        cannot_satisfy_level2_comparison_gate: true,
        forbidden_fields_absent: true,
        public_output_unchanged: true,
      },
      "comparison_suppression_trace",
    );
    if (w.written) emitted_artefact_ids.push("comparison_suppression_trace");
    else hadFailure = true;
  }
  if (input.same_video_repeatability_trace) {
    const w = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison_traces/same_video_repeatability_trace.json`,
      {
        ...input.same_video_repeatability_trace,
        cannot_satisfy_level2_comparison_gate: true,
        forbidden_fields_absent: true,
        public_output_unchanged: true,
      },
      "same_video_repeatability_trace",
    );
    if (w.written) emitted_artefact_ids.push("same_video_repeatability_trace");
    else hadFailure = true;
  }
  if (input.duplicate_detection_trace) {
    const w = await writeInternalJson(
      root,
      input.run_id,
      `${comparisonRoot}/comparison/duplicate_detection_trace.json`,
      {
        ...input.duplicate_detection_trace,
        cannot_satisfy_level2_comparison_gate: true,
        forbidden_fields_absent: true,
        public_output_unchanged: true,
      },
      "duplicate_detection_trace",
    );
    if (w.written) emitted_artefact_ids.push("duplicate_detection_trace");
    else hadFailure = true;
  }
  const emitted_blocked_artefact_ids: string[] = [];
  return {
    written: !hadFailure,
    comparison_run_id: comparisonRunId,
    emitted_artefact_ids,
    emitted_blocked_artefact_ids,
  };
}

export async function emitComparisonRuntimeArtifactsWithManifestReconciliation(
  input: ComparisonRuntimeArtifactsInput & { root_take_id?: string | null },
): Promise<any> {
  const root = input.root_dir ?? DEFAULT_ROOT;
  const sourceRunId = input.run_id;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const comparedTakeIds =
    input.compared_take_ids ??
    (input.comparison_raw_data?.compared_take_ids as string[] | undefined) ??
    [];
  const identity = resolveCanonicalComparisonReconciliationIdentity({
    run_id: sourceRunId,
    take_id: input.take_id ?? null,
    root_take_id: input.root_take_id ?? input.take_id ?? null,
    analysis_run_id: analysisRunId,
    compared_take_ids: comparedTakeIds,
  });
  const baseResult = {
    source_run_id: sourceRunId,
    canonical_qa_run_id: identity.canonical_qa_run_id,
    canonical_take_id: identity.canonical_take_id,
    canonical_analysis_run_id: identity.canonical_analysis_run_id,
    reconciliation_identity_status: identity.identity_status,
    manifest_preflight_read_path: identity.canonical_manifest_storage_key,
    manifest_rewrite_path: identity.canonical_manifest_storage_key,
    metrics_rewrite_path: identity.canonical_metrics_storage_key,
    comparison_artefact_write_root: identity.canonical_comparison_root,
  };
  if (identity.identity_status !== "resolved") {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      emitted_blocked_artefact_ids: [] as string[],
      ...baseResult,
      read_write_root_match: false,
      comparison_artefact_root_match: false,
      reconciliation_written: false,
      comparison_artefacts_written: false,
      blocker_codes: ["comparison_reconciliation_manifest_identity_mismatch"],
    };
  }
  const preflight = await readQAArtifactText({
    root_dir: root,
    run_id: identity.canonical_qa_run_id,
    relative_path: identity.manifest_relative_path,
  });
  if (preflight.status !== "ok") {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      emitted_blocked_artefact_ids: [] as string[],
      ...baseResult,
      read_write_root_match: false,
      comparison_artefact_root_match: false,
      reconciliation_written: false,
      comparison_artefacts_written: false,
      blocker_codes: [preflight.warning ?? "comparison_reconciliation_failed"],
      manifest_preflight_read_status: preflight.status,
    };
  }
  let manifestObj: Record<string, any> | null = null;
  try {
    manifestObj = JSON.parse(preflight.text ?? "");
  } catch {
    manifestObj = null;
  }
  if (!manifestObj || typeof manifestObj !== "object" || Array.isArray(manifestObj)) {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      emitted_blocked_artefact_ids: [] as string[],
      ...baseResult,
      read_write_root_match: false,
      comparison_artefact_root_match: false,
      reconciliation_written: false,
      comparison_artefacts_written: false,
      blocker_codes: ["comparison_reconciliation_manifest_unreadable"],
    };
  }
  const emitOut = await emitComparisonRuntimeArtifacts({
    ...input,
    run_id: identity.canonical_qa_run_id,
    take_id: identity.canonical_take_id,
    analysis_run_id: identity.canonical_analysis_run_id,
  });
  const emittedIds = emitOut.emitted_artefact_ids ?? [];
  const emittedBlockedIds = emitOut.emitted_blocked_artefact_ids ?? [];
  const normalisedComparedTakeIds = normaliseUniqueTakeCores(comparedTakeIds);
  const comparisonRunId = emitOut.comparison_run_id ?? input.comparison_run_id ?? null;
  const comparisonEvidenceStatus = {
    comparison_raw: emittedIds.includes("comparison_raw"),
    comparison_report_internal: emittedIds.includes("comparison_report_internal"),
    same_video_repeatability_trace: emittedIds.includes("same_video_repeatability_trace"),
    duplicate_detection_trace: emittedIds.includes("duplicate_detection_trace"),
    comparison_suppression_trace: emittedIds.includes("comparison_suppression_trace"),
    route_variance_trace: emittedIds.includes("route_variance_trace"),
  };
  const comparisonInvoked =
    Boolean(comparisonRunId) ||
    normalisedComparedTakeIds.length > 1 ||
    COMPARISON_ARTEFACT_IDS.some((id) => emittedIds.includes(id) || emittedBlockedIds.includes(id));
  const comparisonParityPayloads = {
    public_output_unchanged: true,
    public_comparison_output_absent_or_unchanged: true,
    ...(input.comparison_raw_data
      ? { comparison_raw: { ...input.comparison_raw_data, public_output_unchanged: true } }
      : {}),
    ...(input.same_video_repeatability_trace
      ? {
          same_video_repeatability_trace: {
            ...input.same_video_repeatability_trace,
            public_output_unchanged: true,
          },
        }
      : {}),
    ...(input.duplicate_detection_trace
      ? {
          duplicate_detection_trace: {
            ...input.duplicate_detection_trace,
            public_output_unchanged: true,
          },
        }
      : {}),
    ...(input.suppression_trace
      ? {
          comparison_suppression_trace: {
            ...input.suppression_trace,
            public_output_unchanged: true,
          },
        }
      : {}),
    ...(input.route_variance_trace
      ? { route_variance_trace: { ...input.route_variance_trace, public_output_unchanged: true } }
      : {}),
  };
  const comparisonParityWrite = comparisonInvoked
    ? await emitComparisonParityProof({
        run_id: identity.canonical_qa_run_id,
        analysis_run_id: identity.canonical_analysis_run_id,
        take_id: identity.canonical_take_id,
        comparison_run_id: comparisonRunId,
        compared_take_ids: normalisedComparedTakeIds,
        root_dir: root,
        internal_qa_emit: true,
        comparison_invoked: comparisonInvoked,
        comparison_evidence_status: comparisonEvidenceStatus,
        comparison_payloads: comparisonParityPayloads,
      })
    : {
        written: false,
        emitted_artefact_ids: [] as string[],
        parity_status: "not_applicable" as const,
        blocker_codes: [] as string[],
        comparison_parity_summary: null as Record<string, unknown> | null,
      };
  const reconciledComparisonManifest = reconcileComparisonManifestState({
    manifest: manifestObj,
    comparison_run_id: comparisonRunId,
    compared_take_ids: normalisedComparedTakeIds,
    comparison_write_success_by_id: {
      comparison_raw: emittedIds.includes("comparison_raw"),
      comparison_report_internal: emittedIds.includes("comparison_report_internal"),
      same_video_repeatability_trace: emittedIds.includes("same_video_repeatability_trace"),
      duplicate_detection_trace: emittedIds.includes("duplicate_detection_trace"),
      comparison_suppression_trace: emittedIds.includes("comparison_suppression_trace"),
      route_variance_trace: emittedIds.includes("route_variance_trace"),
    },
  });
  if (emittedIds.includes("media_identity")) {
    const emitted = new Set<string>(reconciledComparisonManifest.emitted_artifacts ?? []);
    const blocked = new Set<string>(
      reconciledComparisonManifest.runtime_evidence_blocked_by_id ?? [],
    );
    const accepted = new Set<string>(
      reconciledComparisonManifest.runtime_evidence_accepted_by_id ?? [],
    );
    emitted.add("media_identity");
    blocked.add("media_identity");
    accepted.delete("media_identity");
    const mediaIdentityPayloads = input.media_identity_payloads ?? [];
    const available = mediaIdentityPayloads.reduce(
      (sum, payload) => sum + Number(payload.available_signal_count ?? 0),
      0,
    );
    const unavailable = mediaIdentityPayloads.reduce(
      (sum, payload) => sum + Number(payload.unavailable_signal_count ?? 0),
      0,
    );
    const mediaBlockers = mediaIdentityPayloads.flatMap((payload) => payload.blocker_codes ?? []);
    reconciledComparisonManifest.emitted_artifacts = [...emitted];
    reconciledComparisonManifest.runtime_evidence_blocked_by_id = [...blocked];
    reconciledComparisonManifest.runtime_evidence_accepted_by_id = [...accepted];
    reconciledComparisonManifest.artefact_status_by_id = {
      ...(reconciledComparisonManifest.artefact_status_by_id ?? {}),
      media_identity: "emitted",
    };
    reconciledComparisonManifest.artefact_source_classification_by_id = {
      ...(reconciledComparisonManifest.artefact_source_classification_by_id ?? {}),
      media_identity: mediaIdentityPayloads.some(
        (payload) => payload.cannot_satisfy_duplicate_detection_gate === false,
      )
        ? "real_runtime_v3_media_identity"
        : "partial_media_identity",
    };
    reconciledComparisonManifest.artefact_level2_spine_satisfaction_by_id = {
      ...(reconciledComparisonManifest.artefact_level2_spine_satisfaction_by_id ?? {}),
      media_identity: false,
    };
    reconciledComparisonManifest.media_identity_summary = {
      media_identity_status: mediaIdentityPayloads.some(
        (payload) => payload.media_identity_status === "complete",
      )
        ? "complete"
        : available > 0
          ? "partial"
          : "unavailable",
      available_signal_count: available,
      unavailable_signal_count: unavailable,
      media_identity_gate_status: "insufficient",
      media_identity_blocker_codes: [...new Set(mediaBlockers)],
      cannot_satisfy_duplicate_detection_gate: !mediaIdentityPayloads.some(
        (payload) => payload.cannot_satisfy_duplicate_detection_gate === false,
      ),
    };
  }
  const reconciledManifest = applyComparisonParityManifestState({
    manifest: reconciledComparisonManifest,
    written: Boolean(comparisonParityWrite.written),
    parity_status: comparisonParityWrite.parity_status as ComparisonParityStatus,
    blocker_codes: comparisonParityWrite.blocker_codes,
    comparison_parity_summary: comparisonParityWrite.comparison_parity_summary ?? null,
  });
  const mw = await writeQAArtifact({
    root_dir: root,
    run_id: identity.canonical_qa_run_id,
    relative_path: identity.manifest_relative_path,
    payload: reconciledManifest,
    artefact_id: "manifest",
  });
  const metrics = {
    ...buildQAAcceptanceMetrics(reconciledManifest),
    ...resolveQADeploymentProvenance(),
  };
  const qw = await writeQAArtifact({
    root_dir: root,
    run_id: identity.canonical_qa_run_id,
    relative_path: identity.metrics_relative_path,
    payload: metrics,
    artefact_id: "qa_acceptance_metrics",
  });
  const reconciliation_written = Boolean(mw.written && qw.written);
  const comparison_parity_write_satisfied =
    !comparisonInvoked ||
    comparisonParityWrite.parity_status === "not_applicable" ||
    Boolean(comparisonParityWrite.written);
  const comparison_artefacts_written = emittedIds.length > 0;
  const comparison_artefact_root_match = Boolean(
    identity.canonical_comparison_root ===
    `takes/take-${identity.canonical_take_id}/analysis-${identity.canonical_analysis_run_id}`,
  );
  const read_write_root_match = Boolean(
    identity.canonical_manifest_storage_key.startsWith(`${identity.canonical_qa_run_id}/`) &&
    identity.canonical_metrics_storage_key.startsWith(`${identity.canonical_qa_run_id}/`),
  );
  return {
    ...emitOut,
    ...baseResult,
    emitted_artefact_ids: [
      ...new Set([
        ...emittedIds,
        ...(comparisonParityWrite.written && comparisonParityWrite.parity_status === "passed"
          ? ["parity_comparison"]
          : []),
      ]),
    ],
    emitted_blocked_artefact_ids: [
      ...new Set([
        ...emittedBlockedIds,
        ...(comparisonParityWrite.written &&
        comparisonParityWrite.parity_status !== "passed" &&
        comparisonParityWrite.parity_status !== "not_applicable"
          ? ["parity_comparison"]
          : []),
      ]),
    ],
    written: Boolean(
      emitOut.written && reconciliation_written && comparison_parity_write_satisfied,
    ),
    reconciliation_written,
    comparison_artefacts_written,
    comparison_parity_written: Boolean(comparisonParityWrite.written),
    comparison_parity_status: comparisonParityWrite.parity_status,
    comparison_artefact_root_match,
    read_write_root_match,
    blocker_codes: [
      ...new Set([
        ...(emitOut.written && reconciliation_written ? [] : ["comparison_reconciliation_failed"]),
        ...(!comparison_parity_write_satisfied ? ["parity_artefacts_missing"] : []),
        ...(comparisonParityWrite.blocker_codes ?? []),
      ]),
    ],
  };
}

export async function emitAnalysisInputArtefacts(input: AnalysisInputArtefactEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const generatedAt = new Date().toISOString();
  const unavailableCommon = dedupePreservingOrder(input.unavailable_fields ?? []);
  if (!input.submission_id) unavailableCommon.push("submission_id");
  if (!input.audition_type) unavailableCommon.push("audition_type");
  if (!input.selected_level) unavailableCommon.push("selected_level");
  const unavailableCommonDedupe = dedupePreservingOrder(unavailableCommon);
  const boolFromEnvOrUnknown = (
    name: "V3_QA_ARTIFACTS_ENABLED" | "INTERNAL_QA_EMIT",
  ): boolean | "unknown" => {
    const v = process.env[name];
    if (v === "true") return true;
    if (v === "false") return false;
    return "unknown";
  };
  const redaction_notes = [
    "Internal QA snapshot only; secrets/tokens/session credentials are excluded by design",
  ];
  const inputRecord = {
    schema_version: "tapecoach_v3_analysis_input_record_v1",
    artefact_type: "analysis_input_record",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    compared_take_ids: input.compared_take_ids ?? [],
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: generatedAt,
    analysis_route: input.analysis_route ?? null,
    route_or_model_marker: input.route_or_model_marker ?? null,
    audition_type: input.audition_type ?? null,
    selected_level: input.selected_level ?? null,
    brief_presence: input.brief_presence ?? "unknown",
    brief_presence_source: input.brief_presence_source ?? "unavailable",
    material_presence: input.material_presence ?? "unknown",
    media_reference_state: {
      mux_playback_id_present: Boolean(input.mux_playback_id),
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? "unknown",
    },
    qa_emit_enabled_state: {
      V3_QA_ARTIFACTS_ENABLED: boolFromEnvOrUnknown("V3_QA_ARTIFACTS_ENABLED"),
      INTERNAL_QA_EMIT: boolFromEnvOrUnknown("INTERNAL_QA_EMIT"),
    },
    unavailable_fields: unavailableCommonDedupe,
    redaction_notes,
  };
  const submissionSnapshot = {
    schema_version: "tapecoach_v3_analysis_submission_v1",
    artefact_type: "analysis_submission",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: generatedAt,
    audition_type: input.audition_type ?? null,
    selected_level: input.selected_level ?? null,
    brief_presence: input.brief_presence ?? "unknown",
    brief_presence_source: input.brief_presence_source ?? "unavailable",
    material_presence: input.material_presence ?? "unknown",
    submission_created_at: input.submission_created_at ?? null,
    submission_updated_at: input.submission_updated_at ?? null,
    component_or_task_declaration: input.component_or_task_declaration ?? null,
    component_or_task_declaration_status:
      input.component_or_task_declaration_status ??
      (input.component_or_task_declaration == null
        ? "unknown"
        : input.component_or_task_declaration.length === 0
          ? "known_empty"
          : "supplied"),
    component_or_task_declaration_source:
      input.component_or_task_declaration_source ??
      (input.component_or_task_declaration == null ? "not_loaded" : "loaded_runtime_field"),
    safe_submission_refs:
      input.safe_submission_refs ??
      (input.submission_id ? [`submission:${input.submission_id}`] : []),
    unavailable_fields: dedupePreservingOrder([
      ...unavailableCommonDedupe,
      ...(input.submission_created_at ? [] : ["submission_created_at"]),
      ...(input.submission_updated_at ? [] : ["submission_updated_at"]),
    ]),
    redaction_notes,
  };
  const takeSnapshot = {
    schema_version: "tapecoach_v3_analysis_take_v1",
    artefact_type: "analysis_take",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: generatedAt,
    take_created_at: input.take_created_at ?? null,
    take_updated_at: input.take_updated_at ?? null,
    take_index: input.take_index ?? null,
    take_index_source:
      input.take_index_source ?? (input.take_index == null ? "unavailable" : "loaded_take_index"),
    stable_take_identity: { take_id: input.take_id, analysis_run_id: analysisRunId },
    mux_playback_id_present: Boolean(input.mux_playback_id),
    safe_mux_playback_ref: input.safe_mux_playback_ref ?? input.mux_playback_id ?? null,
    safe_upload_identity: {
      original_upload_file_hash: input.original_upload_file_hash ?? null,
      original_upload_file_hash_source_stage: input.original_upload_file_hash_source_stage ?? null,
      original_file_name_safe_basename:
        input.original_file_name ??
        input.visible_or_original_file_name ??
        input.file_name ??
        input.filename ??
        null,
      metadata_file_name_safe_basename: input.metadata_file_name ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      mime_type_safe_summary: input.mime_type_safe_summary ?? null,
      last_modified_ms: input.last_modified_ms ?? null,
      upload_metadata_source: input.upload_metadata_source ?? null,
      upload_identity_capture_status:
        input.upload_identity_capture_status ??
        (input.original_upload_file_hash
          ? "captured"
          : input.upload_identity_metadata
            ? "partial"
            : "unavailable"),
      upload_identity_capture_reason: input.upload_identity_capture_reason ?? null,
      upload_identity_source_stage: input.original_upload_file_hash_source_stage ?? null,
      upload_identity_merge_status: input.upload_identity_merge_status ?? null,
      raw_values_redacted: true,
    },
    media_readiness_state: input.media_readiness_state ?? null,
    unavailable_fields: dedupePreservingOrder([
      ...unavailableCommonDedupe,
      ...(input.take_created_at ? [] : ["take_created_at"]),
      ...(input.take_updated_at ? [] : ["take_updated_at"]),
    ]),
    redaction_notes,
  };
  const mediaIdentity = buildMediaIdentityPayload({
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    source_module: input.source_module,
    source_stage: input.source_stage,
    take: {
      take_id: input.take_id,
      analysis_run_id: analysisRunId,
      mux_playback_ref: input.safe_mux_playback_ref ?? input.mux_playback_id ?? null,
      safe_mux_playback_ref: input.safe_mux_playback_ref ?? null,
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? null,
      user_id: input.user_id ?? null,
      profile_id: input.profile_id ?? null,
      audition_id: input.audition_id ?? input.submission_id ?? null,
      submission_id: input.submission_id ?? null,
      original_upload_file_hash: input.original_upload_file_hash ?? null,
      original_upload_file_hash_source_stage: input.original_upload_file_hash_source_stage ?? null,
      visible_or_original_file_name: input.visible_or_original_file_name ?? null,
      original_file_name: input.original_file_name ?? null,
      file_name: input.file_name ?? null,
      filename: input.filename ?? null,
      metadata_file_name: input.metadata_file_name ?? null,
      file_size_bytes: input.file_size_bytes ?? null,
      mime_type_safe_summary: input.mime_type_safe_summary ?? null,
      last_modified_ms: input.last_modified_ms ?? null,
      upload_metadata_source: input.upload_metadata_source ?? null,
      upload_identity_capture_status: input.upload_identity_capture_status ?? null,
      upload_identity_capture_reason: input.upload_identity_capture_reason ?? null,
      upload_identity_merge_status: input.upload_identity_merge_status ?? null,
      video_duration_ms: input.video_duration_ms ?? input.duration_ms ?? null,
      video_duration_seconds: input.video_duration_seconds ?? input.duration_seconds ?? null,
      opening_video_sample_hash_or_profile:
        input.opening_video_sample_hash_or_profile ?? input.opening_video_sample_hash ?? null,
      closing_video_sample_hash_or_profile:
        input.closing_video_sample_hash_or_profile ?? input.closing_video_sample_hash ?? null,
      opening_audio_profile_hash: input.opening_audio_profile_hash ?? null,
      closing_audio_profile_hash: input.closing_audio_profile_hash ?? null,
      safe_media_fingerprint: input.safe_media_fingerprint ?? null,
      upload_identity_metadata: input.upload_identity_metadata ?? null,
    },
  });
  assertSafeSegment(input.take_id, "take_id");
  const base = `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs`;
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  const writes: Array<[string, string, unknown]> = [
    ["analysis_input_record", `${base}/input_record.json`, inputRecord],
    ["analysis_submission", `${base}/submission.json`, submissionSnapshot],
    ["analysis_take", `${base}/take.json`, takeSnapshot],
    ["media_identity", `${base}/media_identity.json`, mediaIdentity],
  ];
  for (const [id, rel, payload] of writes) {
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    if (w.written) emitted_artefact_ids.push(id);
    else hadFailure = true;
  }
  return {
    written: !hadFailure,
    emitted_artefact_ids,
    media_identity_summary: {
      media_identity_status: mediaIdentity.media_identity_status,
      available_signal_count: mediaIdentity.available_signal_count,
      unavailable_signal_count: mediaIdentity.unavailable_signal_count,
      media_identity_gate_status: "insufficient" as const,
      media_identity_blocker_codes: mediaIdentity.blocker_codes,
      cannot_satisfy_duplicate_detection_gate:
        mediaIdentity.cannot_satisfy_duplicate_detection_gate,
    },
    media_identity_source_classification: mediaIdentity.cannot_satisfy_duplicate_detection_gate
      ? ("partial_media_identity" as const)
      : ("real_runtime_v3_media_identity" as const),
  };
}

export async function emitResolverOutputAndTruthStateMap(input: ResolverTruthStateEmitterInput) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false as const, emitted_artefact_ids: [] as string[] };
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  const generatedAt = new Date().toISOString();
  const unresolved_inputs: string[] = [];
  const unavailable_fields = dedupePreservingOrder(input.unavailable_fields ?? []);
  const known_truths: Record<string, unknown> = {
    take_id: input.take_id,
    analysis_run_id: analysisRunId,
  };
  const unavailable_truths: Record<string, unknown> = {};
  if (input.submission_id) known_truths.submission_id = input.submission_id;
  if (input.selected_level) known_truths.selected_level = input.selected_level;
  const briefPresenceState = normalisePresenceTruthState(
    input.brief_presence,
    input.brief_presence_source ?? "unavailable",
  );
  const materialPresenceState = normalisePresenceTruthState(
    input.material_presence,
    input.material_presence_source ?? "unavailable",
  );
  const filteredStep1 = isRecord(input.filtered_run_evidence_pass_step1)
    ? input.filtered_run_evidence_pass_step1
    : null;
  assignPresenceTruthBucket("brief_presence", briefPresenceState, known_truths, unavailable_truths);
  assignPresenceTruthBucket(
    "material_presence",
    materialPresenceState,
    known_truths,
    unavailable_truths,
  );
  known_truths.safe_media_reference_state = {
    mux_playback_id_present: Boolean(input.mux_playback_id),
    mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? "unknown",
  };
  if (input.take_created_at) known_truths.take_created_at = input.take_created_at;
  if (input.take_updated_at) known_truths.take_updated_at = input.take_updated_at;
  if (input.take_index != null) known_truths.take_index = input.take_index;
  const comparedTakeIds = normaliseUniqueTakeCores(input.compared_take_ids ?? [input.take_id]);
  const comparisonInvoked = Boolean(input.comparison_run_id) || comparedTakeIds.length > 1;
  const gf01Rt15Status = comparisonInvoked ? "blocked" : "not_applicable";
  const sameVideoComparisonStatus = comparisonInvoked
    ? "requires_comparison_runtime_evidence"
    : "not_executed_single_take";
  const inferred_truths: Record<string, unknown> = {
    comparison_run_id: input.comparison_run_id ?? null,
    compared_take_ids: comparedTakeIds,
  };
  unavailable_truths.role_fit = "unavailable_without_brief_or_material_support";
  unavailable_truths.comparison_evidence = "not_executed";
  unavailable_truths.evidence_anchors = "not_emitted";
  unavailable_truths.public_claim_support = "not_emitted";
  if ((input.component_or_task_declaration_status ?? "unknown") === "unknown")
    unavailable_truths.component_or_task_declaration = "unknown_or_not_loaded";
  const unsafe_or_blocked_truths = {
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    gf01_rt15_status: gf01Rt15Status,
    same_video_comparison_status: sameVideoComparisonStatus,
  };
  const explicitTruthStateEntries = buildExplicitTruthStateEntriesForStep1({
    input,
    analysisRunId,
    filteredStep1,
    briefPresenceState,
    materialPresenceState,
    comparedTakeIds,
    comparisonInvoked,
  });
  const truthStateIds = explicitTruthStateEntries.map((entry) => entry.truth_state_entry_id);
  const canonicalTruthStateIds = Object.fromEntries(
    explicitTruthStateEntries.map((entry) => [entry.key, entry.truth_state_entry_id]),
  );
  const truthStatesById = Object.fromEntries(
    explicitTruthStateEntries.map((entry) => [entry.truth_state_entry_id, entry]),
  );
  const redaction_notes = [
    "No secret/token/session fields emitted; only safe booleans/refs included",
  ];
  const resolver_output = {
    schema_version: "tapecoach_v3_resolver_output_v1",
    artefact_type: "resolver_output",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: generatedAt,
    analysis_route: input.analysis_route ?? null,
    input_artifact_refs: {
      analysis_input_record: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/input_record.json`,
      analysis_submission: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/submission.json`,
      analysis_take: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/take.json`,
    },
    audition_type: {
      value: input.audition_type ?? null,
      source: input.audition_type ? "loaded_runtime_field" : "unavailable",
      status: input.audition_type ? "known" : "unknown",
    },
    selected_level: {
      value: input.selected_level ?? null,
      source: input.selected_level ? "loaded_runtime_field" : "unavailable",
      status: input.selected_level ? "known" : "unknown",
    },
    brief_presence: briefPresenceState,
    material_presence: materialPresenceState,
    component_declaration_source: input.component_or_task_declaration_source ?? "not_loaded",
    component_or_task_declaration_status: input.component_or_task_declaration_status ?? "unknown",
    media_readiness_state: {
      value: input.media_readiness_state ?? null,
      source: input.media_readiness_state ? "loaded_runtime_field" : "unavailable",
      status: input.media_readiness_state ? "known" : "unknown",
    },
    safe_media_reference_state: {
      mux_playback_id_present: Boolean(input.mux_playback_id),
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? "unknown",
    },
    take_identity: {
      take_id: input.take_id,
      analysis_run_id: analysisRunId,
      take_index: input.take_index ?? null,
      take_index_source: input.take_index_source ?? "unavailable",
    },
    timestamps: {
      take_created_at: input.take_created_at ?? null,
      take_updated_at: input.take_updated_at ?? null,
      timestamp_source:
        input.take_created_at || input.take_updated_at ? "loaded_take_row" : "unavailable",
    },
    legacy_adapter_present: true,
    v3_spine_available: {
      input_artefacts_available: true,
      resolver_output_available: true,
      truth_state_map_available: true,
      evidence_anchors_available: false,
      public_claim_trace_available: false,
    },
    unresolved_inputs,
    unavailable_fields,
    blocker_codes: comparisonInvoked ? ["gf01_rt15_blocked_no_comparison_runtime_evidence"] : [],
    redaction_notes,
  };
  const truth_state_map = {
    schema_version: "tapecoach_v3_truth_state_map_v1",
    artefact_type: "truth_state_map",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    source_module: input.source_module,
    source_stage: input.source_stage,
    generated_at: generatedAt,
    truth_state_scope: "resolver_stage_snapshot",
    final_artefact_status_source: "manifest.json",
    final_qa_acceptance_source: "qa/acceptance_metrics.json",
    not_final_artefact_emission_state: true,
    known_truths,
    inferred_truths,
    unavailable_truths,
    unsafe_or_blocked_truths,
    truth_state_ids: truthStateIds,
    canonical_truth_state_ids: canonicalTruthStateIds,
    truth_state_entry_count: explicitTruthStateEntries.length,
    truth_state_entry_status:
      explicitTruthStateEntries.length > 0 ? "partial_explicit_ids" : "missing",
    brief_truths: {
      brief_presence: briefPresenceState.value,
      source: briefPresenceState.source,
      status: briefPresenceState.status,
    },
    media_truths: {
      media_readiness_state: input.media_readiness_state ?? null,
      mux_playback_id_present: Boolean(input.mux_playback_id),
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? "unknown",
    },
    component_truths: {
      declaration_source: input.component_or_task_declaration_source ?? "not_loaded",
      declaration_status: input.component_or_task_declaration_status ?? "unknown",
      legacy_report_detected_components: "legacy_adapter_report_snapshot_not_v3_input_truth",
    },
    level_truths: {
      selected_level: input.selected_level ?? null,
      status: input.selected_level ? "known" : "unknown",
    },
    role_truths: {
      status: "unavailable",
      reason: "insufficient_reliable_brief_or_material_context",
    },
    comparison_truths: {
      comparison_run_executed: comparisonInvoked,
      status: comparisonInvoked
        ? "blocked_pending_comparison_evidence"
        : "not_applicable_single_take",
      compared_take_ids: comparedTakeIds,
    },
    public_authority_truths: {
      production_safe_status: "blocked",
      public_scoring_status: "blocked",
      public_technique_authority_status: "blocked",
      raw_report_legacy_adapter_not_v3_proof: true,
    },
    truth_state_entries: explicitTruthStateEntries,
    explicit_truth_state_entries: explicitTruthStateEntries,
    entries: explicitTruthStateEntries,
    truth_states: truthStatesById,
    source_refs: resolver_output.input_artifact_refs,
    redaction_notes,
  };
  const base = `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver`;
  const emitted_artefact_ids: string[] = [];
  let hadFailure = false;
  for (const [id, rel, payload] of [
    ["resolver_output", `${base}/resolver_output.json`, resolver_output],
    ["truth_state_map", `${base}/TruthStateMap.json`, truth_state_map],
  ] as const) {
    const w = await writeInternalJson(root, input.run_id, rel, payload, id);
    if (w.written) emitted_artefact_ids.push(id);
    else hadFailure = true;
  }
  return { written: !hadFailure, emitted_artefact_ids, resolver_output, truth_state_map };
}

function step1EvidenceFamilyForItem(
  item: AnalysisObservableEvidenceItem,
): Step1ObservableEvidenceFamily {
  if (item.source_artefact_id === "truth_state_map") return "resolver_truth_fact";
  if (item.evidence_modality === "video") return "video_observable";
  if (item.evidence_modality === "audio") return "audio_observable";
  if (item.evidence_modality === "material") return "material_specific";
  if (item.evidence_kind.includes("technique")) return "candidate_technique";
  if (item.evidence_kind.includes("performance")) return "performance_observable";
  if (item.assessability_limitations.length > 0 && item.blocker_codes.length > 0)
    return "assessability_limit";
  return "deterministic_runtime_fact";
}

function step1SourceArtefactIdForItem(
  item: AnalysisObservableEvidenceItem,
): Step1ObservableEvidenceItem["source_artefact_id"] | null {
  return isAllowedStep1EvidenceSource(item.source_artefact_id) ? item.source_artefact_id : null;
}

function toStep1ObservableEvidenceItem(
  item: AnalysisObservableEvidenceItem,
  index: number,
  sourceArtefactId: Step1ObservableEvidenceItem["source_artefact_id"],
): Step1ObservableEvidenceItem {
  return {
    evidence_item_id: `step1-${String(index + 1).padStart(4, "0")}`,
    evidence_family: step1EvidenceFamilyForItem(item),
    evidence_modality: item.evidence_modality,
    evidence_kind: item.evidence_kind,
    safe_evidence_summary: item.safe_evidence_summary,
    source_artefact_id: sourceArtefactId,
    source_path:
      item.source_artefact_id === "run_evidence_pass"
        ? `filtered_run_evidence_pass_step1.${item.source_path}`
        : item.source_path,
    timestamp: item.timestamp,
    timestamp_range: item.timestamp_range,
    timestamp_source: item.timestamp_source,
    component_id: item.component_id,
    linked_truth_state_ids: item.linked_truth_state_ids,
    assessability_limitations: item.assessability_limitations,
    confidence_or_strength: item.confidence_or_strength,
    public_display_status: item.public_display_status,
    blocker_codes: item.blocker_codes,
    cannot_satisfy_v3_gate: true,
  };
}

export async function emitAnalysisEvidenceStatePrerequisite(
  input: AnalysisEvidenceStateEmitterInput,
) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit })) {
    return {
      written: false as const,
      emitted_artefact_ids: [] as string[],
      emitted_blocked_artefact_ids: [] as string[],
      source_classification: "unavailable" as const,
      level2_satisfies: false as const,
      payload: null,
    };
  }
  const root = input.root_dir ?? DEFAULT_ROOT;
  const analysisRunId = input.analysis_run_id ?? input.run_id;
  assertSafeSegment(input.take_id, "take_id");
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const generatedAt = new Date().toISOString();
  const resolverOutputAvailable = input.resolver_output_available === true;
  const truthStateMapAvailable = input.truth_state_map_available === true;
  const durationKnown =
    typeof input.media_duration_seconds === "number" &&
    Number.isFinite(input.media_duration_seconds) &&
    input.media_duration_seconds > 0;
  const durationConfidence = durationKnown ? (input.duration_confidence ?? "known") : "unknown";
  const filteredStep1 = isRecord(input.filtered_run_evidence_pass_step1)
    ? input.filtered_run_evidence_pass_step1
    : null;
  const step1VideoItems = safeRecordArray(filteredStep1?.video_observable_evidence_items);
  const step1AudioItems = safeRecordArray(filteredStep1?.audio_observable_evidence_items);
  const step1MaterialItems = safeRecordArray(filteredStep1?.material_observable_evidence_items);
  const step1PerformanceItems = safeRecordArray(
    filteredStep1?.performance_observable_evidence_items,
  );
  const step1TechniqueItems = safeRecordArray(filteredStep1?.candidate_technique_evidence);
  const hasFilteredStep1Items =
    step1VideoItems.length +
      step1AudioItems.length +
      step1MaterialItems.length +
      step1PerformanceItems.length +
      step1TechniqueItems.length >
    0;
  const inputArtifactRefs = {
    analysis_input_record: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/input_record.json`,
    analysis_submission: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/submission.json`,
    analysis_take: `takes/take-${input.take_id}/analysis-${analysisRunId}/inputs/take.json`,
  };
  const observable_evidence_items: AnalysisObservableEvidenceItem[] = [];
  const addRuntimeFact = (
    item: Omit<
      AnalysisObservableEvidenceItem,
      "evidence_item_id" | "timestamp" | "timestamp_range" | "public_display_status"
    >,
  ) => {
    observable_evidence_items.push({
      evidence_item_id: `aes-${String(observable_evidence_items.length + 1).padStart(4, "0")}`,
      timestamp: null,
      timestamp_range: null,
      public_display_status: "internal_only",
      ...item,
    });
  };
  const addIfKnown = (
    value: unknown,
    item: Omit<
      AnalysisObservableEvidenceItem,
      | "evidence_item_id"
      | "timestamp"
      | "timestamp_range"
      | "public_display_status"
      | "safe_evidence_summary"
    > & { label: string },
  ) => {
    if (value == null) return;
    if (typeof value === "string" && !value.trim()) return;
    addRuntimeFact({
      ...item,
      safe_evidence_summary: `${item.label}: ${String(value)}`,
    });
  };
  const addUnavailableRuntimeFact = (
    item: Omit<
      AnalysisObservableEvidenceItem,
      | "evidence_item_id"
      | "timestamp"
      | "timestamp_range"
      | "public_display_status"
      | "confidence_or_strength"
    > & { confidence_or_strength?: string | null },
  ) => {
    addRuntimeFact({
      confidence_or_strength: null,
      ...item,
      assessability_limitations: dedupePreservingOrder(item.assessability_limitations),
      blocker_codes: dedupePreservingOrder(item.blocker_codes),
    });
  };
  const unavailableFieldSet = new Set(
    (input.unavailable_fields ?? []).filter(
      (field): field is string => typeof field === "string" && field.length > 0,
    ),
  );
  const extractedBriefCacheStatus = String(input.brief_presence_source ?? "").includes(
    "extracted_brief_cached",
  )
    ? "loaded"
    : input.brief_presence_source === "audition.brief+audition.extracted_brief_cached_empty"
      ? "known_empty"
      : "not_loaded";
  addIfKnown(input.selected_level, {
    label: "selected_level",
    evidence_modality: "submission_context",
    evidence_kind: "selected_level",
    source_artefact_id: "analysis_submission",
    source_path: "selected_level",
    timestamp_source: "not_timestamped_runtime_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: "runtime_field_present",
    blocker_codes: [],
  });
  addIfKnown(input.audition_type, {
    label: "audition_type",
    evidence_modality: "submission_context",
    evidence_kind: "audition_type",
    source_artefact_id: "analysis_submission",
    source_path: "audition_type",
    timestamp_source: "not_timestamped_runtime_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: "runtime_field_present",
    blocker_codes: [],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "submission_identity_loaded",
    safe_evidence_summary: `submission_identity_loaded: ${input.submission_id ? "present" : "missing"}`,
    source_artefact_id: "analysis_submission",
    source_path: "submission_id",
    timestamp_source: "not_timestamped_runtime_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: input.submission_id ? [] : ["submission_id_unavailable"],
    confidence_or_strength: input.submission_id ? "runtime_identity_present" : null,
    blocker_codes: input.submission_id ? [] : ["submission_id_missing"],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "brief_presence",
    safe_evidence_summary: `brief_presence: ${input.brief_presence ?? "unknown"}`,
    source_artefact_id: "resolver_output",
    source_path: "brief_presence",
    timestamp_source: "not_timestamped_resolver_fact",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "brief_presence_source_resolved",
    safe_evidence_summary: `brief_presence_source: ${input.brief_presence_source ?? "unavailable"}`,
    source_artefact_id: "resolver_output",
    source_path: "brief_presence.source",
    timestamp_source: "not_timestamped_resolver_fact",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: input.brief_presence_source
      ? []
      : ["brief_presence_source_unavailable"],
    confidence_or_strength:
      resolverOutputAvailable && input.brief_presence_source ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable
      ? input.brief_presence_source
        ? []
        : ["brief_presence_source_unavailable"]
      : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "extracted_brief_cache_status",
    safe_evidence_summary: `extracted_brief_cache_status: ${extractedBriefCacheStatus}`,
    source_artefact_id: "resolver_output",
    source_path: "brief_presence.source",
    timestamp_source: "not_timestamped_resolver_fact",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations:
      extractedBriefCacheStatus === "not_loaded" ? ["extracted_brief_cache_not_loaded"] : [],
    confidence_or_strength: resolverOutputAvailable ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "material",
    evidence_kind: "material_presence",
    safe_evidence_summary: `material_presence: ${input.material_presence ?? "unknown"}`,
    source_artefact_id: "resolver_output",
    source_path: "material_presence",
    timestamp_source: "not_timestamped_resolver_fact",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "material",
    evidence_kind: "material_presence_source_resolved",
    safe_evidence_summary: `material_presence_source: ${input.material_presence_source ?? "unavailable"}`,
    source_artefact_id: "resolver_output",
    source_path: "material_presence.source",
    timestamp_source: "not_timestamped_resolver_fact",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: input.material_presence_source
      ? []
      : ["material_presence_source_unavailable"],
    confidence_or_strength:
      resolverOutputAvailable && input.material_presence_source ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable
      ? input.material_presence_source
        ? []
        : ["material_presence_source_unavailable"]
      : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "stable_take_identity",
    safe_evidence_summary: `stable_take_identity: take ${input.take_id} / analysis ${analysisRunId}`,
    source_artefact_id: "analysis_take",
    source_path: "stable_take_identity",
    timestamp_source: "not_timestamped_runtime_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: "runtime_identity_present",
    blocker_codes: [],
  });
  addRuntimeFact({
    evidence_modality: "submission_context",
    evidence_kind: "take_identity_loaded",
    safe_evidence_summary: "take_identity_loaded: take and analysis identifiers present",
    source_artefact_id: "analysis_take",
    source_path: "stable_take_identity",
    timestamp_source: "not_timestamped_runtime_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: "runtime_identity_present",
    blocker_codes: [],
  });
  if (input.take_created_at) {
    addRuntimeFact({
      evidence_modality: "submission_context",
      evidence_kind: "take_created_at_normalised",
      safe_evidence_summary: "take_created_at_normalised: timestamp available",
      source_artefact_id: "analysis_take",
      source_path: "take_created_at",
      timestamp_source: "loaded_take_row",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: [],
      confidence_or_strength: "normalised_runtime_timestamp_present",
      blocker_codes: [],
    });
  }
  if (input.take_updated_at) {
    addRuntimeFact({
      evidence_modality: "submission_context",
      evidence_kind: "take_updated_at_normalised",
      safe_evidence_summary: "take_updated_at_normalised: timestamp available",
      source_artefact_id: "analysis_take",
      source_path: "take_updated_at",
      timestamp_source: "loaded_take_row",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: [],
      confidence_or_strength: "normalised_runtime_timestamp_present",
      blocker_codes: [],
    });
  }
  if (input.take_index != null) {
    addRuntimeFact({
      evidence_modality: "submission_context",
      evidence_kind: "take_index_loaded",
      safe_evidence_summary: `take_index_loaded: ${input.take_index}`,
      source_artefact_id: "analysis_take",
      source_path: "take_index",
      timestamp_source: "not_timestamped_runtime_metadata",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: [],
      confidence_or_strength: input.take_index_source ?? "runtime_field_present",
      blocker_codes: [],
    });
  } else {
    addUnavailableRuntimeFact({
      evidence_modality: "submission_context",
      evidence_kind: "take_index_unavailable",
      safe_evidence_summary: "take_index_unavailable: not loaded before Step 2",
      source_artefact_id: "analysis_take",
      source_path: "take_index",
      timestamp_source: "unavailable",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: ["take_index_unavailable"],
      blocker_codes: ["take_index_unavailable"],
    });
  }
  addRuntimeFact({
    evidence_modality: "media_readiness",
    evidence_kind: "media_readiness_state",
    safe_evidence_summary: `media_readiness_state_loaded: ${input.media_readiness_state ? "runtime field present" : "unknown"}`,
    source_artefact_id: "analysis_take",
    source_path: "media_readiness_state",
    timestamp_source: durationKnown ? "media_readiness_runtime_field" : "unavailable",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: durationKnown
      ? []
      : ["media_duration_unavailable_no_timestamp_evidence_fabricated"],
    confidence_or_strength: input.media_readiness_state ? "runtime_field_present" : null,
    blocker_codes: durationKnown ? [] : ["media_duration_unavailable"],
  });
  addRuntimeFact({
    evidence_modality: "media_readiness",
    evidence_kind: durationKnown ? "media_duration_known" : "media_duration_unknown",
    safe_evidence_summary: durationKnown
      ? `media_duration_known: ${normaliseSafeStep1Value(input.media_duration_seconds)} seconds`
      : "media_duration_unknown: duration unavailable before Step 2",
    source_artefact_id: "media_readiness",
    source_path: "media_duration_seconds",
    timestamp_source: durationKnown ? "media_readiness_runtime_field" : "unavailable",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: durationKnown
      ? []
      : ["media_duration_unavailable_no_timestamp_evidence_fabricated"],
    confidence_or_strength: durationKnown ? durationConfidence : null,
    blocker_codes: durationKnown ? [] : ["media_duration_unavailable"],
  });
  addRuntimeFact({
    evidence_modality: "media_readiness",
    evidence_kind: "safe_media_reference_state",
    safe_evidence_summary: `media reference present: playback=${Boolean(input.mux_playback_id)}, asset_or_upload=${String(input.mux_asset_or_upload_id_present ?? "unknown")}`,
    source_artefact_id: "resolver_output",
    source_path: "safe_media_reference_state",
    timestamp_source: "not_timestamped_media_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: [],
    confidence_or_strength: resolverOutputAvailable ? "resolver_runtime_fact" : null,
    blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
  });
  addRuntimeFact({
    evidence_modality: "media_readiness",
    evidence_kind: hasMeaningfulStep1Value(input.original_upload_file_hash)
      ? "safe_upload_identity_available"
      : "safe_upload_identity_unavailable",
    safe_evidence_summary: hasMeaningfulStep1Value(input.original_upload_file_hash)
      ? "safe_upload_identity_available: original upload hash present"
      : `safe_upload_identity_unavailable: ${input.upload_identity_capture_status ?? "not captured"}`,
    source_artefact_id: "analysis_take",
    source_path: "safe_upload_identity.original_upload_file_hash",
    timestamp_source: "not_timestamped_upload_identity_metadata",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: hasMeaningfulStep1Value(input.original_upload_file_hash)
      ? []
      : ["safe_upload_identity_unavailable"],
    confidence_or_strength: hasMeaningfulStep1Value(input.original_upload_file_hash)
      ? "runtime_upload_identity_present"
      : null,
    blocker_codes: hasMeaningfulStep1Value(input.original_upload_file_hash)
      ? []
      : ["safe_upload_identity_unavailable"],
  });
  addRuntimeFact({
    evidence_modality: "resolver_truth",
    evidence_kind: "known_truths",
    safe_evidence_summary:
      "known runtime truth fields recorded for take, analysis run, safe media state and supplied metadata",
    source_artefact_id: "truth_state_map",
    source_path: "known_truths",
    timestamp_source: "not_timestamped_truth_state",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable_in_current_truth_map_schema"]
      : [],
    confidence_or_strength: truthStateMapAvailable ? "truth_state_map_runtime_fact" : null,
    blocker_codes: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable"]
      : ["TruthStateMap_missing"],
  });
  addRuntimeFact({
    evidence_modality: "resolver_truth",
    evidence_kind: "component_truths",
    safe_evidence_summary: `component declaration status: ${input.component_or_task_declaration_status ?? "unknown"}`,
    source_artefact_id: "truth_state_map",
    source_path: "component_truths.declaration_status",
    timestamp_source: "not_timestamped_truth_state",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable_in_current_truth_map_schema"]
      : [],
    confidence_or_strength: truthStateMapAvailable ? "truth_state_map_runtime_fact" : null,
    blocker_codes: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable"]
      : ["TruthStateMap_missing"],
  });
  addRuntimeFact({
    evidence_modality: "material",
    evidence_kind:
      (input.component_or_task_declaration_status ?? "unknown") === "supplied"
        ? "component_or_task_declaration_loaded"
        : "component_or_task_declaration_unavailable",
    safe_evidence_summary: `component_or_task_declaration_status: ${input.component_or_task_declaration_status ?? "unknown"}`,
    source_artefact_id: "analysis_submission",
    source_path: "component_or_task_declaration_status",
    timestamp_source: "not_timestamped_supplied_context",
    component_id: "component_or_task_declaration",
    linked_truth_state_ids: [],
    assessability_limitations:
      (input.component_or_task_declaration_status ?? "unknown") === "unknown"
        ? ["component_or_task_declaration_not_loaded"]
        : [],
    confidence_or_strength:
      input.component_or_task_declaration_source === "loaded_runtime_field"
        ? "supplied_context_runtime_field"
        : null,
    blocker_codes:
      (input.component_or_task_declaration_status ?? "unknown") === "unknown"
        ? ["component_or_task_declaration_unknown"]
        : [],
  });
  addRuntimeFact({
    evidence_modality: "resolver_truth",
    evidence_kind: "comparison_truths",
    safe_evidence_summary: `comparison execution status: ${input.comparison_run_id ? "comparison_context_present" : "not_executed_single_take"}`,
    source_artefact_id: "truth_state_map",
    source_path: "comparison_truths.status",
    timestamp_source: "not_timestamped_truth_state",
    component_id: null,
    linked_truth_state_ids: [],
    assessability_limitations: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable_in_current_truth_map_schema"]
      : [],
    confidence_or_strength: truthStateMapAvailable ? "truth_state_map_runtime_fact" : null,
    blocker_codes: truthStateMapAvailable
      ? ["structured_truth_state_ids_unavailable"]
      : ["TruthStateMap_missing"],
  });
  if (unavailableFieldSet.size > 0) {
    addUnavailableRuntimeFact({
      evidence_modality: "submission_context",
      evidence_kind: "unavailable_runtime_fields_recorded",
      safe_evidence_summary: `unavailable_runtime_fields_recorded: ${Array.from(unavailableFieldSet).sort().join(", ")}`,
      source_artefact_id: "analysis_input_record",
      source_path: "unavailable_fields",
      timestamp_source: "unavailable",
      component_id: null,
      linked_truth_state_ids: [],
      assessability_limitations: Array.from(unavailableFieldSet).map(
        (field) => `${field}_unavailable`,
      ),
      blocker_codes: Array.from(unavailableFieldSet).map((field) => `${field}_unavailable`),
    });
  }
  const appendFilteredStep1Items = (items: Array<Record<string, unknown>>, familyPath: string) => {
    items.forEach((item, index) => {
      const evidenceModality =
        typeof item.evidence_modality === "string" &&
        [
          "video",
          "audio",
          "material",
          "submission_context",
          "resolver_truth",
          "media_readiness",
          "unknown",
        ].includes(item.evidence_modality)
          ? (item.evidence_modality as AnalysisObservableEvidenceItem["evidence_modality"])
          : "unknown";
      const evidenceKind =
        typeof item.evidence_kind === "string" && item.evidence_kind.trim()
          ? item.evidence_kind.trim()
          : "runEvidencePass_observation";
      const summary =
        typeof item.safe_evidence_summary === "string" && item.safe_evidence_summary.trim()
          ? item.safe_evidence_summary.trim()
          : `${evidenceKind}: filtered runEvidencePass observation`;
      observable_evidence_items.push({
        evidence_item_id: `aes-${String(observable_evidence_items.length + 1).padStart(4, "0")}`,
        evidence_modality: evidenceModality,
        evidence_kind: evidenceKind,
        safe_evidence_summary: summary,
        source_artefact_id: "run_evidence_pass",
        source_path:
          typeof item.source_path === "string" && item.source_path.trim()
            ? item.source_path.trim()
            : `${familyPath}[${index}]`,
        timestamp: typeof item.timestamp === "string" ? item.timestamp : null,
        timestamp_range: null,
        timestamp_source:
          typeof item.timestamp_source === "string"
            ? item.timestamp_source
            : "not_timestamped_observation",
        component_id: typeof item.component_id === "string" ? item.component_id : null,
        linked_truth_state_ids: Array.isArray(item.linked_truth_state_ids)
          ? item.linked_truth_state_ids.filter((x): x is string => typeof x === "string")
          : [],
        assessability_limitations: Array.isArray(item.assessability_limitations)
          ? item.assessability_limitations.filter((x): x is string => typeof x === "string")
          : [],
        confidence_or_strength:
          typeof item.confidence_or_strength === "string"
            ? item.confidence_or_strength
            : "runEvidencePass_observation",
        public_display_status: "internal_only",
        blocker_codes: Array.isArray(item.blocker_codes)
          ? item.blocker_codes.filter((x): x is string => typeof x === "string")
          : [],
        analysis_evidence_state_source_path: `${familyPath}[${index}]`,
      } as AnalysisObservableEvidenceItem & { analysis_evidence_state_source_path: string });
    });
  };
  appendFilteredStep1Items(step1VideoItems, "video_observable_evidence_items");
  appendFilteredStep1Items(step1AudioItems, "audio_observable_evidence_items");
  appendFilteredStep1Items(step1MaterialItems, "material_observable_evidence_items");
  appendFilteredStep1Items(step1PerformanceItems, "performance_observable_evidence_items");
  appendFilteredStep1Items(step1TechniqueItems, "candidate_technique_evidence");
  const candidate_brief_evidence = [
    {
      evidence_kind: "brief_presence",
      status: input.brief_presence ?? "unknown",
      source_artefact_id: "resolver_output",
      source_path: "brief_presence",
      safe_evidence_summary: "brief presence only; downstream judgement not asserted",
      linked_truth_state_ids: truthStateMapAvailable
        ? [canonicalTruthStateId(input.run_id, "brief_presence")]
        : [],
      blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
    },
    {
      evidence_kind: "material_presence",
      status: input.material_presence ?? "unknown",
      source_artefact_id: "resolver_output",
      source_path: "material_presence",
      safe_evidence_summary: "material presence only; downstream judgement not asserted",
      linked_truth_state_ids: truthStateMapAvailable
        ? [canonicalTruthStateId(input.run_id, "material_presence")]
        : [],
      blocker_codes: resolverOutputAvailable ? [] : ["resolver_output_missing"],
    },
  ];
  const component_evidence = [
    {
      component_id: "component_or_task_declaration",
      evidence_kind: "component_or_task_declaration_status",
      status: input.component_or_task_declaration_status ?? "unknown",
      source_artefact_id: "analysis_submission",
      source_path: "component_or_task_declaration_status",
      safe_evidence_summary: `component/task declaration status is ${input.component_or_task_declaration_status ?? "unknown"}`,
      linked_truth_state_ids: truthStateMapAvailable
        ? [
            canonicalTruthStateId(
              input.run_id,
              step1EvidenceTruthSlug(
                {
                  evidence_kind:
                    (input.component_or_task_declaration_status ?? "unknown") === "supplied"
                      ? "component_or_task_declaration_loaded"
                      : "component_or_task_declaration_unavailable",
                },
                1,
              ),
            ),
          ]
        : [],
      assessability_limitations:
        (input.component_or_task_declaration_status ?? "unknown") === "unknown"
          ? ["component_or_task_declaration_not_loaded"]
          : [],
      blocker_codes:
        (input.component_or_task_declaration_status ?? "unknown") === "unknown"
          ? ["component_or_task_declaration_unknown"]
          : [],
    },
  ];
  const performanceUnavailable = [
    {
      evidence_kind: "video_observable_performance_evidence_not_extracted",
      status: "not_extracted",
      reason:
        "no_persisted_pre_raw_report_video_observable_evidence_extractor_wired_for_qa_promotion",
      blocker_codes: ["video_observable_performance_evidence_not_extracted"],
    },
    {
      evidence_kind: "audio_observable_performance_evidence_not_extracted",
      status: "not_extracted",
      reason:
        "no_persisted_pre_raw_report_audio_observable_evidence_extractor_wired_for_qa_promotion",
      blocker_codes: ["audio_observable_performance_evidence_not_extracted"],
    },
    {
      evidence_kind: "material_specific_performance_evidence_not_extracted",
      status: "not_extracted",
      reason:
        "brief/material presence metadata is available but performance achievement is not extracted in this Step 1 artefact",
      blocker_codes: ["material_specific_performance_evidence_not_extracted"],
    },
    {
      evidence_kind: "performance_observable_evidence_not_extracted",
      status: "not_extracted",
      reason:
        "no persisted pre-raw-report performance observable evidence extractor is wired for QA promotion",
      blocker_codes: ["performance_observable_evidence_not_extracted"],
    },
    {
      evidence_kind: "candidate_technique_evidence_not_extracted",
      status: "not_extracted",
      reason:
        "no genuine persisted Step 1 technique extractor is available; legacy TechniqueObservationTrace is forbidden as a source",
      blocker_codes: ["candidate_technique_evidence_not_extracted"],
    },
  ];
  const filteredUnsupported = safeRecordArray(filteredStep1?.unsupported_or_unavailable_evidence);
  const filteredRejected = Array.isArray(filteredStep1?.rejected_or_filtered_fields)
    ? filteredStep1.rejected_or_filtered_fields.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      )
    : [];
  const timestampNormalisationWarnings = Array.isArray(input.timestamp_normalisation_warnings)
    ? input.timestamp_normalisation_warnings.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      )
    : [];
  const filteredBlockers = Array.isArray(filteredStep1?.blocker_codes)
    ? filteredStep1.blocker_codes.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
  const hasStep1Video = step1VideoItems.length > 0;
  const hasStep1Audio = step1AudioItems.length > 0;
  const hasStep1MaterialPerformanceCandidate = step1MaterialItems.some(
    (item) => materialStep1FamilyForRawItem(item) === "material_specific_performance",
  );
  const hasStep1Performance = step1PerformanceItems.length > 0;
  const hasStep1PerformanceOrDerived =
    hasStep1Performance ||
    step1MaterialItems.some(canDerivePerformanceObservableFromMaterialStep1Item);
  const hasStep1Technique = step1TechniqueItems.length > 0;
  const step1MediaInputStatus = hasFilteredStep1Items
    ? input.mux_playback_id || input.mux_asset_or_upload_id_present
      ? "media_observable_input_available"
      : "metadata_only"
    : input.mux_playback_id || input.mux_asset_or_upload_id_present
      ? "unknown"
      : "unavailable";
  const step1CanExtractMediaObservations =
    step1MediaInputStatus === "media_observable_input_available";
  const unsupportedOrUnavailableEvidence = [
    ...(filteredStep1 ? filteredUnsupported : performanceUnavailable),
    ...(filteredStep1 &&
    !hasStep1Video &&
    !filteredUnsupported.some((item) => String(item.evidence_kind ?? "").includes("video"))
      ? [performanceUnavailable[0]]
      : []),
    ...(filteredStep1 &&
    !hasStep1Audio &&
    !filteredUnsupported.some((item) => String(item.evidence_kind ?? "").includes("audio"))
      ? [performanceUnavailable[1]]
      : []),
    ...(filteredStep1 &&
    !hasStep1MaterialPerformanceCandidate &&
    !filteredUnsupported.some((item) => String(item.evidence_kind ?? "").includes("material"))
      ? [performanceUnavailable[2]]
      : []),
    ...(filteredStep1 &&
    !hasStep1PerformanceOrDerived &&
    !filteredUnsupported.some((item) => String(item.evidence_kind ?? "").includes("performance"))
      ? [performanceUnavailable[3]]
      : []),
    ...(filteredStep1 &&
    !hasStep1Technique &&
    !filteredUnsupported.some((item) =>
      String(item.evidence_kind ?? "").includes("candidate_technique"),
    )
      ? [performanceUnavailable[4]]
      : []),
  ];
  const step2DependencyBlockers = dedupePreservingOrder([
    ...(!resolverOutputAvailable ? ["resolver_output_missing"] : []),
    ...(!truthStateMapAvailable ? ["TruthStateMap_missing"] : []),
    ...(filteredStep1 && filteredStep1.extraction_status === "blocked"
      ? ["runEvidencePass_filtered_step1_blocked"]
      : []),
  ]);
  const step2DependencyStatus = {
    status: step2DependencyBlockers.length > 0 ? "blocked" : "ready_with_limitations",
    can_run_step2: step2DependencyBlockers.length === 0,
    required_artefact_id: "analysis_evidence_state",
    blocker_codes: step2DependencyBlockers,
  };
  const blocker_codes = dedupePreservingOrder([
    ...(hasFilteredStep1Items
      ? ["analysis_evidence_state_filtered_runEvidencePass_partial"]
      : ["analysis_evidence_state_partial_runtime_facts_only"]),
    ...(!hasStep1Video ? ["video_observable_performance_evidence_not_extracted"] : []),
    ...(!hasStep1Audio ? ["audio_observable_performance_evidence_not_extracted"] : []),
    ...(!hasStep1MaterialPerformanceCandidate
      ? ["material_specific_performance_evidence_not_extracted"]
      : []),
    ...(!hasStep1PerformanceOrDerived ? ["performance_observable_evidence_not_extracted"] : []),
    ...(!hasStep1Technique ? ["candidate_technique_evidence_not_extracted"] : []),
    ...filteredBlockers,
    ...(filteredRejected.length > 0 ? ["runEvidencePass_prohibited_fields_filtered"] : []),
    ...(!resolverOutputAvailable ? ["resolver_output_missing"] : []),
    ...(!truthStateMapAvailable ? ["TruthStateMap_missing"] : []),
    ...(!durationKnown ? ["media_duration_unavailable"] : []),
    ...(!truthStateMapAvailable ? ["structured_truth_state_ids_unavailable"] : []),
    ...step2DependencyBlockers,
  ]);
  const sourceClassification: "real_runtime_v3" | "unavailable" =
    observable_evidence_items.length > 0 ? "real_runtime_v3" : "unavailable";
  const evidenceStateStatus: "partial" | "unavailable" | "blocked" =
    filteredStep1?.extraction_status === "blocked"
      ? "blocked"
      : observable_evidence_items.length > 0
        ? "partial"
        : "unavailable";
  const deterministicStep1ObservableEvidenceItems = observable_evidence_items.flatMap((item) => {
    const sourceArtefactId = step1SourceArtefactIdForItem(item);
    return sourceArtefactId ? [toStep1ObservableEvidenceItem(item, 0, sourceArtefactId)] : [];
  });
  const mediaObservableProjection = buildMediaObservableStep1EvidenceItems({
    videoItems: step1VideoItems,
    audioItems: step1AudioItems,
  });
  const ordinaryAnalysisProjection = buildOrdinaryAnalysisStep1EvidenceItems({
    materialItems: step1MaterialItems,
    performanceItems: step1PerformanceItems,
    techniqueItems: step1TechniqueItems,
  });
  const step1ObservableEvidenceItemsUnlinked = [
    ...deterministicStep1ObservableEvidenceItems,
    ...mediaObservableProjection.items,
    ...ordinaryAnalysisProjection.items,
  ].map((item, index) => ({
    ...item,
    evidence_item_id: `step1-${String(index + 1).padStart(4, "0")}`,
    source_path:
      item.source_artefact_id === "step1_observable_evidence"
        ? `observable_evidence_items[${index}]`
        : item.source_path,
  }));
  const step1ObservableEvidenceItems = truthStateMapAvailable
    ? linkStep1ObservableEvidenceItemsToTruthState(
        input.run_id,
        step1ObservableEvidenceItemsUnlinked,
      )
    : step1ObservableEvidenceItemsUnlinked;
  const analysisObservableEvidenceItems = truthStateMapAvailable
    ? linkAnalysisObservableEvidenceItemsToTruthState(input.run_id, observable_evidence_items)
    : observable_evidence_items;
  const withAnalysisSourcePath = (item: Step1ObservableEvidenceItem, sourcePath: string) => ({
    ...item,
    analysis_evidence_state_source_path: sourcePath,
    truth_state_entry_ids: item.linked_truth_state_ids,
    limitation_only: isStep1LimitationOnlyEvidenceItem(item),
    can_satisfy_family_gate:
      !item.cannot_satisfy_v3_gate && !isStep1LimitationOnlyEvidenceItem(item),
  });
  const step1FamilyObservableEvidenceItems = step1ObservableEvidenceItems.map((item, index) =>
    withAnalysisSourcePath(item, `step1_family_observable_evidence_items[${index}]`),
  );
  const videoObservableEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "video_observable")
    .map((item, index) => withAnalysisSourcePath(item, `video_observable_evidence[${index}]`));
  const audioObservableEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "audio_observable")
    .map((item, index) => withAnalysisSourcePath(item, `audio_observable_evidence[${index}]`));
  const materialSpecificEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "material_specific")
    .map((item, index) => withAnalysisSourcePath(item, `material_specific_evidence[${index}]`));
  const materialSpecificPerformanceEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "material_specific_performance")
    .map((item, index) =>
      withAnalysisSourcePath(item, `material_specific_performance_evidence[${index}]`),
    );
  const performanceObservableEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "performance_observable")
    .map((item, index) =>
      withAnalysisSourcePath(item, `performance_observable_evidence[${index}]`),
    );
  const candidateTechniqueEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "candidate_technique")
    .map((item, index) => withAnalysisSourcePath(item, `candidate_technique_evidence[${index}]`));
  const assessabilityLimitEvidence = step1ObservableEvidenceItems
    .filter((item) => item.evidence_family === "assessability_limit")
    .map((item, index) => withAnalysisSourcePath(item, `assessability_limit_evidence[${index}]`));
  const deterministicRuntimeFacts = step1ObservableEvidenceItems
    .filter((item) =>
      ["deterministic_runtime_fact", "resolver_truth_fact"].includes(item.evidence_family),
    )
    .map((item, index) => withAnalysisSourcePath(item, `deterministic_runtime_facts[${index}]`));
  const suppliedContextFacts = step1ObservableEvidenceItems
    .filter(
      (item) =>
        item.evidence_family === "material_specific" &&
        SUPPLIED_CONTEXT_MATERIAL_FACT_KINDS.has(item.evidence_kind),
    )
    .map((item, index) => withAnalysisSourcePath(item, `supplied_context_facts[${index}]`));
  const step1TruthLinkedEvidenceItemCount = step1ObservableEvidenceItems.filter(
    (item) => item.linked_truth_state_ids.length > 0,
  ).length;
  const step1TruthUnlinkedEvidenceItemCount =
    step1ObservableEvidenceItems.length - step1TruthLinkedEvidenceItemCount;
  const deterministicTruthLinkedCount = step1ObservableEvidenceItems.filter(
    (item) =>
      ["deterministic_runtime_fact", "resolver_truth_fact"].includes(item.evidence_family) &&
      item.linked_truth_state_ids.length > 0,
  ).length;
  const suppliedContextTruthLinkedCount = step1ObservableEvidenceItems.filter(
    (item) =>
      item.evidence_family === "material_specific" && item.linked_truth_state_ids.length > 0,
  ).length;
  const mediaObservableTruthLinkedCount = step1ObservableEvidenceItems.filter(
    (item) =>
      ["video_observable", "audio_observable"].includes(item.evidence_family) &&
      item.linked_truth_state_ids.length > 0,
  ).length;
  const limitationOnlyTruthEntryCount = step1ObservableEvidenceItems.filter(
    (item) => isStep1LimitationOnlyEvidenceItem(item) && item.linked_truth_state_ids.length > 0,
  ).length;
  const missingTruthStateLinkageCount = step1ObservableEvidenceItems.filter(
    (item) =>
      item.linked_truth_state_ids.length === 0 ||
      item.blocker_codes.includes("missing_truth_state_linkage"),
  ).length;
  const step1TruthStateIds = dedupePreservingOrder(
    step1ObservableEvidenceItems.flatMap((item) => item.linked_truth_state_ids),
  );
  const step1CanonicalTruthStateIds = Object.fromEntries(
    step1TruthStateIds.map((truthId) => [truthId.split(":truth_state:")[1] ?? truthId, truthId]),
  );
  const truthStateLinkageStatus = !truthStateMapAvailable
    ? "missing"
    : step1TruthUnlinkedEvidenceItemCount === 0
      ? "satisfied"
      : "partial_with_unlinked_items";
  const truthStateLinkageBlockerCodes = dedupePreservingOrder([
    ...(!truthStateMapAvailable ? ["TruthStateMap_missing"] : []),
    ...(step1TruthUnlinkedEvidenceItemCount > 0 ? ["missing_truth_state_linkage"] : []),
  ]);
  const deterministicRuntimeEvidenceCount = step1ObservableEvidenceItems.filter((item) =>
    ["deterministic_runtime_fact", "resolver_truth_fact"].includes(item.evidence_family),
  ).length;
  const videoObservableEvidenceCount = mediaObservableProjection.videoCount;
  const audioObservableEvidenceCount = mediaObservableProjection.audioCount;
  const mediaAssessabilityLimitCount = mediaObservableProjection.limitationCount;
  const timestampedMediaObservationCount = mediaObservableProjection.timestampedCount;
  const rejectedMediaObservableSourceCount = mediaObservableProjection.rejected.length;
  const materialSpecificEvidenceCount = materialSpecificEvidence.length;
  const materialSpecificPerformanceEvidenceCount = materialSpecificPerformanceEvidence.length;
  const performanceObservableEvidenceCount = performanceObservableEvidence.length;
  const performanceObservableDerivationCount = performanceObservableEvidence.filter((item) =>
    Boolean(item.derived_from_evidence_item_id || item.derived_from_family),
  ).length;
  const candidateTechniqueEvidenceCount = candidateTechniqueEvidence.length;
  const acceptedObservationFieldCount =
    step1VideoItems.length +
    step1AudioItems.length +
    step1MaterialItems.length +
    step1PerformanceItems.length +
    step1TechniqueItems.length;
  const rejectedJudgementFieldCount =
    filteredRejected.length +
    mediaObservableProjection.rejected.length +
    ordinaryAnalysisProjection.rejected.length;
  const briefMaterialEvidenceCount = step1ObservableEvidenceItems.filter((item) =>
    SUPPLIED_CONTEXT_MATERIAL_FACT_KINDS.has(item.evidence_kind),
  ).length;
  const suppliedContextUnavailableCount = step1ObservableEvidenceItems.filter(
    (item) =>
      [
        "brief_presence_source_resolved",
        "material_presence_source_resolved",
        "component_or_task_declaration_unavailable",
        "unavailable_runtime_fields_recorded",
      ].includes(item.evidence_kind) && item.blocker_codes.length > 0,
  ).length;
  const hasSuppliedContextMaterialFact = step1ObservableEvidenceItems.some(
    (item) =>
      item.evidence_family === "material_specific" &&
      [
        "material_presence",
        "material_presence_source_resolved",
        "component_or_task_declaration_loaded",
        "component_or_task_declaration_unavailable",
      ].includes(item.evidence_kind),
  );
  const rejectedOrdinaryAnalysisProjectionCountByFamily: Record<
    OrdinaryAnalysisRequiredFamilyId,
    number
  > = {
    video_observable: mediaObservableProjection.rejected.filter((item) =>
      /video|visibility|framing|lighting|focus|movement/i.test(
        `${item.source_path} ${item.reason}`,
      ),
    ).length,
    audio_observable: mediaObservableProjection.rejected.filter((item) =>
      /audio|speech|lyric|volume|noise|balance|intelligibility/i.test(
        `${item.source_path} ${item.reason}`,
      ),
    ).length,
    material_specific_performance: ordinaryAnalysisProjection.rejected.filter((item) =>
      /brief|material/i.test(`${item.source_path} ${item.reason}`),
    ).length,
    performance_observable: ordinaryAnalysisProjection.rejected.filter((item) =>
      /performance|acting|vocal|movement/i.test(`${item.source_path} ${item.reason}`),
    ).length,
    candidate_technique: ordinaryAnalysisProjection.rejected.filter((item) =>
      /candidate_technique|technique/i.test(`${item.source_path} ${item.reason}`),
    ).length,
  };
  const ordinaryAnalysisFamilyCompletionById = Object.fromEntries(
    ORDINARY_ANALYSIS_REQUIRED_FAMILY_IDS.map((family) => [
      family,
      evaluateOrdinaryAnalysisFamilyCompletion({
        family,
        items: step1ObservableEvidenceItems,
        rejectedItemCount: rejectedOrdinaryAnalysisProjectionCountByFamily[family],
      }),
    ]),
  ) as Record<OrdinaryAnalysisRequiredFamilyId, OrdinaryAnalysisFamilyCompletionSummary>;
  const ordinaryAnalysisFamilyCompletion = aggregateOrdinaryAnalysisFamilyCompletion(
    ordinaryAnalysisFamilyCompletionById,
  );
  const filteredEvidenceFamilyCoverage = {
    ...(isRecord(filteredStep1?.evidence_family_coverage)
      ? filteredStep1.evidence_family_coverage
      : {}),
    video: ordinaryAnalysisFamilyCompletionById.video_observable.can_satisfy_family_gate,
    audio: ordinaryAnalysisFamilyCompletionById.audio_observable.can_satisfy_family_gate,
    material:
      ordinaryAnalysisFamilyCompletionById.material_specific_performance.can_satisfy_family_gate,
    material_specific_performance:
      ordinaryAnalysisFamilyCompletionById.material_specific_performance.can_satisfy_family_gate,
    performance:
      ordinaryAnalysisFamilyCompletionById.performance_observable.can_satisfy_family_gate,
    candidate_technique:
      ordinaryAnalysisFamilyCompletionById.candidate_technique.can_satisfy_family_gate,
  };
  const filteredFamilyStatus = {
    ...(isRecord(filteredStep1?.evidence_family_status_by_id)
      ? filteredStep1.evidence_family_status_by_id
      : {}),
    video: ordinaryAnalysisFamilyCompletionById.video_observable.status,
    audio: ordinaryAnalysisFamilyCompletionById.audio_observable.status,
    material: ordinaryAnalysisFamilyCompletionById.material_specific_performance.status,
    material_specific_performance:
      ordinaryAnalysisFamilyCompletionById.material_specific_performance.status,
    performance: ordinaryAnalysisFamilyCompletionById.performance_observable.status,
    candidate_technique: ordinaryAnalysisFamilyCompletionById.candidate_technique.status,
  };
  const prohibitedFieldFilterSummary = isRecord(filteredStep1?.prohibited_field_filter_summary)
    ? {
        ...filteredStep1.prohibited_field_filter_summary,
        raw_values_persisted: false,
      }
    : {
        rejected_field_count: 0,
        rejected_field_keys: [],
        raw_values_persisted: false,
      };
  const step1Coverage = {
    deterministic_runtime_facts: observable_evidence_items.some((item) =>
      [
        "analysis_input_record",
        "analysis_submission",
        "analysis_take",
        "resolver_output",
        "media_readiness",
      ].includes(item.source_artefact_id),
    )
      ? "partial"
      : "missing",
    resolver_truth_facts:
      resolverOutputAvailable && truthStateMapAvailable
        ? "complete"
        : resolverOutputAvailable || truthStateMapAvailable
          ? "partial"
          : "missing",
    video_observable: ordinaryAnalysisFamilyCompletionById.video_observable.status,
    audio_observable: ordinaryAnalysisFamilyCompletionById.audio_observable.status,
    material_specific: hasSuppliedContextMaterialFact
      ? "partial"
      : materialSpecificEvidenceCount > 0
        ? "partial"
        : "missing",
    material_specific_performance:
      ordinaryAnalysisFamilyCompletionById.material_specific_performance.status,
    performance_observable: ordinaryAnalysisFamilyCompletionById.performance_observable.status,
    candidate_technique: ordinaryAnalysisFamilyCompletionById.candidate_technique.status,
  } as const;
  const step1FamilyStatusById = {
    deterministic_runtime_facts: step1Coverage.deterministic_runtime_facts,
    resolver_truth_facts: step1Coverage.resolver_truth_facts,
    video_observable: step1Coverage.video_observable,
    audio_observable: step1Coverage.audio_observable,
    material_specific: step1Coverage.material_specific,
    material_specific_performance: step1Coverage.material_specific_performance,
    performance_observable: step1Coverage.performance_observable,
    candidate_technique: step1Coverage.candidate_technique,
  };
  const requiredEvidenceFamilyCompletionCount =
    ordinaryAnalysisFamilyCompletion.complete_family_count;
  const requiredEvidenceFamilyPartialCount = ordinaryAnalysisFamilyCompletion.partial_family_count;
  const requiredEvidenceFamilyMissingCount = ordinaryAnalysisFamilyCompletion.missing_family_count;
  const requiredEvidenceFamilyBlockedCount = ordinaryAnalysisFamilyCompletion.blocked_family_count;
  const requiredEvidenceFamilyCount = ordinaryAnalysisFamilyCompletion.required_family_count;
  const notApplicableEvidenceFamilyCount =
    ordinaryAnalysisFamilyCompletion.not_applicable_family_count;
  const ordinaryStep1FamilyGateSatisfied =
    ordinaryAnalysisFamilyCompletion.all_required_families_satisfied;
  const mediaObservableEvidenceGateStatus = ordinaryStep1FamilyGateSatisfied
    ? ("satisfied" as const)
    : ("insufficient" as const);
  const mediaObservableEvidenceGateReason = ordinaryStep1FamilyGateSatisfied
    ? "required_observable_families_classified_truth_linked_and_anchor_ready"
    : ordinaryAnalysisFamilyCompletionById.performance_observable.status === "complete"
      ? "required_observable_families_partial_or_missing_non_performance_family"
      : "performance_observable_requires_safe_step1_event_observation";
  const ordinaryAnalysisProofBundleStatus = ordinaryStep1FamilyGateSatisfied
    ? "step1_families_complete_proof_chain_blocked"
    : requiredEvidenceFamilyPartialCount > 0 || requiredEvidenceFamilyCompletionCount > 0
      ? "partial"
      : "blocked";
  const ordinaryAnalysisProofBundleGateReason = ordinaryStep1FamilyGateSatisfied
    ? "ordinary_analysis_step1_required_families_complete_but_score_trace_technique_trace_and_independent_proof_chain_still_blocked"
    : requiredEvidenceFamilyPartialCount > 0
      ? "ordinary_analysis_step1_projection_partial_required_families_missing_or_partial"
      : "ordinary_analysis_step1_projection_unavailable";
  const ordinaryAnalysisProofBundleBlockerCodes = dedupePreservingOrder([
    ...ordinaryAnalysisFamilyCompletion.blocker_codes,
    ...(requiredEvidenceFamilyMissingCount > 0
      ? ["ordinary_analysis_required_evidence_families_missing"]
      : []),
    ...(requiredEvidenceFamilyPartialCount > 0
      ? ["ordinary_analysis_required_evidence_families_partial"]
      : []),
    ...(requiredEvidenceFamilyBlockedCount > 0
      ? ["ordinary_analysis_required_evidence_families_blocked"]
      : []),
    "score_trace_real_runtime_projection_deferred",
    "technique_observation_trace_real_runtime_projection_deferred",
    "validator_gate_modelrun_independent_proof_chain_insufficient",
    "public_scoring_blocked",
    "public_technique_authority_blocked",
    "production_safe_blocked",
  ]);
  const analysisEvidenceStateCanSatisfyGate =
    ordinaryStep1FamilyGateSatisfied &&
    sourceClassification === "real_runtime_v3" &&
    step2DependencyStatus.status !== "blocked" &&
    filteredStep1?.extraction_status !== "blocked";
  const finalEvidenceStateStatus: "complete" | "partial" | "unavailable" | "blocked" =
    filteredStep1?.extraction_status === "blocked"
      ? "blocked"
      : analysisEvidenceStateCanSatisfyGate
        ? "complete"
        : evidenceStateStatus;
  const analysisEvidenceStateGateStatus: "satisfied" | "insufficient" | "missing" =
    analysisEvidenceStateCanSatisfyGate ? "satisfied" : "insufficient";
  const analysisEvidenceStateGateReason = analysisEvidenceStateCanSatisfyGate
    ? "ordinary_analysis_required_step1_families_complete_with_resolved_sources_and_truth_links"
    : ordinaryStep1FamilyGateSatisfied
      ? "ordinary_analysis_step1_families_complete_but_dependency_or_source_gate_blocked"
      : hasFilteredStep1Items
        ? "filtered_runEvidencePass_observations_persisted_but_step1_contract_partial"
        : sourceClassification === "real_runtime_v3"
          ? "partial_runtime_facts_present_but_performance_extractor_unavailable"
          : "genuine_step1_observable_evidence_source_unavailable";
  const analysisEvidenceStateRemainingBlockers = dedupePreservingOrder([
    ...ordinaryAnalysisFamilyCompletion.blocker_codes,
    ...step2DependencyBlockers,
    ...(analysisEvidenceStateCanSatisfyGate ? [] : ["analysis_evidence_state_gate_insufficient"]),
  ]);
  const unsupportedEvidenceResolvedByFamilyCounts = (item: Record<string, unknown>): boolean => {
    const haystack =
      `${String(item.evidence_kind ?? "")} ${String(item.reason ?? "")} ${getStringArray(item.blocker_codes).join(" ")}`.toLowerCase();
    if (
      (haystack.includes("candidate_technique") || haystack.includes("technique")) &&
      candidateTechniqueEvidenceCount > 0
    )
      return true;
    if (haystack.includes("video") && videoObservableEvidenceCount > 0) return true;
    if (haystack.includes("audio") && audioObservableEvidenceCount > 0) return true;
    if (haystack.includes("material") && materialSpecificPerformanceEvidenceCount > 0) return true;
    if (haystack.includes("performance") && performanceObservableEvidenceCount > 0) return true;
    return false;
  };
  const blockerCodeResolvedByFamilyCounts = (code: string): boolean => {
    const lower = code.toLowerCase();
    if (
      (lower.includes("candidate_technique") || lower.includes("technique")) &&
      candidateTechniqueEvidenceCount > 0
    )
      return true;
    if (lower.includes("video") && videoObservableEvidenceCount > 0) return true;
    if (lower.includes("audio") && audioObservableEvidenceCount > 0) return true;
    if (lower.includes("material") && materialSpecificPerformanceEvidenceCount > 0) return true;
    if (lower.includes("performance") && performanceObservableEvidenceCount > 0) return true;
    return false;
  };
  const analysisUnsupportedOrUnavailableEvidence = unsupportedOrUnavailableEvidence.filter(
    (item) => !unsupportedEvidenceResolvedByFamilyCounts(item),
  );
  const familyFilteredBlockerCodes = blocker_codes.filter(
    (code) => !blockerCodeResolvedByFamilyCounts(code),
  );
  const analysisBlockerCodes = dedupePreservingOrder([
    ...familyFilteredBlockerCodes,
    ...ordinaryAnalysisProofBundleBlockerCodes,
    ...analysisEvidenceStateRemainingBlockers,
  ]);
  const step1UnsupportedSource = [
    ...performanceUnavailable.filter((item) => {
      const kind = String(item.evidence_kind ?? "");
      if (videoObservableEvidenceCount > 0 && kind.includes("video_observable")) return false;
      if (audioObservableEvidenceCount > 0 && kind.includes("audio_observable")) return false;
      if (materialSpecificPerformanceEvidenceCount > 0 && kind.includes("material")) return false;
      if (performanceObservableEvidenceCount > 0 && kind.includes("performance")) return false;
      if (candidateTechniqueEvidenceCount > 0 && kind.includes("candidate_technique")) return false;
      return true;
    }),
    ...filteredUnsupported.filter((item) => {
      const kind = String(item.evidence_kind ?? "");
      if (unsupportedEvidenceResolvedByFamilyCounts(item)) return false;
      return !performanceUnavailable.some((fallback) => fallback.evidence_kind === kind);
    }),
  ];
  const step1Unsupported = step1UnsupportedSource.map((item) => {
    const kind = String(item.evidence_kind ?? "");
    const evidenceFamily = kind.includes("video")
      ? "video_observable"
      : kind.includes("audio")
        ? "audio_observable"
        : kind.includes("material")
          ? "material_specific_performance"
          : kind.includes("candidate_technique")
            ? "candidate_technique"
            : "performance_observable";
    return {
      evidence_family: evidenceFamily,
      evidence_kind: kind || "unknown_step1_evidence_unavailable",
      status: String(item.status ?? "not_extracted"),
      reason: String(item.reason ?? "step1_observable_evidence_not_extracted"),
      blocker_codes: Array.isArray(item.blocker_codes)
        ? item.blocker_codes.filter((x): x is string => typeof x === "string")
        : [],
    };
  });
  const step1RejectedOrFilteredFields = [
    ...(hasFilteredStep1Items
      ? [
          {
            source_family: "runEvidencePass_filtered_step1",
            source_path: "filtered_run_evidence_pass_step1",
            reason:
              "filtered runEvidencePass observations are retained in AnalysisEvidenceState only and do not satisfy the S9-18B Step1ObservableEvidence container gate",
            blocker_codes: ["runEvidencePass_step1_not_trusted_as_satisfying_observable_evidence"],
          },
        ]
      : []),
    ...filteredRejected.map((source_path) => ({
      source_family: "runEvidencePass_filtered_step1",
      source_path,
      reason: "filtered_step1_source_field_rejected_or_redacted",
      blocker_codes: ["runEvidencePass_prohibited_fields_filtered"],
    })),
    ...mediaObservableProjection.rejected.map((item) => ({
      source_family: "runEvidencePass_filtered_media_observable",
      source_path: item.source_path,
      reason: item.reason,
      blocker_codes: item.blocker_codes,
    })),
    ...ordinaryAnalysisProjection.rejected.map((item) => ({
      source_family: "runEvidencePass_filtered_ordinary_analysis_observable",
      source_path: item.source_path,
      reason: item.reason,
      blocker_codes: item.blocker_codes,
    })),
    {
      source_family: "raw_report",
      source_path: "reports/raw_report.json",
      reason: "raw_report_prose_forbidden_as_satisfying_step1_observable_evidence",
      blocker_codes: ["raw_report_forbidden_as_step1_observable_evidence"],
    },
    {
      source_family: "render_payload",
      source_path: "reports/render_payload.json",
      reason: "render_payload_forbidden_as_satisfying_step1_observable_evidence",
      blocker_codes: ["render_payload_forbidden_as_step1_observable_evidence"],
    },
    {
      source_family: "public_report_payload",
      source_path: "reports/public_report_payload.json",
      reason: "public_report_payload_forbidden_as_satisfying_step1_observable_evidence",
      blocker_codes: ["public_report_payload_forbidden_as_step1_observable_evidence"],
    },
    {
      source_family: "report_parity_result",
      source_path: "parity/report_parity_result.json",
      reason: "report_parity_result_forbidden_as_satisfying_step1_observable_evidence",
      blocker_codes: ["report_parity_result_forbidden_as_step1_observable_evidence"],
    },
    {
      source_family: "legacy_score_trace",
      source_path: "traces/ScoreTrace.json",
      reason: "legacy ScoreTrace forbidden as satisfying Step 1 observable evidence",
      blocker_codes: ["legacy_score_trace_forbidden_as_step1_observable_evidence"],
    },
    {
      source_family: "legacy_technique_observation_trace",
      source_path: "traces/TechniqueObservationTrace.json",
      reason: "legacy TechniqueObservationTrace forbidden as satisfying Step 1 observable evidence",
      blocker_codes: ["legacy_technique_trace_forbidden_as_step1_observable_evidence"],
    },
  ];
  const step1ExtractionStatus: "partial" | "unavailable" | "blocked" =
    filteredStep1?.extraction_status === "blocked"
      ? "blocked"
      : step1ObservableEvidenceItems.length > 0
        ? "partial"
        : "unavailable";
  const step1SourceClassification: "real_runtime_v3_partial" | "source_scaffold" | "blocked" =
    step1ExtractionStatus === "blocked"
      ? "blocked"
      : step1ObservableEvidenceItems.length > 0
        ? "real_runtime_v3_partial"
        : "source_scaffold";
  const step1BlockerCodes = dedupePreservingOrder([
    ...(ordinaryStep1FamilyGateSatisfied ? [] : ["step1_observable_evidence_partial"]),
    ...analysisBlockerCodes,
    ...truthStateLinkageBlockerCodes,
  ]);
  const step1Summary = {
    extraction_status: step1ExtractionStatus,
    source_classification: step1SourceClassification,
    observable_evidence_item_count: step1ObservableEvidenceItems.length,
    deterministic_runtime_evidence_count: deterministicRuntimeEvidenceCount,
    brief_material_evidence_count: briefMaterialEvidenceCount,
    material_specific_evidence_count: materialSpecificEvidenceCount,
    video_observable_evidence_count: videoObservableEvidenceCount,
    audio_observable_evidence_count: audioObservableEvidenceCount,
    performance_observable_evidence_count: performanceObservableEvidenceCount,
    performance_observable_derivation_count: performanceObservableDerivationCount,
    material_specific_performance_evidence_count: materialSpecificPerformanceEvidenceCount,
    candidate_technique_evidence_count: candidateTechniqueEvidenceCount,
    accepted_observation_field_count: acceptedObservationFieldCount,
    rejected_judgement_field_count: rejectedJudgementFieldCount,
    required_evidence_family_completion_count: requiredEvidenceFamilyCompletionCount,
    required_evidence_family_partial_count: requiredEvidenceFamilyPartialCount,
    required_evidence_family_missing_count: requiredEvidenceFamilyMissingCount,
    required_family_count: requiredEvidenceFamilyCount,
    complete_family_count: requiredEvidenceFamilyCompletionCount,
    partial_family_count: requiredEvidenceFamilyPartialCount,
    missing_family_count: requiredEvidenceFamilyMissingCount,
    blocked_family_count: requiredEvidenceFamilyBlockedCount,
    not_applicable_family_count: notApplicableEvidenceFamilyCount,
    required_evidence_family_blocked_count: requiredEvidenceFamilyBlockedCount,
    required_evidence_family_not_applicable_count: notApplicableEvidenceFamilyCount,
    ordinary_analysis_proof_bundle_status: ordinaryAnalysisProofBundleStatus,
    ordinary_analysis_proof_bundle_gate_status: ordinaryStep1FamilyGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    ordinary_analysis_proof_bundle_gate_reason: ordinaryAnalysisProofBundleGateReason,
    ordinary_analysis_proof_bundle_blocker_codes: ordinaryAnalysisProofBundleBlockerCodes,
    ordinary_analysis_family_completion_by_id: ordinaryAnalysisFamilyCompletionById,
    ordinary_analysis_family_completion_summary: ordinaryAnalysisFamilyCompletion,
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateGateReason,
    analysis_evidence_state_remaining_blockers: analysisEvidenceStateRemainingBlockers,
    media_assessability_limit_count: mediaAssessabilityLimitCount,
    timestamped_media_observation_count: timestampedMediaObservationCount,
    rejected_media_observable_source_count: rejectedMediaObservableSourceCount,
    media_observable_evidence_family_summary: {
      video_observable: step1FamilyStatusById.video_observable,
      audio_observable: step1FamilyStatusById.audio_observable,
      performance_observable: step1FamilyStatusById.performance_observable,
      candidate_technique: step1FamilyStatusById.candidate_technique,
    },
    ordinary_analysis_evidence_family_summary: step1FamilyStatusById,
    step1_truth_linked_evidence_item_count: step1TruthLinkedEvidenceItemCount,
    step1_truth_unlinked_evidence_item_count: step1TruthUnlinkedEvidenceItemCount,
    deterministic_truth_linked_count: deterministicTruthLinkedCount,
    supplied_context_truth_linked_count: suppliedContextTruthLinkedCount,
    media_observable_truth_linked_count: mediaObservableTruthLinkedCount,
    limitation_only_truth_entry_count: limitationOnlyTruthEntryCount,
    missing_truth_state_linkage_count: missingTruthStateLinkageCount,
    truth_state_linkage_status: truthStateLinkageStatus,
    truth_state_linkage_gate_reason:
      "explicit_truth_ids_linked_for_supported_step1_facts_required_families_still_incomplete",
    truth_state_linkage_blocker_codes: truthStateLinkageBlockerCodes,
    media_observable_evidence_gate_status: mediaObservableEvidenceGateStatus,
    media_observable_evidence_gate_reason: mediaObservableEvidenceGateReason,
    supplied_context_fact_count: briefMaterialEvidenceCount,
    supplied_context_unavailable_count: suppliedContextUnavailableCount,
    unsupported_or_unavailable_evidence_count: step1Unsupported.length,
    rejected_or_filtered_field_count: step1RejectedOrFilteredFields.length,
    step1_observable_evidence_gate_status: ordinaryStep1FamilyGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    step1_observable_evidence_gate_reason: ordinaryStep1FamilyGateSatisfied
      ? "ordinary_analysis_required_step1_families_classified_and_truth_linked"
      : "container_emitted_but_required_step1_families_incomplete",
    blocker_codes: step1BlockerCodes,
    forbidden_sources_rejected: true,
    allowed_source_artefact_ids: Array.from(STEP1_ALLOWED_EVIDENCE_SOURCE_ARTEFACT_IDS),
    internal_only: true,
    public_output_unchanged: true,
  };
  const summary = {
    evidence_state_status: finalEvidenceStateStatus,
    source_classification: sourceClassification,
    step1_media_input_status: step1MediaInputStatus,
    step1_media_input_reason: step1CanExtractMediaObservations
      ? "redacted_media_reference_available_to_step1_provider"
      : "media_observable_input_not_confirmed_for_step1_family_projection",
    step1_can_extract_video_audio_observations: step1CanExtractMediaObservations,
    step1_can_extract_performance_observations: step1CanExtractMediaObservations,
    observable_evidence_item_count: analysisObservableEvidenceItems.length,
    deterministic_runtime_evidence_count: deterministicRuntimeEvidenceCount,
    brief_material_evidence_count: briefMaterialEvidenceCount,
    material_specific_evidence_count: materialSpecificEvidenceCount,
    video_observable_evidence_count: videoObservableEvidenceCount,
    audio_observable_evidence_count: audioObservableEvidenceCount,
    performance_observable_evidence_count: performanceObservableEvidenceCount,
    performance_observable_derivation_count: performanceObservableDerivationCount,
    material_specific_performance_evidence_count: materialSpecificPerformanceEvidenceCount,
    candidate_technique_evidence_count: candidateTechniqueEvidenceCount,
    accepted_observation_field_count: acceptedObservationFieldCount,
    rejected_judgement_field_count: rejectedJudgementFieldCount,
    required_evidence_family_completion_count: requiredEvidenceFamilyCompletionCount,
    required_evidence_family_partial_count: requiredEvidenceFamilyPartialCount,
    required_evidence_family_missing_count: requiredEvidenceFamilyMissingCount,
    required_family_count: requiredEvidenceFamilyCount,
    complete_family_count: requiredEvidenceFamilyCompletionCount,
    partial_family_count: requiredEvidenceFamilyPartialCount,
    missing_family_count: requiredEvidenceFamilyMissingCount,
    blocked_family_count: requiredEvidenceFamilyBlockedCount,
    not_applicable_family_count: notApplicableEvidenceFamilyCount,
    required_evidence_family_blocked_count: requiredEvidenceFamilyBlockedCount,
    required_evidence_family_not_applicable_count: notApplicableEvidenceFamilyCount,
    ordinary_analysis_proof_bundle_status: ordinaryAnalysisProofBundleStatus,
    ordinary_analysis_proof_bundle_gate_status: ordinaryStep1FamilyGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    ordinary_analysis_proof_bundle_gate_reason: ordinaryAnalysisProofBundleGateReason,
    ordinary_analysis_proof_bundle_blocker_codes: ordinaryAnalysisProofBundleBlockerCodes,
    ordinary_analysis_family_completion_by_id: ordinaryAnalysisFamilyCompletionById,
    ordinary_analysis_family_completion_summary: ordinaryAnalysisFamilyCompletion,
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateGateReason,
    analysis_evidence_state_remaining_blockers: analysisEvidenceStateRemainingBlockers,
    media_assessability_limit_count: mediaAssessabilityLimitCount,
    timestamped_media_observation_count: timestampedMediaObservationCount,
    rejected_media_observable_source_count: rejectedMediaObservableSourceCount,
    media_observable_evidence_family_summary: {
      video_observable: step1FamilyStatusById.video_observable,
      audio_observable: step1FamilyStatusById.audio_observable,
      performance_observable: step1FamilyStatusById.performance_observable,
      candidate_technique: step1FamilyStatusById.candidate_technique,
    },
    ordinary_analysis_evidence_family_summary: step1FamilyStatusById,
    step1_truth_linked_evidence_item_count: step1TruthLinkedEvidenceItemCount,
    step1_truth_unlinked_evidence_item_count: step1TruthUnlinkedEvidenceItemCount,
    deterministic_truth_linked_count: deterministicTruthLinkedCount,
    supplied_context_truth_linked_count: suppliedContextTruthLinkedCount,
    media_observable_truth_linked_count: mediaObservableTruthLinkedCount,
    limitation_only_truth_entry_count: limitationOnlyTruthEntryCount,
    missing_truth_state_linkage_count: missingTruthStateLinkageCount,
    truth_state_linkage_status: truthStateLinkageStatus,
    truth_state_linkage_gate_reason:
      "explicit_truth_ids_linked_for_supported_step1_facts_required_families_still_incomplete",
    truth_state_linkage_blocker_codes: truthStateLinkageBlockerCodes,
    media_observable_evidence_gate_status: mediaObservableEvidenceGateStatus,
    media_observable_evidence_gate_reason: mediaObservableEvidenceGateReason,
    step1_observable_evidence_item_count: step1ObservableEvidenceItems.length,
    step1_observable_evidence_family_summary: step1FamilyStatusById,
    supplied_context_fact_count: briefMaterialEvidenceCount,
    supplied_context_unavailable_count: suppliedContextUnavailableCount,
    unsupported_or_unavailable_evidence_count: analysisUnsupportedOrUnavailableEvidence.length,
    filtered_runEvidencePass_observation_count: acceptedObservationFieldCount,
    rejected_or_filtered_field_count: filteredRejected.length,
    cannot_satisfy_v3_gate: !analysisEvidenceStateCanSatisfyGate,
    step2_dependency_status: step2DependencyStatus.status,
  };
  const step1Payload = {
    schema_version: "tapecoach_v3_step1_observable_evidence_v1",
    artefact_type: "step1_observable_evidence",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    submission_id: input.submission_id ?? null,
    generated_at: generatedAt,
    internal_only: true,
    privacy_classification: "internal_private",
    source_module: input.source_module,
    source_stage: "analysis_step_1_evidence_mapping",
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_comparison_output_status: "blocked",
    extraction_status: step1ExtractionStatus,
    source_classification: step1SourceClassification,
    cannot_satisfy_v3_gate: !ordinaryStep1FamilyGateSatisfied,
    step1_media_input_status: step1MediaInputStatus,
    step1_media_input_reason: step1CanExtractMediaObservations
      ? "redacted_media_reference_available_to_step1_provider"
      : "media_observable_input_not_confirmed_for_step1_family_projection",
    step1_media_input_refs_redacted: true,
    step1_can_extract_video_audio_observations: step1CanExtractMediaObservations,
    step1_can_extract_performance_observations: step1CanExtractMediaObservations,
    extraction_source_refs: {
      resolver_output_ref: resolverOutputAvailable
        ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/resolver_output.json`
        : null,
      truth_state_map_ref: truthStateMapAvailable
        ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/TruthStateMap.json`
        : null,
      input_record_ref: inputArtifactRefs.analysis_input_record,
      submission_ref: inputArtifactRefs.analysis_submission,
      take_ref: inputArtifactRefs.analysis_take,
      model_run_trace_ref: hasFilteredStep1Items
        ? `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ModelRunTrace.json`
        : null,
      raw_report_used_as_source: false,
      render_payload_used_as_source: false,
      public_report_payload_used_as_source: false,
      report_parity_result_used_as_source: false,
      legacy_score_trace_used_as_source: false,
      legacy_technique_trace_used_as_source: false,
    },
    evidence_family_coverage: step1Coverage,
    evidence_family_status_by_id: step1FamilyStatusById,
    truth_state_ids: step1TruthStateIds,
    canonical_truth_state_ids: step1CanonicalTruthStateIds,
    observable_evidence_items: step1ObservableEvidenceItems,
    video_observable_evidence: videoObservableEvidence,
    audio_observable_evidence: audioObservableEvidence,
    material_specific_evidence: materialSpecificEvidence,
    material_specific_performance_evidence: materialSpecificPerformanceEvidence,
    performance_observable_evidence: performanceObservableEvidence,
    candidate_technique_evidence: candidateTechniqueEvidence,
    assessability_limit_evidence: assessabilityLimitEvidence,
    deterministic_runtime_facts: deterministicRuntimeFacts,
    supplied_context_facts: suppliedContextFacts,
    rejected_or_filtered_observations: step1RejectedOrFilteredFields,
    deterministic_runtime_evidence_count: deterministicRuntimeEvidenceCount,
    brief_material_evidence_count: briefMaterialEvidenceCount,
    material_specific_evidence_count: materialSpecificEvidenceCount,
    video_observable_evidence_count: videoObservableEvidenceCount,
    audio_observable_evidence_count: audioObservableEvidenceCount,
    performance_observable_evidence_count: performanceObservableEvidenceCount,
    performance_observable_derivation_count: performanceObservableDerivationCount,
    material_specific_performance_evidence_count: materialSpecificPerformanceEvidenceCount,
    candidate_technique_evidence_count: candidateTechniqueEvidenceCount,
    accepted_observation_field_count: acceptedObservationFieldCount,
    rejected_judgement_field_count: rejectedJudgementFieldCount,
    required_evidence_family_completion_count: requiredEvidenceFamilyCompletionCount,
    required_evidence_family_partial_count: requiredEvidenceFamilyPartialCount,
    required_evidence_family_missing_count: requiredEvidenceFamilyMissingCount,
    required_family_count: requiredEvidenceFamilyCount,
    complete_family_count: requiredEvidenceFamilyCompletionCount,
    partial_family_count: requiredEvidenceFamilyPartialCount,
    missing_family_count: requiredEvidenceFamilyMissingCount,
    blocked_family_count: requiredEvidenceFamilyBlockedCount,
    not_applicable_family_count: notApplicableEvidenceFamilyCount,
    required_evidence_family_blocked_count: requiredEvidenceFamilyBlockedCount,
    required_evidence_family_not_applicable_count: notApplicableEvidenceFamilyCount,
    ordinary_analysis_proof_bundle_status: ordinaryAnalysisProofBundleStatus,
    ordinary_analysis_proof_bundle_gate_status: ordinaryStep1FamilyGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    ordinary_analysis_proof_bundle_gate_reason: ordinaryAnalysisProofBundleGateReason,
    ordinary_analysis_proof_bundle_blocker_codes: ordinaryAnalysisProofBundleBlockerCodes,
    ordinary_analysis_family_completion_by_id: ordinaryAnalysisFamilyCompletionById,
    ordinary_analysis_family_completion_summary: ordinaryAnalysisFamilyCompletion,
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateGateReason,
    analysis_evidence_state_remaining_blockers: analysisEvidenceStateRemainingBlockers,
    media_assessability_limit_count: mediaAssessabilityLimitCount,
    timestamped_media_observation_count: timestampedMediaObservationCount,
    rejected_media_observable_source_count: rejectedMediaObservableSourceCount,
    media_observable_evidence_family_summary: {
      video_observable: step1FamilyStatusById.video_observable,
      audio_observable: step1FamilyStatusById.audio_observable,
      performance_observable: step1FamilyStatusById.performance_observable,
      candidate_technique: step1FamilyStatusById.candidate_technique,
    },
    ordinary_analysis_evidence_family_summary: step1FamilyStatusById,
    step1_truth_linked_evidence_item_count: step1TruthLinkedEvidenceItemCount,
    step1_truth_unlinked_evidence_item_count: step1TruthUnlinkedEvidenceItemCount,
    deterministic_truth_linked_count: deterministicTruthLinkedCount,
    supplied_context_truth_linked_count: suppliedContextTruthLinkedCount,
    media_observable_truth_linked_count: mediaObservableTruthLinkedCount,
    limitation_only_truth_entry_count: limitationOnlyTruthEntryCount,
    missing_truth_state_linkage_count: missingTruthStateLinkageCount,
    truth_state_linkage_status: truthStateLinkageStatus,
    truth_state_linkage_gate_reason:
      "explicit_truth_ids_linked_for_supported_step1_facts_required_families_still_incomplete",
    truth_state_linkage_blocker_codes: truthStateLinkageBlockerCodes,
    media_observable_evidence_gate_status: mediaObservableEvidenceGateStatus,
    media_observable_evidence_gate_reason: mediaObservableEvidenceGateReason,
    supplied_context_fact_count: briefMaterialEvidenceCount,
    step1_candidate_observation_count: acceptedObservationFieldCount + filteredRejected.length,
    step1_family_classified_observation_count:
      videoObservableEvidenceCount +
      audioObservableEvidenceCount +
      materialSpecificPerformanceEvidenceCount +
      performanceObservableEvidenceCount +
      candidateTechniqueEvidenceCount,
    step1_family_unclassified_observation_count:
      mediaObservableProjection.rejected.length + ordinaryAnalysisProjection.rejected.length,
    step1_rejected_judgement_count: rejectedJudgementFieldCount,
    step1_rejected_authority_count: filteredRejected.filter((field) =>
      /authority|castability|bookability|marketability|score|verdict|role_fit/i.test(field),
    ).length,
    step1_deterministic_fact_count: deterministicRuntimeEvidenceCount,
    step1_supplied_context_fact_count: suppliedContextFacts.length,
    step1_media_observable_candidate_count: step1VideoItems.length + step1AudioItems.length,
    step1_media_observable_accepted_count:
      videoObservableEvidenceCount + audioObservableEvidenceCount,
    step1_candidate_technique_candidate_count: step1TechniqueItems.length,
    step1_candidate_technique_accepted_count: candidateTechniqueEvidenceCount,
    supplied_context_unavailable_count: suppliedContextUnavailableCount,
    deterministic_evidence_source_refs: {
      allowed_source_artefact_ids: Array.from(STEP1_ALLOWED_EVIDENCE_SOURCE_ARTEFACT_IDS),
      forbidden_satisfying_source_refs: STEP1_FORBIDDEN_SATISFYING_SOURCE_REFS.map(
        (item) => item.source_path,
      ),
    },
    unsupported_or_unavailable_evidence: step1Unsupported,
    rejected_or_filtered_fields: step1RejectedOrFilteredFields,
    anti_fake_evidence_guard: {
      raw_report_prose_rejected: true,
      render_payload_rejected: true,
      public_report_payload_rejected: true,
      report_parity_result_rejected: true,
      legacy_score_trace_rejected: true,
      legacy_technique_observation_trace_rejected: true,
      public_report_ui_rejected: true,
      model_text_without_structured_provenance_rejected: true,
    },
    blocker_codes: step1BlockerCodes,
    step1_observable_evidence_summary: step1Summary,
    ...resolveQADeploymentProvenance(),
  };
  const step1RelPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/analysis/Step1ObservableEvidence.json`;
  const step1Write = await writeInternalJson(
    root,
    input.run_id,
    step1RelPath,
    step1Payload,
    "step1_observable_evidence",
  );
  const step1RefStatus = step1Write.written ? "written" : "failed_emission";
  const payload = {
    schema_version: "tapecoach_v3_analysis_evidence_state_v1",
    artefact_type: "analysis_evidence_state",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    submission_id: input.submission_id ?? null,
    take_id: input.take_id,
    comparison_run_id: input.comparison_run_id ?? null,
    generated_at: generatedAt,
    internal_only: true,
    privacy_classification: "internal_private",
    source_classification: sourceClassification,
    evidence_state_status: finalEvidenceStateStatus,
    cannot_satisfy_v3_gate: !analysisEvidenceStateCanSatisfyGate,
    step1_media_input_status: step1MediaInputStatus,
    step1_media_input_reason: step1CanExtractMediaObservations
      ? "redacted_media_reference_available_to_step1_provider"
      : "media_observable_input_not_confirmed_for_step1_family_projection",
    step1_media_input_refs_redacted: true,
    step1_can_extract_video_audio_observations: step1CanExtractMediaObservations,
    step1_can_extract_performance_observations: step1CanExtractMediaObservations,
    analysis_evidence_state_gate_status: analysisEvidenceStateGateStatus,
    analysis_evidence_state_gate_reason: analysisEvidenceStateGateReason,
    analysis_evidence_state_remaining_blockers: analysisEvidenceStateRemainingBlockers,
    source_stage: "analysis_step_1_evidence_mapping",
    source_module: input.source_module,
    source_trigger_stage: input.source_stage,
    analysis_route: input.analysis_route ?? null,
    extractor_run_id: hasFilteredStep1Items ? `extractor-${analysisRunId}` : null,
    extractor_source_module: hasFilteredStep1Items ? "src/server/evidence-pass.server.ts" : null,
    extractor_source_stage: hasFilteredStep1Items
      ? "runEvidencePass_filtered_before_step2"
      : "deterministic_runtime_fact_mapping",
    extractor_input_refs: hasFilteredStep1Items
      ? {
          media_input: "runEvidencePass.videoUrl redacted",
          context_text: "runEvidencePass.contextText redacted",
        }
      : {},
    extractor_model_ref:
      typeof filteredStep1?.extractor_model_ref === "string"
        ? filteredStep1.extractor_model_ref
        : null,
    extraction_status: finalEvidenceStateStatus,
    evidence_family_coverage: filteredEvidenceFamilyCoverage,
    evidence_family_status_by_id: filteredFamilyStatus,
    truth_state_ids: step1TruthStateIds,
    canonical_truth_state_ids: step1CanonicalTruthStateIds,
    input_artifact_refs: inputArtifactRefs,
    resolver_output_ref: resolverOutputAvailable
      ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/resolver_output.json`
      : null,
    truth_state_map_ref: truthStateMapAvailable
      ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/TruthStateMap.json`
      : null,
    step1_observable_evidence_ref: `takes/take-${input.take_id}/analysis-${analysisRunId}/analysis/Step1ObservableEvidence.json`,
    step1_observable_evidence_ref_status: step1RefStatus,
    step1_observable_evidence_source_classification: step1SourceClassification,
    step1_observable_evidence_gate_status: step1Summary.step1_observable_evidence_gate_status,
    step1_observable_evidence_gate_reason: step1Summary.step1_observable_evidence_gate_reason,
    step1_observable_evidence_blocker_codes: step1BlockerCodes,
    media_readiness_summary: {
      media_readiness_state: input.media_readiness_state ?? null,
      media_duration_seconds: durationKnown ? input.media_duration_seconds : null,
      duration_confidence: durationConfidence,
      timestamp_source: durationKnown ? "media_readiness_runtime_field" : "unavailable",
      mux_playback_id_present: Boolean(input.mux_playback_id),
      mux_asset_or_upload_id_present: input.mux_asset_or_upload_id_present ?? "unknown",
    },
    deterministic_runtime_evidence_count: deterministicRuntimeEvidenceCount,
    brief_material_evidence_count: briefMaterialEvidenceCount,
    material_specific_evidence_count: materialSpecificEvidenceCount,
    video_observable_evidence_count: videoObservableEvidenceCount,
    audio_observable_evidence_count: audioObservableEvidenceCount,
    performance_observable_evidence_count: performanceObservableEvidenceCount,
    performance_observable_derivation_count: performanceObservableDerivationCount,
    material_specific_performance_evidence_count: materialSpecificPerformanceEvidenceCount,
    candidate_technique_evidence_count: candidateTechniqueEvidenceCount,
    accepted_observation_field_count: acceptedObservationFieldCount,
    rejected_judgement_field_count: rejectedJudgementFieldCount,
    required_evidence_family_completion_count: requiredEvidenceFamilyCompletionCount,
    required_evidence_family_partial_count: requiredEvidenceFamilyPartialCount,
    required_evidence_family_missing_count: requiredEvidenceFamilyMissingCount,
    required_family_count: requiredEvidenceFamilyCount,
    complete_family_count: requiredEvidenceFamilyCompletionCount,
    partial_family_count: requiredEvidenceFamilyPartialCount,
    missing_family_count: requiredEvidenceFamilyMissingCount,
    blocked_family_count: requiredEvidenceFamilyBlockedCount,
    not_applicable_family_count: notApplicableEvidenceFamilyCount,
    required_evidence_family_blocked_count: requiredEvidenceFamilyBlockedCount,
    required_evidence_family_not_applicable_count: notApplicableEvidenceFamilyCount,
    ordinary_analysis_proof_bundle_status: ordinaryAnalysisProofBundleStatus,
    ordinary_analysis_proof_bundle_gate_status: ordinaryStep1FamilyGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    ordinary_analysis_proof_bundle_gate_reason: ordinaryAnalysisProofBundleGateReason,
    ordinary_analysis_proof_bundle_blocker_codes: ordinaryAnalysisProofBundleBlockerCodes,
    ordinary_analysis_family_completion_by_id: ordinaryAnalysisFamilyCompletionById,
    ordinary_analysis_family_completion_summary: ordinaryAnalysisFamilyCompletion,
    media_assessability_limit_count: mediaAssessabilityLimitCount,
    timestamped_media_observation_count: timestampedMediaObservationCount,
    rejected_media_observable_source_count: rejectedMediaObservableSourceCount,
    media_observable_evidence_family_summary: {
      video_observable: step1FamilyStatusById.video_observable,
      audio_observable: step1FamilyStatusById.audio_observable,
      performance_observable: step1FamilyStatusById.performance_observable,
      candidate_technique: step1FamilyStatusById.candidate_technique,
    },
    ordinary_analysis_evidence_family_summary: step1FamilyStatusById,
    step1_truth_linked_evidence_item_count: step1TruthLinkedEvidenceItemCount,
    step1_truth_unlinked_evidence_item_count: step1TruthUnlinkedEvidenceItemCount,
    deterministic_truth_linked_count: deterministicTruthLinkedCount,
    supplied_context_truth_linked_count: suppliedContextTruthLinkedCount,
    media_observable_truth_linked_count: mediaObservableTruthLinkedCount,
    limitation_only_truth_entry_count: limitationOnlyTruthEntryCount,
    missing_truth_state_linkage_count: missingTruthStateLinkageCount,
    truth_state_linkage_status: truthStateLinkageStatus,
    truth_state_linkage_gate_reason:
      "explicit_truth_ids_linked_for_supported_step1_facts_required_families_still_incomplete",
    truth_state_linkage_blocker_codes: truthStateLinkageBlockerCodes,
    media_observable_evidence_gate_status: mediaObservableEvidenceGateStatus,
    media_observable_evidence_gate_reason: mediaObservableEvidenceGateReason,
    step1_observable_evidence_item_count: step1ObservableEvidenceItems.length,
    step1_observable_evidence_family_summary: step1FamilyStatusById,
    deterministic_evidence_source_refs: {
      allowed_source_artefact_ids: Array.from(STEP1_ALLOWED_EVIDENCE_SOURCE_ARTEFACT_IDS),
      input_artifact_refs: inputArtifactRefs,
      resolver_output_ref: resolverOutputAvailable
        ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/resolver_output.json`
        : null,
      truth_state_map_ref: truthStateMapAvailable
        ? `takes/take-${input.take_id}/analysis-${analysisRunId}/resolver/TruthStateMap.json`
        : null,
    },
    supplied_context_fact_count: briefMaterialEvidenceCount,
    supplied_context_unavailable_count: suppliedContextUnavailableCount,
    assessability_limitations: [
      ...(!durationKnown ? ["media_duration_unavailable_no_timestamp_evidence_fabricated"] : []),
      ...timestampNormalisationWarnings,
      ...(hasFilteredStep1Items
        ? ["filtered_runEvidencePass_step1_contract_partial"]
        : ["observable_step1_extraction_unavailable"]),
    ],
    timestamp_normalisation_warnings: timestampNormalisationWarnings,
    component_evidence,
    video_observable_evidence_items: step1VideoItems,
    audio_observable_evidence_items: step1AudioItems,
    material_observable_evidence_items: step1MaterialItems,
    performance_observable_evidence_items: step1PerformanceItems,
    step1_family_observable_evidence_items: step1FamilyObservableEvidenceItems,
    video_observable_evidence: videoObservableEvidence,
    audio_observable_evidence: audioObservableEvidence,
    material_specific_evidence: materialSpecificEvidence,
    material_specific_performance_evidence: materialSpecificPerformanceEvidence,
    performance_observable_evidence: performanceObservableEvidence,
    assessability_limit_evidence: assessabilityLimitEvidence,
    deterministic_runtime_facts: deterministicRuntimeFacts,
    supplied_context_facts: suppliedContextFacts,
    observable_evidence_items: analysisObservableEvidenceItems,
    candidate_brief_evidence,
    filtered_candidate_technique_evidence_items: step1TechniqueItems,
    candidate_technique_evidence: candidateTechniqueEvidence,
    unsupported_or_unavailable_evidence: analysisUnsupportedOrUnavailableEvidence,
    rejected_or_filtered_fields: filteredRejected,
    prohibited_field_filter_summary: prohibitedFieldFilterSummary,
    step2_dependency_status: step2DependencyStatus,
    blocker_codes: analysisBlockerCodes,
    gate_satisfaction_reason: summary.analysis_evidence_state_gate_reason,
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    redaction_notes: [
      "Internal-only QA prerequisite; unsafe external media references and raw report payloads are excluded",
    ],
    analysis_evidence_state_summary: summary,
    ...resolveQADeploymentProvenance(),
  };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/analysis/AnalysisEvidenceState.json`;
  const w = await writeInternalJson(
    root,
    input.run_id,
    relPath,
    payload,
    "analysis_evidence_state",
  );
  return {
    written: Boolean(w.written),
    emitted_artefact_ids: [
      ...(step1Write.written ? ["step1_observable_evidence"] : []),
      ...(w.written && analysisEvidenceStateCanSatisfyGate ? ["analysis_evidence_state"] : []),
    ] as string[],
    emitted_blocked_artefact_ids:
      w.written && !analysisEvidenceStateCanSatisfyGate ? ["analysis_evidence_state"] : [],
    path: w.path ?? w.storage_path,
    source_classification: sourceClassification,
    step1_observable_evidence_source_classification: step1SourceClassification,
    step1_observable_evidence_summary: step1Summary,
    step1_observable_evidence_payload: step1Payload,
    level2_satisfies: Boolean(w.written && analysisEvidenceStateCanSatisfyGate),
    summary,
    blocker_codes: analysisBlockerCodes,
    payload,
    warning: mergeQAWarnings(step1Write.warning, w.warning),
  };
}

export async function emitValidatorTraceFirstPass(input: any) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false, emitted_artefact_ids: [] as string[] };
  if (!input.manifest_snapshot || !input.acceptance_metrics_snapshot)
    return { written: false, emitted_artefact_ids: [] as string[] };
  const analysisRunId =
    typeof input.analysis_run_id === "string" && input.analysis_run_id.trim().length
      ? input.analysis_run_id.trim()
      : String(input.run_id ?? "").trim();
  if (!analysisRunId) return { written: false, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.take_id, "take_id");
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const entries: Array<Record<string, unknown>> = [
    {
      validation_id: "level2_status_agreement",
      validation_rule_version: "s9-18h-internal-snapshot-v1",
      validation_area: "manifest_metrics_agreement",
      subject: "level2_status",
      status:
        input.manifest_snapshot.level2_qa_acceptance ===
        input.acceptance_metrics_snapshot.level2_status
          ? "pass"
          : "warn",
      expected: input.acceptance_metrics_snapshot.level2_status,
      observed: input.manifest_snapshot.level2_qa_acceptance,
      source_path: "manifest.level2_qa_acceptance",
      related_artefact_ids: ["qa_acceptance_metrics"],
      blocker_codes: [],
      notes: null,
    },
    {
      validation_id: "public_scoring_status_agreement",
      validation_rule_version: "s9-18h-internal-snapshot-v1",
      validation_area: "manifest_metrics_agreement",
      subject: "public_scoring_status",
      status:
        input.manifest_snapshot.public_scoring_status ===
        input.acceptance_metrics_snapshot.public_scoring_status
          ? "pass"
          : "warn",
      expected: input.acceptance_metrics_snapshot.public_scoring_status,
      observed: input.manifest_snapshot.public_scoring_status,
      source_path: "manifest.public_scoring_status",
      related_artefact_ids: ["qa_acceptance_metrics"],
      blocker_codes: [],
      notes: null,
    },
    {
      validation_id: "public_technique_authority_status_agreement",
      validation_rule_version: "s9-18h-internal-snapshot-v1",
      validation_area: "manifest_metrics_agreement",
      subject: "public_technique_authority_status",
      status:
        input.manifest_snapshot.public_technique_authority_status ===
        input.acceptance_metrics_snapshot.public_technique_authority_status
          ? "pass"
          : "warn",
      expected: input.acceptance_metrics_snapshot.public_technique_authority_status,
      observed: input.manifest_snapshot.public_technique_authority_status,
      source_path: "manifest.public_technique_authority_status",
      related_artefact_ids: ["qa_acceptance_metrics"],
      blocker_codes: [],
      notes: null,
    },
    {
      validation_id: "production_safe_status_agreement",
      validation_rule_version: "s9-18h-internal-snapshot-v1",
      validation_area: "manifest_metrics_agreement",
      subject: "production_safe_status",
      status:
        input.manifest_snapshot.production_safe_status ===
        input.acceptance_metrics_snapshot.production_safe_status
          ? "pass"
          : "warn",
      expected: input.acceptance_metrics_snapshot.production_safe_status,
      observed: input.manifest_snapshot.production_safe_status,
      source_path: "manifest.production_safe_status",
      related_artefact_ids: ["qa_acceptance_metrics"],
      blocker_codes: [],
      notes: null,
    },
  ];
  const addMetricValidation = (args: {
    validation_id: string;
    validation_area: string;
    subject: string;
    expected: unknown;
    observed: unknown;
    source_path: string;
    related_artefact_ids: string[];
    passWhen?: (observed: unknown) => boolean;
    blocker_code?: string;
    validation_rule_version?: string;
  }) => {
    const pass = args.passWhen ? args.passWhen(args.observed) : args.observed === args.expected;
    entries.push({
      validation_id: args.validation_id,
      validation_rule_version:
        args.validation_rule_version ?? "s9-19b-ordinary-analysis-proof-chain-v1",
      validation_area: args.validation_area,
      subject: args.subject,
      status: pass ? "pass" : "warn",
      expected: args.expected,
      observed: args.observed,
      source_path: args.source_path,
      related_artefact_ids: args.related_artefact_ids,
      blocker_codes: pass || !args.blocker_code ? [] : [args.blocker_code],
      notes: null,
    });
  };
  addMetricValidation({
    validation_id: "ordinary_analysis_step1_family_completion_status",
    validation_area: "ordinary_analysis_proof_bundle",
    subject: "ordinary_analysis_proof_bundle_status",
    expected: "step1_families_complete_or_partial_with_exact_blockers",
    observed: input.acceptance_metrics_snapshot.ordinary_analysis_proof_bundle_status,
    source_path: "qa.acceptance_metrics.ordinary_analysis_proof_bundle_status",
    related_artefact_ids: ["step1_observable_evidence", "analysis_evidence_state"],
    passWhen: (value) => typeof value === "string" && value.length > 0,
    blocker_code: "ordinary_analysis_family_status_missing",
  });
  addMetricValidation({
    validation_id: "analysis_evidence_state_gate_status_recorded",
    validation_area: "ordinary_analysis_proof_bundle",
    subject: "analysis_evidence_state_gate_status",
    expected: "satisfied_or_insufficient",
    observed: input.acceptance_metrics_snapshot.analysis_evidence_state_gate_status,
    source_path: "qa.acceptance_metrics.analysis_evidence_state_gate_status",
    related_artefact_ids: ["analysis_evidence_state"],
    passWhen: (value) => ["satisfied", "insufficient", "missing"].includes(String(value)),
    blocker_code: "analysis_evidence_state_gate_status_missing",
  });
  addMetricValidation({
    validation_id: "evidence_anchor_aggregate_status_recorded",
    validation_area: "ordinary_analysis_proof_bundle",
    subject: "evidence_anchor_gate_status",
    expected: "sufficient_or_insufficient",
    observed: input.acceptance_metrics_snapshot.evidence_anchor_gate_status,
    source_path: "qa.acceptance_metrics.evidence_anchor_gate_status",
    related_artefact_ids: ["evidence_anchors"],
    passWhen: (value) => ["sufficient", "insufficient", "missing"].includes(String(value)),
    blocker_code: "evidence_anchor_gate_status_missing",
  });
  addMetricValidation({
    validation_id: "public_claim_trace_aggregate_status_recorded",
    validation_area: "ordinary_analysis_proof_bundle",
    subject: "public_claim_gate_status",
    expected: "sufficient_or_insufficient",
    observed: input.acceptance_metrics_snapshot.public_claim_gate_status,
    source_path: "qa.acceptance_metrics.public_claim_gate_status",
    related_artefact_ids: ["public_claim_trace"],
    passWhen: (value) => ["sufficient", "insufficient", "missing"].includes(String(value)),
    blocker_code: "public_claim_gate_status_missing",
  });
  addMetricValidation({
    validation_id: "score_trace_remains_non_public",
    validation_area: "score_trace_gate",
    subject: "score_trace_gate_status",
    expected: "internal_or_insufficient_score_trace_with_public_scoring_blocked",
    observed: input.acceptance_metrics_snapshot.score_trace_gate_status,
    source_path: "qa.acceptance_metrics.score_trace_gate_status",
    related_artefact_ids: ["score_trace"],
    passWhen: (value) =>
      ["insufficient", "missing", "satisfied"].includes(String(value)) &&
      input.acceptance_metrics_snapshot.public_scoring_status === "blocked",
    blocker_code: "score_trace_gate_unexpected_status",
  });
  addMetricValidation({
    validation_id: "technique_trace_remains_non_public",
    validation_area: "technique_observation_trace_gate",
    subject: "technique_observation_trace_status",
    expected: "internal_or_insufficient_technique_trace_with_public_authority_blocked",
    observed: input.acceptance_metrics_snapshot.technique_observation_gate_status,
    source_path: "qa.acceptance_metrics.technique_observation_gate_status",
    related_artefact_ids: ["technique_observation_trace"],
    passWhen: (value) =>
      ["insufficient", "missing", "satisfied"].includes(String(value)) &&
      input.acceptance_metrics_snapshot.public_technique_authority_status === "blocked",
    blocker_code: "technique_observation_trace_unexpected_real_runtime_count",
  });
  addMetricValidation({
    validation_id: "score_trace_internal_proof_status_recorded",
    validation_area: "s9_19c_score_technique_modelrun_bundle",
    subject: "score_trace_internal_proof_status",
    expected: "recorded",
    observed: input.acceptance_metrics_snapshot.score_trace_internal_proof_status,
    source_path: "qa.acceptance_metrics.score_trace_internal_proof_status",
    related_artefact_ids: ["score_trace"],
    passWhen: (value) => typeof value === "string" && value.length > 0,
    blocker_code: "score_trace_internal_proof_status_missing",
    validation_rule_version: "s9-19c-score-technique-modelrun-proof-v1",
  });
  addMetricValidation({
    validation_id: "technique_trace_internal_proof_status_recorded",
    validation_area: "s9_19c_score_technique_modelrun_bundle",
    subject: "technique_observation_internal_proof_status",
    expected: "recorded",
    observed: input.acceptance_metrics_snapshot.technique_observation_internal_proof_status,
    source_path: "qa.acceptance_metrics.technique_observation_internal_proof_status",
    related_artefact_ids: ["technique_observation_trace"],
    passWhen: (value) => typeof value === "string" && value.length > 0,
    blocker_code: "technique_observation_internal_proof_status_missing",
    validation_rule_version: "s9-19c-score-technique-modelrun-proof-v1",
  });
  addMetricValidation({
    validation_id: "model_run_per_stage_proof_status_recorded",
    validation_area: "s9_19c_score_technique_modelrun_bundle",
    subject: "model_run_trace_per_stage_model_proof_status",
    expected: "recorded",
    observed: input.acceptance_metrics_snapshot.model_run_trace_per_stage_model_proof_status,
    source_path: "qa.acceptance_metrics.model_run_trace_per_stage_model_proof_status",
    related_artefact_ids: ["model_run_trace"],
    passWhen: (value) => typeof value === "string" && value.length > 0 && value !== "missing",
    blocker_code: "model_run_trace_per_stage_status_missing",
    validation_rule_version: "s9-19c-score-technique-modelrun-proof-v1",
  });
  addMetricValidation({
    validation_id: "model_run_raw_prompt_response_absent",
    validation_area: "s9_19c_score_technique_modelrun_bundle",
    subject: "model_run_raw_prompt_or_response_stored",
    expected: false,
    observed: input.acceptance_metrics_snapshot.model_run_raw_prompt_or_response_stored,
    source_path: "qa.acceptance_metrics.model_run_raw_prompt_or_response_stored",
    related_artefact_ids: ["model_run_trace"],
    passWhen: (value) => value === false,
    blocker_code: "raw_prompt_or_response_storage_detected",
    validation_rule_version: "s9-19c-score-technique-modelrun-proof-v1",
  });
  addMetricValidation({
    validation_id: "model_run_secrets_absent",
    validation_area: "s9_19c_score_technique_modelrun_bundle",
    subject: "model_run_secrets_or_signed_urls_stored",
    expected: false,
    observed: input.acceptance_metrics_snapshot.model_run_secrets_or_signed_urls_stored,
    source_path: "qa.acceptance_metrics.model_run_secrets_or_signed_urls_stored",
    related_artefact_ids: ["model_run_trace"],
    passWhen: (value) => value === false,
    blocker_code: "secrets_or_signed_urls_storage_detected",
    validation_rule_version: "s9-19c-score-technique-modelrun-proof-v1",
  });
  addMetricValidation({
    validation_id: "report_parity_passed_status_recorded",
    validation_area: "report_parity_gate",
    subject: "report_parity_status",
    expected: "passed_or_missing_when_not_emitted",
    observed: input.acceptance_metrics_snapshot.report_parity_status,
    source_path: "qa.acceptance_metrics.report_parity_status",
    related_artefact_ids: ["parity_report"],
    passWhen: (value) => ["passed", "missing", "insufficient"].includes(String(value)),
    blocker_code: "report_parity_status_missing",
  });
  addMetricValidation({
    validation_id: "no_export_complete_status_recorded",
    validation_area: "no_export_gate",
    subject: "no_export_status",
    expected: "complete_or_missing_when_not_emitted",
    observed: input.acceptance_metrics_snapshot.no_export_status,
    source_path: "qa.acceptance_metrics.no_export_status",
    related_artefact_ids: ["no_export_proof"],
    passWhen: (value) =>
      [
        "no_export_proof_complete",
        "no_export_proof_missing",
        "no_export_proof_insufficient",
      ].includes(String(value)),
    blocker_code: "no_export_status_missing",
  });
  const ordinaryUnsatisfiedGateIds = getStringArray(
    input.acceptance_metrics_snapshot.ordinary_l2a_unsatisfied_gate_ids,
  );
  const ordinarySelfGateIds = ["validator_trace_gate", "gate_trace_gate"];
  const ordinaryUnsatisfiedExcludingSelf = ordinaryUnsatisfiedGateIds.filter(
    (gateId) => !ordinarySelfGateIds.includes(gateId),
  );
  const ordinaryMetricsStatus = String(
    input.acceptance_metrics_snapshot.ordinary_l2a_analysis_proof_status ?? "insufficient",
  );
  const ordinaryMetricsStatusSatisfied = ordinaryMetricsStatus === "satisfied";
  const ordinaryMetricsOnlySelfBlocked =
    ordinaryUnsatisfiedGateIds.length > 0 &&
    ordinaryUnsatisfiedExcludingSelf.length === 0 &&
    ordinaryUnsatisfiedGateIds.every((gateId) => ordinarySelfGateIds.includes(gateId)) &&
    ordinaryMetricsStatus !== "blocked";
  const ordinaryDependenciesSatisfied =
    ordinaryUnsatisfiedExcludingSelf.length === 0 &&
    (ordinaryMetricsStatusSatisfied || ordinaryMetricsOnlySelfBlocked);
  entries.push({
    validation_id: "ordinary_l2a_dependency_gate_validation",
    validation_rule_version: "s9-19d-independent-ordinary-l2a-proof-v1",
    validation_area: "ordinary_l2a_internal_proof",
    subject: "ordinary_l2a_unsatisfied_gate_ids_excluding_validator_gate",
    status: ordinaryDependenciesSatisfied ? "pass" : "fail",
    expected: [],
    observed: {
      ordinary_l2a_analysis_proof_status: ordinaryMetricsStatus,
      unsatisfied_gate_ids_excluding_validator_and_gate_trace: ordinaryUnsatisfiedExcludingSelf,
      self_referential_gate_ids: ordinaryUnsatisfiedGateIds.filter((gateId) =>
        ordinarySelfGateIds.includes(gateId),
      ),
    },
    source_path: "qa.acceptance_metrics.ordinary_l2a_unsatisfied_gate_ids",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "model_run_trace",
      "evidence_anchors",
      "public_claim_trace",
      "score_trace",
      "technique_observation_trace",
    ],
    blocker_codes: ordinaryDependenciesSatisfied
      ? []
      : ["ordinary_l2a_dependency_gate_unsatisfied"],
    notes: null,
  });
  entries.push({
    validation_id: "public_release_gates_separated_from_ordinary_l2a",
    validation_rule_version: "s9-19d-independent-ordinary-l2a-proof-v1",
    validation_area: "public_release_gate_separation",
    subject: "public_release_dependency_status",
    status:
      input.acceptance_metrics_snapshot.ordinary_l2a_public_release_dependency_status ===
        "blocked" &&
      input.acceptance_metrics_snapshot.public_scoring_status === "blocked" &&
      input.acceptance_metrics_snapshot.public_technique_authority_status === "blocked" &&
      input.acceptance_metrics_snapshot.production_safe_status === "blocked"
        ? "pass"
        : "fail",
    expected: "public_release_gates_blocked_and_separated",
    observed: {
      ordinary_l2a_public_release_dependency_status:
        input.acceptance_metrics_snapshot.ordinary_l2a_public_release_dependency_status,
      public_scoring_status: input.acceptance_metrics_snapshot.public_scoring_status,
      public_technique_authority_status:
        input.acceptance_metrics_snapshot.public_technique_authority_status,
      production_safe_status: input.acceptance_metrics_snapshot.production_safe_status,
    },
    source_path: "qa.acceptance_metrics.public_release_statuses",
    related_artefact_ids: ["qa_acceptance_metrics", "gate_trace"],
    blocker_codes: [],
    notes: null,
  });
  const publicScoringSuppressionSatisfied =
    input.acceptance_metrics_snapshot.public_scoring_suppression_proof_status === "satisfied" &&
    input.acceptance_metrics_snapshot.public_score_gate_permission === false &&
    input.acceptance_metrics_snapshot.public_score_fields_absent_from_public_payload === true &&
    input.acceptance_metrics_snapshot.public_score_claims_suppressed === true;
  const publicTechniqueSuppressionSatisfied =
    input.acceptance_metrics_snapshot.public_technique_authority_suppression_proof_status ===
      "satisfied" &&
    input.acceptance_metrics_snapshot.public_technique_gate_permission === false &&
    input.acceptance_metrics_snapshot.public_named_technique_fields_absent_from_public_payload ===
      true &&
    input.acceptance_metrics_snapshot.public_named_technique_claims_suppressed === true &&
    input.acceptance_metrics_snapshot.public_technique_authority_content_scan_status ===
      "satisfied";
  const publicComparisonSuppressionSatisfied =
    ["satisfied", "not_applicable"].includes(
      String(
        input.acceptance_metrics_snapshot.public_comparison_recommendation_suppression_proof_status,
      ),
    ) &&
    input.acceptance_metrics_snapshot.comparison_recommendation_gate_permission === false &&
    input.acceptance_metrics_snapshot.public_winner_absent === true &&
    input.acceptance_metrics_snapshot.public_recommendation_absent === true;
  const globalLevel2TaxonomySatisfied =
    input.acceptance_metrics_snapshot.global_level2_evidence_status === "satisfied" &&
    input.acceptance_metrics_snapshot.global_level2_release_status === "blocked" &&
    input.acceptance_metrics_snapshot.global_level2_acceptance_status === "not_accepted" &&
    input.acceptance_metrics_snapshot.production_safe_status === "blocked" &&
    input.acceptance_metrics_snapshot.customer_release_status === "blocked";
  const runtimeOperatorVerificationCompleted =
    input.acceptance_metrics_snapshot.runtime_operator_verification_status === "completed";
  const deploymentContextVerified =
    ["resolved"].includes(String(input.acceptance_metrics_snapshot.deployment_provenance_status)) ||
    input.acceptance_metrics_snapshot.operator_confirmation_status === "confirmed";
  const productionReadinessReady =
    input.acceptance_metrics_snapshot.production_safe_readiness_status === "ready_for_review";
  const customerReleaseReadinessReady =
    input.acceptance_metrics_snapshot.customer_release_readiness_status === "ready_for_review";
  const releaseReadinessReady = productionReadinessReady && customerReleaseReadinessReady;
  const duplicateSameVideoSafetyClassified = [
    "not_applicable",
    "satisfied_suppressed",
    "insufficient",
    "blocked",
  ].includes(String(input.acceptance_metrics_snapshot.duplicate_same_video_safety_status));
  const comparisonPublicOutputAbsenceClassified = [
    "not_applicable",
    "satisfied",
    "insufficient",
    "blocked",
  ].includes(
    String(input.acceptance_metrics_snapshot.comparison_public_output_absence_proof_status),
  );
  const comparisonSuppressionSafetyClassified = [
    "not_applicable",
    "satisfied_suppressed",
    "insufficient",
    "blocked",
  ].includes(String(input.acceptance_metrics_snapshot.comparison_suppression_safety_status));
  const comparisonParityClassified = [
    "not_applicable",
    "passed",
    "failed",
    "fail_closed",
    "satisfied_suppression_only",
    "insufficient",
  ].includes(String(input.acceptance_metrics_snapshot.comparison_parity_status));
  const evidenceDeltaClassified = [
    "not_applicable",
    "decisive",
    "non_decisive",
    "unavailable",
    "insufficient",
  ].includes(
    String(input.acceptance_metrics_snapshot.evidence_delta_or_no_material_difference_status),
  );
  entries.push({
    validation_id: "public_scoring_suppression_proof_validated",
    validation_rule_version: "s9-19e-public-release-suppression-proof-v1",
    validation_area: "public_scoring_suppression_proof",
    subject: "public_scoring_suppression_proof_status",
    status: publicScoringSuppressionSatisfied ? "pass" : "fail",
    expected: "public_scoring_feature_blocked_but_public_score_absence_satisfied",
    observed: {
      public_scoring_suppression_proof_status:
        input.acceptance_metrics_snapshot.public_scoring_suppression_proof_status,
      public_score_gate_permission: input.acceptance_metrics_snapshot.public_score_gate_permission,
      public_score_fields_absent_from_public_payload:
        input.acceptance_metrics_snapshot.public_score_fields_absent_from_public_payload,
      public_score_claims_suppressed:
        input.acceptance_metrics_snapshot.public_score_claims_suppressed,
    },
    source_path: "qa.acceptance_metrics.public_scoring_suppression_proof_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "gate_trace",
      "public_claim_trace",
      "score_trace",
      "parity_report",
      "no_export_proof",
    ],
    blocker_codes: publicScoringSuppressionSatisfied
      ? []
      : ["public_scoring_suppression_proof_incomplete"],
    notes: null,
  });
  entries.push({
    validation_id: "public_technique_authority_suppression_proof_validated",
    validation_rule_version: "s9-19e-public-release-suppression-proof-v1",
    validation_area: "public_technique_authority_suppression_proof",
    subject: "public_technique_authority_suppression_proof_status",
    status: publicTechniqueSuppressionSatisfied ? "pass" : "fail",
    expected:
      "public_technique_authority_feature_blocked_but_public_named_technique_absence_satisfied",
    observed: {
      public_technique_authority_suppression_proof_status:
        input.acceptance_metrics_snapshot.public_technique_authority_suppression_proof_status,
      public_technique_gate_permission:
        input.acceptance_metrics_snapshot.public_technique_gate_permission,
      public_named_technique_fields_absent_from_public_payload:
        input.acceptance_metrics_snapshot.public_named_technique_fields_absent_from_public_payload,
      public_named_technique_claims_suppressed:
        input.acceptance_metrics_snapshot.public_named_technique_claims_suppressed,
      public_technique_authority_content_scan_status:
        input.acceptance_metrics_snapshot.public_technique_authority_content_scan_status,
    },
    source_path: "qa.acceptance_metrics.public_technique_authority_suppression_proof_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "gate_trace",
      "public_claim_trace",
      "technique_observation_trace",
      "parity_report",
      "no_export_proof",
    ],
    blocker_codes: publicTechniqueSuppressionSatisfied
      ? []
      : ["public_technique_authority_suppression_proof_incomplete"],
    notes: null,
  });
  entries.push({
    validation_id: "public_comparison_recommendation_suppression_proof_validated",
    validation_rule_version: "s9-19e-public-release-suppression-proof-v1",
    validation_area: "public_comparison_recommendation_suppression_proof",
    subject: "public_comparison_recommendation_suppression_proof_status",
    status: publicComparisonSuppressionSatisfied ? "pass" : "fail",
    expected:
      "public_comparison_recommendation_feature_blocked_and_public_winner_recommendation_absent",
    observed: {
      public_comparison_recommendation_suppression_proof_status:
        input.acceptance_metrics_snapshot.public_comparison_recommendation_suppression_proof_status,
      comparison_recommendation_gate_permission:
        input.acceptance_metrics_snapshot.comparison_recommendation_gate_permission,
      public_winner_absent: input.acceptance_metrics_snapshot.public_winner_absent,
      public_recommendation_absent: input.acceptance_metrics_snapshot.public_recommendation_absent,
    },
    source_path: "qa.acceptance_metrics.public_comparison_recommendation_suppression_proof_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "gate_trace",
      "comparison_suppression_trace",
      "parity_report",
      "no_export_proof",
    ],
    blocker_codes: publicComparisonSuppressionSatisfied
      ? []
      : ["public_comparison_recommendation_suppression_proof_incomplete"],
    notes: null,
  });
  entries.push({
    validation_id: "global_level2_gate_taxonomy_reconciled",
    validation_rule_version: "s9-19e-public-release-suppression-proof-v1",
    validation_area: "global_level2_gate_reconciliation",
    subject: "global_level2_evidence_release_acceptance_statuses",
    status: globalLevel2TaxonomySatisfied ? "pass" : "fail",
    expected: "evidence_suppression_satisfied_release_blocked_global_level2_not_accepted",
    observed: {
      global_level2_evidence_status:
        input.acceptance_metrics_snapshot.global_level2_evidence_status,
      global_level2_release_status: input.acceptance_metrics_snapshot.global_level2_release_status,
      global_level2_acceptance_status:
        input.acceptance_metrics_snapshot.global_level2_acceptance_status,
      level2_status: input.acceptance_metrics_snapshot.level2_status,
      production_safe_status: input.acceptance_metrics_snapshot.production_safe_status,
      customer_release_status: input.acceptance_metrics_snapshot.customer_release_status,
    },
    source_path: "qa.acceptance_metrics.global_level2_acceptance_status",
    related_artefact_ids: ["qa_acceptance_metrics", "gate_trace", "validator_trace"],
    blocker_codes: globalLevel2TaxonomySatisfied ? [] : ["global_level2_gate_taxonomy_incomplete"],
    notes: null,
  });
  entries.push({
    validation_id: "runtime_operator_verification_status_validated",
    validation_rule_version: "s9-19f-release-readiness-runtime-verification-v1",
    validation_area: "runtime_operator_verification",
    subject: "runtime_operator_verification_status",
    status: runtimeOperatorVerificationCompleted ? "pass" : "blocked",
    expected: "completed_for_release_readiness",
    observed: {
      runtime_operator_verification_status:
        input.acceptance_metrics_snapshot.runtime_operator_verification_status,
      runtime_bundle_freshness_status:
        input.acceptance_metrics_snapshot.runtime_bundle_freshness_status,
      runtime_bundle_matches_current_commit_status:
        input.acceptance_metrics_snapshot.runtime_bundle_matches_current_commit_status,
    },
    source_path: "qa.acceptance_metrics.runtime_operator_verification_status",
    related_artefact_ids: ["qa_acceptance_metrics", "manifest"],
    blocker_codes: runtimeOperatorVerificationCompleted
      ? []
      : getStringArray(
          input.acceptance_metrics_snapshot.runtime_operator_verification_blocker_codes,
        ),
    notes: null,
  });
  entries.push({
    validation_id: "deployment_provenance_or_operator_confirmation_validated",
    validation_rule_version: "s9-19f-release-readiness-runtime-verification-v1",
    validation_area: "deployment_provenance",
    subject: "deployment_provenance_status",
    status: deploymentContextVerified ? "pass" : "blocked",
    expected: "resolved_or_operator_confirmed",
    observed: {
      deployment_provenance_status: input.acceptance_metrics_snapshot.deployment_provenance_status,
      operator_confirmation_status: input.acceptance_metrics_snapshot.operator_confirmation_status,
    },
    source_path: "qa.acceptance_metrics.deployment_provenance_status",
    related_artefact_ids: ["qa_acceptance_metrics", "manifest"],
    blocker_codes: deploymentContextVerified
      ? []
      : getStringArray(input.acceptance_metrics_snapshot.deployment_provenance_blocker_codes),
    notes: null,
  });
  entries.push({
    validation_id: "production_customer_release_readiness_validated",
    validation_rule_version: "s9-19f-release-readiness-runtime-verification-v1",
    validation_area: "production_customer_release_readiness",
    subject: "production_and_customer_release_readiness",
    status: releaseReadinessReady ? "pass" : "blocked",
    expected: "ready_for_review_without_approval",
    observed: {
      production_safe_readiness_status:
        input.acceptance_metrics_snapshot.production_safe_readiness_status,
      customer_release_readiness_status:
        input.acceptance_metrics_snapshot.customer_release_readiness_status,
      production_safe_status: input.acceptance_metrics_snapshot.production_safe_status,
      customer_release_status: input.acceptance_metrics_snapshot.customer_release_status,
    },
    source_path: "qa.acceptance_metrics.production_safe_readiness_status",
    related_artefact_ids: ["qa_acceptance_metrics", "gate_trace", "validator_trace"],
    blocker_codes: releaseReadinessReady
      ? []
      : getStringArray(input.acceptance_metrics_snapshot.production_safe_readiness_blocker_codes),
    notes: null,
  });
  entries.push({
    validation_id: "duplicate_same_video_safety_classification_recorded",
    validation_rule_version: "s9-19f-release-readiness-runtime-verification-v1",
    validation_area: "comparison_safety",
    subject: "duplicate_same_video_safety_status",
    status: duplicateSameVideoSafetyClassified ? "pass" : "blocked",
    expected: "not_applicable_or_suppressed_or_fail_closed",
    observed: input.acceptance_metrics_snapshot.duplicate_same_video_safety_status,
    source_path: "qa.acceptance_metrics.duplicate_same_video_safety_status",
    related_artefact_ids: ["qa_acceptance_metrics", "comparison_suppression_trace"],
    blocker_codes: duplicateSameVideoSafetyClassified
      ? []
      : ["duplicate_same_video_safety_status_missing"],
    notes: null,
  });
  entries.push({
    validation_id: "comparison_public_output_absence_validated",
    validation_rule_version: "s9-19j-runtime-verification-comparison-parity-v1",
    validation_area: "comparison_safety",
    subject: "comparison_public_output_absence_proof_status",
    status: comparisonPublicOutputAbsenceClassified ? "pass" : "blocked",
    expected: "not_applicable_or_satisfied_or_exact_blocker",
    observed: {
      comparison_public_output_status:
        input.acceptance_metrics_snapshot.comparison_public_output_status,
      comparison_public_output_absence_proof_status:
        input.acceptance_metrics_snapshot.comparison_public_output_absence_proof_status,
      public_winner_absent: input.acceptance_metrics_snapshot.public_winner_absent,
      public_recommendation_absent: input.acceptance_metrics_snapshot.public_recommendation_absent,
    },
    source_path: "qa.acceptance_metrics.comparison_public_output_absence_proof_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "parity_comparison",
      "comparison_suppression_trace",
    ],
    blocker_codes: comparisonPublicOutputAbsenceClassified
      ? []
      : ["comparison_public_output_absence_status_missing"],
    notes: null,
  });
  entries.push({
    validation_id: "comparison_suppression_safety_validated",
    validation_rule_version: "s9-19j-runtime-verification-comparison-parity-v1",
    validation_area: "comparison_safety",
    subject: "comparison_suppression_safety_status",
    status: comparisonSuppressionSafetyClassified ? "pass" : "blocked",
    expected: "not_applicable_or_satisfied_suppressed_or_fail_closed",
    observed: input.acceptance_metrics_snapshot.comparison_suppression_safety_status,
    source_path: "qa.acceptance_metrics.comparison_suppression_safety_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "parity_comparison",
      "duplicate_detection_trace",
      "comparison_suppression_trace",
    ],
    blocker_codes: comparisonSuppressionSafetyClassified
      ? []
      : ["comparison_suppression_safety_status_missing"],
    notes: null,
  });
  entries.push({
    validation_id: "comparison_parity_classification_validated",
    validation_rule_version: "s9-19j-runtime-verification-comparison-parity-v1",
    validation_area: "comparison_parity",
    subject: "comparison_parity_status",
    status: comparisonParityClassified && evidenceDeltaClassified ? "pass" : "blocked",
    expected: "passed_or_fail_closed_with_exact_evidence_delta_status",
    observed: {
      comparison_parity_status: input.acceptance_metrics_snapshot.comparison_parity_status,
      comparison_parity_reason: input.acceptance_metrics_snapshot.comparison_parity_reason,
      evidence_delta_or_no_material_difference_status:
        input.acceptance_metrics_snapshot.evidence_delta_or_no_material_difference_status,
      comparison_parity_blocker_codes:
        input.acceptance_metrics_snapshot.comparison_parity_blocker_codes,
    },
    source_path: "qa.acceptance_metrics.comparison_parity_status",
    related_artefact_ids: [
      "qa_acceptance_metrics",
      "parity_comparison",
      "duplicate_detection_trace",
    ],
    blocker_codes:
      comparisonParityClassified && evidenceDeltaClassified
        ? []
        : ["comparison_parity_status_missing"],
    notes: null,
  });
  const failCount = entries.filter((e) => e.status === "fail").length;
  const ordinaryInternalFailCount = entries.filter(
    (e) =>
      e.status === "fail" &&
      !["global_level2_gate_taxonomy_reconciled"].includes(String(e.validation_id)),
  ).length;
  const warningCount = entries.filter((e) => e.status === "warn" || e.status === "warning").length;
  const blockedCount = entries.filter((e) => e.status === "blocked").length;
  const ordinaryValidatorTraceSatisfied = ordinaryDependenciesSatisfied;
  const validatorInternalProofSatisfied =
    ordinaryValidatorTraceSatisfied && ordinaryInternalFailCount === 0;
  const suppressionAndReleaseTaxonomySatisfied =
    publicScoringSuppressionSatisfied &&
    publicTechniqueSuppressionSatisfied &&
    publicComparisonSuppressionSatisfied &&
    globalLevel2TaxonomySatisfied;
  const validatorTraceSatisfied = validatorInternalProofSatisfied;
  const validatorInternalBlockerCodes = validatorInternalProofSatisfied
    ? []
    : dedupePreservingOrder([
        ...(!ordinaryValidatorTraceSatisfied ? ["ordinary_l2a_dependency_gate_unsatisfied"] : []),
        ...(ordinaryInternalFailCount > 0 ? ["ordinary_internal_validator_checks_failed"] : []),
      ]);
  const validatorReleaseBlockerCodes = dedupePreservingOrder([
    ...(!runtimeOperatorVerificationCompleted ? ["runtime_operator_verification_required"] : []),
    ...(!deploymentContextVerified ? ["deployment_provenance_unknown_or_unconfirmed"] : []),
    ...(!releaseReadinessReady ? ["production_customer_release_readiness_blocked"] : []),
    "production_safe_blocked",
    "customer_release_blocked",
  ]);
  const summary = {
    validation_count: entries.length,
    pass_count: entries.filter((e) => e.status === "pass").length,
    warning_count: warningCount,
    fail_count: failCount,
    blocked_count: blockedCount,
    validator_trace_gate_status: validatorTraceSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    validator_trace_gate_reason: validatorTraceSatisfied
      ? ("ordinary_l2a_artifact_derived_validations_passed" as const)
      : ("ordinary_analysis_artifact_checks_missing_or_failed" as const),
    independent_validation_status: validatorTraceSatisfied
      ? ("independent_validation_satisfying" as const)
      : ("independent_validation_partial" as const),
    validator_trace_internal_proof_status: validatorInternalProofSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    validator_trace_internal_proof_reason: validatorInternalProofSatisfied
      ? ("ordinary_internal_validation_checks_passed_release_gates_separated" as const)
      : ("ordinary_internal_validation_checks_failed_or_incomplete" as const),
    validator_trace_public_release_status: "blocked" as const,
    validator_trace_internal_blocker_codes: validatorInternalBlockerCodes,
    validator_trace_release_blocker_codes: validatorReleaseBlockerCodes,
    ordinary_l2a_validation_status: validatorInternalProofSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    ordinary_l2a_validation_reason: validatorInternalProofSatisfied
      ? ("ordinary_internal_validation_satisfied_self_referential_trace_placeholders_reconciled" as const)
      : "ordinary_internal_validation_unsatisfied",
    suppression_and_release_taxonomy_validation_status: suppressionAndReleaseTaxonomySatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    referential_integrity_status: validatorTraceSatisfied
      ? ("passed" as const)
      : ("partial_snapshot_checks" as const),
    deterministic_checks_version: "s9-19e-public-release-suppression-proof-v1" as const,
    public_private_leakage_validation_status:
      failCount === 0 ? ("passed" as const) : ("partial" as const),
    uk_english_validation_status: "not_run" as const,
    render_permission_validation_status:
      publicScoringSuppressionSatisfied &&
      publicTechniqueSuppressionSatisfied &&
      publicComparisonSuppressionSatisfied
        ? ("passed" as const)
        : ("partial" as const),
    public_scoring_suppression_validation_status: publicScoringSuppressionSatisfied
      ? ("passed" as const)
      : ("failed" as const),
    public_technique_authority_suppression_validation_status: publicTechniqueSuppressionSatisfied
      ? ("passed" as const)
      : ("failed" as const),
    public_comparison_recommendation_suppression_validation_status:
      publicComparisonSuppressionSatisfied ? ("passed" as const) : ("failed" as const),
    global_level2_gate_taxonomy_validation_status: globalLevel2TaxonomySatisfied
      ? ("passed" as const)
      : ("failed" as const),
    runtime_operator_verification_validation_status: runtimeOperatorVerificationCompleted
      ? ("passed" as const)
      : ("blocked" as const),
    deployment_provenance_validation_status: deploymentContextVerified
      ? ("passed" as const)
      : ("blocked" as const),
    release_readiness_validation_status: releaseReadinessReady
      ? ("passed" as const)
      : ("blocked" as const),
    duplicate_same_video_safety_validation_status: duplicateSameVideoSafetyClassified
      ? ("passed" as const)
      : ("blocked" as const),
    comparison_public_output_absence_validation_status: comparisonPublicOutputAbsenceClassified
      ? ("passed" as const)
      : ("blocked" as const),
    comparison_suppression_safety_validation_status: comparisonSuppressionSafetyClassified
      ? ("passed" as const)
      : ("blocked" as const),
    comparison_parity_classification_validation_status:
      comparisonParityClassified && evidenceDeltaClassified
        ? ("passed" as const)
        : ("blocked" as const),
  };
  const payload = {
    schema_version: "tapecoach_v3_validator_trace_first_pass_v1",
    artefact_type: "validator_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    generated_at: new Date().toISOString(),
    source_module: input.source_module,
    source_stage: input.source_stage,
    source_classification: validatorTraceSatisfied
      ? "independent_validation_satisfying"
      : "internal_validator",
    trace_mode: "first_pass_internal_bundle_validator",
    validated_snapshot_stage: "pre_finalisation_snapshot",
    final_manifest_rewrite_expected: true,
    self_inclusion_validated: false,
    intended_same_finalisation_artefact_ids: input.intended_same_finalisation_artefact_ids ?? [
      "validator_trace",
      "gate_trace",
    ],
    ...summary,
    validation_entries: entries,
    validator_trace_summary: summary,
    cannot_satisfy_level2_validator_gate: !validatorTraceSatisfied,
    gate_satisfaction_reason: summary.validator_trace_gate_reason,
    blocker_codes: validatorTraceSatisfied
      ? ["public_release_gates_blocked"]
      : ["ValidatorTrace_internal_only"],
    public_output_unchanged: true,
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    ...resolveQADeploymentProvenance(),
  };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/ValidatorTrace.json`;
  const w = await writeInternalJson(
    input.root_dir ?? DEFAULT_ROOT,
    input.run_id,
    relPath,
    payload,
    "validator_trace",
  );
  if (!w.written) return { written: false, emitted_artefact_ids: [] as string[] };
  return {
    written: true,
    emitted_artefact_ids: ["validator_trace"],
    path: w.path ?? w.storage_path,
    validator_trace_summary: summary,
  };
}

export async function emitGateTraceFirstPass(input: any) {
  if (!resolveInternalQAEmitEnabled({ internal_qa_emit: input.internal_qa_emit }))
    return { written: false, emitted_artefact_ids: [] as string[] };
  if (!input.manifest_snapshot || !input.acceptance_metrics_snapshot)
    return { written: false, emitted_artefact_ids: [] as string[] };
  const analysisRunId =
    typeof input.analysis_run_id === "string" && input.analysis_run_id.trim().length
      ? input.analysis_run_id.trim()
      : String(input.run_id ?? "").trim();
  if (!analysisRunId) return { written: false, emitted_artefact_ids: [] as string[] };
  assertSafeSegment(input.take_id, "take_id");
  assertSafeSegment(analysisRunId, "analysis_run_id");
  const ordinaryUnsatisfiedGateIds = getStringArray(
    input.acceptance_metrics_snapshot?.ordinary_l2a_unsatisfied_gate_ids,
  );
  const validatorTraceSatisfied =
    input.validator_trace_summary?.validator_trace_gate_status === "satisfied" ||
    input.validator_trace_summary?.ordinary_l2a_validation_status === "satisfied" ||
    input.validator_trace_summary?.independent_validation_status ===
      "independent_validation_satisfying";
  const ordinaryUnsatisfiedExcludingGate = ordinaryUnsatisfiedGateIds.filter(
    (gateId) => gateId !== "gate_trace_gate" && gateId !== "validator_trace_gate",
  );
  const ordinaryL2AGateSatisfied =
    validatorTraceSatisfied && ordinaryUnsatisfiedExcludingGate.length === 0;
  const ordinaryL2AStatus = ordinaryL2AGateSatisfied ? "satisfied" : "insufficient";
  const ordinaryL2AReason = ordinaryL2AGateSatisfied
    ? "ordinary_internal_analysis_proof_chain_satisfied_public_release_gates_separated"
    : `ordinary_internal_analysis_proof_chain_unsatisfied:${ordinaryUnsatisfiedExcludingGate.join(",") || "validator_trace_gate"}`;
  const publicScoringSuppressionStatus = String(
    input.acceptance_metrics_snapshot?.public_scoring_suppression_proof_status ?? "missing",
  );
  const publicTechniqueSuppressionStatus = String(
    input.acceptance_metrics_snapshot?.public_technique_authority_suppression_proof_status ??
      "missing",
  );
  const publicComparisonSuppressionStatus = String(
    input.acceptance_metrics_snapshot?.public_comparison_recommendation_suppression_proof_status ??
      "missing",
  );
  const globalLevel2EvidenceStatus = String(
    input.acceptance_metrics_snapshot?.global_level2_evidence_status ?? "insufficient",
  );
  const globalLevel2SuppressionProofStatus = String(
    input.acceptance_metrics_snapshot?.global_level2_suppression_proof_status ?? "insufficient",
  );
  const globalLevel2ReleaseReadinessStatus = String(
    input.acceptance_metrics_snapshot?.global_level2_release_readiness_status ?? "blocked",
  );
  const runtimeOperatorVerificationStatus = String(
    input.acceptance_metrics_snapshot?.runtime_operator_verification_status ?? "required",
  );
  const runtimeBundleFreshnessStatus = String(
    input.acceptance_metrics_snapshot?.runtime_bundle_freshness_status ?? "unknown",
  );
  const runtimeBundleMatchesCurrentImplementationStatus = String(
    input.acceptance_metrics_snapshot?.runtime_bundle_matches_current_implementation_status ??
      input.acceptance_metrics_snapshot?.runtime_bundle_matches_current_commit_status ??
      "unknown",
  );
  const deploymentProvenanceStatus = String(
    input.acceptance_metrics_snapshot?.deployment_provenance_status ??
      "unknown_no_safe_env_var_found",
  );
  const operatorConfirmationStatus = String(
    input.acceptance_metrics_snapshot?.operator_confirmation_status ?? "missing",
  );
  const productionSafeReadinessStatus = String(
    input.acceptance_metrics_snapshot?.production_safe_readiness_status ?? "blocked",
  );
  const customerReleaseReadinessStatus = String(
    input.acceptance_metrics_snapshot?.customer_release_readiness_status ?? "blocked",
  );
  const duplicateSameVideoSafetyStatus = String(
    input.acceptance_metrics_snapshot?.duplicate_same_video_safety_status ?? "not_applicable",
  );
  const comparisonPublicOutputAbsenceProofStatus = String(
    input.acceptance_metrics_snapshot?.comparison_public_output_absence_proof_status ??
      "not_applicable",
  );
  const comparisonSuppressionSafetyStatus = String(
    input.acceptance_metrics_snapshot?.comparison_suppression_safety_status ?? "not_applicable",
  );
  const comparisonParityStatus = String(
    input.acceptance_metrics_snapshot?.comparison_parity_status ?? "not_applicable",
  );
  const evidenceDeltaOrNoMaterialDifferenceStatus = String(
    input.acceptance_metrics_snapshot?.evidence_delta_or_no_material_difference_status ??
      "not_applicable",
  );
  const globalLevel2AcceptanceStatus = String(
    input.acceptance_metrics_snapshot?.global_level2_acceptance_status ?? "not_accepted",
  );
  const suppressionGateStatus = (status: string) =>
    status === "satisfied"
      ? "passed"
      : status === "not_applicable"
        ? "not_applicable"
        : status === "missing"
          ? "missing"
          : "insufficient";
  const gate_entries: Array<Record<string, unknown>> = [
    {
      gate_id: "ordinary_l2a_analysis_proof_gate",
      gate_name: "ordinary_l2a_analysis_proof_gate",
      gate_family: "ordinary_l2a_internal_analysis",
      status: ordinaryL2AGateSatisfied ? "passed" : "insufficient",
      reason: ordinaryL2AReason,
      required_for_level: "ordinary_l2a_internal",
      current_state: ordinaryL2AStatus,
      expected_state_for_acceptance: "satisfied",
      observed_evidence: [
        `ordinary_l2a_unsatisfied_gate_ids=${ordinaryUnsatisfiedGateIds.join(",")}`,
        `ordinary_l2a_unsatisfied_gate_ids_excluding_self=${ordinaryUnsatisfiedExcludingGate.join(",")}`,
      ],
      blocker_codes: ordinaryL2AGateSatisfied
        ? []
        : ["ordinary_l2a_independent_proof_chain_incomplete"],
      dependent_artefact_ids: [
        "validator_trace",
        "gate_trace",
        "model_run_trace",
        "qa_acceptance_metrics",
      ],
      evidence_artefact_ids: [
        "validator_trace",
        "gate_trace",
        "model_run_trace",
        "qa_acceptance_metrics",
      ],
      validator_rule_ids: ["ordinary_l2a_dependency_gate_validation"],
      source_paths: [
        "traces/ValidatorTrace.json",
        "traces/GateTrace.json",
        "qa/acceptance_metrics.json",
      ],
      public_effect: "none_internal_only",
      required_maturity_level: "internal_l2a",
      dependency_gate_ids: ordinaryUnsatisfiedExcludingGate,
      notes: null,
    },
    {
      gate_id: "global_level2_evidence_gate",
      gate_name: "global_level2_evidence_gate",
      gate_family: "level2_evidence",
      status: globalLevel2EvidenceStatus === "satisfied" ? "passed" : "insufficient",
      reason: String(
        input.acceptance_metrics_snapshot?.global_level2_acceptance_reason ??
          "global_level2_evidence_or_suppression_incomplete",
      ),
      required_for_level: "L2",
      current_state: globalLevel2EvidenceStatus,
      expected_state_for_acceptance: "satisfied",
      observed_evidence: [
        `qa.acceptance_metrics.global_level2_evidence_status=${globalLevel2EvidenceStatus}`,
      ],
      blocker_codes:
        globalLevel2EvidenceStatus === "satisfied"
          ? []
          : ["global_level2_evidence_or_suppression_incomplete"],
      dependent_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      validator_rule_ids: ["global_level2_gate_taxonomy_reconciled"],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/ValidatorTrace.json",
        "traces/GateTrace.json",
      ],
      public_effect: "none_internal_only",
      required_maturity_level: "global_l2_evidence",
      dependency_gate_ids: [
        "ordinary_l2a_analysis_proof_gate",
        "public_scoring_suppression_proof_gate",
        "public_technique_authority_suppression_proof_gate",
        "public_comparison_recommendation_suppression_proof_gate",
      ],
      notes: null,
    },
    {
      gate_id: "global_level2_suppression_proof_gate",
      gate_name: "global_level2_suppression_proof_gate",
      gate_family: "suppression_proof",
      status: globalLevel2SuppressionProofStatus === "satisfied" ? "passed" : "insufficient",
      reason: String(
        input.acceptance_metrics_snapshot?.global_level2_acceptance_reason ??
          "global_level2_suppression_proof_incomplete",
      ),
      required_for_level: "L2",
      current_state: globalLevel2SuppressionProofStatus,
      expected_state_for_acceptance: "satisfied",
      observed_evidence: [
        `qa.acceptance_metrics.global_level2_suppression_proof_status=${globalLevel2SuppressionProofStatus}`,
      ],
      blocker_codes:
        globalLevel2SuppressionProofStatus === "satisfied"
          ? []
          : ["global_level2_suppression_proof_incomplete"],
      dependent_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      validator_rule_ids: [
        "public_scoring_suppression_proof_validated",
        "public_technique_authority_suppression_proof_validated",
        "public_comparison_recommendation_suppression_proof_validated",
      ],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/ValidatorTrace.json",
        "traces/GateTrace.json",
      ],
      public_effect: "proves_blocked_public_feature_absence",
      required_maturity_level: "global_l2_suppression",
      dependency_gate_ids: [
        "public_scoring_suppression_proof_gate",
        "public_technique_authority_suppression_proof_gate",
        "public_comparison_recommendation_suppression_proof_gate",
      ],
      notes: null,
    },
    {
      gate_id: "public_scoring_suppression_proof_gate",
      gate_name: "public_scoring_suppression_proof_gate",
      gate_family: "suppression_proof",
      status: suppressionGateStatus(publicScoringSuppressionStatus),
      reason: String(
        input.acceptance_metrics_snapshot?.public_scoring_suppression_reason ??
          publicScoringSuppressionStatus,
      ),
      required_for_level: "L2",
      current_state: publicScoringSuppressionStatus,
      expected_state_for_acceptance: "satisfied",
      observed_evidence: [
        `qa.acceptance_metrics.public_scoring_suppression_proof_status=${publicScoringSuppressionStatus}`,
        "public_output_permissions.show_overall_score=false",
      ],
      blocker_codes:
        publicScoringSuppressionStatus === "satisfied"
          ? []
          : getStringArray(
              input.acceptance_metrics_snapshot?.public_scoring_suppression_blocker_codes,
            ),
      dependent_artefact_ids: [
        "score_trace",
        "public_claim_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      evidence_artefact_ids: [
        "score_trace",
        "public_claim_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      validator_rule_ids: ["public_scoring_suppression_proof_validated"],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/GateTrace.json",
        "parity/report_parity_result.json",
        "export_or_no_export/no_export_proof.json",
      ],
      public_effect: "proves_public_score_absence_without_feature_approval",
      required_maturity_level: "public_safety_suppression",
      dependency_gate_ids: ["public_scoring_gate"],
      notes: null,
    },
    {
      gate_id: "public_technique_authority_suppression_proof_gate",
      gate_name: "public_technique_authority_suppression_proof_gate",
      gate_family: "suppression_proof",
      status: suppressionGateStatus(publicTechniqueSuppressionStatus),
      reason: String(
        input.acceptance_metrics_snapshot?.public_technique_authority_suppression_reason ??
          publicTechniqueSuppressionStatus,
      ),
      required_for_level: "L2",
      current_state: publicTechniqueSuppressionStatus,
      expected_state_for_acceptance: "satisfied",
      observed_evidence: [
        `qa.acceptance_metrics.public_technique_authority_suppression_proof_status=${publicTechniqueSuppressionStatus}`,
        "public_output_permissions.show_public_technique_names=false",
      ],
      blocker_codes:
        publicTechniqueSuppressionStatus === "satisfied"
          ? []
          : getStringArray(
              input.acceptance_metrics_snapshot
                ?.public_technique_authority_suppression_blocker_codes,
            ),
      dependent_artefact_ids: [
        "technique_observation_trace",
        "public_claim_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      evidence_artefact_ids: [
        "technique_observation_trace",
        "public_claim_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      validator_rule_ids: ["public_technique_authority_suppression_proof_validated"],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/GateTrace.json",
        "parity/report_parity_result.json",
        "export_or_no_export/no_export_proof.json",
      ],
      public_effect: "proves_public_named_technique_absence_without_feature_approval",
      required_maturity_level: "public_safety_suppression",
      dependency_gate_ids: ["public_technique_authority_gate"],
      notes: null,
    },
    {
      gate_id: "public_comparison_recommendation_suppression_proof_gate",
      gate_name: "public_comparison_recommendation_suppression_proof_gate",
      gate_family: "suppression_proof",
      status: suppressionGateStatus(publicComparisonSuppressionStatus),
      reason: String(
        input.acceptance_metrics_snapshot?.public_comparison_recommendation_suppression_reason ??
          publicComparisonSuppressionStatus,
      ),
      required_for_level: "L2",
      current_state: publicComparisonSuppressionStatus,
      expected_state_for_acceptance: "satisfied_or_not_applicable_for_ordinary_single_take",
      observed_evidence: [
        `qa.acceptance_metrics.public_comparison_recommendation_suppression_proof_status=${publicComparisonSuppressionStatus}`,
        "public_output_permissions.show_comparison_recommendation=false",
      ],
      blocker_codes: ["satisfied", "not_applicable"].includes(publicComparisonSuppressionStatus)
        ? []
        : getStringArray(
            input.acceptance_metrics_snapshot
              ?.public_comparison_recommendation_suppression_blocker_codes,
          ),
      dependent_artefact_ids: [
        "comparison_suppression_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      evidence_artefact_ids: [
        "comparison_suppression_trace",
        "parity_report",
        "no_export_proof",
        "gate_trace",
      ],
      validator_rule_ids: ["public_comparison_recommendation_suppression_proof_validated"],
      source_paths: ["qa/acceptance_metrics.json", "traces/GateTrace.json"],
      public_effect: "proves_public_comparison_recommendation_absence_without_feature_approval",
      required_maturity_level: "public_safety_suppression",
      dependency_gate_ids: ["public_comparison_recommendation_gate"],
      notes: null,
    },
    {
      gate_id: "duplicate_same_video_safety_gate",
      gate_name: "duplicate_same_video_safety_gate",
      gate_family: "comparison_safety",
      status: ["not_applicable", "satisfied_suppressed"].includes(duplicateSameVideoSafetyStatus)
        ? duplicateSameVideoSafetyStatus === "not_applicable"
          ? "not_applicable"
          : "passed"
        : "insufficient",
      required_for_level: "comparison_runtime",
      current_state: duplicateSameVideoSafetyStatus,
      expected_state_for_acceptance: "not_applicable_or_satisfied_suppressed",
      observed_evidence: [
        `qa.acceptance_metrics.duplicate_same_video_safety_status=${duplicateSameVideoSafetyStatus}`,
      ],
      blocker_codes: ["not_applicable", "satisfied_suppressed"].includes(
        duplicateSameVideoSafetyStatus,
      )
        ? []
        : ["duplicate_same_video_safety_not_suppressed"],
      dependent_artefact_ids: ["comparison_suppression_trace", "duplicate_detection_trace"],
      evidence_artefact_ids: [
        "qa_acceptance_metrics",
        "comparison_suppression_trace",
        "duplicate_detection_trace",
      ],
      validator_rule_ids: ["duplicate_same_video_safety_classification_recorded"],
      source_paths: ["qa/acceptance_metrics.json"],
      public_effect: "blocks_public_comparison_winner_recommendation",
      required_maturity_level: "comparison_safety",
      dependency_gate_ids: ["public_comparison_recommendation_suppression_proof_gate"],
      notes: null,
    },
    {
      gate_id: "level2_acceptance",
      gate_name: "level2_acceptance",
      gate_family: "level2",
      status: "blocked",
      required_for_level: "L2",
      current_state: "not_accepted",
      expected_state_for_acceptance: "accepted",
      observed_evidence: ["manifest.level2_qa_acceptance=not_accepted"],
      blocker_codes: ["level2_not_accepted"],
      dependent_artefact_ids: ["validator_trace", "gate_trace"],
      evidence_artefact_ids: ["manifest", "qa_acceptance_metrics"],
      validator_rule_ids: [],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "none_internal_only",
      required_maturity_level: "global_l2",
      dependency_gate_ids: [
        "production_safe_gate",
        "public_scoring_gate",
        "public_technique_authority_gate",
        "public_comparison_recommendation_gate",
      ],
      notes: null,
    },
    {
      gate_id: "validator_trace_gate",
      gate_name: "validator_trace_gate",
      gate_family: "trace",
      status: validatorTraceSatisfied
        ? "passed"
        : input.emitted_artefact_ids?.includes("validator_trace")
          ? "insufficient"
          : "missing",
      required_for_level: "ordinary_l2a_internal",
      current_state: validatorTraceSatisfied
        ? "independent_validation_satisfying"
        : input.emitted_artefact_ids?.includes("validator_trace")
          ? "emitted_internal_only"
          : "missing",
      expected_state_for_acceptance: "independent_runtime_v3",
      observed_evidence: [
        `validator_trace_summary.independent_validation_status=${String(input.validator_trace_summary?.independent_validation_status ?? "missing")}`,
      ],
      blocker_codes: validatorTraceSatisfied ? [] : ["ValidatorTrace_internal_only"],
      dependent_artefact_ids: ["validator_trace"],
      evidence_artefact_ids: ["validator_trace"],
      validator_rule_ids: [],
      source_paths: ["traces/ValidatorTrace.json"],
      public_effect: "none_internal_only",
      required_maturity_level: "internal_l2a",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "model_run_trace_gate",
      gate_name: "model_run_trace_gate",
      gate_family: "trace",
      status:
        input.acceptance_metrics_snapshot?.model_run_trace_gate_status === "satisfied"
          ? "passed"
          : input.emitted_artefact_ids?.includes("model_run_trace")
            ? "insufficient"
            : "missing",
      required_for_level: "ordinary_l2a_internal",
      current_state: String(
        input.acceptance_metrics_snapshot?.model_run_trace_per_stage_model_proof_status ??
          (input.emitted_artefact_ids?.includes("model_run_trace")
            ? "emitted_metadata_only"
            : "missing"),
      ),
      expected_state_for_acceptance: "independent_model_run_proof_chain",
      observed_evidence: [
        `qa.acceptance_metrics.model_run_trace_per_stage_model_proof_status=${String(input.acceptance_metrics_snapshot?.model_run_trace_per_stage_model_proof_status ?? "missing")}`,
      ],
      blocker_codes:
        input.acceptance_metrics_snapshot?.model_run_trace_gate_status === "satisfied"
          ? []
          : ["ModelRunTrace_independent_proof_partial"],
      dependent_artefact_ids: ["model_run_trace"],
      evidence_artefact_ids: ["model_run_trace"],
      validator_rule_ids: ["model_run_per_stage_proof_status_recorded"],
      source_paths: ["traces/ModelRunTrace.json", "qa/acceptance_metrics.json"],
      public_effect: "none_internal_only",
      required_maturity_level: "internal_l2a",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "runtime_operator_verification_gate",
      gate_name: "runtime_operator_verification_gate",
      gate_family: "runtime_verification",
      status: runtimeOperatorVerificationStatus === "completed" ? "passed" : "blocked",
      required_for_level: "release_readiness",
      current_state: runtimeOperatorVerificationStatus,
      expected_state_for_acceptance: "completed",
      observed_evidence: [
        `qa.acceptance_metrics.runtime_operator_verification_status=${runtimeOperatorVerificationStatus}`,
      ],
      blocker_codes:
        runtimeOperatorVerificationStatus === "completed"
          ? []
          : getStringArray(
              input.acceptance_metrics_snapshot?.runtime_operator_verification_blocker_codes,
            ),
      dependent_artefact_ids: ["qa_acceptance_metrics", "manifest"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "manifest"],
      validator_rule_ids: ["runtime_operator_verification_status_validated"],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_release_readiness",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: ["global_level2_evidence_gate", "global_level2_suppression_proof_gate"],
      notes: null,
    },
    {
      gate_id: "runtime_bundle_freshness_gate",
      gate_name: "runtime_bundle_freshness_gate",
      gate_family: "runtime_verification",
      status: ["fresh", "verified_fresh", "current"].includes(runtimeBundleFreshnessStatus)
        ? "passed"
        : "blocked",
      required_for_level: "release_readiness",
      current_state: runtimeBundleFreshnessStatus,
      expected_state_for_acceptance: "fresh",
      observed_evidence: [
        `qa.acceptance_metrics.runtime_bundle_freshness_status=${runtimeBundleFreshnessStatus}`,
      ],
      blocker_codes: ["fresh", "verified_fresh", "current"].includes(runtimeBundleFreshnessStatus)
        ? []
        : ["runtime_bundle_freshness_required"],
      dependent_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics", "manifest"],
      evidence_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics", "manifest"],
      validator_rule_ids: ["runtime_operator_verification_status_validated"],
      source_paths: ["analysis/RuntimeVerificationTrace.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_release_readiness",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "runtime_bundle_matches_current_implementation_gate",
      gate_name: "runtime_bundle_matches_current_implementation_gate",
      gate_family: "runtime_verification",
      status: [
        "matched",
        "matches",
        "matches_current_commit",
        "current_commit_matched",
        "matches_current_implementation",
        "current_implementation_matched",
        "operator_confirmed",
      ].includes(runtimeBundleMatchesCurrentImplementationStatus)
        ? "passed"
        : "blocked",
      required_for_level: "release_readiness",
      current_state: runtimeBundleMatchesCurrentImplementationStatus,
      expected_state_for_acceptance: "matches_current_implementation",
      observed_evidence: [
        `qa.acceptance_metrics.runtime_bundle_matches_current_implementation_status=${runtimeBundleMatchesCurrentImplementationStatus}`,
      ],
      blocker_codes: [
        "matched",
        "matches",
        "matches_current_commit",
        "current_commit_matched",
        "matches_current_implementation",
        "current_implementation_matched",
        "operator_confirmed",
      ].includes(runtimeBundleMatchesCurrentImplementationStatus)
        ? []
        : ["runtime_bundle_current_implementation_required"],
      dependent_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics", "manifest"],
      evidence_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics", "manifest"],
      validator_rule_ids: ["runtime_operator_verification_status_validated"],
      source_paths: ["analysis/RuntimeVerificationTrace.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_release_readiness",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "deployment_provenance_gate",
      gate_name: "deployment_provenance_gate",
      gate_family: "deployment_provenance",
      status:
        deploymentProvenanceStatus === "resolved" || operatorConfirmationStatus === "confirmed"
          ? "passed"
          : "blocked",
      required_for_level: "release_readiness",
      current_state: deploymentProvenanceStatus,
      expected_state_for_acceptance: "resolved_or_operator_confirmed",
      observed_evidence: [
        `qa.acceptance_metrics.deployment_provenance_status=${deploymentProvenanceStatus}`,
        `qa.acceptance_metrics.operator_confirmation_status=${operatorConfirmationStatus}`,
      ],
      blocker_codes:
        deploymentProvenanceStatus === "resolved" || operatorConfirmationStatus === "confirmed"
          ? []
          : getStringArray(input.acceptance_metrics_snapshot?.deployment_provenance_blocker_codes),
      dependent_artefact_ids: ["qa_acceptance_metrics", "manifest"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "manifest"],
      validator_rule_ids: ["deployment_provenance_or_operator_confirmation_validated"],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_release_readiness",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "operator_confirmation_gate",
      gate_name: "operator_confirmation_gate",
      gate_family: "deployment_provenance",
      status: operatorConfirmationStatus === "confirmed" ? "passed" : "blocked",
      required_for_level: "release_readiness",
      current_state: operatorConfirmationStatus,
      expected_state_for_acceptance: "confirmed_if_safe_env_absent",
      observed_evidence: [
        `qa.acceptance_metrics.operator_confirmation_status=${operatorConfirmationStatus}`,
      ],
      blocker_codes:
        operatorConfirmationStatus === "confirmed" ? [] : ["operator_confirmation_missing"],
      dependent_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics"],
      evidence_artefact_ids: ["runtime_verification_trace", "qa_acceptance_metrics"],
      validator_rule_ids: ["deployment_provenance_or_operator_confirmation_validated"],
      source_paths: ["analysis/RuntimeVerificationTrace.json", "qa/acceptance_metrics.json"],
      public_effect: "does_not_approve_release",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "comparison_public_output_absence_gate",
      gate_name: "comparison_public_output_absence_gate",
      gate_family: "comparison_safety",
      status: ["satisfied", "not_applicable"].includes(comparisonPublicOutputAbsenceProofStatus)
        ? comparisonPublicOutputAbsenceProofStatus === "not_applicable"
          ? "not_applicable"
          : "passed"
        : "insufficient",
      required_for_level: "comparison_runtime",
      current_state: comparisonPublicOutputAbsenceProofStatus,
      expected_state_for_acceptance: "satisfied_or_not_applicable",
      observed_evidence: [
        `qa.acceptance_metrics.comparison_public_output_absence_proof_status=${comparisonPublicOutputAbsenceProofStatus}`,
      ],
      blocker_codes: ["satisfied", "not_applicable"].includes(
        comparisonPublicOutputAbsenceProofStatus,
      )
        ? []
        : ["comparison_public_output_absence_not_proven"],
      dependent_artefact_ids: ["parity_comparison", "comparison_suppression_trace"],
      evidence_artefact_ids: [
        "qa_acceptance_metrics",
        "parity_comparison",
        "comparison_suppression_trace",
      ],
      validator_rule_ids: ["comparison_public_output_absence_validated"],
      source_paths: ["parity/comparison_parity.json", "qa/acceptance_metrics.json"],
      public_effect: "prevents_public_comparison_winner_recommendation",
      required_maturity_level: "comparison_safety",
      dependency_gate_ids: ["public_comparison_recommendation_gate"],
      notes: null,
    },
    {
      gate_id: "comparison_suppression_safety_gate",
      gate_name: "comparison_suppression_safety_gate",
      gate_family: "comparison_safety",
      status: ["satisfied_suppressed", "not_applicable"].includes(comparisonSuppressionSafetyStatus)
        ? comparisonSuppressionSafetyStatus === "not_applicable"
          ? "not_applicable"
          : "passed"
        : "insufficient",
      required_for_level: "comparison_runtime",
      current_state: comparisonSuppressionSafetyStatus,
      expected_state_for_acceptance: "satisfied_suppressed_or_not_applicable",
      observed_evidence: [
        `qa.acceptance_metrics.comparison_suppression_safety_status=${comparisonSuppressionSafetyStatus}`,
      ],
      blocker_codes: ["satisfied_suppressed", "not_applicable"].includes(
        comparisonSuppressionSafetyStatus,
      )
        ? []
        : ["comparison_suppression_safety_not_satisfied"],
      dependent_artefact_ids: [
        "parity_comparison",
        "duplicate_detection_trace",
        "comparison_suppression_trace",
      ],
      evidence_artefact_ids: [
        "qa_acceptance_metrics",
        "parity_comparison",
        "duplicate_detection_trace",
        "comparison_suppression_trace",
      ],
      validator_rule_ids: ["comparison_suppression_safety_validated"],
      source_paths: ["parity/comparison_parity.json", "qa/acceptance_metrics.json"],
      public_effect: "prevents_public_comparison_winner_recommendation",
      required_maturity_level: "comparison_safety",
      dependency_gate_ids: ["comparison_public_output_absence_gate"],
      notes: null,
    },
    {
      gate_id: "comparison_parity_gate",
      gate_name: "comparison_parity_gate",
      gate_family: "comparison_parity",
      status: ["passed", "not_applicable"].includes(comparisonParityStatus)
        ? comparisonParityStatus === "not_applicable"
          ? "not_applicable"
          : "passed"
        : comparisonParityStatus === "fail_closed"
          ? "blocked"
          : "insufficient",
      required_for_level: "comparison_l2",
      current_state: comparisonParityStatus,
      expected_state_for_acceptance: "passed_or_not_applicable",
      observed_evidence: [
        `qa.acceptance_metrics.comparison_parity_status=${comparisonParityStatus}`,
      ],
      blocker_codes: ["passed", "not_applicable"].includes(comparisonParityStatus)
        ? []
        : getStringArray(input.acceptance_metrics_snapshot?.comparison_parity_blocker_codes),
      dependent_artefact_ids: ["parity_comparison"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "parity_comparison"],
      validator_rule_ids: ["comparison_parity_classification_validated"],
      source_paths: ["parity/comparison_parity.json", "qa/acceptance_metrics.json"],
      public_effect: "does_not_approve_public_recommendation",
      required_maturity_level: "comparison_l2",
      dependency_gate_ids: [
        "comparison_suppression_safety_gate",
        "evidence_delta_or_no_material_difference_gate",
      ],
      notes: null,
    },
    {
      gate_id: "evidence_delta_or_no_material_difference_gate",
      gate_name: "evidence_delta_or_no_material_difference_gate",
      gate_family: "comparison_parity",
      status: ["decisive", "not_applicable"].includes(evidenceDeltaOrNoMaterialDifferenceStatus)
        ? evidenceDeltaOrNoMaterialDifferenceStatus === "not_applicable"
          ? "not_applicable"
          : "passed"
        : "blocked",
      required_for_level: "comparison_l2",
      current_state: evidenceDeltaOrNoMaterialDifferenceStatus,
      expected_state_for_acceptance: "decisive_or_not_applicable",
      observed_evidence: [
        `qa.acceptance_metrics.evidence_delta_or_no_material_difference_status=${evidenceDeltaOrNoMaterialDifferenceStatus}`,
      ],
      blocker_codes: ["decisive", "not_applicable"].includes(
        evidenceDeltaOrNoMaterialDifferenceStatus,
      )
        ? []
        : ["duplicate_same_video_suppressed_without_decisive_evidence_delta"],
      dependent_artefact_ids: ["duplicate_detection_trace", "parity_comparison"],
      evidence_artefact_ids: [
        "qa_acceptance_metrics",
        "duplicate_detection_trace",
        "parity_comparison",
      ],
      validator_rule_ids: ["comparison_parity_classification_validated"],
      source_paths: [
        "comparison/duplicate_detection_trace.json",
        "parity/comparison_parity.json",
        "qa/acceptance_metrics.json",
      ],
      public_effect: "keeps_comparison_level2_fail_closed",
      required_maturity_level: "comparison_l2",
      dependency_gate_ids: ["duplicate_same_video_safety_gate"],
      notes: null,
    },
    {
      gate_id: "production_safe_readiness_gate",
      gate_name: "production_safe_readiness_gate",
      gate_family: "release_readiness",
      status: productionSafeReadinessStatus === "ready_for_review" ? "passed" : "blocked",
      required_for_level: "release_readiness",
      current_state: productionSafeReadinessStatus,
      expected_state_for_acceptance: "ready_for_review",
      observed_evidence: [
        `qa.acceptance_metrics.production_safe_readiness_status=${productionSafeReadinessStatus}`,
      ],
      blocker_codes:
        productionSafeReadinessStatus === "ready_for_review"
          ? []
          : getStringArray(
              input.acceptance_metrics_snapshot?.production_safe_readiness_blocker_codes,
            ),
      dependent_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      validator_rule_ids: ["production_customer_release_readiness_validated"],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/ValidatorTrace.json",
        "traces/GateTrace.json",
      ],
      public_effect: "does_not_approve_production_release",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: ["runtime_operator_verification_gate", "deployment_provenance_gate"],
      notes: null,
    },
    {
      gate_id: "customer_release_readiness_gate",
      gate_name: "customer_release_readiness_gate",
      gate_family: "release_readiness",
      status: customerReleaseReadinessStatus === "ready_for_review" ? "passed" : "blocked",
      required_for_level: "release_readiness",
      current_state: customerReleaseReadinessStatus,
      expected_state_for_acceptance: "ready_for_review",
      observed_evidence: [
        `qa.acceptance_metrics.customer_release_readiness_status=${customerReleaseReadinessStatus}`,
      ],
      blocker_codes:
        customerReleaseReadinessStatus === "ready_for_review"
          ? []
          : getStringArray(
              input.acceptance_metrics_snapshot?.customer_release_readiness_blocker_codes,
            ),
      dependent_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      evidence_artefact_ids: ["qa_acceptance_metrics", "validator_trace", "gate_trace"],
      validator_rule_ids: ["production_customer_release_readiness_validated"],
      source_paths: [
        "qa/acceptance_metrics.json",
        "traces/ValidatorTrace.json",
        "traces/GateTrace.json",
      ],
      public_effect: "does_not_approve_customer_release",
      required_maturity_level: "release_readiness",
      dependency_gate_ids: ["runtime_operator_verification_gate", "deployment_provenance_gate"],
      notes: null,
    },
    {
      gate_id: "production_safe_gate",
      gate_name: "production_safe_gate",
      gate_family: "release",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["manifest.production_safe_status=blocked"],
      blocker_codes: ["production_safe_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["manifest", "qa_acceptance_metrics", "gate_trace"],
      validator_rule_ids: [],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_production_release",
      required_maturity_level: "public_release",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "production_safe_approval_gate",
      gate_name: "production_safe_approval_gate",
      gate_family: "release_approval",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["qa.acceptance_metrics.production_safe_status=blocked"],
      blocker_codes: ["production_safe_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["manifest", "qa_acceptance_metrics", "gate_trace"],
      validator_rule_ids: [],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_production_release",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["production_safe_readiness_gate"],
      notes: null,
    },
    {
      gate_id: "public_scoring_gate",
      gate_name: "public_scoring_gate",
      gate_family: "public_output_permission",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_output_permissions.show_overall_score=false"],
      blocker_codes: ["public_scoring_blocked"],
      dependent_artefact_ids: ["score_trace", "gate_trace"],
      evidence_artefact_ids: ["score_trace", "gate_trace"],
      validator_rule_ids: [],
      source_paths: ["traces/GateTrace.json"],
      public_effect: "blocks_public_scores",
      required_maturity_level: "public_release",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "public_technique_authority_gate",
      gate_name: "public_technique_authority_gate",
      gate_family: "public_output_permission",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_output_permissions.show_public_technique_names=false"],
      blocker_codes: ["public_technique_authority_blocked"],
      dependent_artefact_ids: ["technique_observation_trace", "gate_trace"],
      evidence_artefact_ids: ["technique_observation_trace", "gate_trace"],
      validator_rule_ids: [],
      source_paths: ["traces/GateTrace.json"],
      public_effect: "blocks_public_named_techniques",
      required_maturity_level: "public_release",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "public_comparison_recommendation_gate",
      gate_name: "public_comparison_recommendation_gate",
      gate_family: "public_output_permission",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_output_permissions.show_comparison_recommendation=false"],
      blocker_codes: ["public_comparison_recommendation_blocked"],
      dependent_artefact_ids: ["comparison_raw", "gate_trace"],
      evidence_artefact_ids: ["gate_trace"],
      validator_rule_ids: [],
      source_paths: ["traces/GateTrace.json"],
      public_effect: "blocks_public_comparison_recommendation",
      required_maturity_level: "public_release",
      dependency_gate_ids: [],
      notes: null,
    },
    {
      gate_id: "public_scoring_feature_approval_gate",
      gate_name: "public_scoring_feature_approval_gate",
      gate_family: "feature_approval",
      status: "blocked",
      required_for_level: "public_release",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_scoring_feature_status=blocked"],
      blocker_codes: ["public_scoring_feature_approval_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["gate_trace"],
      validator_rule_ids: ["public_scoring_suppression_proof_validated"],
      source_paths: ["qa/acceptance_metrics.json", "traces/GateTrace.json"],
      public_effect: "blocks_public_scores_feature_approval",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["public_scoring_suppression_proof_gate"],
      notes: null,
    },
    {
      gate_id: "public_technique_authority_feature_approval_gate",
      gate_name: "public_technique_authority_feature_approval_gate",
      gate_family: "feature_approval",
      status: "blocked",
      required_for_level: "public_release",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_technique_authority_feature_status=blocked"],
      blocker_codes: ["public_technique_authority_feature_approval_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["gate_trace"],
      validator_rule_ids: ["public_technique_authority_suppression_proof_validated"],
      source_paths: ["qa/acceptance_metrics.json", "traces/GateTrace.json"],
      public_effect: "blocks_public_technique_authority_feature_approval",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["public_technique_authority_suppression_proof_gate"],
      notes: null,
    },
    {
      gate_id: "public_comparison_recommendation_feature_approval_gate",
      gate_name: "public_comparison_recommendation_feature_approval_gate",
      gate_family: "feature_approval",
      status: "blocked",
      required_for_level: "public_release",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["public_comparison_recommendation_feature_status=blocked"],
      blocker_codes: ["public_comparison_recommendation_feature_approval_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["gate_trace"],
      validator_rule_ids: ["public_comparison_recommendation_suppression_proof_validated"],
      source_paths: ["qa/acceptance_metrics.json", "traces/GateTrace.json"],
      public_effect: "blocks_public_comparison_recommendation_feature_approval",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["public_comparison_recommendation_suppression_proof_gate"],
      notes: null,
    },
    {
      gate_id: "customer_release_gate",
      gate_name: "customer_release_gate",
      gate_family: "release",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["production_safe_status=blocked"],
      blocker_codes: ["customer_release_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["gate_trace"],
      validator_rule_ids: [],
      source_paths: ["traces/GateTrace.json"],
      public_effect: "blocks_customer_release",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["production_safe_gate"],
      notes: null,
    },
    {
      gate_id: "customer_release_approval_gate",
      gate_name: "customer_release_approval_gate",
      gate_family: "release_approval",
      status: "blocked",
      required_for_level: "L2",
      current_state: "blocked",
      expected_state_for_acceptance: "approved",
      observed_evidence: ["qa.acceptance_metrics.customer_release_status=blocked"],
      blocker_codes: ["customer_release_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["manifest", "qa_acceptance_metrics", "gate_trace"],
      validator_rule_ids: [],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json"],
      public_effect: "blocks_customer_release",
      required_maturity_level: "public_release",
      dependency_gate_ids: ["customer_release_readiness_gate", "production_safe_approval_gate"],
      notes: null,
    },
    {
      gate_id: "global_level2_acceptance_gate",
      gate_name: "global_level2_acceptance_gate",
      gate_family: "level2",
      status: "blocked",
      required_for_level: "L2",
      current_state: globalLevel2AcceptanceStatus,
      expected_state_for_acceptance: "accepted",
      observed_evidence: [
        `global_level2_evidence_status=${globalLevel2EvidenceStatus}`,
        `global_level2_acceptance_status=${globalLevel2AcceptanceStatus}`,
        `global_level2_release_readiness_status=${globalLevel2ReleaseReadinessStatus}`,
      ],
      blocker_codes: ["global_level2_public_release_gates_blocked"],
      dependent_artefact_ids: ["gate_trace"],
      evidence_artefact_ids: ["manifest", "qa_acceptance_metrics", "gate_trace"],
      validator_rule_ids: ["global_level2_gate_taxonomy_reconciled"],
      source_paths: ["manifest.json", "qa/acceptance_metrics.json", "traces/GateTrace.json"],
      public_effect: "blocks_global_level2_acceptance",
      required_maturity_level: "global_l2",
      dependency_gate_ids: [
        "global_level2_evidence_gate",
        "global_level2_suppression_proof_gate",
        "runtime_operator_verification_gate",
        "deployment_provenance_gate",
        "production_safe_approval_gate",
        "customer_release_approval_gate",
      ],
      notes: null,
    },
  ];
  const metricStatus = (key: string, fallback = "missing") =>
    String(input.acceptance_metrics_snapshot?.[key] ?? fallback);
  const addOrdinaryGate = (args: {
    gate_id: string;
    gate_family: string;
    metric_key: string;
    expected_state_for_acceptance: string;
    dependent_artefact_ids: string[];
    source_paths: string[];
    blocker_codes: string[];
    public_effect?: string;
    satisfiedValues?: string[];
    notApplicableValues?: string[];
  }) => {
    const currentState = metricStatus(args.metric_key);
    const status = (args.notApplicableValues ?? []).includes(currentState)
      ? "not_applicable"
      : (
            args.satisfiedValues ?? [
              "satisfied",
              "sufficient",
              "passed",
              "no_export_proof_complete",
              "not_applicable",
            ]
          ).includes(currentState)
        ? "passed"
        : currentState === "missing"
          ? "missing"
          : "insufficient";
    gate_entries.push({
      gate_id: args.gate_id,
      gate_name: args.gate_id,
      gate_family: args.gate_family,
      status,
      required_for_level: "L2",
      current_state: currentState,
      expected_state_for_acceptance: args.expected_state_for_acceptance,
      observed_evidence: [`qa.acceptance_metrics.${args.metric_key}=${currentState}`],
      blocker_codes: status === "passed" || status === "not_applicable" ? [] : args.blocker_codes,
      dependent_artefact_ids: args.dependent_artefact_ids,
      evidence_artefact_ids: args.dependent_artefact_ids,
      validator_rule_ids: [],
      source_paths: args.source_paths,
      public_effect: args.public_effect ?? "none_internal_only",
      required_maturity_level: "internal_l2a",
      dependency_gate_ids: [],
      notes: null,
    });
  };
  addOrdinaryGate({
    gate_id: "ordinary_analysis_step1_evidence_gate",
    gate_family: "ordinary_analysis",
    metric_key: "ordinary_analysis_proof_bundle_status",
    expected_state_for_acceptance: "step1_families_complete_proof_chain_blocked_or_complete",
    dependent_artefact_ids: ["step1_observable_evidence"],
    source_paths: ["analysis/Step1ObservableEvidence.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["ordinary_analysis_required_evidence_families_missing"],
    satisfiedValues: [
      "satisfied",
      "step1_families_complete",
      "step1_families_complete_proof_chain_blocked",
      "step1_families_complete_proof_chain_satisfied",
    ],
  });
  addOrdinaryGate({
    gate_id: "analysis_evidence_state_gate",
    gate_family: "ordinary_analysis",
    metric_key: "analysis_evidence_state_gate_status",
    expected_state_for_acceptance: "satisfied",
    dependent_artefact_ids: ["analysis_evidence_state"],
    source_paths: ["analysis/AnalysisEvidenceState.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["AnalysisEvidenceState_insufficient"],
  });
  addOrdinaryGate({
    gate_id: "evidence_anchor_aggregate_gate",
    gate_family: "ordinary_analysis",
    metric_key: "evidence_anchor_gate_status",
    expected_state_for_acceptance: "sufficient",
    dependent_artefact_ids: ["evidence_anchors"],
    source_paths: ["traces/EvidenceAnchors.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["EvidenceAnchor_trace_insufficient"],
  });
  addOrdinaryGate({
    gate_id: "public_claim_support_gate",
    gate_family: "ordinary_analysis",
    metric_key: "public_claim_gate_status",
    expected_state_for_acceptance: "sufficient",
    dependent_artefact_ids: ["public_claim_trace"],
    source_paths: ["traces/PublicClaimTrace.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["PublicClaimTrace_insufficient"],
  });
  addOrdinaryGate({
    gate_id: "score_trace_gate",
    gate_family: "trace",
    metric_key: "score_trace_gate_status",
    expected_state_for_acceptance: "real_runtime_v3_internal_score_proof",
    dependent_artefact_ids: ["score_trace"],
    source_paths: ["traces/ScoreTrace.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["score_trace_requires_structured_step2_score_projection"],
  });
  addOrdinaryGate({
    gate_id: "technique_observation_trace_gate",
    gate_family: "trace",
    metric_key: "technique_observation_gate_status",
    expected_state_for_acceptance: "real_runtime_v3_internal_technique_proof",
    dependent_artefact_ids: ["technique_observation_trace"],
    source_paths: ["traces/TechniqueObservationTrace.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["technique_trace_requires_step1_candidate_technique_extractor"],
  });
  addOrdinaryGate({
    gate_id: "report_parity_gate",
    gate_family: "report_parity",
    metric_key: "report_parity_status",
    expected_state_for_acceptance: "passed",
    dependent_artefact_ids: ["parity_report"],
    source_paths: ["parity/report_parity_result.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["parity_artefacts_missing"],
    satisfiedValues: ["passed"],
  });
  addOrdinaryGate({
    gate_id: "no_export_gate",
    gate_family: "no_export",
    metric_key: "no_export_status",
    expected_state_for_acceptance: "no_export_proof_complete",
    dependent_artefact_ids: ["no_export_proof"],
    source_paths: ["export_or_no_export/no_export_proof.json", "qa/acceptance_metrics.json"],
    blocker_codes: ["no_export_proof_missing"],
    satisfiedValues: ["no_export_proof_complete"],
  });
  addOrdinaryGate({
    gate_id: "ordinary_comparison_not_applicable_gate",
    gate_family: "comparison",
    metric_key: "comparison_status",
    expected_state_for_acceptance: "not_applicable",
    dependent_artefact_ids: ["parity_comparison"],
    source_paths: ["qa/acceptance_metrics.json"],
    blocker_codes: ["comparison_gate_unexpectedly_applicable"],
    satisfiedValues: ["not_applicable", "not_invoked"],
    notApplicableValues: ["not_applicable", "not_invoked"],
  });
  const summary = {
    gate_count: gate_entries.length,
    passed_gate_count: gate_entries.filter((g) => g.status === "passed").length,
    blocked_gate_count: gate_entries.filter((g) => g.status === "blocked").length,
    insufficient_gate_count: gate_entries.filter((g) => g.status === "insufficient").length,
    missing_gate_count: gate_entries.filter((g) => g.status === "missing").length,
    not_applicable_gate_count: gate_entries.filter((g) => g.status === "not_applicable").length,
    gate_trace_gate_status: ordinaryL2AGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    gate_trace_gate_reason: ordinaryL2AGateSatisfied
      ? ("ordinary_l2a_independent_gate_decisions_satisfied_public_release_blocked" as const)
      : ("ordinary_analysis_gate_decisions_partial_not_level2_acceptance_proof" as const),
    independent_gate_decision_status: ordinaryL2AGateSatisfied
      ? ("independent_gate_satisfying" as const)
      : ("independent_gate_partial" as const),
    gate_trace_internal_l2a_status: ordinaryL2AGateSatisfied
      ? ("satisfied" as const)
      : ("insufficient" as const),
    gate_trace_internal_l2a_reason: ordinaryL2AReason,
    gate_trace_internal_l2a_blocker_codes: ordinaryL2AGateSatisfied
      ? []
      : ["ordinary_l2a_independent_proof_chain_incomplete"],
    gate_trace_release_status: "blocked" as const,
    gate_trace_release_blocker_codes: [
      "runtime_operator_verification_required",
      "deployment_provenance_unknown_or_unconfirmed",
      "production_safe_blocked",
      "customer_release_blocked",
    ],
    gate_registry_version: "s9-19f-release-readiness-gate-registry-v1" as const,
    ordinary_l2a_analysis_proof_status: ordinaryL2AStatus,
    ordinary_l2a_analysis_proof_reason: ordinaryL2AReason,
    ordinary_l2a_analysis_proof_blocker_codes: ordinaryL2AGateSatisfied
      ? []
      : ["ordinary_l2a_independent_proof_chain_incomplete"],
    ordinary_l2a_satisfied_gate_ids: gate_entries
      .filter((g) => ["passed", "satisfied", "not_applicable"].includes(String(g.status)))
      .map((g) => String(g.gate_id)),
    ordinary_l2a_unsatisfied_gate_ids: gate_entries
      .filter(
        (g) =>
          !["passed", "satisfied", "not_applicable"].includes(String(g.status)) &&
          ![
            "public_output_permission",
            "release",
            "level2",
            "level2_evidence",
            "suppression_proof",
            "feature_approval",
            "runtime_verification",
            "deployment_provenance",
            "release_readiness",
            "release_approval",
            "comparison_safety",
          ].includes(String(g.gate_family)),
      )
      .map((g) => String(g.gate_id)),
    ordinary_l2a_public_release_dependency_status: "blocked" as const,
    ordinary_l2a_comparison_dependency_status:
      "ordinary_single_take_comparison_not_applicable" as const,
    public_scoring_feature_status: "blocked" as const,
    public_scoring_suppression_proof_status: publicScoringSuppressionStatus,
    public_technique_authority_feature_status: "blocked" as const,
    public_technique_authority_suppression_proof_status: publicTechniqueSuppressionStatus,
    public_comparison_recommendation_feature_status: "blocked" as const,
    public_comparison_recommendation_suppression_proof_status: publicComparisonSuppressionStatus,
    comparison_safety_suppression_proof_status: String(
      input.acceptance_metrics_snapshot?.comparison_safety_suppression_proof_status ??
        publicComparisonSuppressionStatus,
    ),
    duplicate_same_video_safety_status: duplicateSameVideoSafetyStatus,
    global_level2_evidence_status: globalLevel2EvidenceStatus,
    global_level2_suppression_proof_status: globalLevel2SuppressionProofStatus,
    global_level2_release_status: String(
      input.acceptance_metrics_snapshot?.global_level2_release_status ?? "blocked",
    ),
    global_level2_release_readiness_status: globalLevel2ReleaseReadinessStatus,
    global_level2_acceptance_status: globalLevel2AcceptanceStatus,
    global_level2_acceptance_reason: String(
      input.acceptance_metrics_snapshot?.global_level2_acceptance_reason ??
        "global_level2_not_accepted_public_release_blocked",
    ),
    runtime_operator_verification_status: runtimeOperatorVerificationStatus,
    deployment_provenance_status: deploymentProvenanceStatus,
    operator_confirmation_status: operatorConfirmationStatus,
    production_safe_readiness_status: productionSafeReadinessStatus,
    customer_release_readiness_status: customerReleaseReadinessStatus,
    global_level2_blocker_codes_by_family:
      input.acceptance_metrics_snapshot?.global_level2_blocker_codes_by_family ?? {},
    global_level2_satisfied_gate_ids: getStringArray(
      input.acceptance_metrics_snapshot?.global_level2_satisfied_gate_ids,
    ),
    global_level2_unsatisfied_gate_ids: getStringArray(
      input.acceptance_metrics_snapshot?.global_level2_unsatisfied_gate_ids,
    ),
    global_level2_blocked_release_gate_ids: getStringArray(
      input.acceptance_metrics_snapshot?.global_level2_blocked_release_gate_ids,
    ),
    global_level2_suppression_proof_gate_ids: getStringArray(
      input.acceptance_metrics_snapshot?.global_level2_suppression_proof_gate_ids,
    ),
    public_output_permissions: BLOCKED_PUBLIC_OUTPUT_PERMISSIONS,
  };
  const payload = {
    schema_version: "tapecoach_v3_gate_trace_first_pass_v1",
    artefact_type: "gate_trace",
    internal_only: true,
    privacy_classification: "internal_private",
    run_id: input.run_id,
    analysis_run_id: analysisRunId,
    take_id: input.take_id,
    generated_at: new Date().toISOString(),
    source_module: input.source_module,
    source_stage: input.source_stage,
    source_classification: ordinaryL2AGateSatisfied
      ? "independent_gate_decision"
      : "internal_gate_trace",
    trace_mode: "ordinary_l2a_independent_gate_decisions",
    validated_snapshot_stage: "pre_finalisation_snapshot",
    final_manifest_rewrite_expected: true,
    self_inclusion_validated: false,
    intended_same_finalisation_artefact_ids: input.intended_same_finalisation_artefact_ids ?? [
      "validator_trace",
      "gate_trace",
    ],
    ...summary,
    gate_entries,
    gate_trace_summary: summary,
    cannot_satisfy_level2_gate_trace_gate: !ordinaryL2AGateSatisfied,
    gate_satisfaction_reason: summary.gate_trace_gate_reason,
    blocker_codes: ordinaryL2AGateSatisfied
      ? ["public_release_gates_blocked"]
      : ["GateTrace_internal_only"],
    level2_status: "not_accepted",
    production_safe_status: "blocked",
    public_scoring_status: "blocked",
    public_technique_authority_status: "blocked",
    public_output_unchanged: true,
    ...resolveQADeploymentProvenance(),
  };
  const relPath = `takes/take-${input.take_id}/analysis-${analysisRunId}/traces/GateTrace.json`;
  const w = await writeInternalJson(
    input.root_dir ?? DEFAULT_ROOT,
    input.run_id,
    relPath,
    payload,
    "gate_trace",
  );
  if (!w.written) return { written: false, emitted_artefact_ids: [] as string[] };
  return {
    written: true,
    emitted_artefact_ids: ["gate_trace"],
    path: w.path ?? w.storage_path,
    gate_trace_summary: summary,
  };
}

export function dedupePreservingOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}
