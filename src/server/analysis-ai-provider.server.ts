// SERVER-ONLY. AI provider transport adapters for TapeCoach analysis.
// Do not import this module from client/browser code.

export type AnalysisAiProviderId = "lovable_ai_gateway" | "openrouter";

export type AnalysisAiProviderRole = "brief_extraction" | "step1" | "step2" | "recovery";

export type AnalysisAiProviderRuntimeEnv = {
  LOVABLE_API_KEY?: unknown;
  OPENROUTER_API_KEY?: unknown;
  OPENROUTER_SITE_URL?: unknown;
  OPENROUTER_APP_TITLE?: unknown;
  S10_MODEL_STEP1?: unknown;
  S10_MODEL_STEP2?: unknown;
  S10_MODEL_RECOVERY?: unknown;
};

export type AnalysisAiProviderRequest = {
  body: Record<string, unknown>;
  signal?: AbortSignal;
  role?: AnalysisAiProviderRole;
};

export type AnalysisAiProviderFailureCategory =
  | "provider_missing_api_key"
  | "provider_auth_config_failure"
  | "retryable_provider_failure"
  | "provider_request_failure"
  | "malformed_provider_response"
  | "network_error";

export type AnalysisAiProviderJsonResult =
  | {
      ok: true;
      provider: AnalysisAiProviderId;
      status: number;
      body: Record<string, unknown>;
    }
  | {
      ok: false;
      provider: AnalysisAiProviderId;
      status: number | null;
      category: AnalysisAiProviderFailureCategory;
      retryable: boolean;
      error: string;
    };

export interface AnalysisAiProvider {
  id: AnalysisAiProviderId;
  endpoint: string;
  isConfigured(): boolean;
  missingConfigMessage(): string;
  resolveModel(role: AnalysisAiProviderRole, fallbackModel: string): string;
  chatCompletions(input: AnalysisAiProviderRequest): Promise<Response>;
  requestJson(input: AnalysisAiProviderRequest): Promise<AnalysisAiProviderJsonResult>;
}

type FetchLike = typeof fetch;

function cleanEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanHeaderValue(value: unknown): string | null {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) return null;
  return /[\r\n]/.test(cleaned) ? null : cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function retryableHttpStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function failureForHttpStatus(status: number): {
  category: AnalysisAiProviderFailureCategory;
  retryable: boolean;
  error: string;
} {
  if (status === 401 || status === 403) {
    return {
      category: "provider_auth_config_failure",
      retryable: false,
      error: "provider_auth_config_failure",
    };
  }
  if (retryableHttpStatus(status)) {
    return {
      category: "retryable_provider_failure",
      retryable: true,
      error: `provider_retryable_http_${status}`,
    };
  }
  return {
    category: "provider_request_failure",
    retryable: false,
    error: `provider_http_${status}`,
  };
}

abstract class BaseAnalysisAiProvider implements AnalysisAiProvider {
  abstract id: AnalysisAiProviderId;
  abstract endpoint: string;

  protected readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    // Bind to the global scope: calling `this.fetchImpl(...)` as a method
    // rebinds `this` to the provider instance, which makes the native fetch
    // throw "TypeError: Illegal invocation" on Cloudflare Workers.
    this.fetchImpl = (fetchImpl ?? globalThis.fetch).bind(globalThis);
  }

  abstract isConfigured(): boolean;
  abstract missingConfigMessage(): string;
  abstract resolveModel(role: AnalysisAiProviderRole, fallbackModel: string): string;
  abstract chatCompletions(input: AnalysisAiProviderRequest): Promise<Response>;

  async requestJson(input: AnalysisAiProviderRequest): Promise<AnalysisAiProviderJsonResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        provider: this.id,
        status: null,
        category: "provider_missing_api_key",
        retryable: false,
        error: this.missingConfigMessage(),
      };
    }

    let response: Response;
    try {
      response = await this.chatCompletions(input);
    } catch {
      return {
        ok: false,
        provider: this.id,
        status: null,
        category: "network_error",
        retryable: true,
        error: `${this.id}_network_error`,
      };
    }

    if (!response.ok) {
      const failure = failureForHttpStatus(response.status);
      return {
        ok: false,
        provider: this.id,
        status: response.status,
        ...failure,
      };
    }

    try {
      const body = await response.json();
      if (!isRecord(body)) {
        return {
          ok: false,
          provider: this.id,
          status: response.status,
          category: "malformed_provider_response",
          retryable: false,
          error: "provider_response_not_json_object",
        };
      }
      return {
        ok: true,
        provider: this.id,
        status: response.status,
        body,
      };
    } catch {
      return {
        ok: false,
        provider: this.id,
        status: response.status,
        category: "malformed_provider_response",
        retryable: false,
        error: "provider_response_json_parse_error",
      };
    }
  }
}

