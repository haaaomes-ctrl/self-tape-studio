import {
  createSupabaseAdminClientForRuntimeEnv,
  resolveSupabaseAdminRuntimeConfig,
  SupabaseAdminRuntimeConfigError,
} from "@/integrations/supabase/client.server";
import {
  resolveAdminCutoverDiagnostics,
  resolveMuxRuntimeDiagnostics,
  resolvePublicCutoverDiagnostics,
  resolveQaRuntimeDiagnostics,
  safeErrorSummary,
  type CutoverRuntimeEnv,
} from "@/server/cutover-diagnostics.server";
import { getRequestEnv } from "@/worker-entry";
import { describeWorkerAnalysisReadiness } from "@/server/worker-analysis-consumer.server";

export const CUTOVER_HEALTH_VERSION = "lovable-owned-supabase-cutover-2026-06-02";

const CORE_TABLES = [
  "auditions",
  "takes",
  "account_compliance",
  "partner_package_presets",
] as const;
const REQUIRED_BUCKETS = ["audition-videos", "qa-artifacts"] as const;

type CheckStatus = "ok" | "failed" | "missing" | "not_checked";
type ErrorEntry = {
  code: string;
  target: string;
  message?: string | null;
};

type HealthClient = ReturnType<typeof createSupabaseAdminClientForRuntimeEnv>;

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentRuntimeEnv(env?: CutoverRuntimeEnv | null): CutoverRuntimeEnv | null {
  return env === undefined ? (getRequestEnv<CutoverRuntimeEnv>() ?? null) : env;
}

function presenceEnv(env?: CutoverRuntimeEnv | null): CutoverRuntimeEnv | NodeJS.ProcessEnv {
  return currentRuntimeEnv(env) ?? process.env;
}

function readSecret(env?: CutoverRuntimeEnv | null): string | null {
  const runtimeEnv = currentRuntimeEnv(env);
  const hasRuntimeEnv = runtimeEnv !== undefined && runtimeEnv !== null;
  return (
    cleanUnknownEnvValue(runtimeEnv?.CUTOVER_HEALTH_SECRET) ??
    (hasRuntimeEnv ? null : cleanUnknownEnvValue(process.env.CUTOVER_HEALTH_SECRET))
  );
}

function bearerToken(request: Request): string | null {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? null
  );
}

export function isAuthorisedCutoverHealthRequest(
  request: Request,
  env?: CutoverRuntimeEnv | null,
): boolean {
  const secret = readSecret(env);
  if (!secret) return false;
  return bearerToken(request) === secret;
}

function safeError(code: string, target: string, error?: unknown): ErrorEntry {
  const summary = safeErrorSummary(error);
  return {
    code,
    target,
    message: summary.message,
  };
}

async function checkTable(
  client: HealthClient,
  table: string,
): Promise<{
  status: CheckStatus;
  error?: ErrorEntry;
}> {
  const { error } = await client.from(table as never).select("*", {
    count: "exact",
    head: true,
  });
  if (!error) return { status: "ok" };
  return {
    status: "failed",
    error: safeError("table_check_failed", table, error),
  };
}

async function checkBucket(
  client: HealthClient,
  bucket: string,
): Promise<{
  status: CheckStatus;
  error?: ErrorEntry;
}> {
  const { data, error } = await client.storage.getBucket(bucket);
  if (error || !data) {
    return {
      status: "missing",
      error: safeError("storage_bucket_missing", bucket, error),
    };
  }
  if (data.public !== false) {
    return {
      status: "failed",
      error: { code: "storage_bucket_public", target: bucket, message: null },
    };
  }
  return { status: "ok" };
}

async function checkAdminUser(
  client: HealthClient,
  adminEmail: string | null,
): Promise<{
  user: CheckStatus;
  account_compliance: CheckStatus;
  error?: ErrorEntry;
}> {
  if (!adminEmail) return { user: "not_checked", account_compliance: "not_checked" };
  try {
    const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error)
      return {
        user: "failed",
        account_compliance: "not_checked",
        error: safeError("admin_user_lookup_failed", "auth.users", error),
      };
    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === adminEmail.toLowerCase(),
    );
    if (!user) return { user: "missing", account_compliance: "not_checked" };

    const { data: compliance, error: complianceError } = await client
      .from("account_compliance")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (complianceError) {
      return {
        user: "ok",
        account_compliance: "failed",
        error: safeError(
          "admin_account_compliance_lookup_failed",
          "account_compliance",
          complianceError,
        ),
      };
    }
    return { user: "ok", account_compliance: compliance ? "ok" : "missing" };
  } catch (error) {
    return {
      user: "failed",
      account_compliance: "not_checked",
      error: safeError("admin_user_lookup_failed", "auth.users", error),
    };
  }
}

