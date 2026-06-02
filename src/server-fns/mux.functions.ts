import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";

export const createMuxDirectUpload = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        takeId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { createMuxDirectUploadForAuthenticatedUser } = await import("./mux-upload.impl.server");
    return createMuxDirectUploadForAuthenticatedUser({
      takeId: data.takeId,
      userId: context.userId,
      claims: (context as { claims?: unknown }).claims,
    });
  });
