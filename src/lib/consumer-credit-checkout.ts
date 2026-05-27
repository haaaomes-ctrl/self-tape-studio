import type { ConsumerTopUpProduct } from "@/lib/consumer-credit-products";

export const STRIPE_CHECKOUT_MODE = "payment" as const;
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;
export const CONSUMER_CHECKOUT_SOURCE = "consumer_top_up" as const;

export const CONSUMER_STRIPE_EVENT_TYPES = [
  "checkout.session.completed",
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
] as const;

export type ConsumerStripeEventType = (typeof CONSUMER_STRIPE_EVENT_TYPES)[number];

export type ConsumerCheckoutMetadata = {
  source: typeof CONSUMER_CHECKOUT_SOURCE;
  user_id: string;
  product_sku: string;
  credit_amount: string;
  stripe_price_id: string;
};

export type StripeSignatureParts = {
  timestamp: number;
  signatures: string[];
};

const CONSUMER_STRIPE_EVENT_TYPE_SET = new Set<string>(CONSUMER_STRIPE_EVENT_TYPES);

export function isConsumerStripeEventType(value: unknown): value is ConsumerStripeEventType {
  return typeof value === "string" && CONSUMER_STRIPE_EVENT_TYPE_SET.has(value);
}

export function buildConsumerCheckoutMetadata(input: {
  userId: string;
  product: Pick<ConsumerTopUpProduct, "sku" | "credit_amount" | "stripe_price_id">;
}): ConsumerCheckoutMetadata {
  if (!input.product.stripe_price_id) {
    throw new Error("consumer top-up product is not configured for checkout");
  }
  return {
    source: CONSUMER_CHECKOUT_SOURCE,
    user_id: input.userId,
    product_sku: input.product.sku,
    credit_amount: String(input.product.credit_amount),
    stripe_price_id: input.product.stripe_price_id,
  };
}

export function normaliseCheckoutOrigin(value: string): string {
  const parsed = new URL(value);
  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

export function buildStripeCheckoutSessionParams(input: {
  origin: string;
  priceId: string;
  metadata: ConsumerCheckoutMetadata;
}): URLSearchParams {
  const origin = normaliseCheckoutOrigin(input.origin);
  const params = new URLSearchParams();
  params.set("mode", STRIPE_CHECKOUT_MODE);
  params.set("line_items[0][price]", input.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", `${origin}/credits-success?session_id={CHECKOUT_SESSION_ID}`);
  params.set("cancel_url", `${origin}/credits-cancelled`);
  params.set("client_reference_id", input.metadata.user_id);

  for (const [key, value] of Object.entries(input.metadata)) {
    params.set(`metadata[${key}]`, value);
    params.set(`payment_intent_data[metadata][${key}]`, value);
  }

  return params;
}

export function parseStripeSignatureHeader(header: string | null): StripeSignatureParts | null {
  if (!header) return null;
  const parts = header.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter((signature) => /^[a-f0-9]+$/i.test(signature));

  if (!Number.isFinite(timestamp) || timestamp <= 0 || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

export function buildStripeSignedPayload(timestamp: number, rawBody: string): string {
  return `${timestamp}.${rawBody}`;
}

export function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
