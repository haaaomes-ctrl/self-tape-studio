import { afterEach, describe, expect, it, vi } from "vitest";
import {
  classifyAiGatewayProviderError,
  cloneForProviderToolSchema,
  shouldRetryWithFreshMuxUrl,
} from "@/server/provider-tool-schema.server";
import { runReportPolish } from "@/server/report-polish.server";

function hasArrayValuedType(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => hasArrayValuedType(item));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => {
    if (key === "type" && Array.isArray(child)) return true;
    return hasArrayValuedType(child);
  });
}

describe("provider tool schema helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts nullable JSON-schema union types before sending Gemini function tools", () => {
    const tool = {
      type: "function",
      function: {
        name: "submit_audition_report",
        parameters: {
          type: "object",
          properties: {
            score: { type: ["integer", "null"], minimum: 0, maximum: 100 },
            note: { type: ["string", "null"] },
            nested: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  value: { type: ["string", "number", "boolean", "null"] },
                },
              },
            },
          },
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

  it("report polish sends a provider-safe tool and exposes contract failures distinctly", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      expect(body.tools?.[0]?.function?.name).toBe("submit_audition_report");
      expect(hasArrayValuedType(body.tools?.[0])).toBe(false);
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
      reportTool: {
        type: "function",
        function: {
          name: "submit_audition_report",
          parameters: {
            type: "object",
            properties: { note: { type: ["string", "null"] } },
          },
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.safe_error_category).toBe("provider_request_contract_error");
    }
  });
});
