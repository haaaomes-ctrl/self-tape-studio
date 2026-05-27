import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-client-middleware";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { metric } from "@/server/metrics.server";
import { isVideoDurationEventName, type VideoDurationEventName } from "@/lib/video-duration-policy";

const durationEventSchema = z.object({
  eventName: z.string().refine(isVideoDurationEventName),
  durationSeconds: z
    .number()
    .positive()
    .max(60 * 60),
  durationStatus: z.enum(["within_target", "over_soft_guidance", "over_hard_cap"]),
  surface: z
    .enum(["new_audition_upload", "add_take_upload", "replace_failed_take"])
    .default("new_audition_upload"),
});

export const trackVideoDurationUploadEvent = createServerFn({ method: "POST" })
  .middleware([attachSupabaseAuth, requireSupabaseAuth])
  .inputValidator((data: unknown) => durationEventSchema.parse(data))
  .handler(async ({ data }) => {
    metric(data.eventName as VideoDurationEventName, {
      duration_seconds: Math.round(data.durationSeconds),
      duration_status: data.durationStatus,
      surface: data.surface,
    });

    return { ok: true };
  });
