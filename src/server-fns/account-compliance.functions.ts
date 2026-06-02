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
