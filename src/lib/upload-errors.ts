// Translates errors thrown by createMuxDirectUpload into user-facing messages.
// The server function throws plain Errors with stable code prefixes
// (see src/server/mux.functions.ts) so we can surface the right UX.

export interface UploadErrorInfo {
  message: string;
  kind:
    | "quota"
    | "credit_required"
    | "auth"
    | "policy_acceptance"
    | "config"
    | "mux"
    | "server_config"
    | "prerequisite"
    | "not_found"
    | "forbidden"
    | "unknown";
}

export function describeUploadError(err: unknown): UploadErrorInfo {
  // Auth middleware throws a Response with a string body.
  if (err instanceof Response) {
    if (err.status === 401) {
      return {
        kind: "auth",
        message: "Your session has expired. Please sign in again.",
      };
    }
    return {
      kind: "unknown",
      message: `Upload could not start (${err.status}). Please try again.`,
    };
  }

  const raw = err instanceof Error ? err.message : typeof err === "string" ? err : "";

  // Auth middleware errors often surface as plain strings with "Unauthorized".
  if (/unauthorized|no authorization header|invalid token/i.test(raw)) {
    return {
      kind: "auth",
      message: "Your session has expired. Please sign in again.",
    };
  }

  if (raw.startsWith("QUOTA_EXCEEDED:")) {
    return { kind: "quota", message: raw.replace(/^QUOTA_EXCEEDED:\s*/, "") };
  }
  if (raw.startsWith("CREDIT_REQUIRED:")) {
    return { kind: "credit_required", message: raw.replace(/^CREDIT_REQUIRED:\s*/, "") };
  }
  if (raw.startsWith("POLICY_ACCEPTANCE_REQUIRED:")) {
    return {
      kind: "policy_acceptance",
      message: raw.replace(/^POLICY_ACCEPTANCE_REQUIRED:\s*/, ""),
    };
  }
  if (/^server_supabase_misconfigured:/i.test(raw)) {
    return {
      kind: "server_config",
      message: raw.replace(/^server_supabase_misconfigured:\s*/i, ""),
    };
  }
  if (/^mux_config_missing:/i.test(raw)) {
    return { kind: "config", message: raw.replace(/^mux_config_missing:\s*/i, "") };
  }
  if (/^upload_prerequisite_missing:/i.test(raw)) {
    return {
      kind: "prerequisite",
      message: raw.replace(/^upload_prerequisite_missing:\s*/i, ""),
    };
  }
  if (/^mux_upload_failed:/i.test(raw)) {
    return { kind: "mux", message: raw.replace(/^mux_upload_failed:\s*/i, "") };
  }
  if (raw.startsWith("MUX_CONFIG:")) {
    return { kind: "config", message: raw.replace(/^MUX_CONFIG:\s*/, "") };
  }
  const muxApi = raw.match(/^MUX_API_(\d+):\s*(.*)$/);
  if (muxApi) {
    return {
      kind: "mux",
      message: `Video service error (${muxApi[1]}): ${muxApi[2] || "please try again"}.`,
    };
  }
  if (raw.startsWith("TAKE_NOT_FOUND:")) {
    return {
      kind: "not_found",
      message: raw.replace(/^TAKE_NOT_FOUND:\s*/, ""),
    };
  }
  if (raw.startsWith("FORBIDDEN:")) {
    return { kind: "forbidden", message: raw.replace(/^FORBIDDEN:\s*/, "") };
  }

  if (raw) return { kind: "unknown", message: raw };
  return {
    kind: "unknown",
    message: "Could not start upload. Please try again.",
  };
}