export class LovableAiGatewayProvider extends BaseAnalysisAiProvider {
  id = "lovable_ai_gateway" as const;
  endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";

  private readonly apiKey: string | null;

  constructor(
    input: { apiKey?: unknown; env?: AnalysisAiProviderRuntimeEnv; fetchImpl?: FetchLike } = {},
  ) {
    super(input.fetchImpl);
    this.apiKey = cleanEnvValue(input.apiKey) ?? cleanEnvValue(input.env?.LOVABLE_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  missingConfigMessage(): string {
    return "LOVABLE_API_KEY is not configured";
  }

  resolveModel(_role: AnalysisAiProviderRole, fallbackModel: string): string {
    return fallbackModel;
  }

  async chatCompletions(input: AnalysisAiProviderRequest): Promise<Response> {
    if (!this.apiKey) throw new Error(this.missingConfigMessage());
    return this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input.body),
      signal: input.signal,
    });
  }
}

export class OpenRouterChatProvider extends BaseAnalysisAiProvider {
  id = "openrouter" as const;
  endpoint = "https://openrouter.ai/api/v1/chat/completions";

  private readonly env: AnalysisAiProviderRuntimeEnv;
  private readonly apiKey: string | null;

  constructor(input: { env?: AnalysisAiProviderRuntimeEnv; fetchImpl?: FetchLike } = {}) {
    super(input.fetchImpl);
    this.env = input.env ?? process.env;
    this.apiKey = cleanEnvValue(this.env.OPENROUTER_API_KEY);
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  missingConfigMessage(): string {
    return "OPENROUTER_API_KEY is not configured";
  }

  resolveModel(role: AnalysisAiProviderRole, fallbackModel: string): string {
    if (role === "step1") return cleanEnvValue(this.env.S10_MODEL_STEP1) ?? fallbackModel;
    if (role === "step2") return cleanEnvValue(this.env.S10_MODEL_STEP2) ?? fallbackModel;
    if (role === "recovery") return cleanEnvValue(this.env.S10_MODEL_RECOVERY) ?? fallbackModel;
    return fallbackModel;
  }

  private buildBody(input: AnalysisAiProviderRequest): Record<string, unknown> {
    const role = input.role;
    const currentModel = typeof input.body.model === "string" ? input.body.model : "";
    if (!role || !currentModel) return input.body;
    const resolvedModel = this.resolveModel(role, currentModel);
    if (resolvedModel === currentModel) return input.body;
    return { ...input.body, model: resolvedModel };
  }

  async chatCompletions(input: AnalysisAiProviderRequest): Promise<Response> {
    if (!this.apiKey) throw new Error(this.missingConfigMessage());
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
    const referer = cleanHeaderValue(this.env.OPENROUTER_SITE_URL);
    const title = cleanHeaderValue(this.env.OPENROUTER_APP_TITLE);
    if (referer) headers["HTTP-Referer"] = referer;
    if (title) headers["X-OpenRouter-Title"] = title;

    return this.fetchImpl(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(this.buildBody(input)),
      signal: input.signal,
    });
  }
}

export function isOpenRouterConfigured(env: AnalysisAiProviderRuntimeEnv = process.env): boolean {
  return Boolean(cleanEnvValue(env.OPENROUTER_API_KEY));
}

export function createAnalysisAiProvider(
  input: {
    env?: AnalysisAiProviderRuntimeEnv;
    lovableApiKey?: unknown;
    fetchImpl?: FetchLike;
  } = {},
): AnalysisAiProvider {
  const env = input.env ?? process.env;
  if (isOpenRouterConfigured(env)) {
    return new OpenRouterChatProvider({ env, fetchImpl: input.fetchImpl });
  }
  return new LovableAiGatewayProvider({
    apiKey: input.lovableApiKey,
    env,
    fetchImpl: input.fetchImpl,
  });
}
