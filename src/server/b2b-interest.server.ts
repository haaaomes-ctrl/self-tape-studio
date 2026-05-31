import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import {
  buildB2BInterestAnalyticsProperties,
  buildB2BInterestEmailDraft,
  buildB2BInterestLeadDraft,
  type B2BInterestSubmissionInput,
} from "@/lib/b2b-interest";

export const B2B_INTEREST_SERVER_VERSION = "s10-1-ds-20-2026-05-28" as const;

export type SubmitB2BInterestResult = {
  accepted: boolean;
  lead_event_id: string | null;
  queued_email_id: number | null;
};

type SupabaseError = { message?: string };

type B2BInterestSupabase = {
  from: (table: "analytics_events") => {
    insert: (value: Record<string, unknown>) => {
      select: (columns: "id") => {
        single: () => Promise<{ data: { id: string } | null; error: SupabaseError | null }>;
      };
    };
  };
  rpc: (
    fn: "enqueue_email",
    args: { queue_name: "transactional_emails"; payload: Json },
  ) => Promise<{ data: number | null; error: SupabaseError | null }>;
};

function fromAddress(): string {
  return process.env.TAPECOACH_EMAIL_FROM || "TapeCoach <notify@notify.tapecoach.co.uk>";
}

function senderDomain(): string {
  return process.env.TAPECOACH_EMAIL_SENDER_DOMAIN || "notify.tapecoach.co.uk";
}

function safeMessageToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export async function submitB2BInterestLead(
  input: B2BInterestSubmissionInput,
): Promise<SubmitB2BInterestResult> {
  const draft = buildB2BInterestLeadDraft(input);
  if (!draft) {
    return {
      accepted: true,
      lead_event_id: null,
      queued_email_id: null,
    };
  }

  const attribution = draft.analytics_attribution;
  const admin = supabaseAdmin as unknown as B2BInterestSupabase;
  const { data: eventRows, error: eventError } = await admin
    .from("analytics_events")
    .insert({
      event_name: "b2b_lead",
      event_source: "server_product_event",
      consent_state:
        attribution?.consent_state === "analytics_granted"
          ? "analytics_granted"
          : draft.analytics_consent_state,
      attribution_key: attribution?.attribution_key ?? null,
      session_key: null,
      utm_source: attribution?.utm_source ?? null,
      utm_medium: attribution?.utm_medium ?? null,
      utm_campaign: attribution?.utm_campaign ?? null,
      utm_term: attribution?.utm_term ?? null,
      utm_content: attribution?.utm_content ?? null,
      creator_code: attribution?.creator_code ?? null,
      partner_code_hint: attribution?.partner_code_hint ?? null,
      landing_path: attribution?.landing_path ?? draft.source_path,
      referrer_host: attribution?.referrer_host ?? null,
      object_type: "b2b_lead",
      object_id: null,
      audition_id: null,
      take_id: null,
      event_properties: buildB2BInterestAnalyticsProperties(draft) as Json,
    })
    .select("id")
    .single();

  if (eventError) {
    console.error("[b2b-interest] analytics_record_failed", {
      message: eventError.message,
      partner_type: draft.partner_type,
    });
    throw new Error("B2B interest could not be recorded.");
  }

  const emailDraft = buildB2BInterestEmailDraft(draft);
  const eventId = eventRows?.id ?? crypto.randomUUID();
  const messageId = `b2b_interest_${safeMessageToken(eventId)}`;
  const { data: queuedEmailId, error: queueError } = await admin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: emailDraft.to,
      from: fromAddress(),
      sender_domain: senderDomain(),
      subject: emailDraft.subject,
      html: emailDraft.html,
      text: emailDraft.text,
      purpose: "transactional",
      label: "b2b_interest",
      idempotency_key: messageId,
      message_id: messageId,
      queued_at: new Date().toISOString(),
    } as Json,
  });

  if (queueError) {
    console.error("[b2b-interest] support_notification_enqueue_failed", {
      message: queueError.message,
      lead_event_id: eventRows?.id ?? null,
    });
    throw new Error("B2B interest was recorded, but the support notification could not be queued.");
  }

  return {
    accepted: true,
    lead_event_id: eventRows?.id ?? null,
    queued_email_id: queuedEmailId ?? null,
  };
}
