// Admin-only consumer product catalogue endpoint.
//
// This mirrors /api/public/admin-config: it is under /api/public for the
// deployed route shape, but it is fail-closed behind x-reconciler-secret.
// DS-03 only manages catalogue configuration. Checkout, payment webhooks,
// credit grants and revenue ledger reconciliation belong to later slices.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  getConsumerTopUpCatalogue,
  upsertConsumerTopUpProducts,
} from "@/server/consumer-credit-products.server";

const ProductInputSchema = z
  .object({
    sku: z.string().min(3).max(81),
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().min(1).max(500).optional(),
    credit_amount: z.number().int().positive().max(10_000).optional(),
    currency: z.literal("GBP").optional(),
    unit_amount_pence: z.number().int().positive().max(1_000_000).optional(),
    stripe_price_id: z.string().trim().min(1).max(120).nullable().optional(),
    active: z.boolean().optional(),
    display_order: z.number().int().positive().max(10_000).optional(),
    founding_price: z.boolean().optional(),
  })
  .strict();

const UpdateSchema = z
  .object({
    products: z.array(ProductInputSchema).min(1).max(50),
  })
  .strict();

function authorise(request: Request): Response | null {
  const secret = process.env.RECONCILER_SECRET;
  if (!secret) {
    console.error("[admin-product-catalogue] RECONCILER_SECRET not configured");
    return new Response("not configured", { status: 503 });
  }
  const provided = request.headers.get("x-reconciler-secret");
  if (provided !== secret) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

export const Route = createFileRoute("/api/public/admin-product-catalogue")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;
        const catalogue = await getConsumerTopUpCatalogue();
        return Response.json(catalogue);
      },
      POST: async ({ request }) => {
        const denied = authorise(request);
        if (denied) return denied;

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        const parsed = UpdateSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid_body", issues: parsed.error.issues },
            { status: 400 },
          );
        }

        try {
          const result = await upsertConsumerTopUpProducts(parsed.data.products);
          console.log(
            `[admin-product-catalogue] updated ${JSON.stringify({
              skus: result.changed_skus,
            })}`,
          );
          return Response.json(result);
        } catch (err) {
          if (err instanceof Response) return err;
          return Response.json(
            { error: "invalid_catalogue_update", message: String(err) },
            { status: 400 },
          );
        }
      },
    },
  },
});
