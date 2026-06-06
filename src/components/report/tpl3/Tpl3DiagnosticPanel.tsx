// OPERATOR-ONLY diagnostic panel (PR-3). Lazy-loaded by the AdminReport
// Diagnostics mount in V2ReportView — never part of the performer render
// path, never in print (.tc-print-exclude on the mount).
//
// Per report module: LEFT = the raw Step 1 evidence fields that feed it
// (provenance.step1EvidenceFields, extracted from the Step1ObservableEvidence
// artifact), RIGHT = the Step 2 narrated output (the lossless envelope.data,
// plus the module's structured-output fields from raw_report.json where
// present), with the state chip, readiness, decision-critical flag and the
// ESTIMATED per-module cost. Per-step figures are real; per-module figures
// are estimates by construction (Step 2 is one composed call) and are always
// labelled "est.".

import { useEffect, useMemo, useState } from "react";
import {
  estimateReportModuleCosts,
  REPORT_MODULE_KEYS,
  REPORT_MODULE_PROVENANCE,
  type ReportCostAttribution,
  type ReportModuleKey,
  type ReportViewModel,
} from "@/lib/report-view-model";
import { getReportDiagnosticBundle } from "@/server-fns/report-diagnostics.functions";
import type { ReportDiagnosticBundle } from "@/server/report-diagnostics.server";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Best-effort lookup of a Step 1 evidence field inside the
 * Step1ObservableEvidence artifact. The artifact is a QA container whose
 * exact nesting can evolve; we check the obvious roots and report honest
 * absence rather than guessing deeper.
 */
function extractStep1Field(artifact: unknown, field: string): unknown {
  if (!isRecord(artifact)) return undefined;
  if (field in artifact) return artifact[field];
  for (const root of ["evidence_pass", "evidence", "step1", "step1_evidence", "payload"]) {
    const nested = artifact[root];
    if (isRecord(nested) && field in nested) return nested[field];
  }
  return undefined;
}

function extractStep2Field(artifact: unknown, fieldPath: string): unknown {
  if (!isRecord(artifact)) return undefined;
  const segments = fieldPath.split(".");
  let current: unknown = artifact;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) return undefined;
    current = current[segment];
  }
  return current;
}

