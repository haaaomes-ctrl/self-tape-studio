import { createFileRoute } from "@tanstack/react-router";
import { handleInternalAnalysisRunRequest } from "@/server/internal-analysis-runner.server";

export const Route = createFileRoute("/api/internal/run-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => handleInternalAnalysisRunRequest(request),
    },
  },
});
