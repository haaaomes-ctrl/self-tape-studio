import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildProviderToolForModel,
  classifyAiGatewayProviderError,
  cloneForProviderToolSchema,
  parseProviderJsonObjectContent,
  selectReportProviderContract,
  shouldRetryWithFreshMuxUrl,
} from "@/server/provider-tool-schema.server";
import {
  buildReportToolForProvider,
  buildSinglePassReportRequestBodyForProvider,
  REPORT_TOOL,
} from "@/server/process-take.server";
import {
  buildReportPolishRequestBodyForProvider,
  runReportPolish,
} from "@/server/report-polish.server";

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

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  expect(value, label).toBeTruthy();
  expect(typeof value, label).toBe("object");
  expect(Array.isArray(value), label).toBe(false);
  return value as Record<string, unknown>;
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
    expect(providerTool.function.parameters.properties.nested.items.properties.value.type).toBe(
      "string",
    );
    expect(providerTool.function.parameters.required).toEqual([
      "must_be_true",
      "open_payload",
      "nested",
    ]);
    expect(providerTool.function.parameters.properties.must_be_true.enum).toBeUndefined();
    const providerProperties = expectRecord(
      providerTool.function.parameters.properties,
      "provider properties",
    );
    const openPayload = expectRecord(providerProperties.open_payload, "open payload schema");
    const openPayloadProperties = expectRecord(openPayload.properties, "open payload properties");
    const summary = expectRecord(openPayloadProperties.summary, "open payload summary");
    expect(summary.type).toBe("string");
    expect(collectUnsupportedKeys(providerTool)).toEqual([]);
    expect(collectOpenObjectSchemas(providerTool)).toEqual([]);
    expect(collectNonStringEnums(providerTool)).toEqual([]);
  });

  it("builds the real submit_audition_report tool as Gemini-safe schema", () => {
    const providerTool = buildReportToolForProvider("google/gemini-3-flash-preview");
    const providerParameters = expectRecord(
      providerTool.function.parameters,
      "provider parameters",
    );
    const providerProperties = expectRecord(providerParameters.properties, "provider properties");

    expect(providerTool.function.name).toBe("submit_audition_report");
    expect(hasArrayValuedType(providerTool)).toBe(false);
    expect(collectUnsupportedKeys(providerTool)).toEqual([]);
    expect(collectOpenObjectSchemas(providerTool)).toEqual([]);
    expect(collectNonStringEnums(providerTool)).toEqual([]);
    expect(
      collectProviderRequiredNullableFields(REPORT_TOOL.function.parameters, providerParameters),
    ).toEqual([]);
    const fixHierarchy = expectRecord(providerProperties.s10_fix_hierarchy, "fix hierarchy schema");
    const fixHierarchyProperties = expectRecord(
      fixHierarchy.properties,
      "fix hierarchy properties",
    );
    const fixFirst = expectRecord(fixHierarchyProperties.fix_first, "fix first schema");
    expect(fixFirst.type).toBe("object");
    expect(fixHierarchy.required).not.toContain("fix_first");
    const readiness = expectRecord(
      providerProperties.readiness_score_judgement,
      "readiness schema",
    );
    const readinessProperties = expectRecord(readiness.properties, "readiness properties");
    const categoryRationale = expectRecord(
      readinessProperties.category_rationale,
      "category rationale schema",
    );
    const categoryRationaleProperties = expectRecord(
      categoryRationale.properties,
      "category rationale properties",
    );
    const categorySummary = expectRecord(
      categoryRationaleProperties.summary,
      "category summary schema",
    );
    expect(categorySummary.type).toBe("string");
    const selectedLevelCalibration = expectRecord(
      readinessProperties.selected_level_calibration,
      "selected level calibration schema",
    );
    const selectedLevelCalibrationProperties = expectRecord(
      selectedLevelCalibration.properties,
      "selected level calibration properties",
    );
    const selectedLevel = expectRecord(
      selectedLevelCalibrationProperties.selected_level,
      "selected level schema",
    );
    expect(Array.isArray(selectedLevel.enum) ? selectedLevel.enum : []).toContain("professional");
  });

  it("uses plain JSON report contracts for Gemini report generation", () => {
    expect(selectReportProviderContract("google/gemini-3-flash-preview")).toBe("plain_json_report");

    const polishBody = buildReportPolishRequestBodyForProvider({
      model: "google/gemini-3-flash-preview",
      systemPrompt: "system",
      userText: "user",
      reportTool: REPORT_TOOL,
    });
    expect(polishBody).not.toHaveProperty("tools");
    expect(polishBody).not.toHaveProperty("tool_choice");
    expect(JSON.stringify(polishBody)).toContain("Return ONLY the JSON object");

    const singlePassBody = buildSinglePassReportRequestBodyForProvider({
      model: "google/gemini-3-flash-preview",
      systemPrompt: "system",
      userText: "user",
      videoUrl: "https://example.invalid/video.mp4",
    });
    expect(singlePassBody).not.toHaveProperty("tools");
    expect(singlePassBody).not.toHaveProperty("tool_choice");
    expect(JSON.stringify(singlePassBody)).toContain("file_url");
    expect(JSON.stringify(singlePassBody)).toContain("Return ONLY the JSON object");
  });

  it("keeps tool-call report contracts for non-Gemini providers", () => {
    expect(selectReportProviderContract("openai/gpt-4.1")).toBe("tool_call");

    const polishBody = buildReportPolishRequestBodyForProvider({
      model: "openai/gpt-4.1",
      systemPrompt: "system",
      userText: "user",
      reportTool: REPORT_TOOL,
    });
    expect(Array.isArray(polishBody.tools)).toBe(true);
    const tools = polishBody.tools as unknown[];
    const firstTool = expectRecord(tools[0], "first tool");
    const firstToolFunction = expectRecord(firstTool.function, "first tool function");
    expect(firstToolFunction.name).toBe("submit_audition_report");
    expect(polishBody.tool_choice).toMatchObject({
      type: "function",
      function: { name: "submit_audition_report" },
    });
  });

  it("parses plain JSON report content from Gemini-style responses", () => {
    expect(parseProviderJsonObjectContent('```json\n{"overall_score":82}\n```')).toEqual({
      overall_score: 82,
    });
    expect(
      parseProviderJsonObjectContent([
        { type: "text", text: 'Here is the JSON:\n{"mode":"FULL"}' },
      ]),
    ).toEqual({ mode: "FULL" });
    expect(parseProviderJsonObjectContent('[{"overall_score":82}]')).toEqual({
      overall_score: 82,
    });
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

  it("report polish sends plain JSON requests for Gemini and parses report content", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.tools).toBeUndefined();
      expect(body.tool_choice).toBeUndefined();
      expect(JSON.stringify(body.messages)).toContain("Return ONLY the JSON object");
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '```json\n{"mode":"FULL","overall_score":88}\n```',
              },
            },
          ],
        }),
        { status: 200 },
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
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.report).toMatchObject({ mode: "FULL", overall_score: 88 });
    }
  });
});
