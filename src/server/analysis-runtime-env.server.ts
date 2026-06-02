// SERVER-ONLY. Runtime-neutral analysis environment contract for TapeCoach.
// Do not import this module from client/browser code.
//
// Purpose: let the analysis pipeline receive server-only configuration through a
// single injected object, so the same analysis code can eventually run inside the
// Lovable runtime or the Cloudflare Worker runtime without hard-coded `process.env`
// reads. This slice (Slice 2) provides the capability only; it does NOT rewire the
// existing analysis modules (process-take/extract-brief/report-polish/runProcessTake).
//
// - `resolveAnalysisRuntimeEnv` inspects runtime env safely and returns nullable
//   values plus boolean-only diagnostics (never secret values).
// - `requireAnalysisRuntimeEnv` is the strict guard for the future direct Worker
//   analysis runtime. It requires the owned Supabase pair AND OPENROUTER_API_KEY,
//   because the durable Worker analysis runner uses OpenRouter as its transport.
//   It must NOT be imported into the current Lovable-managed AI path in this slice.
import {
  resolveSupabaseAdminRuntimeConfig,
  type SupabaseAdminRuntimeEnv,
} from "@/integrations/supabase/client.server";
import { getRequestEnv } from "@/worker-entry";

export type AnalysisRuntimeEnvInput = SupabaseAdminRuntimeEnv & {
  OPENROUTER_API_KEY?: unknown;
  OPENROUTER_SITE_URL?: unknown;
  OPENROUTER_APP_TITLE?: unknown;
  S10_MODEL_STEP1?: unknown;
  S10_MODEL_STEP2?: unknown;
  S10_MODEL_RECOVERY?: unknown;
  MUX_TOKEN_ID?: unknown;
  MUX_TOKEN_SECRET?: unknown;
  MUX_WEBHOOK_SECRET?: unknown;
  QA_ARTIFACT_STORAGE_BUCKET?: unknown;
  QA_ARTIFACT_SINK?: unknown;
};

/**
 * Resolved, consumable server-only analysis configuration.
 *
 * `supabaseUrl`, `supabaseServiceRoleKey` and `openRouterApiKey` are the
 * required fields for the strict direct-analysis guard. Everything else is
 * optional/nullable in this slice (Mux and QA artefact config remain optional
 * here unless an existing resolver already requires them).
 */
export interface AnalysisRuntimeEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  openRouterApiKey: string;
  openRouterSiteUrl: string | null;
  openRouterAppTitle: string | null;
  s10ModelStep1: string | null;
  s10ModelStep2: string | null;
  s10ModelRecovery: string | null;
  muxTokenId: string | null;
  muxTokenSecret: string | null;
  muxWebhookSecret: string | null;
  qaArtifactStorageBucket: string | null;
  qaArtifactSink: string | null;
}

export type AnalysisRuntimeDiagnostics = {
  supabase_url_configured: boolean;
  supabase_url_host: string | null;
  supabase_service_role_key_configured: boolean;
  openrouter_api_key_configured: boolean;
  openrouter_site_url_configured: boolean;
  openrouter_app_title_configured: boolean;
  s10_model_step1_configured: boolean;
  s10_model_step2_configured: boolean;
  s10_model_recovery_configured: boolean;
  mux_token_id_present: boolean;
  mux_token_secret_present: boolean;
  mux_webhook_secret_present: boolean;
  qa_artifact_storage_bucket_present: boolean;
  qa_artifact_sink_present: boolean;
};

export type ResolvedAnalysisRuntimeEnv = {
  supabaseUrl: string | null;
  supabaseServiceRoleKey: string | null;
  openRouterApiKey: string | null;
  openRouterSiteUrl: string | null;
  openRouterAppTitle: string | null;
  s10ModelStep1: string | null;
  s10ModelStep2: string | null;
  s10ModelRecovery: string | null;
  muxTokenId: string | null;
  muxTokenSecret: string | null;
  muxWebhookSecret: string | null;
  qaArtifactStorageBucket: string | null;
  qaArtifactSink: string | null;
  diagnostics: AnalysisRuntimeDiagnostics;
};

export class AnalysisRuntimeConfigError extends Error {
  diagnostics: AnalysisRuntimeDiagnostics;
  missing: readonly string[];

