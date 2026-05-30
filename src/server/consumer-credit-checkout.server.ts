import type { Json } from "@/integrations/supabase/types";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildConsumerCheckoutMetadata,
  buildStripeCheckoutSessionParams,
  buildStripeSignedPayload,
  isConsumerStripeEventType,
  parseStripeSignatureHeader,
  timingSafeEqualHex,
} from "@/lib/consumer-credit-checkout";
import { getConsumerTopUpProductBySku } from "@/server/consumer-credit-products.server";
import { metric } from "@/server/metrics.server";
import { recordServerAnalyticsEvent } from "@/server/analytics-events.server";

type StripeObject = Record<string, unknown>;

export type ConsumerStripeEvent = {
  id: string;
  type: string;
  data?: {
    object?: StripeObject;
  };
};

export type ConsumerCheckoutSessionResult = {
  checkout_session_id: string;
  checkout_url: string;
};

function metadataAsJson(metadata: Record<string, unknown>): Json {
  return metadata as Json;
}

function stringValue(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" && id.trim() ? id.trim() : null;
  }
  return null;
}

function integerValue(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function metadataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue === "string") output[key] = rawValue;
  }
  return output;
}

function metadataInteger(metadata: Record<string, string>, key: string): number | null {
  const parsed = Number(metadata[key]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function stripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_CONFIG: Stripe Checkout is not configured.");
  }
  return key;
}

export function stripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_CONFIG: Stripe webhook verification is not configured.");
  }
  return secret;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Stripe webhook verification requires Web Crypto support.");
  }
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): Promise<boolean> {
  const parsed = parseStripeSignatureHeader(input.signatureHeader);
  if (!parsed) return false;

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - parsed.timestamp) > toleranceSeconds) return false;

  const expected = await hmacSha256Hex(
    input.secret,
    buildStripeSignedPayload(parsed.timestamp, input.rawBody),
  );
  return parsed.signatures.some((signature) => timingSafeEqualHex(signature, expected));
}

async function stripePostForm(path: string, body: URLSearchParams): Promise<StripeObject> {
  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => null)) as StripeObject | null;
  if (!response.ok || !payload) {
    const error = payload?.error as { type?: string; code?: string; message?: string } | undefined;
    console.error("[consumer-checkout] stripe_checkout_create_failed", {
      status: response.status,
      type: error?.type ?? null,
      code: error?.code ?? null,
    });
    throw new Error(error?.message ?? "Stripe Checkout could not be started.");
  }
  return payload;
}

export async function createConsumerTopUpCheckoutSession(input: {
  userId: string;
  sku: string;
  origin: string;
  analyticsAttribution?: Record<string, unknown>;
}): Promise<ConsumerCheckoutSessionResult> {
  const product = await getConsumerTopUpProductBySku(input.sku);
  if (!product || !product.active) {
    throw new Error("This credit pack is not available.");
  }
  if (!product.checkout_ready || !product.stripe_price_id) {
    throw new Error("This credit pack is not ready for checkout yet.");
  }

  const metadata = buildConsumerCheckoutMetadata({
    userId: input.userId,
    product,
  });
  const params = buildStripeCheckoutSessionParams({
    origin: input.origin,
    priceId: product.stripe_price_id,
    metadata,
  });
  const session = await stripePostForm("/v1/checkout/sessions", params);
  const sessionId = stringValue(session.id);
  const checkoutUrl = stringValue(session.url);
  if (!sessionId || !checkoutUrl) {
    throw new Error("Stripe Checkout did not return a usable session.");
  }

  const { error } = await supabaseAdmin.rpc("record_consumer_checkout_session", {
    p_user_id: input.userId,
    p_product_sku: product.sku,
    p_credit_amount: product.credit_amount,
    p_currency: product.currency,
    p_amount_total_pence: product.unit_amount_pence,
    p_stripe_price_id: product.stripe_price_id,
    p_stripe_checkout_session_id: sessionId,
    p_stripe_customer_id: stringValue(session.customer) ?? undefined,
    p_metadata: metadataAsJson({
      source: "consumer_top_up_checkout",
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: stringValue(session.payment_intent),
      analytics_attribution: input.analyticsAttribution ?? null,
    }),
  });
  if (error) {
    console.error("[consumer-checkout] checkout_session_record_failed", {
      checkout_session_id: sessionId,
      error: error.message,
    });
    throw new Error("Stripe Checkout was created but could not be recorded.");
  }

  metric("consumer_checkout_created", {
    product_sku: product.sku,
    credit_amount: product.credit_amount,
  });

  return {
    checkout_session_id: sessionId,
    checkout_url: checkoutUrl,
  };
}

function paymentPayloadFromObject(object: StripeObject) {
  const metadata = metadataRecord(object.metadata);
  return {
    metadata,
    user_id: metadata.user_id ?? stringValue(object.client_reference_id),
    product_sku: metadata.product_sku,
    credit_amount: metadataInteger(metadata, "credit_amount"),
    stripe_price_id: metadata.stripe_price_id,
    amount_total_pence:
      integerValue(object.amount_total) ??
      integerValue(object.amount_received) ??
      integerValue(object.amount),
    currency: typeof object.currency === "string" ? object.currency.toUpperCase() : "GBP",
    checkout_session_id: stringValue(object.id),
    payment_intent_id: stringValue(object.payment_intent),
    customer_id: stringValue(object.customer),
  };
}

