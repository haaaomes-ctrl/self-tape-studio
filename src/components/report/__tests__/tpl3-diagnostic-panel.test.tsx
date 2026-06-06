// PR-3: operator-only diagnostic panel.
//
// The panel renders from a pre-loaded bundle (test seam) — per-module rows
// with "est." cost labels, "readiness not recorded" for current takes, and
// honest artifact markers. The NEGATIVE test pins the red line: a performer
// -path static render of V2ReportView contains zero diagnostics markup even
// when takeId is provided (admin gating via effects never runs statically,
// and non-admins render nothing at runtime).

import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Tpl3DiagnosticPanel from "../tpl3/Tpl3DiagnosticPanel";
import { V2ReportView } from "../V2ReportView";
import { buildReportViewModel, type ReportViewModel } from "@/lib/report-view-model";
import type { ReportDiagnosticBundle } from "@/server/report-diagnostics.server";
import { buildV2Report } from "@/server/v2-report-builder.server";
import {
  buildS10CanaryAReportInput,
  buildS10CanaryAViewContext,
} from "@/test-fixtures/s10-canary-a-incomplete-package";

const TAKE_ID = "39cc95b2-eeca-4d12-ac79-71a50a53528d";

function canaryViewModel(): { report: Record<string, unknown>; viewModel: ReportViewModel } {
  const report = buildV2Report({
    legacyReport: buildS10CanaryAReportInput(),
    futureDimensions: null,
    auditionType: "musical_theatre",
    mode: "brief",
    s10Context: buildS10CanaryAViewContext() as never,
  }) as unknown as Record<string, unknown>;
  const viewModel = buildReportViewModel(report, { takeNumber: 1 });
  if (!viewModel) throw new Error("fixture view-model failed to build");
  return { report, viewModel };
}

function fixtureBundle(): ReportDiagnosticBundle {
  return {
    take_id: TAKE_ID,
    artifacts: {
      run_folder: `analysis-take-${TAKE_ID}`,
      step1: {
        status: "ok",
        path: `take-${TAKE_ID}/analysis-take-${TAKE_ID}/analysis/Step1ObservableEvidence.json`,
        json: {
          raw_scores: { acting: 70, vocal: 78 },
          timestamped_evidence: [{ timestamp: "00:10", observation: "entry" }],
        },
      },
      step2: {
        status: "not_captured",
        path: `take-${TAKE_ID}/analysis-take-${TAKE_ID}/reports/raw_report.json`,
        json: null,
      },
    },
    usage: {
      rows: [
        {
          step: "evidence_pass",
          status: "success",
          model: "google/gemini-2.5-flash",
          prompt_version: "s10_observation_module_map_v1",
          provider_contract: "plain_json_observations",
          prompt_tokens: 7609,
          completion_tokens: 3988,
          total_tokens: 11597,
          latency_ms: 20000,
          estimated_cost_usd: 0.07,
          cost_source: "token_usage_available",
          repair_attempt: false,
          fallback_used: false,
          created_at: "2026-06-04T20:59:07Z",
        },
        {
          step: "report_polish",
          status: "success",
          model: "google/gemini-2.5-flash",
          prompt_version: "s10_professional_judgement_module_map_v1",
          provider_contract: "tool_call",
          prompt_tokens: 30530,
          completion_tokens: 33231,
          total_tokens: 63761,
          latency_ms: 120000,
          estimated_cost_usd: 0.0339,
          cost_source: "token_usage_available",
          repair_attempt: false,
          fallback_used: false,
          created_at: "2026-06-04T21:01:15Z",
        },
      ],
      per_step: [
        { step: "evidence_pass", rows: 1, total_tokens: 11597, cost_usd: 0.07 },
        { step: "report_polish", rows: 1, total_tokens: 63761, cost_usd: 0.0339 },
      ],
      total_cost_usd: 0.1039,
      total_tokens: 75358,
    },
  };
}

function text(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("Tpl3DiagnosticPanel (pre-loaded bundle)", () => {
  it("renders per-step real figures, per-module rows with est. labels and honest markers", () => {
    const { viewModel } = canaryViewModel();
    const html = renderToStaticMarkup(
      <Tpl3DiagnosticPanel
        takeId={TAKE_ID}
        viewModel={viewModel}
        initialBundle={fixtureBundle()}
      />,
    );
    const t = text(html);

    // Per-step REAL figures.
    expect(t).toContain("AI usage — real per-step figures");
    expect(t).toContain("evidence_pass");
    expect(t).toContain("report_polish");
    expect(t).toContain("s10_observation_module_map_v1");

    // Per-module traceability rows keyed by ReportModuleKey.
    expect(t).toContain("recommendation");
    expect(t).toContain("fixHierarchy");
    expect(t).toContain("Step 1 evidence");
    expect(t).toContain("Step 2 narration");
    expect(t).toContain("persisted module (envelope.data)");

    // Current takes carry no readiness block — stated, not faked.
    expect(t).toContain("readiness not recorded");

    // Cost figures are estimates and say so.
    expect(t).toContain("(est.)");
    expect(t).toContain("ESTIMATES");

    // Honest artifact markers (step2 deliberately not captured here).
    expect(t).toContain("artifact not captured for this take");

    // Lossless escape hatch present.
    expect(t).toContain("rawFallback — full persisted report");
  });

  it("shows a loading state when no bundle is pre-loaded (fetch never runs statically)", () => {
    const { viewModel } = canaryViewModel();
    const html = renderToStaticMarkup(
      <Tpl3DiagnosticPanel takeId={TAKE_ID} viewModel={viewModel} />,
    );
    expect(text(html)).toContain("Loading diagnostics…");
  });
});

describe("performer-path red line", () => {
  it("static render of V2ReportView with takeId contains ZERO diagnostics markup", () => {
    const { report } = canaryViewModel();
    const html = renderToStaticMarkup(
      <V2ReportView
        report={report}
        takeNumber={1}
        auditionType="musical_theatre"
        takeId={TAKE_ID}
      />,
    );
    expect(html).not.toContain("Show diagnostics");
    expect(html).not.toContain("diagnostics");
    expect(html).not.toContain("Step 1 evidence");
    expect(html).not.toContain(TAKE_ID);
  });

  it("the diagnostics mount is print-excluded and admin-gated in source", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "../V2ReportView.tsx"), "utf8");
    const mountIndex = source.indexOf("function AdminReportDiagnostics");
    expect(mountIndex).toBeGreaterThan(-1);
    const mountSource = source.slice(mountIndex, source.indexOf("type V2 = any"));
    expect(mountSource).toContain("tc-print-exclude");
    expect(mountSource).toContain("whoAmIAdmin");
    expect(mountSource).toContain("if (!isAdmin) return null");
  });
});
