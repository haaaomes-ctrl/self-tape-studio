// SERVER-ONLY: structured logging for provider/AI errors.
//
// Provider failures are collapsed into safe error categories
// (e.g. "unknown_safe_error", "network_error") before they reach callers,
// the report model or persisted usage rows. That is correct for everything
// downstream — but without a log of the underlying error, real failures
// (like the Workers fetch "Illegal invocation" bug) are invisible and
// require a live hunt to diagnose.
//
// This helper is the single place a caught provider error is logged with its
// real message + stack. Rules:
//   - Console only. NEVER persist this output to the database, QA artefacts
//     or anything performer-facing (red lines: secrets, signed URLs, raw
//     model internals stay out of persisted/visible surfaces).
//   - Secrets are redacted defensively before logging: signed/token query
//     params (Mux), Authorization bearer values and OpenRouter-style
//     `sk-or-…` keys, in case an error message ever embeds a URL or header.

const REDACTIONS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Signed/token query params (e.g. Mux playback URLs).
  { pattern: /([?&](?:token|mux_token|signature)=)[^&\s'"]+/gi, replacement: "$1[redacted]" },
  // Authorization header values, with or without the Bearer scheme.
  {
    pattern: /(authorization['"]?\s*[:=]\s*['"]?(?:bearer\s+)?)[^\s'",}]+/gi,
    replacement: "$1[redacted]",
  },
  { pattern: /(bearer\s+)[A-Za-z0-9\-._~+/]{8,}=*/gi, replacement: "$1[redacted]" },
  // OpenRouter-style API keys.
  { pattern: /sk-or-[A-Za-z0-9\-_]{8,}/gi, replacement: "sk-or-[redacted]" },
];

export function redactProviderErrorText(text: string): string {
  let out = text;
  for (const { pattern, replacement } of REDACTIONS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export type ProviderErrorLogContext = {
  /** Pipeline stage where the error was collapsed, e.g. "evidence_pass". */
  stage: string;
  provider?: string;
  model?: string;
  httpStatus?: number | null;
};

/**
 * Log the real provider error (message + stack, redacted) alongside the
 * structured context, so a collapsed safe-error category always has a
 * diagnosable trail in Worker/server logs.
 */
export function logProviderError(context: ProviderErrorLogContext, err: unknown): void {
  const isError = err instanceof Error;
  const message = redactProviderErrorText(isError ? err.message : String(err));
  const stack = isError && err.stack ? redactProviderErrorText(err.stack) : null;
  console.error("[provider-error]", {
    stage: context.stage,
    provider: context.provider ?? null,
    model: context.model ?? null,
    http_status: context.httpStatus ?? null,
    error_name: isError ? err.name : typeof err,
    message,
    stack,
  });
}
