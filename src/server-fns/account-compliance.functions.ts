import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AccountRouteFormSchema = z.object({
  accountRoute: z.enum(["self_service_13_plus", "parent_guardian", "under_13"]),
  parentGuardianAttested: z.boolean(),
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  aiDisclaimerAccepted: z.boolean(),
  marketingConsent: z.boolean(),
});

export const upsertCurrentUserAccountCompliance = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => AccountRouteFormSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { upsertAccountComplianceForUser } = await import("@/server/account-compliance.server");
    return upsertAccountComplianceForUser({
      userId: context.userId,
      state: data,
      operation: "account_compliance_server_fn_upsert",
    });
  });

// Self-healing compliance read for the dashboard guard. Deliberately takes
// NO input: the user id and claims come solely from the verified session
// middleware, so the repair is self-scoped to the caller and can never
// touch another user's row.
export const getCurrentUserAccountCompliance = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAccountComplianceForUser } = await import("@/server/account-compliance.server");
    return getAccountComplianceForUser(context.userId, context.claims);
  });
