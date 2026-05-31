import type { BrevoEmailRecipient, BrevoSendEmailInput } from "@/server/brevo.server";

export type EmailDispatcherMode = "disabled" | "dry_run" | "sandbox" | "enabled";

export const EMAIL_DISPATCHER_MODES: EmailDispatcherMode[] = [
  "disabled",
  "dry_run",
  "sandbox",
  "enabled",
];

export const EMAIL_DISPATCHER_FORCE_DISABLED_ENV = "EMAIL_DISPATCHER_FORCE_DISABLED";

type QueuePayload = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asPositiveInteger(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveEmailDispatcherMode(value: unknown): EmailDispatcherMode {
  return EMAIL_DISPATCHER_MODES.includes(value as EmailDispatcherMode)
    ? (value as EmailDispatcherMode)
    : "disabled";
}

export function isEmailDispatcherForceDisabled(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "disabled", "disable", "off"].includes(
    value.trim().toLowerCase(),
  );
}

export function resolveEffectiveEmailDispatcherMode(
  dbMode: unknown,
  forceDisabled = process.env[EMAIL_DISPATCHER_FORCE_DISABLED_ENV],
): EmailDispatcherMode {
  if (isEmailDispatcherForceDisabled(forceDisabled)) return "disabled";
  return resolveEmailDispatcherMode(dbMode);
}

export function isTestModeEmailPayload(payload: QueuePayload): boolean {
  return payload.test_mode === true || payload.sandbox === true || payload.sandbox_safe === true;
}

export function parseEmailRecipient(value: unknown): BrevoEmailRecipient {
  const raw = asString(value);
  if (!raw) throw new Error("Email payload is missing a recipient email");

  const bracketMatch = raw.match(/^\s*(.*?)\s*<([^<>@\s]+@[^<>@\s]+)>\s*$/);
  if (bracketMatch) {
    const name = bracketMatch[1]?.trim().replace(/^"|"$/g, "");
    return {
      email: bracketMatch[2],
      ...(name ? { name } : {}),
    };
  }

  if (!raw.includes("@")) throw new Error("Email payload recipient is invalid");
  return { email: raw };
}

export function buildBrevoEmailFromQueuePayload(payload: QueuePayload): BrevoSendEmailInput {
  const messageId = asString(payload.message_id);
  const idempotencyKey = asString(payload.idempotency_key);
  const label = asString(payload.label);
  const purpose = asString(payload.purpose);
  const html = asString(payload.html);
  const text = asString(payload.text);
  const templateId = asPositiveInteger(payload.brevo_template_id ?? payload.template_id);
  const params = asRecord(payload.template_data ?? payload.params);

  if (!templateId && !html && !text) {
    throw new Error("Email payload is missing template, HTML and text content");
  }

  const headers: Record<string, string> = {};
  if (messageId) headers["X-TapeCoach-Message-Id"] = messageId;
  if (idempotencyKey) headers["X-TapeCoach-Idempotency-Key"] = idempotencyKey;

  return {
    sender: parseEmailRecipient(payload.from ?? "TapeCoach <notify@notify.tapecoach.co.uk>"),
    to: [parseEmailRecipient(payload.to)],
    subject: asString(payload.subject) ?? "TapeCoach notification",
    ...(templateId ? { templateId } : {}),
    ...(html ? { htmlContent: html } : {}),
    ...(text ? { textContent: text } : {}),
    ...(params ? { params } : {}),
    tags: [label, purpose, "tapecoach"].filter((tag): tag is string => Boolean(tag)),
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  };
}

export function shouldCompleteQueueMessage(
  mode: EmailDispatcherMode,
  payload: QueuePayload,
): boolean {
  if (mode === "enabled") return true;
  if (mode === "dry_run" || mode === "sandbox") return isTestModeEmailPayload(payload);
  return false;
}
