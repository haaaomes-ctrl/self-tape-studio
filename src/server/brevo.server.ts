// Backend-only Brevo utilities. All calls go through the Lovable connector gateway.
// Never import from client code.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

function getAuthHeaders(): Record<string, string> {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) throw new Error("BREVO_API_KEY is not configured");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": BREVO_API_KEY,
  };
}

async function brevoFetch(path: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: { ...getAuthHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await response.text();
  const data = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new Error(`Brevo API call failed [${response.status}] ${path}: ${text}`);
  }
  return data;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Create or update a Brevo contact (upsert by email).
 * Brevo's createContact endpoint accepts updateEnabled=true to upsert.
 */
export type BrevoContactInput = {
  email: string;
  attributes?: Record<string, unknown>;
  listIds?: number[];
  ext_id?: string;
  smsBlacklisted?: boolean;
  emailBlacklisted?: boolean;
};

export async function brevoSyncContact(input: BrevoContactInput): Promise<unknown> {
  if (!input.email || typeof input.email !== "string") {
    throw new Error("brevoSyncContact: email is required");
  }
  return brevoFetch("/contacts", {
    method: "POST",
    body: JSON.stringify({ ...input, updateEnabled: true }),
  });
}

/**
 * Track a custom event for a contact via Brevo's events endpoint.
 * See: https://developers.brevo.com/reference/createevent
 */
export type BrevoTrackEventInput = {
  event_name: string;
  identifiers: { email_id?: string; phone_id?: string; ext_id?: string };
  contact_properties?: Record<string, unknown>;
  event_properties?: Record<string, unknown>;
  event_date?: string; // ISO 8601
};

export async function brevoTrackEvent(input: BrevoTrackEventInput): Promise<unknown> {
  if (!input.event_name) throw new Error("brevoTrackEvent: event_name is required");
  if (
    !input.identifiers ||
    (!input.identifiers.email_id && !input.identifiers.phone_id && !input.identifiers.ext_id)
  ) {
    throw new Error(
      "brevoTrackEvent: at least one identifier (email_id, phone_id, ext_id) is required",
    );
  }
  return brevoFetch("/events", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Send a transactional email via Brevo SMTP API.
 * See: https://developers.brevo.com/reference/sendtransacemail
 */
export type BrevoEmailRecipient = { email: string; name?: string };
export type BrevoSendEmailInput = {
  sender: BrevoEmailRecipient;
  to: BrevoEmailRecipient[];
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  cc?: BrevoEmailRecipient[];
  bcc?: BrevoEmailRecipient[];
  replyTo?: BrevoEmailRecipient;
  templateId?: number;
  params?: Record<string, unknown>;
  tags?: string[];
  headers?: Record<string, string>;
};

export type BrevoSendEmailOptions = {
  sandbox?: boolean;
};

export async function brevoSendEmail(
  input: BrevoSendEmailInput,
  options: BrevoSendEmailOptions = {},
): Promise<unknown> {
  if (!input.sender?.email) throw new Error("brevoSendEmail: sender.email is required");
  if (!Array.isArray(input.to) || input.to.length === 0) {
    throw new Error("brevoSendEmail: at least one recipient is required");
  }
  if (!input.templateId && !input.htmlContent && !input.textContent) {
    throw new Error("brevoSendEmail: templateId, htmlContent, or textContent is required");
  }
  return brevoFetch("/smtp/email", {
    method: "POST",
    headers: options.sandbox ? { "X-Sib-Sandbox": "drop" } : undefined,
    body: JSON.stringify(input),
  });
}