async function parseHealthBody(request: Request): Promise<{ admin_email: string | null }> {
  const text = await request.text();
  if (!text.trim()) return { admin_email: null };
  const parsed = JSON.parse(text) as { admin_email?: unknown };
  return {
    admin_email:
      typeof parsed.admin_email === "string" && parsed.admin_email.trim()
        ? parsed.admin_email.trim()
        : null,
  };
}

export async function handleCutoverHealthRequest(
  request: Request,
  env?: CutoverRuntimeEnv | null,
): Promise<Response> {
  const runtimeEnv = currentRuntimeEnv(env);
  if (!isAuthorisedCutoverHealthRequest(request, runtimeEnv)) {
    return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { admin_email: string | null };
  try {
    body = await parseHealthBody(request);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const envValues = presenceEnv(runtimeEnv);
  const adminConfig = resolveSupabaseAdminRuntimeConfig(runtimeEnv);
  const errors: ErrorEntry[] = [];
  let adminClientStatus: CheckStatus = "not_checked";
  let client: HealthClient | null = null;

  try {
    client = createSupabaseAdminClientForRuntimeEnv(runtimeEnv);
    adminClientStatus = "ok";
  } catch (error) {
    adminClientStatus = "failed";
    errors.push(
      safeError(
        error instanceof SupabaseAdminRuntimeConfigError
          ? "server_supabase_misconfigured"
          : "server_supabase_client_failed",
        "supabase_admin_client",
        error,
      ),
    );
  }

  const tableStatuses: Record<(typeof CORE_TABLES)[number], CheckStatus> = {
    auditions: "not_checked",
    takes: "not_checked",
    account_compliance: "not_checked",
    partner_package_presets: "not_checked",
  };
  const storageStatuses: Record<(typeof REQUIRED_BUCKETS)[number], CheckStatus> = {
    "audition-videos": "not_checked",
    "qa-artifacts": "not_checked",
  };
  let adminUser = {
    user: "not_checked" as CheckStatus,
    account_compliance: "not_checked" as CheckStatus,
  };

  if (client) {
    for (const table of CORE_TABLES) {
      const result = await checkTable(client, table);
      tableStatuses[table] = result.status;
      if (result.error) errors.push(result.error);
    }
    for (const bucket of REQUIRED_BUCKETS) {
      const result = await checkBucket(client, bucket);
      storageStatuses[bucket] = result.status;
      if (result.error) errors.push(result.error);
    }
    const userResult = await checkAdminUser(client, body.admin_email);
    adminUser = {
      user: userResult.user,
      account_compliance: userResult.account_compliance,
    };
    if (userResult.error) errors.push(userResult.error);
  }

  const muxDiagnostics = resolveMuxRuntimeDiagnostics(runtimeEnv);
  if (!muxDiagnostics.mux_token_id_present || !muxDiagnostics.mux_token_secret_present) {
    errors.push({ code: "mux_config_missing", target: "mux", message: null });
  }

  const ok =
    adminClientStatus === "ok" &&
    Object.values(tableStatuses).every((status) => status === "ok") &&
    Object.values(storageStatuses).every((status) => status === "ok") &&
    muxDiagnostics.mux_token_id_present &&
    muxDiagnostics.mux_token_secret_present;

  return Response.json(
    {
      ok,
      environment: "lovable",
      health_check_version: CUTOVER_HEALTH_VERSION,
      owned_supabase: {
        admin_client: adminClientStatus,
        project_host: adminConfig.diagnostics.supabase_url_host,
        tables: tableStatuses,
        storage: storageStatuses,
        admin_user: adminUser,
      },
      secrets_present: {
        TAPECOACH_SUPABASE_URL: Boolean(cleanUnknownEnvValue(envValues.TAPECOACH_SUPABASE_URL)),
        TAPECOACH_SUPABASE_SERVICE_ROLE_KEY: Boolean(
          cleanUnknownEnvValue(envValues.TAPECOACH_SUPABASE_SERVICE_ROLE_KEY),
        ),
        VITE_SUPABASE_URL: resolvePublicCutoverDiagnostics(runtimeEnv).vite_supabase_url_configured,
        QA_ARTIFACT_STORAGE_BUCKET:
          resolveQaRuntimeDiagnostics(runtimeEnv).qa_artifact_storage_bucket_present,
        QA_ARTIFACT_SINK: resolveQaRuntimeDiagnostics(runtimeEnv).qa_artifact_sink_present,
        MUX_TOKEN_ID: muxDiagnostics.mux_token_id_present,
        MUX_TOKEN_SECRET: muxDiagnostics.mux_token_secret_present,
        MUX_WEBHOOK_SECRET: muxDiagnostics.mux_webhook_secret_present,
      },
      diagnostics: {
        ...resolveAdminCutoverDiagnostics(runtimeEnv),
        ...resolvePublicCutoverDiagnostics(runtimeEnv),
      },
      analysis_runtime: describeWorkerAnalysisReadiness(envValues as Record<string, unknown>),
      errors,
    },
    {
      status: ok ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
