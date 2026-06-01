// SERVER-ONLY. Provider request helpers shared by model call sites.

export type ProviderSafeErrorCategory =
  | "provider_request_contract_error"
  | "provider_media_url_error"
  | "provider_unavailable"
  | "provider_timeout"
  | "parser_error"
  | "unknown_safe_error";

export type ReportProviderContract = "tool_call" | "plain_json_report";

const UNSUPPORTED_PROVIDER_SCHEMA_KEYS = new Set([
  "$defs",
  "$ref",
  "additionalProperties",
  "allOf",
  "anyOf",
  "const",
  "default",
  "exclusiveMaximum",
  "exclusiveMinimum",
  "format",
  "maxItems",
  "maxLength",
  "maximum",
  "minItems",
  "minLength",
  "minimum",
  "multipleOf",
  "oneOf",
  "pattern",
]);

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function schemaAllowsNull(value: unknown): boolean {
  const record = asObjectRecord(value);
  if (!record) return false;
  const type = record.type;
  return record.nullable === true || (Array.isArray(type) && type.some((item) => item === "null"));
}

function appendDescription(current: unknown, addition: string): string {
  const base = typeof current === "string" ? current.trim() : "";
  return base ? `${base} ${addition}` : addition;
}

function normaliseType(value: unknown): { type: unknown; descriptionHint: string | null } {
  if (!Array.isArray(value)) return { type: value, descriptionHint: null };
  const nonNullTypes = value.filter(
    (item): item is string => typeof item === "string" && item !== "null",
  );
  const selectedType = nonNullTypes[0] ?? "string";
  const descriptionHint =
    nonNullTypes.length > 1
      ? `Provider schema narrowed a mixed-type field from ${nonNullTypes.join(", ")} to ${selectedType}.`
      : null;
  return { type: selectedType, descriptionHint };
}

function normaliseEnum(value: unknown): {
  enumValue: string[] | null;
  descriptionHint: string | null;
} {
  if (!Array.isArray(value)) return { enumValue: null, descriptionHint: null };
  if (value.every((item): item is string => typeof item === "string")) {
    return { enumValue: value, descriptionHint: null };
  }
  if (value.every((item): item is boolean => typeof item === "boolean")) {
    return {
      enumValue: null,
      descriptionHint: `Expected value: ${value.map(String).join(" or ")}.`,
    };
  }
  return {
    enumValue: null,
    descriptionHint: "Provider schema omitted a mixed-type enum constraint.",
  };
}

export function cloneForProviderToolSchema<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => cloneForProviderToolSchema(item)) as T;
  if (!value || typeof value !== "object") return value;

  const original = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const originalProperties = asObjectRecord(original.properties);
  const nullablePropertyNames = new Set(
    Object.entries(originalProperties ?? {})
      .filter(([, child]) => schemaAllowsNull(child))
      .map(([key]) => key),
  );

  for (const [key, child] of Object.entries(original)) {
    if (UNSUPPORTED_PROVIDER_SCHEMA_KEYS.has(key)) continue;
    if (key === "nullable") continue;
    if (key === "required") continue;

    if (key === "type" && Array.isArray(child)) {
      const { type, descriptionHint } = normaliseType(child);
      out.type = type;
      if (descriptionHint) out.description = appendDescription(out.description, descriptionHint);
      continue;
    }

    if (key === "enum") {
      const { enumValue, descriptionHint } = normaliseEnum(child);
      if (enumValue && enumValue.length > 0) out.enum = enumValue;
      if (descriptionHint) out.description = appendDescription(out.description, descriptionHint);
      continue;
    }

    out[key] = cloneForProviderToolSchema(child);
  }

  if (originalProperties) {
    const providerProperties = asObjectRecord(out.properties) ?? {};
    const required = Array.isArray(original.required)
      ? original.required.filter(
          (item): item is string =>
            typeof item === "string" &&
            item in providerProperties &&
            !nullablePropertyNames.has(item),
        )
      : [];
    if (required.length > 0) out.required = required;
  }

  if (out.type === "object") {
    const properties = asObjectRecord(out.properties);
    if (!properties || Object.keys(properties).length === 0) {
      out.properties = {
        summary: {
          type: "string",
          description:
            "Provider-safe summary for an internally open object. Server-side validation still enforces the final shape.",
        },
      };
      delete out.required;
    }
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

export function selectReportProviderContract(model?: string | null): ReportProviderContract {
  const normalisedModel = (model ?? "").trim().toLowerCase();
  if (normalisedModel.includes("google/gemini")) return "plain_json_report";
  return "tool_call";
}

type ReportSchemaNode = {
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, ReportSchemaNode>;
  items?: ReportSchemaNode;
  minimum?: number;
  maximum?: number;
};

// Render a compact, depth-limited skeleton of a JSON-schema node as a plain JS
// value (objects/arrays/hint-strings) so it can be JSON.stringify'd into the
// prompt. Enums become "a | b | c"; primitives become their type (with range
// where bounded). This mirrors the explicit JSON skeleton that already makes the
// Step-1 compact (plain_json_observations) call reliable.
function renderReportSchemaSkeleton(
  node: ReportSchemaNode | undefined,
  depth: number,
  maxDepth: number,
): unknown {
  if (!node || typeof node !== "object") return "value";
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    // Single-value enums are literal constraints: emit the value with its native
    // JSON type (e.g. boolean `true`, number `5`, string `"slate"`) so a model
    // copying the skeleton produces the right type. Stringifying a boolean-only
    // enum to "true" makes downstream `=== true` filters reject the field.
    if (node.enum.length === 1) return node.enum[0];
    if (node.enum.every((entry) => typeof entry === "boolean")) return "boolean";
    // Multi-value (string) enums become an "a | b | c" choice hint.
    return node.enum.map((entry) => String(entry)).join(" | ");
  }
  // Normalise nullable unions (e.g. type: ["integer", "null"]) to a single
  // primary type plus a "| null" hint, so the skeleton never emits a literal
  // ["integer","null"] array that the model could copy as the field value.
  const types = Array.isArray(node.type) ? node.type : node.type != null ? [node.type] : [];
  const nullable = types.includes("null");
  const primaryType = types.find((entry) => entry && entry !== "null");
  const nullSuffix = nullable ? " | null" : "";

  if (node.properties && (primaryType === "object" || primaryType === undefined)) {
    if (depth >= maxDepth) return "{ ... }";
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node.properties)) {
      out[key] = renderReportSchemaSkeleton(child, depth + 1, maxDepth);
    }
    return out;
  }
  if (node.items && primaryType === "array") {
    if (depth >= maxDepth) return ["..."];
    return [renderReportSchemaSkeleton(node.items, depth + 1, maxDepth)];
  }
  if (primaryType === "integer" || primaryType === "number") {
    const base =
      typeof node.minimum === "number" && typeof node.maximum === "number"
        ? `${primaryType} ${node.minimum}-${node.maximum}`
        : primaryType;
    return `${base}${nullSuffix}`;
  }
  if (primaryType === "string" || primaryType === "boolean") return `${primaryType}${nullSuffix}`;
  return primaryType ?? "value";
}

