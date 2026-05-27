import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { AnalyticsEventName, AnalyticsObjectType } from "@/lib/analytics-attribution";

type ServerAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  userId?: string | null;
  objectType?: AnalyticsObjectType | null;
  objectId?: string | null;
  auditionId?: string | null;
  takeId?: string | null;
  properties?: Record<string, Json | undefined>;
};

const UNSAFE_EVENT_PROPERTY_KEYS = new Set([
  "brief",
  "full_brief",
  "report",
  "raw_report",
  "prompt",
  "raw_prompt",
  "system_prompt",
  "user_prompt",
  "raw_response",
  "response_text",
  "video_url",
  "signed_url",
  "playback_url",
  "authorization",
  "api_key",
  "token",
  "secret",
  "cookie",
  "session",
]);

function safeProperties(input: Record<string, Json | undefined> = {}): Record<string, Json> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, Json] => {
      const [key, value] = entry;
      return value !== undefined && !UNSAFE_EVENT_PROPERTY_KEYS.has(key.toLowerCase());
    }),
  );
}

export async function recordServerAnalyticsEvent(input: ServerAnalyticsEventInput): Promise<void> {
  const { error } = await supabaseAdmin.from("analytics_events").insert({
    event_name: input.eventName,
    event_source: "server_product_event",
    consent_state: "essential_only",
    user_id: input.userId ?? null,
    object_type: input.objectType ?? null,
    object_id: input.objectId ?? null,
    audition_id: input.auditionId ?? null,
    take_id: input.takeId ?? null,
    event_properties: safeProperties(input.properties),
  });

  if (error) {
    console.warn("[analytics] server_event_record_failed", {
      event_name: input.eventName,
      take_id: input.takeId ?? null,
      message: error.message,
    });
  }
}

export async function recordSecondReportEventIfNeeded(input: {
  userId?: string | null;
  auditionId?: string | null;
  takeId: string;
}): Promise<void> {
  if (!input.userId) return;
  const { count, error } = await supabaseAdmin
    .from("takes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", input.userId)
    .eq("status", "complete");

  if (error) {
    console.warn("[analytics] second_report_count_failed", {
      take_id: input.takeId,
      message: error.message,
    });
    return;
  }
  if (count !== 2) return;
  await recordServerAnalyticsEvent({
    eventName: "second_report",
    userId: input.userId,
    objectType: "report",
    objectId: input.takeId,
    auditionId: input.auditionId ?? null,
    takeId: input.takeId,
  });
}
