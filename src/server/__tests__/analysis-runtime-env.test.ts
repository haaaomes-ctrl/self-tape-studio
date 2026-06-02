import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Worker request-env accessor so we can simulate a Cloudflare Worker
// binding for the no-arg resolution path. Defaults to null (Node/dev path).
const getRequestEnvMock = vi.hoisted(() => vi.fn((): Record<string, unknown> | null => null));
vi.mock("@/worker-entry", () => ({ getRequestEnv: getRequestEnvMock }));

import {
  AnalysisRuntimeConfigError,
  mapCloudflareEnvToAnalysisRuntimeEnvInput,
  requireAnalysisRuntimeEnv,
  resolveAnalysisRuntimeEnv,
  resolveAnalysisRuntimeEnvFromCloudflare,
  type AnalysisRuntimeEnvInput,
} from "../analysis-runtime-env.server";

const SECRET_VALUES = {
  serviceRole: "owned-service-role-secret",
  openRouter: "or-secret-key",
  muxId: "mux-id-secret",
  muxSecret: "mux-token-secret",
  muxWebhook: "mux-webhook-secret",
} as const;

function fullOwnedEnv(): AnalysisRuntimeEnvInput {
  return {
    TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
    TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
    OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    OPENROUTER_SITE_URL: "https://tapecoach.example",
    OPENROUTER_APP_TITLE: "TapeCoach",
    S10_MODEL_STEP1: "model/step1",
    S10_MODEL_STEP2: "model/step2",
    S10_MODEL_RECOVERY: "model/recovery",
    MUX_TOKEN_ID: SECRET_VALUES.muxId,
    MUX_TOKEN_SECRET: SECRET_VALUES.muxSecret,
    MUX_WEBHOOK_SECRET: SECRET_VALUES.muxWebhook,
    QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
    QA_ARTIFACT_SINK: "storage",
  };
}

