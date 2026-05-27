export const CONSUMER_TOP_UP_DISPLAY_CONTEXT = "secondary_consumer_top_up" as const;

export const CONSUMER_TOP_UP_SECONDARY_MESSAGE =
  "Optional paid top-ups sit behind free monthly and partner-funded TapeCoach access.";

export type ConsumerTopUpDisplayContext = typeof CONSUMER_TOP_UP_DISPLAY_CONTEXT;
export type ConsumerTopUpSource = "config" | "default";

export type ConsumerTopUpProduct = {
  sku: string;
  name: string;
  description: string;
  credit_amount: number;
  currency: "GBP";
  unit_amount_pence: number;
  display_price: string;
  stripe_price_id: string | null;
  active: boolean;
  display_order: number;
  founding_price: boolean;
  display_context: ConsumerTopUpDisplayContext;
  checkout_ready: boolean;
  source: ConsumerTopUpSource;
};

export type ConsumerTopUpCatalogue = {
  products: ConsumerTopUpProduct[];
  source: ConsumerTopUpSource;
  secondary_message: string;
};

export type ConsumerTopUpProductInput = {
  sku: string;
  name?: string;
  description?: string;
  credit_amount?: number;
  currency?: "GBP";
  unit_amount_pence?: number;
  stripe_price_id?: string | null;
  active?: boolean;
  display_order?: number;
  founding_price?: boolean;
};

export type ConsumerTopUpProductPatch = {
  sku: string;
  name?: string;
  description?: string;
  credit_amount?: number;
  currency?: "GBP";
  unit_amount_pence?: number;
  stripe_price_id?: string | null;
  active?: boolean;
  display_order?: number;
  founding_price?: boolean;
  display_context?: ConsumerTopUpDisplayContext;
};

type ConsumerTopUpProductRecord = Record<string, unknown>;

const SKU_PATTERN = /^[a-z0-9][a-z0-9-]{2,80}$/;
const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9_]+$/;

export const LAUNCH_CONSUMER_TOP_UP_PRODUCTS: ConsumerTopUpProduct[] = [
  {
    sku: "consumer-top-up-3-gbp-299",
    name: "Starter top-up",
    description:
      "Adds 3 TapeCoach report credits for performers who need more than their free or partner-funded allowance.",
    credit_amount: 3,
    currency: "GBP",
    unit_amount_pence: 299,
    display_price: "GBP 2.99",
    stripe_price_id: null,
    active: true,
    display_order: 10,
    founding_price: true,
    display_context: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
    checkout_ready: false,
    source: "default",
  },
  {
    sku: "consumer-top-up-10-gbp-799",
    name: "Habit top-up",
    description:
      "Adds 10 TapeCoach report credits for performers using TapeCoach across repeated self-tape practice.",
    credit_amount: 10,
    currency: "GBP",
    unit_amount_pence: 799,
    display_price: "GBP 7.99",
    stripe_price_id: null,
    active: true,
    display_order: 20,
    founding_price: true,
    display_context: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
    checkout_ready: false,
    source: "default",
  },
];

export function formatGbpPence(unitAmountPence: number): string {
  return `GBP ${(unitAmountPence / 100).toFixed(2)}`;
}

export function normaliseStripePriceId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error("stripe_price_id must be a Stripe price id or null");
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!STRIPE_PRICE_ID_PATTERN.test(trimmed)) {
    throw new Error("stripe_price_id must start with price_");
  }
  return trimmed;
}

