import {
  resolveSupabaseAdminRuntimeConfig,
  type SupabaseAdminRuntimeEnv,
} from "@/integrations/supabase/client.server";
import {
  resolveSupabasePublicRuntimeConfig,
  type SupabasePublicRuntimeEnv,
} from "@/integrations/supabase/public-runtime";
import { getRequestEnv } from "@/worker-entry";

export type CutoverRuntimeEnv = SupabaseAdminRuntimeEnv &
  SupabasePublicRuntimeEnv & {
    CUTOVER_HEALTH_SECRET?: unknown;
    MUX_TOKEN_ID?: unknown;
    MUX_TOKEN_SECRET?: unknown;
    MUX_WEBHOOK_SECRET?: unknown;
    QA_ARTIFACT_STORAGE_BUCKET?: unknown;
    QA_ARTIFACT_SINK?: unknown;
  };

export type SafeCutoverLogContext = {
  supabase_url_host: string | null;
  tapecoach_supabase_url_present: boolean;
  tapecoach_supabase_service_role_key_present: boolean;
  legacy_supabase_url_present: boolean;
  legacy_supabase_service_role_key_present: boolean;
};

export type MuxRuntimeDiagnostics = {
  mux_token_id_present: boolean;
  mux_token_secret_present: boolean;
  mux_webhook_secret_present: boolean;
};

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentRuntimeEnv(env?: CutoverRuntimeEnv | null): CutoverRuntimeEnv | null {
  return env === undefined ? (getRequestEnv<CutoverRuntimeEnv>() ?? null) : env;
}

function envForPresence(env?: CutoverRuntimeEnv | null): CutoverRuntimeEnv | NodeJS.ProcessEnv {
  const runtimeEnv = currentRuntimeEnv(env);
  return runtimeEnv ?? process.env;
}

export function resolveAdminCutoverDiagnostics(
  env?: CutoverRuntimeEnv | null,
): SafeCutoverLogContext {
  const runtimeEnv = currentRuntimeEnv(env);
  const presenceEnv = envForPresence(env);
  const resolved = resolveSupabaseAdminRuntimeConfig(runtimeEnv);

  return {
    supabase_url_host: resolved.diagnostics.supabase_url_host,
    tapecoach_supabase_url_present: Boolean(
      cleanUnknownEnvValue(presenceEnv.TAPECOACH_SUPABASE_URL),
    ),
    tapecoach_supabase_service_role_key_present: Boolean(
      cleanUnknownEnvValue(presenceEnv.TAPECOACH_SUPABASE_SERVICE_ROLE_KEY),
    ),
    legacy_supabase_url_present: Boolean(cleanUnknownEnvValue(presenceEnv.SUPABASE_URL)),
    legacy_supabase_service_role_key_present: Boolean(
      cleanUnknownEnvValue(presenceEnv.SUPABASE_SERVICE_ROLE_KEY),
    ),
  };
}

export function resolvePublicCutoverDiagnostics(env?: CutoverRuntimeEnv | null) {
  return resolveSupabasePublicRuntimeConfig(currentRuntimeEnv(env)).diagnostics;
}

export function resolveMuxRuntimeDiagnostics(
  env?: CutoverRuntimeEnv | null,
): MuxRuntimeDiagnostics {
  const presenceEnv = envForPresence(env);
  return {
    mux_token_id_present: Boolean(cleanUnknownEnvValue(presenceEnv.MUX_TOKEN_ID)),
    mux_token_secret_present: Boolean(cleanUnknownEnvValue(presenceEnv.MUX_TOKEN_SECRET)),
    mux_webhook_secret_present: Boolean(cleanUnknownEnvValue(presenceEnv.MUX_WEBHOOK_SECRET)),
  };
}

export function resolveQaRuntimeDiagnostics(env?: CutoverRuntimeEnv | null) {
  const presenceEnv = envForPresence(env);
  return {
    qa_artifact_storage_bucket_present: Boolean(
      cleanUnknownEnvValue(presenceEnv.QA_ARTIFACT_STORAGE_BUCKET),
    ),
    qa_artifact_sink_present: Boolean(cleanUnknownEnvValue(presenceEnv.QA_ARTIFACT_SINK)),
  };
}

export function safeErrorSummary(error: unknown): { code: string | null; message: string | null } {
  if (!error) return { code: null, message: null };
  if (typeof error === "object") {
    const record = error as { code?: unknown; message?: unknown; name?: unknown };
    return {
      code: typeof record.code === "string" ? record.code.slice(0, 80) : null,
      message:
        typeof record.message === "string"
          ? record.message.replace(/\s+/g, " ").slice(0, 180)
          : typeof record.name === "string"
            ? record.name.slice(0, 80)
            : null,
    };
  }
  return { code: null, message: String(error).replace(/\s+/g, " ").slice(0, 180) };
}

export function safeCutoverLog(
  level: "error" | "warn" | "info",
  event: string,
  payload: {
    operation: string;
    code: string;
    user_id?: string | null;
    table?: string;
    action?: string;
    error?: unknown;
    env?: CutoverRuntimeEnv | null;
    mux?: boolean;
    extra?: Record<string, unknown>;
  },
): void {
  const { error_code, error_message } = (() => {
    const summary = safeErrorSummary(payload.error);
    return { error_code: summary.code, error_message: summary.message };
  })();
  const body = {
    operation: payload.operation,
    code: payload.code,
    user_id: payload.user_id ?? null,
    table: payload.table ?? null,
    action: payload.action ?? null,
    ...resolveAdminCutoverDiagnostics(payload.env),
    ...(payload.mux ? resolveMuxRuntimeDiagnostics(payload.env) : {}),
    error_code,
    error_message,
    ...(payload.extra ?? {}),
  };
  console[level](event, body);
}