describe("analysis runtime env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    getRequestEnvMock.mockReturnValue(null);
  });

  it("resolves the full Lovable/app runtime env from an injected object", () => {
    const env = requireAnalysisRuntimeEnv(fullOwnedEnv());

    expect(env).toMatchObject({
      supabaseUrl: "https://owned-project.supabase.co",
      supabaseServiceRoleKey: SECRET_VALUES.serviceRole,
      openRouterApiKey: SECRET_VALUES.openRouter,
      openRouterSiteUrl: "https://tapecoach.example",
      openRouterAppTitle: "TapeCoach",
      s10ModelStep1: "model/step1",
      s10ModelStep2: "model/step2",
      s10ModelRecovery: "model/recovery",
      muxTokenId: SECRET_VALUES.muxId,
      muxTokenSecret: SECRET_VALUES.muxSecret,
      muxWebhookSecret: SECRET_VALUES.muxWebhook,
      qaArtifactStorageBucket: "qa-artifacts",
      qaArtifactSink: "storage",
    });
  });

  it("falls back to legacy SUPABASE env names when TAPECOACH names are absent", () => {
    const resolved = resolveAnalysisRuntimeEnv({
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    });

    expect(resolved).toMatchObject({
      supabaseUrl: "https://legacy-project.supabase.co",
      supabaseServiceRoleKey: "legacy-service-role",
      openRouterApiKey: SECRET_VALUES.openRouter,
    });
  });

  it("does not mix TapeCoach and legacy Supabase env pairs", () => {
    const resolved = resolveAnalysisRuntimeEnv({
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    });

    expect(resolved.supabaseUrl).toBeNull();
    expect(resolved.supabaseServiceRoleKey).toBe(SECRET_VALUES.serviceRole);
    expect(resolved.diagnostics.supabase_url_configured).toBe(false);

    expect(() =>
      requireAnalysisRuntimeEnv({
        TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
        SUPABASE_URL: "https://legacy-project.supabase.co",
        OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
      }),
    ).toThrow(AnalysisRuntimeConfigError);
  });

  it("maps a Cloudflare Worker env binding without reading process.env", () => {
    // Stub process.env for keys the Cloudflare env both supplies AND omits, so a
    // pass only proves the mapper ignores process.env (not that values happen to match).
    vi.stubEnv("TAPECOACH_SUPABASE_URL", "https://process-env-should-not-win.supabase.co");
    vi.stubEnv("OPENROUTER_API_KEY", "process-env-openrouter-should-not-win");
    // These two are intentionally absent from cfEnv below; process.env must NOT fill them.
    vi.stubEnv("MUX_WEBHOOK_SECRET", "process-env-mux-webhook-should-not-win");
    vi.stubEnv("S10_MODEL_STEP1", "process-env-model-should-not-win");

    const cfEnv: Record<string, unknown> = {
      TAPECOACH_SUPABASE_URL: "https://worker-project.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
      MUX_TOKEN_ID: SECRET_VALUES.muxId,
      MUX_TOKEN_SECRET: SECRET_VALUES.muxSecret,
      QA_ARTIFACT_STORAGE_BUCKET: "qa-artifacts",
      QA_ARTIFACT_SINK: "storage",
      // Unrelated worker bindings should be ignored by the mapper.
      ANALYSIS_QUEUE: { send: () => undefined },
      APP_ENV: "production",
    };

    const env = requireAnalysisRuntimeEnv(mapCloudflareEnvToAnalysisRuntimeEnvInput(cfEnv));

    expect(env.supabaseUrl).toBe("https://worker-project.supabase.co");
    expect(env.openRouterApiKey).toBe(SECRET_VALUES.openRouter);
    expect(env.muxTokenId).toBe(SECRET_VALUES.muxId);
    expect(env.qaArtifactStorageBucket).toBe("qa-artifacts");

    // Decisive: keys absent from cfEnv stay null even though process.env defines
    // them — proving the Cloudflare path never consults process.env.
    const resolved = resolveAnalysisRuntimeEnvFromCloudflare(cfEnv);
    expect(resolved.supabaseUrl).toBe("https://worker-project.supabase.co");
    expect(resolved.muxWebhookSecret).toBeNull();
    expect(resolved.s10ModelStep1).toBeNull();
    expect(resolved.diagnostics.mux_webhook_secret_present).toBe(false);
    expect(resolved.diagnostics.s10_model_step1_configured).toBe(false);
    // The mapper only extracts known analysis keys; worker-only bindings are dropped.
    expect(Object.keys(mapCloudflareEnvToAnalysisRuntimeEnvInput(cfEnv))).not.toContain(
      "ANALYSIS_QUEUE",
    );
  });

  it("does not honour legacy Supabase names in the Cloudflare Worker mapper (fails safe)", () => {
    const cfEnv: Record<string, unknown> = {
      // Only the legacy pair is present on the Worker binding — no owned TAPECOACH pair.
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    };

    // The mapper drops legacy names, so the owned Supabase pair is absent.
    const resolved = resolveAnalysisRuntimeEnvFromCloudflare(cfEnv);
    expect(resolved.supabaseUrl).toBeNull();
    expect(resolved.supabaseServiceRoleKey).toBeNull();

    // The durable Worker guard fails safe rather than resolving the legacy project.
    expect(() =>
      requireAnalysisRuntimeEnv(mapCloudflareEnvToAnalysisRuntimeEnvInput(cfEnv)),
    ).toThrow(AnalysisRuntimeConfigError);
  });

  it("excludes legacy Supabase names on the no-arg Worker request env path (fails safe)", () => {
    // Simulate a Cloudflare Worker request whose binding carries only the legacy pair.
    getRequestEnvMock.mockReturnValue({
      SUPABASE_URL: "https://legacy-project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service-role",
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    });
    const legacyResolved = resolveAnalysisRuntimeEnv();
    expect(legacyResolved.supabaseUrl).toBeNull();
    expect(legacyResolved.supabaseServiceRoleKey).toBeNull();
    expect(() => requireAnalysisRuntimeEnv()).toThrow(AnalysisRuntimeConfigError);

    // The owned TAPECOACH pair on the same request-env path resolves normally.
    getRequestEnvMock.mockReturnValue({
      TAPECOACH_SUPABASE_URL: "https://worker-owned.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    });
    expect(requireAnalysisRuntimeEnv().supabaseUrl).toBe("https://worker-owned.supabase.co");
  });

  it("resolves from process.env on the Lovable/Node path when no env is injected", () => {
    vi.stubEnv("TAPECOACH_SUPABASE_URL", "https://node-process-env.supabase.co");
    vi.stubEnv("TAPECOACH_SUPABASE_SERVICE_ROLE_KEY", SECRET_VALUES.serviceRole);
    vi.stubEnv("OPENROUTER_API_KEY", SECRET_VALUES.openRouter);

    // No injected env and no request runtime env => falls back to process.env,
    // matching the existing per-domain resolvers (Mux, cutover, Supabase admin).
    const env = requireAnalysisRuntimeEnv();

    expect(env.supabaseUrl).toBe("https://node-process-env.supabase.co");
    expect(env.supabaseServiceRoleKey).toBe(SECRET_VALUES.serviceRole);
    expect(env.openRouterApiKey).toBe(SECRET_VALUES.openRouter);
  });

  it("returns a safe config failure when OPENROUTER_API_KEY is missing", () => {
    let thrown: unknown;
    try {
      requireAnalysisRuntimeEnv({
        TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
        TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AnalysisRuntimeConfigError);
    const error = thrown as AnalysisRuntimeConfigError;
    expect(error.missing).toContain("OPENROUTER_API_KEY");
    expect(error.diagnostics.openrouter_api_key_configured).toBe(false);
    expect(error.diagnostics.supabase_service_role_key_configured).toBe(true);
  });

  it("returns a safe config failure when the Supabase pair is missing", () => {
    let thrown: unknown;
    try {
      requireAnalysisRuntimeEnv({ OPENROUTER_API_KEY: SECRET_VALUES.openRouter });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AnalysisRuntimeConfigError);
    const error = thrown as AnalysisRuntimeConfigError;
    expect(error.missing).toEqual(
      expect.arrayContaining(["TAPECOACH_SUPABASE_URL", "TAPECOACH_SUPABASE_SERVICE_ROLE_KEY"]),
    );
    expect(error.diagnostics.supabase_url_configured).toBe(false);
    expect(error.diagnostics.supabase_service_role_key_configured).toBe(false);
  });

  it("never leaks secret values in config errors or diagnostics", () => {
    // Every secret value is present in the input; the throw is forced by the only
    // missing required field being the (non-secret) Supabase URL. This makes each
    // "secret does not appear" assertion meaningful rather than trivially true.
    let thrown: unknown;
    try {
      requireAnalysisRuntimeEnv({
        TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
        OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
        MUX_TOKEN_ID: SECRET_VALUES.muxId,
        MUX_TOKEN_SECRET: SECRET_VALUES.muxSecret,
        MUX_WEBHOOK_SECRET: SECRET_VALUES.muxWebhook,
      });
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(AnalysisRuntimeConfigError);
    const error = thrown as AnalysisRuntimeConfigError;
    expect(error.missing).toEqual(["TAPECOACH_SUPABASE_URL"]);
    const serialised = `${error.message}\n${JSON.stringify(error.diagnostics)}\n${error.missing.join(",")}`;
    for (const secret of Object.values(SECRET_VALUES)) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("reports optional Mux and QA artefact config via boolean-only diagnostics", () => {
    const resolved = resolveAnalysisRuntimeEnv({
      TAPECOACH_SUPABASE_URL: "https://owned-project.supabase.co",
      TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: SECRET_VALUES.serviceRole,
      OPENROUTER_API_KEY: SECRET_VALUES.openRouter,
    });

    // Mux and QA artefact config are optional in this slice.
    expect(resolved.muxTokenId).toBeNull();
    expect(resolved.qaArtifactStorageBucket).toBeNull();
    expect(resolved.diagnostics.mux_token_id_present).toBe(false);
    expect(resolved.diagnostics.qa_artifact_storage_bucket_present).toBe(false);

    // Diagnostics carry only booleans and the safe Supabase host.
    for (const [key, value] of Object.entries(resolved.diagnostics)) {
      if (key === "supabase_url_host") {
        expect(value === null || typeof value === "string").toBe(true);
        expect(value).toBe("owned-project.supabase.co");
      } else {
        expect(typeof value).toBe("boolean");
      }
    }
  });

  it("keeps the runtime env module server-only and out of client-imported modules", async () => {
    const moduleSource = await readFile(
      path.join(process.cwd(), "src/server/analysis-runtime-env.server.ts"),
      "utf8",
    );
    expect(moduleSource).toContain("SERVER-ONLY");

    const clientImportedModules = [
      "src/lib/admin-storage.functions.ts",
      "src/server-fns/account-compliance.functions.ts",
      "src/server-fns/credit-balance.functions.ts",
      "src/server-fns/mux.functions.ts",
      "src/integrations/supabase/client.ts",
    ];

    for (const modulePath of clientImportedModules) {
      const source = await readFile(path.join(process.cwd(), modulePath), "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*analysis-runtime-env\.server["']/);
      expect(source).not.toContain("OPENROUTER_API_KEY");
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});
