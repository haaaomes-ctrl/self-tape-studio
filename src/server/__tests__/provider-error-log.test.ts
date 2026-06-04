import { afterEach, describe, expect, it, vi } from "vitest";
import { logProviderError, redactProviderErrorText } from "../provider-error-log.server";

describe("redactProviderErrorText", () => {
  it("redacts signed/token query params (Mux-style URLs)", () => {
    const input =
      "fetch failed for https://stream.mux.com/abc.m3u8?token=eyJhbGciOiJSUzI1NiJ9.secret&mux_token=abc123&signature=deadbeef";
    const out = redactProviderErrorText(input);
    expect(out).toContain("?token=[redacted]");
    expect(out).toContain("&mux_token=[redacted]");
    expect(out).toContain("&signature=[redacted]");
    expect(out).not.toContain("eyJhbGciOiJSUzI1NiJ9.secret");
    expect(out).not.toContain("deadbeef");
  });

  it("redacts Authorization bearer values in header-shaped text", () => {
    const out = redactProviderErrorText(
      'request headers: { "Authorization": "Bearer sk-or-v1-0123456789abcdef" }',
    );
    expect(out).not.toContain("sk-or-v1-0123456789abcdef");
    expect(out).toContain("[redacted]");
  });

  it("redacts bare Bearer tokens", () => {
    const out = redactProviderErrorText("sent Bearer abcdefghijklmnop to upstream");
    expect(out).toBe("sent Bearer [redacted] to upstream");
  });

  it("redacts OpenRouter-style sk-or keys outside header context", () => {
    const out = redactProviderErrorText("key sk-or-v1-aaaabbbbccccdddd rejected");
    expect(out).toBe("key sk-or-[redacted] rejected");
  });

  it("leaves ordinary error text untouched", () => {
    const input = "TypeError: Illegal invocation: function called with incorrect this reference";
    expect(redactProviderErrorText(input)).toBe(input);
  });
});

describe("logProviderError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs structured context with message and redacted stack for Error inputs", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("fetch failed: https://stream.mux.com/a.m3u8?token=supersecret");
    logProviderError(
      {
        stage: "evidence_pass",
        provider: "openrouter",
        model: "google/gemini-3.5-flash",
        httpStatus: null,
      },
      err,
    );
    expect(spy).toHaveBeenCalledTimes(1);
    const [tag, payload] = spy.mock.calls[0] as [string, Record<string, unknown>];
    expect(tag).toBe("[provider-error]");
    expect(payload).toMatchObject({
      stage: "evidence_pass",
      provider: "openrouter",
      model: "google/gemini-3.5-flash",
      http_status: null,
      error_name: "Error",
    });
    expect(payload.message).toContain("token=[redacted]");
    expect(payload.message).not.toContain("supersecret");
    expect(String(payload.stack)).toContain("at ");
    expect(String(payload.stack)).not.toContain("supersecret");
  });

  it("handles non-Error throwables without crashing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logProviderError({ stage: "provider_request" }, "plain string failure");
    logProviderError({ stage: "provider_request" }, null);
    logProviderError({ stage: "provider_request" }, { weird: true });
    expect(spy).toHaveBeenCalledTimes(3);
    const first = spy.mock.calls[0][1] as Record<string, unknown>;
    expect(first.message).toBe("plain string failure");
    expect(first.stack).toBeNull();
    expect(first.provider).toBeNull();
  });
});
