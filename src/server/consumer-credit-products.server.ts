import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildConsumerTopUpProductPatch,
  CONSUMER_TOP_UP_SECONDARY_MESSAGE,
  LAUNCH_CONSUMER_TOP_UP_PRODUCTS,
  normaliseConsumerTopUpProduct,
  sortConsumerTopUpProducts,
  type ConsumerTopUpCatalogue,
  type ConsumerTopUpProductInput,
} from "@/lib/consumer-credit-products";

const SELECT_FIELDS =
  "sku, name, description, credit_amount, currency, unit_amount_pence, stripe_price_id, active, display_order, founding_price, display_context";

function defaultCatalogue(): ConsumerTopUpCatalogue {
  return {
    products: sortConsumerTopUpProducts(LAUNCH_CONSUMER_TOP_UP_PRODUCTS),
    source: "default",
    secondary_message: CONSUMER_TOP_UP_SECONDARY_MESSAGE,
  };
}

export async function getConsumerTopUpCatalogue(): Promise<ConsumerTopUpCatalogue> {
  try {
    const { data, error } = await supabaseAdmin
      .from("consumer_credit_products")
      .select(SELECT_FIELDS)
      .order("display_order", { ascending: true })
      .order("sku", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[consumer-products] catalogue_read_failed", error);
      return defaultCatalogue();
    }

    return {
      products: sortConsumerTopUpProducts(
        data.map((row) => normaliseConsumerTopUpProduct(row, "config")),
      ),
      source: "config",
      secondary_message: CONSUMER_TOP_UP_SECONDARY_MESSAGE,
    };
  } catch (err) {
    console.warn("[consumer-products] catalogue_read_failed", err);
    return defaultCatalogue();
  }
}

export async function upsertConsumerTopUpProducts(inputs: ConsumerTopUpProductInput[]) {
  const changedSkus: string[] = [];

  for (const input of inputs) {
    const sku = input.sku.trim();
    const { data: existingRow, error: readError } = await supabaseAdmin
      .from("consumer_credit_products")
      .select(SELECT_FIELDS)
      .eq("sku", sku)
      .maybeSingle();

    if (readError) {
      console.error("[consumer-products] product_lookup_failed", {
        sku,
        error: readError.message,
      });
      throw new Response("product lookup failed", { status: 500 });
    }

    const existing = existingRow ? normaliseConsumerTopUpProduct(existingRow, "config") : undefined;
    const patch = buildConsumerTopUpProductPatch(input, existing);
    const isCreate = !existing;

    if (isCreate && (!patch.name || !patch.description)) {
      throw new Response("new products require name and description", { status: 400 });
    }

    const write = isCreate
      ? supabaseAdmin.from("consumer_credit_products").insert(patch)
      : supabaseAdmin.from("consumer_credit_products").update(patch).eq("sku", sku);

    const { error: writeError } = await write;
    if (writeError) {
      console.error("[consumer-products] product_write_failed", {
        sku,
        error: writeError.message,
      });
      throw new Response("product write failed", { status: 500 });
    }

    changedSkus.push(sku);
  }

  return { changed_skus: changedSkus, catalogue: await getConsumerTopUpCatalogue() };
}
