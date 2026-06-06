// PR-3: report diagnostic bundle — storage list/suffix-match/download/parse,
// usage read, per-step sums; degrades gracefully (never throws for artifact
// problems); admin assertion wired FIRST in the server-fn wrapper.

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const list = vi.fn();
  const download = vi.fn();
  const usageResult = { value: { data: [] as unknown[], error: null as unknown } };
  const builder = () => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => Promise.resolve(usageResult.value)),
    };
    return chain;
  };
  return { list, download, usageResult, builder };
});

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    storage: { from: vi.fn(() => ({ list: mocks.list, download: mocks.download })) },
    from: vi.fn(() => mocks.builder()),
  },
  SupabaseAdminRuntimeConfigError: class extends Error {},
  setSupabaseAdminRuntimeEnvResolver: vi.fn(),
}));

// Established pattern (account-compliance-self-heal.test.ts): silence the
// safe logger rather than satisfying its runtime-config diagnostics shape.
vi.mock("@/server/cutover-diagnostics.server", () => ({
  safeCutoverLog: vi.fn(),
}));

import { buildReportDiagnosticBundle } from "@/server/report-diagnostics.server";

const TAKE_ID = "39cc95b2-eeca-4d12-ac79-71a50a53528d";

function folderEntry(name: string) {
  return { name, id: null, updated_at: null, metadata: null };
}

function blobOf(text: string) {
  return { text: async () => text };
}

beforeEach(() => {
  mocks.list.mockReset();
  mocks.download.mockReset();
  mocks.usageResult.value = { data: [], error: null };
});

describe("buildReportDiagnosticBundle", () => {
  it("downloads both artifacts from the newest analysis run folder and sums usage per step", async () => {
    mocks.list.mockResolvedValue({
      data: [folderEntry(`analysis-take-${TAKE_ID}`)],
      error: null,
    });
    mocks.download.mockImplementation(async (artifactPath: string) => {
      if (artifactPath.endsWith("analysis/Step1ObservableEvidence.json")) {
        return { data: blobOf(JSON.stringify({ raw_scores: { acting: 70 } })), error: null };
      }
      if (artifactPath.endsWith("reports/raw_report.json")) {
        return { data: blobOf(JSON.stringify({ overall_score: 69 })), error: null };
      }
      return { data: null, error: { message: "not found" } };
    });
    mocks.usageResult.value = {
      data: [
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
          // PostgREST returns numeric as a string — must normalise.
          estimated_cost_usd: "0.0700",
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
          estimated_cost_usd: "0.0339",
          cost_source: "token_usage_available",
          repair_attempt: false,
          fallback_used: false,
          created_at: "2026-06-04T21:01:15Z",
        },
      ],
      error: null,
    };

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);

    expect(mocks.list).toHaveBeenCalledWith(`take-${TAKE_ID}`, expect.anything());
    expect(bundle.artifacts.run_folder).toBe(`analysis-take-${TAKE_ID}`);
    expect(bundle.artifacts.step1.status).toBe("ok");
    expect(bundle.artifacts.step1.path).toBe(
      `take-${TAKE_ID}/analysis-take-${TAKE_ID}/analysis/Step1ObservableEvidence.json`,
    );
    expect(bundle.artifacts.step1.json).toEqual({ raw_scores: { acting: 70 } });
    expect(bundle.artifacts.step2.status).toBe("ok");
    expect(bundle.artifacts.step2.json).toEqual({ overall_score: 69 });

    expect(bundle.usage.rows).toHaveLength(2);
    expect(bundle.usage.rows[0].estimated_cost_usd).toBeCloseTo(0.07, 10);
    expect(bundle.usage.per_step).toEqual([
      { step: "evidence_pass", rows: 1, total_tokens: 11597, cost_usd: expect.closeTo(0.07, 10) },
      { step: "report_polish", rows: 1, total_tokens: 63761, cost_usd: expect.closeTo(0.0339, 10) },
    ]);
    expect(bundle.usage.total_cost_usd).toBeCloseTo(0.1039, 10);
    expect(bundle.usage.total_tokens).toBe(75358);
  });

  it("picks the NEWEST analysis-* folder when multiple runs exist", async () => {
    mocks.list.mockResolvedValue({
      data: [
        folderEntry("analysis-run-2026-01-01"),
        folderEntry("analysis-run-2026-06-01"),
        folderEntry("export_or_no_export"),
      ],
      error: null,
    });
    mocks.download.mockResolvedValue({ data: blobOf("{}"), error: null });

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);
    expect(bundle.artifacts.run_folder).toBe("analysis-run-2026-06-01");
  });

  it("degrades to not_captured for takes with no artifact folder — never throws", async () => {
    mocks.list.mockResolvedValue({ data: [], error: null });

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);
    expect(bundle.artifacts.run_folder).toBeNull();
    expect(bundle.artifacts.step1).toEqual({ status: "not_captured", path: null, json: null });
    expect(bundle.artifacts.step2).toEqual({ status: "not_captured", path: null, json: null });
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it("degrades to not_captured when a single artifact download fails", async () => {
    mocks.list.mockResolvedValue({ data: [folderEntry("analysis-x")], error: null });
    mocks.download.mockImplementation(async (artifactPath: string) => {
      if (artifactPath.endsWith("reports/raw_report.json")) {
        return { data: null, error: { message: "object not found" } };
      }
      return { data: blobOf("{}"), error: null };
    });

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);
    expect(bundle.artifacts.step1.status).toBe("ok");
    expect(bundle.artifacts.step2.status).toBe("not_captured");
    expect(bundle.artifacts.step2.path).toBe(`take-${TAKE_ID}/analysis-x/reports/raw_report.json`);
  });

  it("marks malformed artifact JSON as parse_failed — never throws", async () => {
    mocks.list.mockResolvedValue({ data: [folderEntry("analysis-x")], error: null });
    mocks.download.mockResolvedValue({ data: blobOf("{not json"), error: null });

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);
    expect(bundle.artifacts.step1.status).toBe("parse_failed");
    expect(bundle.artifacts.step1.json).toBeNull();
    expect(bundle.artifacts.step2.status).toBe("parse_failed");
  });

  it("returns empty usage when the usage read errors", async () => {
    mocks.list.mockResolvedValue({ data: [], error: null });
    mocks.usageResult.value = { data: null as never, error: { message: "boom" } };

    const bundle = await buildReportDiagnosticBundle(TAKE_ID);
    expect(bundle.usage.rows).toEqual([]);
    expect(bundle.usage.total_cost_usd).toBe(0);
  });
});

describe("server-fn wrapper wiring (source-text assertions)", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../server-fns/report-diagnostics.functions.ts"),
    "utf8",
  );

  it("asserts admin FIRST, behind the auth middleware, with uuid validation", () => {
    expect(source).toContain("attachSupabaseAuth");
    expect(source).toContain("requireSupabaseAuth");
    expect(source).toContain(".uuid()");
    const assertIndex = source.indexOf("assertAdminClaims(");
    const buildIndex = source.indexOf("buildReportDiagnosticBundle");
    expect(assertIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(assertIndex).toBeLessThan(buildIndex);
  });
});