  constructor(missing: readonly string[], diagnostics: AnalysisRuntimeDiagnostics) {
    super(
      `Missing required analysis runtime environment variables: ${missing.join(", ")}. ` +
        "Ensure TAPECOACH_SUPABASE_URL, TAPECOACH_SUPABASE_SERVICE_ROLE_KEY (legacy SUPABASE_URL " +
        "and SUPABASE_SERVICE_ROLE_KEY are dev/local fallbacks only) and OPENROUTER_API_KEY are " +
        "configured for the direct analysis runtime.",
    );
    this.name = "AnalysisRuntimeConfigError";
    this.diagnostics = diagnostics;
    this.missing = missing;
  }
}

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentRuntimeEnv(env?: AnalysisRuntimeEnvInput | null): AnalysisRuntimeEnvInput | null {
  return env === undefined ? (getRequestEnv<AnalysisRuntimeEnvInput>() ?? null) : env;
}

/**
 * Returns the env object used to read the non-Supabase keys, given the resolved
 * `runtimeEnv` from `currentRuntimeEnv`. A non-null `runtimeEnv` (e.g. the
 * Cloudflare-mapped object) is used as-is and `process.env` is never consulted —
 * this is what keeps the Cloudflare mapper path free of `process.env`. A `null`
 * `runtimeEnv` (no explicit env and no request runtime env) falls back to
 * `process.env`, matching the existing per-domain resolvers (Mux, cutover
 * diagnostics). The Supabase pair applies this same rule via the owned resolver.
 */
function presenceEnv(
  runtimeEnv: AnalysisRuntimeEnvInput | null,
): AnalysisRuntimeEnvInput | NodeJS.ProcessEnv {
  return runtimeEnv ?? process.env;
}

export function resolveAnalysisRuntimeEnv(
  env?: AnalysisRuntimeEnvInput | null,
): ResolvedAnalysisRuntimeEnv {
  const runtimeEnv = currentRuntimeEnv(env);
  // Delegate the Supabase pair to the owned resolver: this preserves
  // TAPECOACH-first preference, legacy fallback, no-mix rejection and the safe
  // host diagnostic without duplicating that logic here.
  const supabase = resolveSupabaseAdminRuntimeConfig(runtimeEnv);
  const source = presenceEnv(runtimeEnv);

  const openRouterApiKey = cleanUnknownEnvValue(source.OPENROUTER_API_KEY);
  const openRouterSiteUrl = cleanUnknownEnvValue(source.OPENROUTER_SITE_URL);
  const openRouterAppTitle = cleanUnknownEnvValue(source.OPENROUTER_APP_TITLE);
  const s10ModelStep1 = cleanUnknownEnvValue(source.S10_MODEL_STEP1);
  const s10ModelStep2 = cleanUnknownEnvValue(source.S10_MODEL_STEP2);
  const s10ModelRecovery = cleanUnknownEnvValue(source.S10_MODEL_RECOVERY);
  const muxTokenId = cleanUnknownEnvValue(source.MUX_TOKEN_ID);
  const muxTokenSecret = cleanUnknownEnvValue(source.MUX_TOKEN_SECRET);
  const muxWebhookSecret = cleanUnknownEnvValue(source.MUX_WEBHOOK_SECRET);
  const qaArtifactStorageBucket = cleanUnknownEnvValue(source.QA_ARTIFACT_STORAGE_BUCKET);
  const qaArtifactSink = cleanUnknownEnvValue(source.QA_ARTIFACT_SINK);

  return {
    supabaseUrl: supabase.supabaseUrl,
    supabaseServiceRoleKey: supabase.serviceRoleKey,
    openRouterApiKey,
    openRouterSiteUrl,
    openRouterAppTitle,
    s10ModelStep1,
    s10ModelStep2,
    s10ModelRecovery,
    muxTokenId,
    muxTokenSecret,
    muxWebhookSecret,
    qaArtifactStorageBucket,
    qaArtifactSink,
    diagnostics: {
      supabase_url_configured: supabase.diagnostics.supabase_url_configured,
      supabase_url_host: supabase.diagnostics.supabase_url_host,
      supabase_service_role_key_configured:
        supabase.diagnostics.supabase_service_role_key_configured,
      openrouter_api_key_configured: Boolean(openRouterApiKey),
      openrouter_site_url_configured: Boolean(openRouterSiteUrl),
      openrouter_app_title_configured: Boolean(openRouterAppTitle),
      s10_model_step1_configured: Boolean(s10ModelStep1),
      s10_model_step2_configured: Boolean(s10ModelStep2),
      s10_model_recovery_configured: Boolean(s10ModelRecovery),
      mux_token_id_present: Boolean(muxTokenId),
      mux_token_secret_present: Boolean(muxTokenSecret),
      mux_webhook_secret_present: Boolean(muxWebhookSecret),
      qa_artifact_storage_bucket_present: Boolean(qaArtifactStorageBucket),
      qa_artifact_sink_present: Boolean(qaArtifactSink),
    },
  };
}

