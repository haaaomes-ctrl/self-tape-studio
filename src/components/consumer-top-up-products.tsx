import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CONSUMER_TOP_UP_SECONDARY_MESSAGE,
  LAUNCH_CONSUMER_TOP_UP_PRODUCTS,
  sortConsumerTopUpProducts,
  type ConsumerTopUpCatalogue,
} from "@/lib/consumer-credit-products";
import {
  createConsumerTopUpCheckout,
  listConsumerTopUpCatalogue,
} from "@/server-fns/consumer-products.functions";
import {
  buildAnalyticsAttributionMetadata,
  readStoredAnalyticsAttribution,
  trackAnalyticsEvent,
} from "@/lib/analytics-attribution";

const DEFAULT_CATALOGUE: ConsumerTopUpCatalogue = {
  products: sortConsumerTopUpProducts(LAUNCH_CONSUMER_TOP_UP_PRODUCTS),
  source: "default",
  secondary_message: CONSUMER_TOP_UP_SECONDARY_MESSAGE,
};

export function ConsumerTopUpProducts() {
  const listCatalogue = useServerFn(listConsumerTopUpCatalogue);
  const createCheckout = useServerFn(createConsumerTopUpCheckout);
  const [catalogue, setCatalogue] = useState<ConsumerTopUpCatalogue>(DEFAULT_CATALOGUE);
  const [pendingSku, setPendingSku] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCatalogue()
      .then((nextCatalogue) => {
        if (!cancelled) setCatalogue(nextCatalogue as ConsumerTopUpCatalogue);
      })
      .catch((err) => {
        console.warn("[consumer-products] catalogue_display_failed", err);
      });
    return () => {
      cancelled = true;
    };
  }, [listCatalogue]);

  const products = catalogue.products.filter((product) => product.active);
  if (!products.length) return null;

  const startCheckout = async (sku: string) => {
    setPendingSku(sku);
    setCheckoutError(null);
    try {
      const analyticsAttribution = buildAnalyticsAttributionMetadata(
        readStoredAnalyticsAttribution(),
      );
      const result = (await createCheckout({
        data: { sku, analyticsAttribution },
      })) as {
        checkout_session_id?: string;
        checkout_url?: string;
      };
      if (!result.checkout_url) {
        throw new Error("Stripe Checkout did not return a redirect URL.");
      }
      void trackAnalyticsEvent({
        eventName: "purchase_started",
        objectType: "purchase",
        properties: { sku, checkout_session_recorded: Boolean(result.checkout_session_id) },
      });
      window.location.assign(result.checkout_url);
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout could not be started.");
      setPendingSku(null);
    }
  };

  return (
    <section className="rounded-md border border-border bg-secondary/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-soft">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">
              Optional top-ups
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {catalogue.secondary_message}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="font-normal">
          Secondary
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {products.map((product) => (
          <div key={product.sku} className="rounded-md border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-foreground">
                  {product.name}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.credit_amount} credits
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-lg font-bold text-primary">
                  {product.display_price}
                </p>
                {product.founding_price ? (
                  <p className="text-xs text-muted-foreground">Founding price</p>
                ) : null}
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="mt-4 w-full"
              disabled={!product.checkout_ready || pendingSku !== null}
              onClick={() => void startCheckout(product.sku)}
            >
              {pendingSku === product.sku ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {product.checkout_ready ? "Buy credits" : "Unavailable"}
            </Button>
          </div>
        ))}
      </div>
      {checkoutError ? (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {checkoutError}
        </p>
      ) : null}
    </section>
  );
}
