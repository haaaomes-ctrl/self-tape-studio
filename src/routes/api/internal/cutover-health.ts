import { createFileRoute } from "@tanstack/react-router";
import { handleCutoverHealthRequest } from "@/server/cutover-health.server";

export const Route = createFileRoute("/api/internal/cutover-health")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCutoverHealthRequest(request),
    },
  },
});
