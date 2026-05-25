// SERVER-ONLY. Provider request helpers shared by model call sites.

export type ProviderSafeErrorCategory =
  | "provider_request_contract_error"
  | "provider_media_url_error"
  | "provider_unavailable"
  | "provider_timeout"
  | "parser_error"
  | "unknown_safe_error";

export function cloneForProviderToolSchema<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneForProviderToolSchema(item)) as T;
  if (!value || typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "type" && Array.isArray(child)) {
      const nonNullType = child.find((item) => item !== "null");
      out.type = typeof nonNullType === "string" ? nonNullType : "string";
      continue;
    }
    out[key] = cloneForProviderToolSchema(child);
  }
  return out as T;
}

export function buildProviderToolForModel<T>(tool: T, model?: string | null): T {
  const normalisedModel = (model ?? "").trim().toLowerCase();
  if (normalisedModel.includes("google/gemini")) {
    return cloneForProviderToolSchema(tool);
  }
  return tool;
}

function normaliseProviderErrorText(body: unknown): string {
  if (body instanceof Error) return body.message.toLowerCase();
  if (typeof body === "string") return body.toLowerCase();
  return "";
}

export function classifyAiGatewayProviderError(
  httpStatus: number | null,
  body?: unknown,
): ProviderSafeErrorCategory {
  const message = normaliseProviderErrorText(body);
  if (message.includes("abort") || message.includes("timeout")) return "provider_timeout";
  if (httpStatus === 408 || httpStatus === 504) return "provider_timeout";
  if (httpStatus === 429 || (typeof httpStatus === "number" && httpStatus >= 500)) {
    return "provider_unavailable";
  }
  if (
    (httpStatus === 400 || httpStatus === 422) &&
    (message.includes("generatecontentrequest.tools") ||
      message.includes("function_declarations") ||
      message.includes("function declarations") ||
      message.includes("tool schema") ||
      message.includes("parameters.properties") ||
      message.includes("parameters[") ||
      message.includes("invalid schema"))
  ) {
    return "provider_request_contract_error";
  }
  if (
    httpStatus === 400 &&
    (message.includes("file_url") ||
      message.includes("unsupported image format") ||
      message.includes("unsupported video") ||
      message.includes("unsupported media") ||
      message.includes("invalid url") ||
      message.includes("failed to fetch") ||
      message.includes("could not fetch") ||
      message.includes("could not access") ||
      message.includes("download") ||
      message.includes("mux") ||
      message.includes("video/mp4"))
  ) {
    return "provider_media_url_error";
  }
  if (body instanceof SyntaxError || message.includes("json") || message.includes("parse")) {
    return "parser_error";
  }
  return "unknown_safe_error";
}

export function shouldRetryWithFreshMuxUrl(input: {
  httpStatus: number | null;
  body?: unknown;
  didMuxUrlRecoveryRetry: boolean;
  hasPlaybackId: boolean;
}): boolean {
  if (input.didMuxUrlRecoveryRetry || !input.hasPlaybackId) return false;
  return classifyAiGatewayProviderError(input.httpStatus, input.body) === "provider_media_url_error";
}