function JsonDisclosure({ label, value }: { label: string; value: unknown }) {
  if (value === undefined) {
    return <p className="text-[11px] italic text-muted-foreground">{label}: not present</p>;
  }
  return (
    <details className="min-w-0">
      <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">
        {label}
      </summary>
      <pre className="mt-1 max-h-72 overflow-auto rounded border border-border bg-muted/30 p-2 text-[10px] leading-snug">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

function ArtifactStatusLine({
  label,
  artifact,
}: {
  label: string;
  artifact: ReportDiagnosticBundle["artifacts"]["step1"];
}) {
  return (
    <p className="text-xs">
      <span className="font-semibold">{label}:</span>{" "}
      {artifact.status === "ok" ? (
        <span className="text-success">ok</span>
      ) : artifact.status === "parse_failed" ? (
        <span className="text-destructive">artifact could not be parsed</span>
      ) : (
        <span className="text-muted-foreground">artifact not captured for this take</span>
      )}
      {artifact.path && <span className="text-muted-foreground"> · {artifact.path}</span>}
    </p>
  );
}

const USD = (value: number) => (value >= 0.01 ? `$${value.toFixed(3)}` : `$${value.toFixed(4)}`);

export default function Tpl3DiagnosticPanel({
  takeId,
  viewModel,
  initialBundle = null,
}: {
  takeId: string;
  viewModel: ReportViewModel;
  /** Test seam: render synchronously from a pre-loaded bundle (skips fetch). */
  initialBundle?: ReportDiagnosticBundle | null;
}) {
  const [bundle, setBundle] = useState<ReportDiagnosticBundle | null>(initialBundle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialBundle) return;
    let cancelled = false;
    getReportDiagnosticBundle({ data: { takeId } })
      .then((result) => {
        if (!cancelled) setBundle(result as ReportDiagnosticBundle);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "diagnostics unavailable");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [takeId, initialBundle]);

  const costs: ReportCostAttribution | null = useMemo(() => {
    if (!bundle) return null;
    return estimateReportModuleCosts(
      bundle.usage.rows.map((row) => ({
        step: row.step,
        total_tokens: row.total_tokens,
        estimated_cost_usd: row.estimated_cost_usd,
      })),
      viewModel,
      isRecord(bundle.artifacts.step1.json) ? bundle.artifacts.step1.json : null,
    );
  }, [bundle, viewModel]);

  if (error) {
    return <p className="text-xs text-destructive">Diagnostics failed to load: {error}</p>;
  }
  if (!bundle) {
    return <p className="text-xs text-muted-foreground">Loading diagnostics…</p>;
  }

  const costByModule = new Map(costs?.perModule.map((row) => [row.key, row]) ?? []);
  const step1Json = bundle.artifacts.step1.json;
  const step2Json = bundle.artifacts.step2.json;

  return (
    <div className="space-y-4 text-sm">
      {/* Per-step REAL figures */}
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          AI usage — real per-step figures
        </p>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="pr-3 font-semibold">step</th>
              <th className="pr-3 font-semibold">rows</th>
              <th className="pr-3 font-semibold">tokens</th>
              <th className="pr-3 font-semibold">cost</th>
            </tr>
          </thead>
          <tbody>
            {bundle.usage.per_step.map((row) => (
              <tr key={row.step}>
                <td className="pr-3 font-mono">{row.step}</td>
                <td className="pr-3 tabular-nums">{row.rows}</td>
                <td className="pr-3 tabular-nums">{row.total_tokens ?? "—"}</td>
                <td className="pr-3 tabular-nums">{USD(row.cost_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs">
          <span className="font-semibold">Total:</span>{" "}
          <span className="tabular-nums">
            {USD(bundle.usage.total_cost_usd)} · {bundle.usage.total_tokens} tokens
          </span>
          {costs && (
            <span className="text-muted-foreground">
              {" "}
              · overhead (not module-attributable): {USD(costs.overheadCostUsd)} est.
            </span>
          )}
        </p>
        <div className="mt-2 space-y-1">
          {bundle.usage.rows.map((row, index) => (
            <p key={index} className="font-mono text-[10px] text-muted-foreground">
              {row.step} · {row.model ?? "?"} · {row.prompt_version ?? "no prompt version"} ·{" "}
              {row.total_tokens ?? "—"} tok · {USD(row.estimated_cost_usd ?? 0)} ·{" "}
              {row.cost_source ?? "?"} · {row.latency_ms ?? "—"} ms
            </p>
          ))}
        </div>
        <div className="mt-2 space-y-0.5">
          <ArtifactStatusLine label="Step 1 artifact" artifact={bundle.artifacts.step1} />
          <ArtifactStatusLine label="Step 2 artifact" artifact={bundle.artifacts.step2} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Per-module figures below are ESTIMATES (Step 2 is one composed call; cost is redistributed
          by serialized module size and always reconciles to the real row totals). Framing:
          decision-critical + cheap → keep · non-critical + expensive → prune candidate. Prompt
          versions exist per STEP, not per module.
        </p>
      </div>

      {/* Per-module Step 1 ↔ Step 2 traceability */}
      <div className="space-y-3">
        {REPORT_MODULE_KEYS.map((key: ReportModuleKey) => {
          const module = viewModel.modules[key];
          const provenance = REPORT_MODULE_PROVENANCE[key];
          const cost = costByModule.get(key);
          return (
            <div key={key} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold">{key}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 font-semibold ${
                    module.state === "populated"
                      ? "border-success/40 text-success"
                      : module.state === "limited"
                        ? "border-warning/40 text-warning"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {module.state}
                  {module.emptyKind ? ` · ${module.emptyKind}` : ""}
                </span>
                <span className="text-muted-foreground">
                  {module.readiness
                    ? `readiness: ${module.readiness.status}${module.readiness.decision_critical ? " · decision-critical" : ""}`
                    : "readiness not recorded"}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {cost
                    ? `${USD(cost.estCostUsd)} · ${cost.estTokens} tok (est.)`
                    : "no cost attributed (est.)"}
                </span>
              </div>
              {module.reason && (
                <p className="mt-1 text-[11px] text-muted-foreground">reason: {module.reason}</p>
              )}
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Step 1 evidence
                  </p>
                  {provenance.step1EvidenceFields.length === 0 && (
                    <p className="text-[11px] italic text-muted-foreground">
                      no Step 1 evidence fields mapped to this module
                    </p>
                  )}
                  {provenance.step1EvidenceFields.map((field) => (
                    <JsonDisclosure
                      key={field}
                      label={field}
                      value={extractStep1Field(step1Json, field)}
                    />
                  ))}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Step 2 narration
                  </p>
                  <JsonDisclosure label="persisted module (envelope.data)" value={module.data} />
                  {provenance.structuredOutputFields.map((field) => (
                    <JsonDisclosure
                      key={field}
                      label={`raw_report.${field}`}
                      value={extractStep2Field(step2Json, field)}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lossless escape hatch */}
      <JsonDisclosure label="rawFallback — full persisted report" value={viewModel.rawFallback} />
    </div>
  );
}
