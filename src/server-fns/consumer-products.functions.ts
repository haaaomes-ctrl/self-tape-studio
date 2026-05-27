import { createServerFn } from "@tanstack/react-start";
import { getConsumerTopUpCatalogue } from "@/server/consumer-credit-products.server";

export const listConsumerTopUpCatalogue = createServerFn({ method: "GET" }).handler(async () =>
  getConsumerTopUpCatalogue(),
);