/**
 * Strict guard for the future direct Worker analysis runtime. Requires the
 * owned Supabase pair and OPENROUTER_API_KEY. Throws a safe configuration error
 * (boolean-only diagnostics, variable names but never values) when required env
 * is missing.
 *
 * Do NOT import this into the current Lovable-managed AI path in this slice —
 * OPENROUTER_API_KEY is only required for the durable direct analysis runtime.
 */
export function requireAnalysisRuntimeEnv(
  env?: AnalysisRuntimeEnvInput | null,
): AnalysisRuntimeEnv {
  const resolved = resolveAnalysisRuntimeEnv(env);
  const missing: string[] = [];
  if (!resolved.supabaseUrl) missing.push("TAPECOACH_SUPABASE_URL");
  if (!resolved.supabaseServiceRoleKey) missing.push("TAPECOACH_SUPABASE_SERVICE_ROLE_KEY");
  if (!resolved.openRouterApiKey) missing.push("OPENROUTER_API_KEY");

  if (!resolved.supabaseUrl || !resolved.supabaseServiceRoleKey || !resolved.openRouterApiKey) {
    throw new AnalysisRuntimeConfigError(missing, resolved.diagnostics);
  }

  return {
    supabaseUrl: resolved.supabaseUrl,
    supabaseServiceRoleKey: resolved.supabaseServiceRoleKey,
    openRouterApiKey: resolved.openRouterApiKey,
    openRouterSiteUrl: resolved.openRouterSiteUrl,
    openRouterAppTitle: resolved.openRouterAppTitle,
    s10ModelStep1: resolved.s10ModelStep1,
    s10ModelStep2: resolved.s10ModelStep2,
    s10ModelRecovery: resolved.s10ModelRecovery,
    muxTokenId: resolved.muxTokenId,
    muxTokenSecret: resolved.muxTokenSecret,
    muxWebhookSecret: resolved.muxWebhookSecret,
    qaArtifactStorageBucket: resolved.qaArtifactStorageBucket,
    qaArtifactSink: resolved.qaArtifactSink,
  };
}

// Keys extracted from a Cloudflare Worker `env` binding. The legacy
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY names are intentionally EXCLUDED: the
// Worker is the durable production analysis runtime, and legacy names are
// dev/local fallbacks only. Excluding them makes a Worker env that lacks the
// owned TAPECOACH pair fail safe via requireAnalysisRuntimeEnv rather than
// silently pointing direct analysis at the legacy Supabase project.
const CLOUDFLARE_ANALYSIS_RUNTIME_ENV_KEYS = [
  "TAPECOACH_SUPABASE_URL",
  "TAPECOACH_SUPABASE_SERVICE_ROLE_KEY",
  "OPENROUTER_API_KEY",
  "OPENROUTER_SITE_URL",
  "OPENROUTER_APP_TITLE",
  "S10_MODEL_STEP1",
  "S10_MODEL_STEP2",
  "S10_MODEL_RECOVERY",
  "MUX_TOKEN_ID",
  "MUX_TOKEN_SECRET",
  "MUX_WEBHOOK_SECRET",
  "QA_ARTIFACT_STORAGE_BUCKET",
  "QA_ARTIFACT_SINK",
] as const satisfies ReadonlyArray<keyof AnalysisRuntimeEnvInput>;

/**
 * Maps a Cloudflare Worker `env` binding object into the analysis runtime env
 * input shape by extracting only the keys the analysis runtime consumes. This
 * is intentionally explicit and MUST NOT read `process.env` — the Worker
 * runtime has no Node `process.env`; secrets arrive on the `env` binding.
 *
 * Legacy SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY names are not extracted, so a
 * Worker configured only with the legacy pair fails safe instead of resolving
 * to the legacy Supabase project. Configure the owned TAPECOACH pair on the
 * Worker binding.
 */
export function mapCloudflareEnvToAnalysisRuntimeEnvInput(
  cfEnv: Record<string, unknown>,
): AnalysisRuntimeEnvInput {
  const mapped: Record<string, unknown> = {};
  for (const key of CLOUDFLARE_ANALYSIS_RUNTIME_ENV_KEYS) {
    mapped[key] = cfEnv[key];
  }
  return mapped as AnalysisRuntimeEnvInput;
}

/**
 * Convenience resolver for the Cloudflare Worker runtime. Passes the mapped env
 * explicitly so `process.env` is never consulted.
 */
export function resolveAnalysisRuntimeEnvFromCloudflare(
  cfEnv: Record<string, unknown>,
): ResolvedAnalysisRuntimeEnv {
  return resolveAnalysisRuntimeEnv(mapCloudflareEnvToAnalysisRuntimeEnvInput(cfEnv));
}
