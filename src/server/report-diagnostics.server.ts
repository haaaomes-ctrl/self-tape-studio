// SERVER-ONLY: report diagnostic bundle for the admin-only Step-1-evidence
// panel (PR-3 of the report-surface rebuild).
//
// Read-only against existing data: downloads the two QA artifacts for a take
// from the qa-artifacts bucket and reads its take_ai_usage rows. No schema,
// write, or pipeline changes. Callers must be admin-asserted BEFORE invoking
// (the server-fn wrapper in src/server-fns/report-diagnostics.functions.ts
// runs assertAdminClaims first) — this module assumes an authorised caller.
//
// Confirmed live layout (2026-06-06): artifacts are NESTED, never flat —
//   take-<takeId>/analysis-<analysisRunId>/analysis/Step1ObservableEvidence.json
//   take-<takeId>/analysis-<analysisRunId>/reports/raw_report.json
// with analysisRunId = "take-<takeId>" for current takes (writer:
// src/server/v3/qa-artifact-sink.server.ts). We list-and-suffix-match the
// newest analysis-* run folder rather than hardcoding the run segment.
//
// Degrades gracefully by design: older takes have NO artifact folders
// (live reality — only 2 of the usage-bearing takes have artifacts), so
// missing artifacts return status "not_captured" and malformed JSON returns
// "parse_failed"; this builder never throws for artifact problems.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { resolveQAArtifactStorageBucket } from "@/lib/qa-artifact-storage-bucket";
import { safeCutoverLog } from "@/server/cutover-diagnostics.server";

export type DiagnosticArtifactStatus = "ok" | "not_captured" | "parse_failed";

export type DiagnosticArtifact = {
  status: DiagnosticArtifactStatus;
  path: string | null;
  json: Json | null;
};

export type DiagnosticUsageRow = {
  step: string | null;
  status: string | null;
  model: string | null;
  prompt_version: string | null;
  provider_contract: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number | null;
  estimated_cost_usd: number | null;
  cost_source: string | null;
  repair_attempt: boolean;
  fallback_used: boolean;
  created_at: string | null;
};

export type DiagnosticUsageStepSummary = {
  step: string;
  rows: number;
  total_tokens: number | null;
  cost_usd: number;
};

export type ReportDiagnosticBundle = {
  take_id: string;
  artifacts: {
    run_folder: string | null;
    step1: DiagnosticArtifact;
    step2: DiagnosticArtifact;
  };
  usage: {
    rows: DiagnosticUsageRow[];
    per_step: DiagnosticUsageStepSummary[];
    total_cost_usd: number;
    total_tokens: number;
  };
};

const STEP1_RELATIVE_PATH = "analysis/Step1ObservableEvidence.json";
const STEP2_RELATIVE_PATH = "reports/raw_report.json";

