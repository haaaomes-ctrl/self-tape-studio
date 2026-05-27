import { describe, expect, it } from "vitest";
import {
  buildConsumerCheckoutMetadata,
  buildStripeCheckoutSessionParams,
  buildStripeSignedPayload,
  isConsumerStripeEventType,
  parseStripeSignatureHeader,
  timingSafeEqualHex,
} from "@/lib/consumer-credit-checkout";
import { LAUNCH_CONSUMER_TOP_UP_PRODUCTS } from "@/lib/consumer-credit-products";

describe("consumer credit checkout helpers", () => {
  it("builds Stripe Checkout params with session and payment-intent metadata", () => {
    const product = {
      ...LAUNCH_CONSUMER_TOP_UP_PRODUCTS[0],
      stripe_price_id: "price_test_123",
    };
    const metadata = buildConsumerCheckoutMetadata({
      userId: "user-123",
      product,
    });
    const params = buildStripeCheckoutSessionParams({
      origin: "https://tapecoach.test/app?ignored=true",
      priceId: product.stripe_price_id,
      metadata,
    });

    expect(params.get("mode")).toBe("payment");
    expect(params.get("line_items[0][price]")).toBe("price_test_123");
    expect(params.get("line_items[0][quantity]")).toBe("1");
    expect(params.get("success_url")).toBe(
      "https://tapecoach.test/credits-success?session_id={CHECKOUT_SESSION_ID}",
    );
    expect(params.get("cancel_url")).toBe("https://tapecoach.test/credits-cancelled");
    expect(params.get("metadata[source]")).toBe("consumer_top_up");
    expect(params.get("metadata[product_sku]")).toBe(product.sku);
    expect(params.get("payment_intent_data[metadata][product_sku]")).toBe(product.sku);
  });

  it("parses Stripe v1 signatures and builds the signed payload", () => {
    const parsed = parseStripeSignatureHeader("t=1710000000,v1=abc123,v0=old,v1=def456");
    expect(parsed).toEqual({ timestamp: 1710000000, signatures: ["abc123", "def456"] });
    expect(buildStripeSignedPayload(1710000000, '{"ok":true}')).toBe('1710000000.{"ok":true}');
  });

  it("recognises only the DS-13 consumer webhook events", () => {
    expect(isConsumerStripeEventType("checkout.session.completed")).toBe(true);
    expect(isConsumerStripeEventType("payment_intent.succeeded")).toBe(true);
    expect(isConsumerStripeEventType("customer.subscription.created")).toBe(false);
  });

  it("compares hex signatures without accepting length mismatches", () => {
    expect(timingSafeEqualHex("abc123", "abc123")).toBe(true);
    expect(timingSafeEqualHex("abc123", "abc124")).toBe(false);
    expect(timingSafeEqualHex("abc123", "abc12300")).toBe(false);
  });
});
