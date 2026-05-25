import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProviderToolForModel,
  classifyAiGatewayProviderError,
  cloneForProviderToolSchema,
  shouldRetryWithFreshMuxUrl,
} from "@/server/provider-tool-schema.server";
import { buildReportToolForProvider, REPORT_TOOL } from "@/server/process-take.server";
import { runReportPolish } from "@/server/report-polish.server";

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

function hasArrayValuedType(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasArrayValuedType(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (key === "type" && Array.isArray(child)) return true;
    return hasArrayValuedType(child);
  });
}

function collectUnsupportedKeys(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectUnsupportedKeys(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const currentPath = `${path}.${key}`;
    const own = UNSUPPORTED_PROVIDER_SCHEMA_KEYS.has(key) ? [currentPath] : [];
    return [...own, ...collectUnsupportedKeys(child, currentPath)];
  });
}

function collectOpenObjectSchemas(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectOpenObjectSchemas(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const properties = record.properties;
  const own =
    record.type === "object" &&
    (!properties ||
      typeof properties !== "object" ||
      Array.isArray(properties) ||
      Object.keys(properties).length === 0)
      ? [path]
      : [];
  return [
    ...own,
    ...Object.entries(record).flatMap(([key, child]) =>
      collectOpenObjectSchemas(child, `${path}.${key}`),
    ),
  ];
}

function collectNonStringEnums(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectNonStringEnums(item, `${path}[${index}]`));
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const own =
    Array.isArray(record.enum) && record.enum.some((item) => typeof item !== "string")
      ? [path]
      : [];
  return [
    ...own,
    ...Object.entries(record).flatMap(([key, child]) =>
      collectNonStringEnums(child, `${path}.${key}`),
    ),
  ];
}

function schemaAllowsNull(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const type = (value as Record<string, unknown>).type;
  return Array.isArray(type) && type.includes("null");
}

function collectProviderRequiredNullableFields(
  sourceSchema: unknown,
  providerSchema: unknown,
  path = "$",
): string[] {
  if (
    !sourceSchema ||
    !providerSchema ||
    typeof sourceSchema !== "object" ||
    typeof providerSchema !== "object" ||
    Array.isArray(sourceSchema) ||
    Array.isArray(providerSchema)
  ) {
    return [];
  }
  const source = sourceSchema as Record<string, unknown>;
  const provider = providerSchema as Record<string, unknown>;
  const sourceProperties =
    source.properties && typeof source.properties === "object" && !Array.isArray(source.properties)
      ? (source.properties as Record<string, unknown>)
      : {};
  const providerProperties =
    provider.properties &&
    typeof provider.properties === "object" &&
    !Array.isArray(provider.properties)
      ? (provider.properties as Record<string, unknown>)
      : {};
  const requiredNullable = Array.isArray(provider.required)
    ? provider.required
        .filter((item): item is string => typeof item === "string")
        .filter((item) => schemaAllowsNull(sourceProperties[item]))
        .map((item) => `${path}.${item}`)
    : [];
  const nestedProperties = Object.keys(providerProperties).flatMap((key) =>
    collectProviderRequiredNullableFields(
      sourceProperties[key],
      providerProperties[key],
      `${path}.properties.${key}`,
    ),
  );
  const nestedItems = collectProviderRequiredNullableFields(
    source.items,
    provider.items,
    `${path}.items`,
  );
  return [...requiredNullable, ...nestedProperties, ...nestedItems];
}

