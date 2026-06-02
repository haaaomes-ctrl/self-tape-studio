import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Override only supabaseAdmin so the take-load returns null and runAnalysisJob
// short-circuits to "Take not found" — proving the seam is wired and accepts the
// injected capabilities WITHOUT running the heavy pipeline. All other
// client.server exports stay real (other modules depend on them at load).
const takeLoad: { data: unknown; error: unknown } = { data: null, error: null };
vi.mock("@/integrations/supabase/client.server", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.single = vi.fn(async () => takeLoad);
  builder.maybeSingle = vi.fn(async () => takeLoad);
  return { ...actual, supabaseAdmin: { from: vi.fn(() => builder) } };
});

import { createAnalysisAiProvider } from "../analysis-ai-provider.server";
import { buildJobEnv, runAnalysisJob, runProcessTake } from "../process-take.server";

function lovableProvider() {
  return createAnalysisAiProvider({ lovableApiKey: "test-lovable-key" });
}

describe("runAnalysisJob seam", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    takeLoad.data = null;
    takeLoad.error = null;
  });

  describe("buildJobEnv", () => {
    it("returns process.env when no env is injected (preserves Lovable behaviour)", () => {
      expect(buildJobEnv()).toBe(process.env);
      expect(buildJobEnv(null)).toBe(process.env);
    });

    it("uses ONLY the injected env in explicit mode — no process.env fallback, no mutation", () => {
      vi.stubEnv("ANALYSIS_MAX_RETRIES", "9");
      const env = buildJobEnv({ ANALYSIS_GEMINI_TIMEOUT_MS: "1234" });

      expect(env.ANALYSIS_GEMINI_TIMEOUT_MS).toBe("1234");
      // Present in process.env but absent from the injected env => must stay undefined.
      expect(env.ANALYSIS_MAX_RETRIES).toBeUndefined();
      // Non-string injected values are ignored.
      expect(buildJobEnv({ FOO: 123 } as never).FOO).toBeUndefined();
      // process.env is never mutated.
      expect(process.env.ANALYSIS_MAX_RETRIES).toBe("9");
      expect(process.env.ANALYSIS_GEMINI_TIMEOUT_MS).not.toBe("1234");
    });
  });

  describe("seam wiring", () => {
    it("runAnalysisJob accepts an injected aiProvider + explicit env and runs the pipeline", async () => {
      const result = await runAnalysisJob({
        takeId: "take-404",
        aiProvider: lovableProvider(),
        env: {
          TAPECOACH_SUPABASE_URL: "https://owned.supabase.co",
          TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: "svc",
        },
      });
      // Reaches the take-load (mocked null) and returns the existing early result.
      expect(result).toEqual({ ok: false, error: "Take not found" });
    });

    it("runProcessTake keeps its signature, builds the default provider, and delegates", async () => {
      // No LOVABLE/OPENROUTER keys required to reach the early return.
      vi.stubEnv("LOVABLE_API_KEY", "");
      vi.stubEnv("OPENROUTER_API_KEY", "");
      const result = await runProcessTake("take-404");
      expect(result).toEqual({ ok: false, error: "Take not found" });
      // Public signature unchanged: (takeId, allowOriginal?, options?).
      const withOptions = await runProcessTake("take-404", false, { preClaimed: true });
      expect(withOptions).toEqual({ ok: false, error: "Take not found" });
    });

    it("default provider is the Lovable gateway and does not require OPENROUTER_API_KEY", () => {
      vi.stubEnv("OPENROUTER_API_KEY", "");
      const provider = createAnalysisAiProvider({ lovableApiKey: "k" });
      expect(provider.id).toBe("lovable_ai_gateway");
    });
  });

  describe("source invariants", () => {
    it("creates the provider only in the wrapper and uses the injected provider in the seam", async () => {
      const src = await readFile(
        path.join(process.cwd(), "src/server/process-take.server.ts"),
        "utf8",
      );
      expect(src).toContain("export async function runAnalysisJob(");
      expect(src).toContain("export async function runProcessTake(");
      // Seam uses the injected provider; the only provider-creation site is the wrapper.
      expect(src).toContain("const aiProvider = params.aiProvider;");
      const creationSites = src.match(/const aiProvider = createAnalysisAiProvider\(/g) ?? [];
      expect(creationSites).toHaveLength(1);
      // QA/route string markers must be unchanged by the rename.
      expect(src).toContain('route_module: "runProcessTake"');
      expect(src).toContain('analysis_route: "runProcessTake"');
    });
  });
});
