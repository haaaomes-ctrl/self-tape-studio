import { useServerFn } from "@tanstack/react-start";
import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CONSUMER_TOP_UP_SECONDARY_MESSAGE,
  LAUNCH_CONSUMER_TOP_UP_PRODUCTS,
  sortConsumerTopUpProducts,
  type ConsumerTopUpCatalogue,
} from "@/lib/consumer-credit-products";
import { listConsumerTopUpCatalogue } from "@/server-fns/consumer-products.functions";

const DEFAULT_CATALOGUE: ConsumerTopUpCatalogue = {
  products: sortConsumerTopUpProducts(LAUNCH_CONSUMER_TOP_UP_PRODUCTS),
  source: "default",
  secondary_message: CONSUMER_TOP_UP_SECONDARY_MESSAGE,
};

export function ConsumerTopUpProducts() {
  const listCatalogue = useServerFn(listConsumerTopUpCatalogue);
  const [catalogue, setCatalogue] = useState<ConsumerTopUpCatalogue>(DEFAULT_CATALOGUE);

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
          </div>
        ))}
      </div>
    </section>
  );
}
