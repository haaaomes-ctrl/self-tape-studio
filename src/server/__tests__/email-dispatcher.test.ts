import { afterEach, describe, expect, it, vi } from "vitest";
import { brevoSendEmail } from "@/server/brevo.server";
import {
  buildBrevoEmailFromQueuePayload,
  isEmailDispatcherForceDisabled,
  resolveEffectiveEmailDispatcherMode,
  shouldCompleteQueueMessage,
} from "@/server/email-dispatcher.server";

describe("email dispatcher runtime guardrails", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("defaults to disabled and lets the emergency env switch force dispatch off", () => {
    expect(resolveEffectiveEmailDispatcherMode(undefined)).toBe("disabled");
    expect(resolveEffectiveEmailDispatcherMode("enabled")).toBe("enabled");
    expect(resolveEffectiveEmailDispatcherMode("enabled", "true")).toBe("disabled");
    expect(isEmailDispatcherForceDisabled("off")).toBe(true);
  });

  it("maps queue payloads to Brevo without forwarding Lovable run identifiers", () => {
    const brevoEmail = buildBrevoEmailFromQueuePayload({
      run_id: "crm:synthetic-run",
      message_id: "crm:report-ready:user-1",
      idempotency_key: "crm:report-ready:user-1",
      to: "performer@example.com",
      from: "TapeCoach <notify@notify.tapecoach.co.uk>",
      subject: "Your TapeCoach report is ready",
      html: "<p>Ready</p>",
      text: "Ready",
      purpose: "transactional",
      label: "report_ready",
    });

    expect(brevoEmail).toMatchObject({
      sender: { name: "TapeCoach", email: "notify@notify.tapecoach.co.uk" },
      to: [{ email: "performer@example.com" }],
      subject: "Your TapeCoach report is ready",
      htmlContent: "<p>Ready</p>",
      textContent: "Ready",
    });
    expect(JSON.stringify(brevoEmail)).not.toContain("run_id");
    expect(brevoEmail.headers).toMatchObject({
      "X-TapeCoach-Message-Id": "crm:report-ready:user-1",
      "X-TapeCoach-Idempotency-Key": "crm:report-ready:user-1",
    });
  });

  it("does not complete real queue messages in dry-run or sandbox mode", () => {
    expect(shouldCompleteQueueMessage("dry_run", { message_id: "real-1" })).toBe(false);
    expect(shouldCompleteQueueMessage("sandbox", { message_id: "real-1" })).toBe(false);
    expect(shouldCompleteQueueMessage("sandbox", { message_id: "test-1", test_mode: true })).toBe(
      true,
    );
    expect(shouldCompleteQueueMessage("enabled", { message_id: "real-1" })).toBe(true);
    expect(shouldCompleteQueueMessage("disabled", { message_id: "test-1", test_mode: true })).toBe(
      false,
    );
  });

  it("passes the Brevo sandbox header only for sandbox sends", async () => {
    vi.stubEnv("LOVABLE_API_KEY", "lovable-key");
    vi.stubEnv("BREVO_API_KEY", "brevo-key");
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response('{"messageId":"provider-1"}', { status: 201 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await brevoSendEmail(
      {
        sender: { email: "notify@notify.tapecoach.co.uk", name: "TapeCoach" },
        to: [{ email: "performer@example.com" }],
        subject: "Sandbox",
        htmlContent: "<p>Sandbox</p>",
      },
      { sandbox: true },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.headers).toMatchObject({
      Authorization: "Bearer lovable-key",
      "X-Connection-Api-Key": "brevo-key",
      "X-Sib-Sandbox": "drop",
    });
  });
});
