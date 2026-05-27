import { describe, expect, it } from "vitest";
import {
  assertConsumerTopUpProductPriceIdentityUnchanged,
  buildConsumerTopUpProductPatch,
  CONSUMER_TOP_UP_DISPLAY_CONTEXT,
  CONSUMER_TOP_UP_SECONDARY_MESSAGE,
  formatGbpPence,
  LAUNCH_CONSUMER_TOP_UP_PRODUCTS,
  normaliseConsumerTopUpProduct,
  normaliseStripePriceId,
  sortConsumerTopUpProducts,
} from "@/lib/consumer-credit-products";

describe("consumer credit product catalogue", () => {
  it("defines the DS-03 launch top-up products as secondary paid access", () => {
    expect(CONSUMER_TOP_UP_SECONDARY_MESSAGE).toMatch(/free monthly and partner-funded/i);
    expect(LAUNCH_CONSUMER_TOP_UP_PRODUCTS).toHaveLength(2);
    expect(
      LAUNCH_CONSUMER_TOP_UP_PRODUCTS.map((product) => ({
        sku: product.sku,
        credits: product.credit_amount,
        currency: product.currency,
        pence: product.unit_amount_pence,
        active: product.active,
        founding: product.founding_price,
        displayContext: product.display_context,
        priceId: product.stripe_price_id,
      })),
    ).toEqual([
      {
        sku: "consumer-top-up-3-gbp-299",
        credits: 3,
        currency: "GBP",
        pence: 299,
        active: true,
        founding: true,
        displayContext: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
        priceId: null,
      },
      {
        sku: "consumer-top-up-10-gbp-799",
        credits: 10,
        currency: "GBP",
        pence: 799,
        active: true,
        founding: true,
        displayContext: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
        priceId: null,
      },
    ]);
  });

  it("formats GBP display prices and orders by display_order", () => {
    expect(formatGbpPence(299)).toBe("GBP 2.99");
    expect(formatGbpPence(799)).toBe("GBP 7.99");
    expect(
      sortConsumerTopUpProducts([
        { ...LAUNCH_CONSUMER_TOP_UP_PRODUCTS[1], display_order: 20 },
        { ...LAUNCH_CONSUMER_TOP_UP_PRODUCTS[0], display_order: 10 },
      ]).map((product) => product.sku),
    ).toEqual(["consumer-top-up-3-gbp-299", "consumer-top-up-10-gbp-799"]);
  });

  it("normalises real Stripe price ids but does not accept placeholders", () => {
    expect(normaliseStripePriceId(null)).toBeNull();
    expect(normaliseStripePriceId("")).toBeNull();
    expect(normaliseStripePriceId(" price_123_test ")).toBe("price_123_test");
    expect(() => normaliseStripePriceId("starter-pack")).toThrow(/price_/);
  });

  it("marks configured products checkout-ready only when a real Stripe price id is present", () => {
    const product = normaliseConsumerTopUpProduct(
      {
        sku: "consumer-top-up-3-gbp-299",
        name: "Starter top-up",
        description: "Three credits",
        credit_amount: 3,
        currency: "GBP",
        unit_amount_pence: 299,
        stripe_price_id: "price_live_123",
        active: true,
        display_order: 10,
        founding_price: true,
        display_context: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
      },
      "config",
    );

    expect(product.checkout_ready).toBe(true);
    expect(product.display_price).toBe("GBP 2.99");
    expect(product.source).toBe("config");
  });

  it("preserves historical price identity for existing configured products", () => {
    const existing = LAUNCH_CONSUMER_TOP_UP_PRODUCTS[0];
    expect(() =>
      assertConsumerTopUpProductPriceIdentityUnchanged(existing, {
        sku: existing.sku,
        active: false,
        display_order: 30,
        stripe_price_id: "price_123",
      }),
    ).not.toThrow();

    expect(() =>
      assertConsumerTopUpProductPriceIdentityUnchanged(existing, {
        sku: existing.sku,
        unit_amount_pence: 399,
      }),
    ).toThrow(/create a new SKU/i);
  });

  it("builds admin patches without widening into checkout or referral automation", () => {
    const existing = LAUNCH_CONSUMER_TOP_UP_PRODUCTS[1];
    expect(
      buildConsumerTopUpProductPatch(
        {
          sku: existing.sku,
          stripe_price_id: "price_abc",
          active: false,
          founding_price: false,
          display_order: 40,
        },
        existing,
      ),
    ).toEqual({
      sku: existing.sku,
      stripe_price_id: "price_abc",
      active: false,
      founding_price: false,
      display_order: 40,
      display_context: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
    });
  });
});