async function completePaymentFromStripeObject(input: {
  event: ConsumerStripeEvent;
  object: StripeObject;
  eventType: "checkout_session_completed" | "payment_succeeded";
}) {
  const payload = paymentPayloadFromObject(input.object);
  const { error } = await supabaseAdmin.rpc("complete_consumer_credit_payment", {
    p_stripe_event_id: input.event.id,
    p_checkout_session_id:
      input.eventType === "checkout_session_completed"
        ? (payload.checkout_session_id ?? undefined)
        : undefined,
    p_payment_intent_id:
      input.eventType === "payment_succeeded"
        ? (stringValue(input.object.id) ?? undefined)
        : (payload.payment_intent_id ?? undefined),
    p_user_id: payload.user_id ?? undefined,
    p_product_sku: payload.product_sku ?? undefined,
    p_credit_amount: payload.credit_amount ?? undefined,
    p_currency: payload.currency,
    p_amount_total_pence: payload.amount_total_pence ?? undefined,
    p_stripe_price_id: payload.stripe_price_id ?? undefined,
    p_stripe_customer_id: payload.customer_id ?? undefined,
    p_event_type: input.eventType,
    p_metadata: metadataAsJson({
      stripe_event_type: input.event.type,
      stripe_event_id: input.event.id,
      stripe_metadata: payload.metadata,
    }),
  });
  if (error) throw error;
  metric("consumer_payment_succeeded", {
    stripe_event_type: input.event.type,
    product_sku: payload.product_sku ?? "unknown",
  });
  void recordServerAnalyticsEvent({
    eventName: "purchase_completed",
    userId: payload.user_id,
    objectType: "purchase",
    properties: {
      product_sku: payload.product_sku ?? "unknown",
      credit_amount: payload.credit_amount,
      amount_total_pence: payload.amount_total_pence,
      stripe_event_type: input.event.type,
    },
  });
}

async function markPaymentFailed(input: { event: ConsumerStripeEvent; object: StripeObject }) {
  const payload = paymentPayloadFromObject(input.object);
  const lastPaymentError =
    input.object.last_payment_error && typeof input.object.last_payment_error === "object"
      ? (input.object.last_payment_error as Record<string, unknown>)
      : null;
  const { error } = await supabaseAdmin.rpc("mark_consumer_credit_payment_failed", {
    p_stripe_event_id: input.event.id,
    p_checkout_session_id: payload.checkout_session_id ?? undefined,
    p_payment_intent_id: stringValue(input.object.id) ?? payload.payment_intent_id ?? undefined,
    p_user_id: payload.user_id ?? undefined,
    p_product_sku: payload.product_sku ?? undefined,
    p_credit_amount: payload.credit_amount ?? undefined,
    p_currency: payload.currency,
    p_amount_total_pence: payload.amount_total_pence ?? undefined,
    p_stripe_price_id: payload.stripe_price_id ?? undefined,
    p_failure_code:
      stringValue(lastPaymentError?.code) ?? stringValue(lastPaymentError?.type) ?? undefined,
    p_metadata: metadataAsJson({
      stripe_event_type: input.event.type,
      stripe_event_id: input.event.id,
      stripe_metadata: payload.metadata,
    }),
  });
  if (error) throw error;
  metric("consumer_payment_failed", {
    stripe_event_type: input.event.type,
    product_sku: payload.product_sku ?? "unknown",
  });
}

async function reversePaymentFromStripeObject(input: {
  event: ConsumerStripeEvent;
  object: StripeObject;
  eventType: "refund" | "dispute";
}) {
  const paymentIntentId = stringValue(input.object.payment_intent);
  const checkoutSessionId = stringValue(input.object.checkout_session);
  const amountPence =
    integerValue(input.object.amount_refunded) ??
    integerValue(input.object.amount) ??
    integerValue(input.object.amount_disputed);
  const { error } = await supabaseAdmin.rpc("reverse_or_flag_consumer_credit_payment", {
    p_stripe_event_id: input.event.id,
    p_payment_intent_id: paymentIntentId ?? undefined,
    p_checkout_session_id: checkoutSessionId ?? undefined,
    p_event_type: input.eventType,
    p_amount_pence: amountPence ?? undefined,
    p_metadata: metadataAsJson({
      stripe_event_type: input.event.type,
      stripe_event_id: input.event.id,
      stripe_object_id: stringValue(input.object.id),
    }),
  });
  if (error) throw error;
  metric("consumer_payment_reversed", {
    stripe_event_type: input.event.type,
    reversal_type: input.eventType,
  });
}

export async function processConsumerStripeEvent(event: ConsumerStripeEvent) {
  if (!isConsumerStripeEventType(event.type)) {
    return { ok: true, action: "ignored" as const };
  }
  const object = event.data?.object;
  if (!object) throw new Error("Stripe event payload did not include an object.");

  if (event.type === "checkout.session.completed") {
    if (object.payment_status !== "paid") {
      return { ok: true, action: "checkout_completed_without_paid_status" as const };
    }
    await completePaymentFromStripeObject({
      event,
      object,
      eventType: "checkout_session_completed",
    });
    return { ok: true, action: "payment_completed" as const };
  }

  if (event.type === "payment_intent.succeeded") {
    await completePaymentFromStripeObject({
      event,
      object,
      eventType: "payment_succeeded",
    });
    return { ok: true, action: "payment_succeeded" as const };
  }

  if (event.type === "payment_intent.payment_failed") {
    await markPaymentFailed({ event, object });
    return { ok: true, action: "payment_failed" as const };
  }

  if (event.type === "charge.refunded") {
    await reversePaymentFromStripeObject({ event, object, eventType: "refund" });
    return { ok: true, action: "payment_refunded" as const };
  }

  await reversePaymentFromStripeObject({ event, object, eventType: "dispute" });
  return { ok: true, action: "payment_disputed" as const };
}