function readString(row: ConsumerTopUpProductRecord, key: string, fallback: string): string {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readInteger(row: ConsumerTopUpProductRecord, key: string, fallback: number): number {
  const value = row[key];
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(row: ConsumerTopUpProductRecord, key: string, fallback: boolean): boolean {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

export function normaliseConsumerTopUpProduct(
  row: ConsumerTopUpProductRecord,
  source: ConsumerTopUpSource,
): ConsumerTopUpProduct {
  const fallback =
    LAUNCH_CONSUMER_TOP_UP_PRODUCTS.find((product) => product.sku === row.sku) ??
    LAUNCH_CONSUMER_TOP_UP_PRODUCTS[0];
  const unitAmountPence = readInteger(row, "unit_amount_pence", fallback.unit_amount_pence);
  const currency = readString(row, "currency", "GBP") === "GBP" ? "GBP" : "GBP";
  const stripePriceId = normaliseStripePriceId(row.stripe_price_id);
  const displayContext =
    row.display_context === CONSUMER_TOP_UP_DISPLAY_CONTEXT
      ? CONSUMER_TOP_UP_DISPLAY_CONTEXT
      : CONSUMER_TOP_UP_DISPLAY_CONTEXT;

  return {
    sku: readString(row, "sku", fallback.sku),
    name: readString(row, "name", fallback.name),
    description: readString(row, "description", fallback.description),
    credit_amount: readInteger(row, "credit_amount", fallback.credit_amount),
    currency,
    unit_amount_pence: unitAmountPence,
    display_price: formatGbpPence(unitAmountPence),
    stripe_price_id: stripePriceId,
    active: readBoolean(row, "active", fallback.active),
    display_order: readInteger(row, "display_order", fallback.display_order),
    founding_price: readBoolean(row, "founding_price", fallback.founding_price),
    display_context: displayContext,
    checkout_ready: Boolean(stripePriceId),
    source,
  };
}

export function sortConsumerTopUpProducts(
  products: ConsumerTopUpProduct[],
): ConsumerTopUpProduct[] {
  return [...products].sort(
    (left, right) => left.display_order - right.display_order || left.sku.localeCompare(right.sku),
  );
}

export function assertConsumerTopUpProductPriceIdentityUnchanged(
  existing: Pick<ConsumerTopUpProduct, "sku" | "credit_amount" | "currency" | "unit_amount_pence">,
  next: ConsumerTopUpProductInput,
): void {
  const attemptedCreditAmount = next.credit_amount ?? existing.credit_amount;
  const attemptedCurrency = next.currency ?? existing.currency;
  const attemptedUnitAmount = next.unit_amount_pence ?? existing.unit_amount_pence;

  if (
    attemptedCreditAmount !== existing.credit_amount ||
    attemptedCurrency !== existing.currency ||
    attemptedUnitAmount !== existing.unit_amount_pence
  ) {
    throw new Error(
      `Historical price preservation: create a new SKU instead of changing price fields for ${existing.sku}`,
    );
  }
}

export function buildConsumerTopUpProductPatch(
  input: ConsumerTopUpProductInput,
  existing?: Pick<ConsumerTopUpProduct, "sku" | "credit_amount" | "currency" | "unit_amount_pence">,
): ConsumerTopUpProductPatch {
  const sku = input.sku.trim();
  if (!SKU_PATTERN.test(sku)) {
    throw new Error("sku must be lowercase kebab-case");
  }

  if (existing) {
    assertConsumerTopUpProductPriceIdentityUnchanged(existing, input);
  } else if (
    input.credit_amount === undefined ||
    input.currency === undefined ||
    input.unit_amount_pence === undefined
  ) {
    throw new Error("new products require credit_amount, currency and unit_amount_pence");
  }

  const patch: ConsumerTopUpProductPatch = {
    sku,
    display_context: CONSUMER_TOP_UP_DISPLAY_CONTEXT,
  };

  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.credit_amount !== undefined) patch.credit_amount = input.credit_amount;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.unit_amount_pence !== undefined) {
    patch.unit_amount_pence = input.unit_amount_pence;
  }
  if (input.stripe_price_id !== undefined) {
    patch.stripe_price_id = normaliseStripePriceId(input.stripe_price_id);
  }
  if (input.active !== undefined) patch.active = input.active;
  if (input.display_order !== undefined) patch.display_order = input.display_order;
  if (input.founding_price !== undefined) patch.founding_price = input.founding_price;

  return patch;
}
