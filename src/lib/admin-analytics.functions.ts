import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminClaims } from "@/lib/admin-storage.functions";
import { getAnalyticsDashboardSnapshot } from "@/server/analytics-dashboard.server";

export const getAdminAnalyticsDashboard = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdminClaims((context as { claims?: { email?: string | null } }).claims);
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch (error) {
      void error;
    }
    return getAnalyticsDashboardSnapshot();
  });
