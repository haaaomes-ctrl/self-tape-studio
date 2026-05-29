import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdminClaims } from "@/lib/admin-storage.functions";
import { getAdminOperationsSnapshot, grantAdminCredits } from "@/server/admin-operations.server";

const AdminCreditGrantInput = z.object({
  user_id: z.string().uuid(),
  credit_amount: z.number().int().min(1).max(1000),
  admin_reason: z.string().min(12).max(500),
  source_label: z.string().max(120).optional().nullable(),
  idempotency_key: z.string().max(160).optional().nullable(),
});

function noStore() {
  try {
    setResponseHeader("Cache-Control", "no-store");
  } catch (error) {
    void error;
  }
}

type ClaimsContext = {
  claims?: {
    email?: string | null;
    sub?: string | null;
  };
};

export const getAdminOperationsDashboard = createServerFn({ method: "GET" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const claims = (context as ClaimsContext).claims;
    assertAdminClaims(claims);
    noStore();
    return getAdminOperationsSnapshot();
  });

export const grantAdminUserCredits = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((input: unknown) => AdminCreditGrantInput.parse(input))
  .handler(async ({ data, context }) => {
    const claims = (context as ClaimsContext).claims;
    assertAdminClaims(claims);
    noStore();
    return grantAdminCredits({
      form: data,
      actor_user_id: claims?.sub ?? null,
      actor_email: claims?.email ?? null,
    });
  });
