import { createFileRoute } from "@tanstack/react-router";
import {
  processConsumerStripeEvent,
  stripeWebhookSecret,
  verifyStripeWebhookSignature,
  type ConsumerStripeEvent,
} from "@/server/consumer-credit-checkout.server";

function safeStripeEventSummary(event: ConsumerStripeEvent) {
  return {
    id: event.id,
    type: event.type,
    object_type:
      event.data?.object && typeof event.data.object.object === "string"
        ? event.data.object.object
        : null,
  };
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let secret: string;
        try {
          secret = stripeWebhookSecret();
        } catch (err) {
          console.error("[stripe-webhook] webhook_secret_missing", {
            error: err instanceof Error ? err.message : "unknown",
          });
          return new Response("not configured", { status: 503 });
        }

        const rawBody = await request.text();
        const signatureHeader = request.headers.get("stripe-signature");
        const verified = await verifyStripeWebhookSignature({
          rawBody,
          signatureHeader,
          secret,
        });
        if (!verified) {
          console.warn("[stripe-webhook] signature_verification_failed", {
            has_header: Boolean(signatureHeader),
          });
          return new Response("invalid signature", { status: 400 });
        }

        let event: ConsumerStripeEvent;
        try {
          event = JSON.parse(rawBody) as ConsumerStripeEvent;
        } catch {
          return new Response("invalid json", { status: 400 });
        }

        try {
          const result = await processConsumerStripeEvent(event);
          console.info("[stripe-webhook] processed", {
            ...safeStripeEventSummary(event),
            action: result.action,
          });
          return Response.json(result);
        } catch (err) {
          console.error("[stripe-webhook] processing_failed", {
            ...safeStripeEventSummary(event),
            error: err instanceof Error ? err.message : "unknown",
          });
          return new Response("processing failed", { status: 500 });
        }
      },
    },
  },
});
