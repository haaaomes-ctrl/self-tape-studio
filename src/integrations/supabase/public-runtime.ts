export type SupabasePublicRuntimeEnv = {
  VITE_SUPABASE_URL?: unknown;
  VITE_SUPABASE_PUBLISHABLE_KEY?: unknown;
};

export type SupabasePublicRuntimeDiagnostics = {
  vite_supabase_url_configured: boolean;
  vite_supabase_url_host: string | null;
  vite_supabase_publishable_key_configured: boolean;
};

export class SupabasePublicRuntimeConfigError extends Error {
  diagnostics: SupabasePublicRuntimeDiagnostics;

  constructor(diagnostics: SupabasePublicRuntimeDiagnostics) {
    super(
      "Missing Supabase public runtime environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are available server-side.",
    );
    this.name = "SupabasePublicRuntimeConfigError";
    this.diagnostics = diagnostics;
  }
}

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeUrlHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function importMetaPublicEnv(): SupabasePublicRuntimeEnv {
  const env = (import.meta as unknown as { env?: SupabasePublicRuntimeEnv }).env;
  return env ?? {};
}

let runtimeEnvResolver: (() => SupabasePublicRuntimeEnv | null) | null = null;

export function setSupabasePublicRuntimeEnvResolver(
  resolver: (() => SupabasePublicRuntimeEnv | null) | null,
): void {
  runtimeEnvResolver = resolver;
}

function currentRuntimeEnv(): SupabasePublicRuntimeEnv | null {
  try {
    return runtimeEnvResolver?.() ?? null;
  } catch {
    return null;
  }
}

export function resolveSupabasePublicRuntimeConfig(
  env?: SupabasePublicRuntimeEnv | null,
  metaEnv: SupabasePublicRuntimeEnv = importMetaPublicEnv(),
): {
  supabaseUrl: string | null;
  publishableKey: string | null;
  diagnostics: SupabasePublicRuntimeDiagnostics;
} {
  const hasRuntimeEnv = env !== undefined && env !== null;
  const supabaseUrl =
    cleanUnknownEnvValue(env?.VITE_SUPABASE_URL) ??
    (hasRuntimeEnv ? null : cleanUnknownEnvValue(process.env.VITE_SUPABASE_URL)) ??
    cleanUnknownEnvValue(metaEnv.VITE_SUPABASE_URL);
  const publishableKey =
    cleanUnknownEnvValue(env?.VITE_SUPABASE_PUBLISHABLE_KEY) ??
    (hasRuntimeEnv ? null : cleanUnknownEnvValue(process.env.VITE_SUPABASE_PUBLISHABLE_KEY)) ??
    cleanUnknownEnvValue(metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY);

  return {
    supabaseUrl,
    publishableKey,
    diagnostics: {
      vite_supabase_url_configured: Boolean(supabaseUrl),
      vite_supabase_url_host: safeUrlHost(supabaseUrl),
      vite_supabase_publishable_key_configured: Boolean(publishableKey),
    },
  };
}

export function requireSupabasePublicRuntimeConfig(env?: SupabasePublicRuntimeEnv | null): {
  supabaseUrl: string;
  publishableKey: string;
  diagnostics: SupabasePublicRuntimeDiagnostics;
} {
  const runtimeEnv = env === undefined ? currentRuntimeEnv() : env;
  const { supabaseUrl, publishableKey, diagnostics } =
    resolveSupabasePublicRuntimeConfig(runtimeEnv);

  if (!supabaseUrl || !publishableKey) {
    throw new SupabasePublicRuntimeConfigError(diagnostics);
  }

  return { supabaseUrl, publishableKey, diagnostics };
}
