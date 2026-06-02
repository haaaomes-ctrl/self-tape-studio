import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAnalysisAiProvider,
  OpenRouterChatProvider,
  type AnalysisAiProviderRuntimeEnv,
} from "@/server/analysis-ai-provider.server";

function createFetchStub(responseFactory: () => Response | Promise<Response>) {
  const calls: Array<{ url: RequestInfo | URL; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url, init });
    return responseFactory();
  };
  return { calls, fetchImpl };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function openRouterEnv(overrides: AnalysisAiProviderRuntimeEnv = {}): AnalysisAiProviderRuntimeEnv {
  return {
    OPENROUTER_API_KEY: "or-test-secret",
    OPENROUTER_SITE_URL: "https://tapecoach.example",
    OPENROUTER_APP_TITLE: "TapeCoach",
    S10_MODEL_STEP1: "openrouter/step-1",
    S10_MODEL_STEP2: "openrouter/step-2",
    S10_MODEL_RECOVERY: "openrouter/recovery",
    ...overrides,
  };
}

describe("OpenRouterChatProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends successful chat completions to OpenRouter with configured model and safe headers", async () => {
    const { calls, fetchImpl } = createFetchStub(() =>
      jsonResponse({ choices: [{ message: { content: "{}" } }], usage: { total_tokens: 1 } }),
    );
    const provider = new OpenRouterChatProvider({
      env: openRouterEnv(),
      fetchImpl,
    });
    const messages = [
      { role: "system", content: "system prompt text" },
      { role: "user", content: "user prompt text" },
    ];

    const result = await provider.requestJson({
      role: "step1",
      body: {
        model: "google/gemini-3-flash-preview",
        messages,
        tools: [{ type: "function", function: { name: "submit_observations" } }],
        tool_choice: { type: "function", function: { name: "submit_observations" } },
      },
    });

    expect(result).toMatchObject({
      ok: true,
      provider: "openrouter",
      status: 200,
    });
    expect(calls).toHaveLength(1);
    expect(String(calls[0].url)).toBe("https://openrouter.ai/api/v1/chat/completions");
    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer or-test-secret");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("HTTP-Referer")).toBe("https://tapecoach.example");
    expect(headers.get("X-OpenRouter-Title")).toBe("TapeCoach");

    const sentBody = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(sentBody.model).toBe("openrouter/step-1");
    expect(sentBody.messages).toEqual(messages);
    expect(sentBody.tools).toEqual([
      { type: "function", function: { name: "submit_observations" } },
    ]);
  });

  it("resolves configurable S10 model names by analysis role", () => {
    const provider = new OpenRouterChatProvider({ env: openRouterEnv() });

    expect(provider.resolveModel("step1", "fallback")).toBe("openrouter/step-1");
    expect(provider.resolveModel("step2", "fallback")).toBe("openrouter/step-2");
    expect(provider.resolveModel("recovery", "fallback")).toBe("openrouter/recovery");
    expect(provider.resolveModel("brief_extraction", "fallback")).toBe("fallback");
  });

  it.each([429, 500, 503])("classifies HTTP %i as retryable provider failure", async (status) => {
    const { fetchImpl } = createFetchStub(() => jsonResponse({ error: "provider error" }, status));
    const provider = new OpenRouterChatProvider({ env: openRouterEnv(), fetchImpl });

    const result = await provider.requestJson({
      role: "step2",
      body: { model: "fallback", messages: [] },
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "openrouter",
      status,
      category: "retryable_provider_failure",
      retryable: true,
    });
  });

  it.each([401, 403])("classifies HTTP %i as safe auth/config failure", async (status) => {
    const { fetchImpl } = createFetchStub(() => jsonResponse({ error: "auth failed" }, status));
    const provider = new OpenRouterChatProvider({ env: openRouterEnv(), fetchImpl });

    const result = await provider.requestJson({
      role: "step2",
      body: { model: "fallback", messages: [] },
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "openrouter",
      status,
      category: "provider_auth_config_failure",
      retryable: false,
      error: "provider_auth_config_failure",
    });
  });

  it("classifies malformed successful responses as controlled failures", async () => {
    const { fetchImpl } = createFetchStub(
      () =>
        new Response("not json", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const provider = new OpenRouterChatProvider({ env: openRouterEnv(), fetchImpl });

    const result = await provider.requestJson({
      role: "step2",
      body: { model: "fallback", messages: [] },
    });

    expect(result).toMatchObject({
      ok: false,
      provider: "openrouter",
      status: 200,
      category: "malformed_provider_response",
      retryable: false,
      error: "provider_response_json_parse_error",
    });
  });

  it("does not log or return API keys in provider failures", async () => {
    const apiKey = "or-never-return-this-secret";
    const { fetchImpl } = createFetchStub(() => jsonResponse({ error: "auth failed" }, 401));
    const provider = new OpenRouterChatProvider({
      env: openRouterEnv({ OPENROUTER_API_KEY: apiKey }),
      fetchImpl,
    });
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await provider.requestJson({
      role: "step2",
      body: { model: "fallback", messages: [] },
    });

    expect(JSON.stringify(result)).not.toContain(apiKey);
    expect(consoleWarn).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("passes prompt and JSON/tool contracts through unchanged", async () => {
    const { calls, fetchImpl } = createFetchStub(() =>
      jsonResponse({ choices: [{ message: { content: "{}" } }] }),
    );
    const provider = new OpenRouterChatProvider({ env: openRouterEnv(), fetchImpl });
    const exactPrompt = "Exact S10 prompt text must remain unchanged.";
    const body = {
      model: "google/gemini-3-flash-preview",
      temperature: 0.2,
      top_p: 1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: exactPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "analyse this exact user prompt" },
            { type: "file_url", file_url: { url: "https://media.example/tape.mp4" } },
          ],
        },
      ],
      tools: [{ type: "function", function: { name: "submit_audition_report" } }],
      tool_choice: { type: "function", function: { name: "submit_audition_report" } },
    };

    await provider.chatCompletions({ role: "recovery", body });

    const sentBody = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(sentBody).toEqual({
      ...body,
      model: "openrouter/recovery",
    });
    const messages = sentBody.messages as Array<{ role: string; content: unknown }>;
    expect(messages[0].content).toBe(exactPrompt);
  });
});

describe("createAnalysisAiProvider", () => {
  it("keeps the Lovable gateway as the default provider", () => {
    const provider = createAnalysisAiProvider({
      env: { LOVABLE_API_KEY: "lovable-secret" },
    });

    expect(provider.id).toBe("lovable_ai_gateway");
  });

  it("selects OpenRouter only when OpenRouter is explicitly configured", () => {
    const provider = createAnalysisAiProvider({
      env: {
        LOVABLE_API_KEY: "lovable-secret",
        OPENROUTER_API_KEY: "or-test-secret",
      },
    });

    expect(provider.id).toBe("openrouter");
  });
});
