import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getConsumerTopUpCatalogue } from "@/server/consumer-credit-products.server";
import { createConsumerTopUpCheckoutSession } from "@/server/consumer-credit-checkout.server";
import { metric } from "@/server/metrics.server";

export const listConsumerTopUpCatalogue = createServerFn({ method: "GET" }).handler(async () =>
  getConsumerTopUpCatalogue(),
);

function resolveCheckoutOrigin(): string {
  const configuredOrigin = process.env.PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (configuredOrigin) return configuredOrigin;

  const request = getRequest();
  if (!request) throw new Error("CHECKOUT_ORIGIN: Request context is unavailable.");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ?? new URL(request.url).protocol.replace(/:$/, "");

  if (host) return `${protocol}://${host}`;
  return new URL(request.url).origin;
}

export const createConsumerTopUpCheckout = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        sku: z.string().min(3).max(81),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    try {
      return await createConsumerTopUpCheckoutSession({
        userId: context.userId,
        sku: data.sku,
        origin: resolveCheckoutOrigin(),
      });
    } catch (err) {
      metric("consumer_checkout_failed", {
        sku: data.sku,
        reason: err instanceof Error ? err.message.slice(0, 80) : "unknown",
      });
      throw err;
    }
  });
