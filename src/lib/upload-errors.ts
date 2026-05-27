// Translates errors thrown by createMuxDirectUpload into user-facing messages.
// The server function throws plain Errors with stable code prefixes
// (see src/server/mux.functions.ts) so we can surface the right UX.

export interface UploadErrorInfo {
  message: string;
  kind:
    | "quota"
    | "auth"
    | "policy_acceptance"
    | "config"
    | "mux"
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
  if (raw.startsWith("POLICY_ACCEPTANCE_REQUIRED:")) {
    return {
      kind: "policy_acceptance",
      message: raw.replace(/^POLICY_ACCEPTANCE_REQUIRED:\s*/, ""),
    };
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