function bucket() {
  return supabaseAdmin.storage.from(resolveQAArtifactStorageBucket().bucket);
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

async function findNewestRunFolder(takeId: string): Promise<string | null> {
  const { data, error } = await bucket().list(`take-${takeId}`, {
    limit: 100,
    sortBy: { column: "name", order: "desc" },
  });
  if (error || !data) {
    if (error) {
      safeCutoverLog("warn", "[report-diagnostics] run_folder_list_failed", {
        operation: "report_diagnostics_list",
        code: "qa_artifact_list_failed",
        table: "storage.objects",
        action: "list",
        error,
      });
    }
    return null;
  }
  // Folder entries come back with id === null; pick the newest analysis-* run.
  const folders = data
    .filter((entry) => entry.id === null && entry.name.startsWith("analysis-"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  return folders[0] ?? null;
}

async function downloadArtifact(takeId: string, runFolder: string | null, relativePath: string) {
  if (!runFolder) {
    return { status: "not_captured", path: null, json: null } satisfies DiagnosticArtifact;
  }
  const path = `take-${takeId}/${runFolder}/${relativePath}`;
  const { data, error } = await bucket().download(path);
  if (error || !data) {
    return { status: "not_captured", path, json: null } satisfies DiagnosticArtifact;
  }
  try {
    const text = await data.text();
    return { status: "ok", path, json: JSON.parse(text) as Json } satisfies DiagnosticArtifact;
  } catch (parseError) {
    safeCutoverLog("warn", "[report-diagnostics] artifact_parse_failed", {
      operation: "report_diagnostics_parse",
      code: "qa_artifact_parse_failed",
      table: "storage.objects",
      action: "download",
      error: parseError,
    });
    return { status: "parse_failed", path, json: null } satisfies DiagnosticArtifact;
  }
}

async function readUsageRows(takeId: string): Promise<DiagnosticUsageRow[]> {
  const { data, error } = await supabaseAdmin
    .from("take_ai_usage")
    .select(
      "step, status, model, prompt_version, provider_contract, prompt_tokens, completion_tokens, total_tokens, latency_ms, estimated_cost_usd, cost_source, repair_attempt, fallback_used, created_at",
    )
    .eq("take_id", takeId)
    .order("created_at", { ascending: true });
  if (error || !data) {
    if (error) {
      safeCutoverLog("warn", "[report-diagnostics] usage_read_failed", {
        operation: "report_diagnostics_usage",
        code: "take_ai_usage_read_failed",
        table: "take_ai_usage",
        action: "select",
        error,
      });
    }
    return [];
  }
  return (data as Array<Record<string, unknown>>).map((row) => ({
    step: typeof row.step === "string" ? row.step : null,
    status: typeof row.status === "string" ? row.status : null,
    model: typeof row.model === "string" ? row.model : null,
    prompt_version: typeof row.prompt_version === "string" ? row.prompt_version : null,
    provider_contract: typeof row.provider_contract === "string" ? row.provider_contract : null,
    prompt_tokens: numberOrNull(row.prompt_tokens),
    completion_tokens: numberOrNull(row.completion_tokens),
    total_tokens: numberOrNull(row.total_tokens),
    latency_ms: numberOrNull(row.latency_ms),
    // numeric comes back as a string from PostgREST — normalise.
    estimated_cost_usd: numberOrNull(row.estimated_cost_usd),
    cost_source: typeof row.cost_source === "string" ? row.cost_source : null,
    repair_attempt: row.repair_attempt === true,
    fallback_used: row.fallback_used === true,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  }));
}

function summariseUsage(rows: DiagnosticUsageRow[]) {
  const perStep = new Map<string, DiagnosticUsageStepSummary>();
  let totalCost = 0;
  let totalTokens = 0;
  for (const row of rows) {
    const step = row.step ?? "unknown";
    const entry = perStep.get(step) ?? { step, rows: 0, total_tokens: null, cost_usd: 0 };
    entry.rows += 1;
    if (row.total_tokens != null) {
      entry.total_tokens = (entry.total_tokens ?? 0) + row.total_tokens;
      totalTokens += row.total_tokens;
    }
    entry.cost_usd += row.estimated_cost_usd ?? 0;
    perStep.set(step, entry);
    totalCost += row.estimated_cost_usd ?? 0;
  }
  return {
    per_step: [...perStep.values()],
    total_cost_usd: totalCost,
    total_tokens: totalTokens,
  };
}

export async function buildReportDiagnosticBundle(takeId: string): Promise<ReportDiagnosticBundle> {
  const runFolder = await findNewestRunFolder(takeId);
  const [step1, step2, usageRows] = await Promise.all([
    downloadArtifact(takeId, runFolder, STEP1_RELATIVE_PATH),
    downloadArtifact(takeId, runFolder, STEP2_RELATIVE_PATH),
    readUsageRows(takeId),
  ]);
  const summary = summariseUsage(usageRows);
  return {
    take_id: takeId,
    artifacts: { run_folder: runFolder, step1, step2 },
    usage: { rows: usageRows, ...summary },
  };
}