// Build the report JSON skeleton from the REPORT_TOOL function schema. Providers
// on the plain_json_report contract (Gemini) get no `tools`, so without this
// they must invent the entire ~27KB nested report blind — the proven cause of
// under-produced/invalid Step-2 output. Giving them the shape scaffolds it.
export function buildReportJsonSkeletonFromTool(tool: unknown, maxDepth = 6): string {
  const params = (tool as { function?: { parameters?: ReportSchemaNode } })?.function?.parameters;
  if (!params || !params.properties) return "";
  return JSON.stringify(renderReportSchemaSkeleton(params, 0, maxDepth), null, 2);
}

export function buildPlainJsonReportInstruction(
  toolName = "submit_audition_report",
  skeleton?: string,
): string {
  const head = [
    `Return ONLY the JSON object that would be passed as arguments to ${toolName}.`,
    "Do not call a tool. Do not wrap the response in Markdown. Do not include commentary before or after the JSON.",
    "The top-level value must be a JSON object, not an array or a string.",
  ].join(" ");
  if (!skeleton || !skeleton.trim()) return head;
  return [
    head,
    'The object MUST follow this exact structure. Populate every top-level key; never omit a module. Use null or [] only where a field is genuinely not assessable, and record why in the matching limitation field rather than dropping the key. Values shown as "a | b | c" are the allowed enums; values shown as type names indicate the expected JSON type.',
    "Required JSON structure:",
    skeleton,
  ].join("\n\n");
}

export function providerMessageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      const record = asObjectRecord(part);
      if (!record) return "";
      if (typeof record.text === "string") return record.text;
      if (typeof record.content === "string") return record.content;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function stripJsonFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function providerParsedJsonObject(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] &&
    typeof value[0] === "object" &&
    !Array.isArray(value[0])
  ) {
    return value[0];
  }
  return null;
}

export function parseProviderJsonObjectContent(content: unknown): unknown {
  const text = stripJsonFence(providerMessageContentToText(content));
  try {
    const parsed = JSON.parse(text);
    const object = providerParsedJsonObject(parsed);
    if (object) return object;
  } catch {
    // Fall through to best-effort extraction below.
  }

  const firstObjectChar = text.indexOf("{");
  const lastObjectChar = text.lastIndexOf("}");
  if (firstObjectChar >= 0 && lastObjectChar > firstObjectChar) {
    const parsed = JSON.parse(text.slice(firstObjectChar, lastObjectChar + 1));
    const object = providerParsedJsonObject(parsed);
    if (object) return object;
  }
  throw new SyntaxError("provider_content_not_json_object");
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
  return (
    classifyAiGatewayProviderError(input.httpStatus, input.body) === "provider_media_url_error"
  );
}