describe("provider tool schema helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts nullable and unsupported JSON-schema constructs before sending Gemini function tools", () => {
    const tool = {
      type: "function",
      function: {
        name: "submit_audition_report",
        parameters: {
          type: "object",
          properties: {
            score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            note: { type: ["string", "null"] },
            must_be_true: { type: "boolean", enum: [true] },
            open_payload: { type: "object" },
            nested: {
              type: "array",
              maxItems: 2,
              items: {
                type: "object",
                properties: {
                  value: { type: ["string", "number", "boolean", "null"] },
                },
              },
            },
          },
          required: ["score", "note", "must_be_true", "open_payload", "nested"],
        },
      },
    };

    const providerTool = cloneForProviderToolSchema(tool);

    expect(providerTool.function.name).toBe("submit_audition_report");
    expect(hasArrayValuedType(providerTool)).toBe(false);
    expect(providerTool.function.parameters.properties.score.type).toBe("integer");
    expect(
      providerTool.function.parameters.properties.nested.items.properties.value.type,
    ).toBe("string");
    expect(providerTool.function.parameters.required).toEqual([
      "must_be_true",
      "open_payload",
      "nested",
    ]);
    expect(providerTool.function.parameters.properties.must_be_true.enum).toBeUndefined();
    const providerParameters = providerTool.function.parameters as any;
    expect(providerParameters.properties.open_payload.properties.summary.type).toBe(
      "string",
    );
    expect(collectUnsupportedKeys(providerTool)).toEqual([]);
    expect(collectOpenObjectSchemas(providerTool)).toEqual([]);
    expect(collectNonStringEnums(providerTool)).toEqual([]);
  });

  it("builds the real submit_audition_report tool as Gemini-safe schema", () => {
    const providerTool = buildReportToolForProvider("google/gemini-3-flash-preview") as any;
    const providerParameters = providerTool.function.parameters;

    expect(providerTool.function.name).toBe("submit_audition_report");
    expect(hasArrayValuedType(providerTool)).toBe(false);
    expect(collectUnsupportedKeys(providerTool)).toEqual([]);
    expect(collectOpenObjectSchemas(providerTool)).toEqual([]);
    expect(collectNonStringEnums(providerTool)).toEqual([]);
    expect(
      collectProviderRequiredNullableFields(REPORT_TOOL.function.parameters, providerParameters),
    ).toEqual([]);
    expect(
      providerParameters.properties.s10_fix_hierarchy.properties.fix_first.type,
    ).toBe("object");
    expect(
      providerParameters.properties.s10_fix_hierarchy.required,
    ).not.toContain("fix_first");
    expect(
      providerParameters.properties.readiness_score_judgement.properties.category_rationale
        .properties.summary.type,
    ).toBe("string");
  });

  it("leaves non-Gemini tools unchanged and normalises Gemini tools", () => {
    const tool = {
      type: "function",
      function: {
        name: "submit_audition_report",
        parameters: {
          type: "object",
          properties: { score: { type: ["integer", "null"], minimum: 0 } },
          required: ["score"],
        },
      },
    };

    expect(buildProviderToolForModel(tool, "openai/gpt-4.1")).toBe(tool);
    const geminiTool = buildProviderToolForModel(tool, "google/gemini-3-flash-preview");
    expect(geminiTool).not.toBe(tool);
    expect(geminiTool.function.parameters.properties.score.type).toBe("integer");
    expect(geminiTool.function.parameters.required).toBeUndefined();
  });

  it("classifies Gemini function declaration 400s as provider contract errors", () => {
    const body =
      '{"error":{"message":"* GenerateContentRequest.tools[0].function_declarations[0].parameters.properties.score.type: must be specified"}}';

    expect(classifyAiGatewayProviderError(400, body)).toBe("provider_request_contract_error");
    expect(
      shouldRetryWithFreshMuxUrl({
        httpStatus: 400,
        body,
        didMuxUrlRecoveryRetry: false,
        hasPlaybackId: true,
      }),
    ).toBe(false);
  });

  it("allows exactly one fresh Mux URL retry for media URL errors", () => {
    const body = '{"error":{"message":"provider could not fetch file_url video/mp4"}}';

    expect(
      shouldRetryWithFreshMuxUrl({
        httpStatus: 400,
        body,
        didMuxUrlRecoveryRetry: false,
        hasPlaybackId: true,
      }),
    ).toBe(true);
    expect(
      shouldRetryWithFreshMuxUrl({
        httpStatus: 400,
        body,
        didMuxUrlRecoveryRetry: true,
        hasPlaybackId: true,
      }),
    ).toBe(false);
  });

  it("report polish sends the real provider-safe tool and exposes contract failures distinctly", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.tools?.[0]?.function?.name).toBe("submit_audition_report");
      expect(hasArrayValuedType(body.tools?.[0])).toBe(false);
      expect(collectUnsupportedKeys(body.tools?.[0])).toEqual([]);
      expect(collectOpenObjectSchemas(body.tools?.[0])).toEqual([]);
      expect(collectNonStringEnums(body.tools?.[0])).toEqual([]);
      return new Response(
        '{"error":{"message":"* GenerateContentRequest.tools[0].function_declarations[0].parameters.properties.note.type: must be specified"}}',
        { status: 400 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runReportPolish({
      apiKey: "test-key",
      signal: new AbortController().signal,
      evidence: {} as never,
      briefBlock: "Brief: test",
      extractedBlock: "Extracted: test",
      signalsBlock: "Signals: test",
      levelBlock: "Level: professional",
      auditionTitle: "Test",
      model: "google/gemini-3-flash-preview",
      reportTool: REPORT_TOOL,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.safe_error_category).toBe("provider_request_contract_error");
    }
  });
});
