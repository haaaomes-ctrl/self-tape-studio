import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json, Tables } from "@/integrations/supabase/types";
import { buildCrmMessageDraft, type CrmMessageKey } from "@/lib/crm-messaging";
import { brevoSyncContact, brevoTrackEvent } from "@/server/brevo.server";

export const CRM_DASHBOARD_VERSION = "s10-1-ds-19-2026-05-28" as const;

export type CrmContactRow = Tables<"crm_contacts">;
export type CrmContactDashboardRow = Tables<"crm_contact_dashboard">;
export type CrmEmailDeliveryDashboardRow = Tables<"crm_email_delivery_dashboard">;
export type CrmLifecycleMessagingDashboardRow = Tables<"crm_lifecycle_messaging_dashboard">;
export type CrmB2BLeadsDashboardRow = Tables<"crm_b2b_leads_dashboard">;

export type CrmDashboardSnapshot = {
  version: typeof CRM_DASHBOARD_VERSION;
  generated_at: string;
  platform: {
    contact_sync: "brevo";
    transactional_dispatch: "lovable_email_queue";
    service_email_consent: "not_required";
    lifecycle_email_consent: "required";
    under_13_routing: "parent_guardian_account_email";
  };
  contacts: CrmContactDashboardRow[];
  email_delivery: CrmEmailDeliveryDashboardRow[];
  lifecycle_messages: CrmLifecycleMessagingDashboardRow[];
  b2b_leads: CrmB2BLeadsDashboardRow[];
};

export type EnqueueCrmEmailInput = {
  userId: string | null | undefined;
  messageKey: CrmMessageKey;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

type SupabaseError = { message?: string };

function throwCrmError(operation: string, error: SupabaseError): never {
  console.error(`[crm-messaging] ${operation}_failed`, { error: error.message });
  throw new Error(`${operation} failed`);
}

function brevoConfigured(): boolean {
  return Boolean(process.env.LOVABLE_API_KEY && process.env.BREVO_API_KEY);
}

function emailFromAddress(): string {
  return process.env.TAPECOACH_EMAIL_FROM || "TapeCoach <notify@notify.tapecoach.co.uk>";
}

function senderDomain(): string {
  return process.env.TAPECOACH_EMAIL_SENDER_DOMAIN || "notify.tapecoach.co.uk";
}

function unsubscribeBaseUrl(): string {
  return process.env.TAPECOACH_UNSUBSCRIBE_BASE_URL || "https://tapecoach.co.uk/unsubscribe";
}

function contactAttributes(row: CrmContactRow): Record<string, unknown> {
  return {
    TAPECOACH_USER_ID: row.user_id,
    USER_SEGMENT: row.user_segment,
    RECIPIENT_ROLE: row.recipient_role,
    ACCOUNT_ROUTE: row.account_route,
    ACCOUNT_TYPE: row.account_type,
    AGE_BAND: row.age_band_declaration,
    PARENT_MANAGED: row.parent_managed,
    MARKETING_CONSENT: row.marketing_consent,
    LIFECYCLE_ALLOWED: row.lifecycle_messages_allowed,
    CONSENT_SOURCE: row.consent_source,
  };
}

async function markBrevoSyncStatus(
  userId: string,
  status: "synced" | "failed" | "not_configured",
  errorMessage: string | null,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("crm_contacts")
    .update({
      brevo_sync_status: status,
      brevo_synced_at: status === "synced" ? new Date().toISOString() : null,
      brevo_sync_error: errorMessage,
    })
    .eq("user_id", userId);
  if (error) {
    console.warn("[crm-messaging] brevo_sync_status_update_failed", {
      user_id: userId,
      status,
      error: error.message,
    });
  }
}

export async function syncCrmContactForUser(userId: string): Promise<CrmContactRow | null> {
  const { error: syncError } = await supabaseAdmin.rpc("sync_crm_contact_from_account_compliance", {
    p_user_id: userId,
  });
  if (syncError) throwCrmError("sync_crm_contact", syncError);

  const { data, error } = await supabaseAdmin
    .from("crm_contacts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throwCrmError("read_crm_contact", error);
  if (!data) return null;

  if (!brevoConfigured()) {
    await markBrevoSyncStatus(userId, "not_configured", null);
    return data as CrmContactRow;
  }

  try {
    await brevoSyncContact({
      email: data.email,
      attributes: contactAttributes(data as CrmContactRow),
      ext_id: data.user_id,
      emailBlacklisted: data.marketing_consent !== true,
    });
    await markBrevoSyncStatus(userId, "synced", null);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markBrevoSyncStatus(userId, "failed", message.slice(0, 1000));
    console.warn("[crm-messaging] brevo_contact_sync_failed", {
      user_id: userId,
      error: message,
    });
  }

  return data as CrmContactRow;
}

function buildDefaultIdempotencyKey(input: EnqueueCrmEmailInput): string {
  const objectType =
    typeof input.templateData?.object_type === "string" ? input.templateData.object_type : "user";
  const objectId =
    typeof input.templateData?.object_id === "string" ? input.templateData.object_id : input.userId;
  return `crm:${input.messageKey}:${input.userId}:${objectType}:${objectId}`;
}

export async function enqueueCrmEmailForUser(input: EnqueueCrmEmailInput): Promise<{
  queued: boolean;
  message_id: string | null;
  contact: CrmContactRow | null;
}> {
  if (!input.userId) return { queued: false, message_id: null, contact: null };
  const contact = await syncCrmContactForUser(input.userId);
  if (!contact) return { queued: false, message_id: null, contact: null };

  const draft = buildCrmMessageDraft({
    messageKey: input.messageKey,
    templateData: input.templateData,
  });

  const idempotencyKey = input.idempotencyKey ?? buildDefaultIdempotencyKey(input);
  const { data, error } = await supabaseAdmin.rpc("enqueue_crm_lifecycle_email", {
    p_user_id: input.userId,
    p_message_key: draft.message_key,
    p_message_category: draft.message_category,
    p_subject: draft.subject,
    p_preview_text: draft.preview_text,
    p_html: draft.html,
    p_text: draft.text,
    p_template_data: draft.template_data as Json,
    p_idempotency_key: idempotencyKey,
    p_send_after: new Date().toISOString(),
    p_from: emailFromAddress(),
    p_sender_domain: senderDomain(),
    p_purpose: draft.purpose,
    p_label: draft.label,
    p_unsubscribe_base_url: unsubscribeBaseUrl(),
  });
  if (error) throwCrmError("enqueue_crm_lifecycle_email", error);

  if (brevoConfigured()) {
    void brevoTrackEvent({
      event_name: "tapecoach_crm_email_queued",
      identifiers: { email_id: contact.email, ext_id: contact.user_id },
      contact_properties: contactAttributes(contact),
      event_properties: {
        message_key: draft.message_key,
        message_category: draft.message_category,
        message_id: data,
      },
      event_date: new Date().toISOString(),
    }).catch((error) => {
      console.warn("[crm-messaging] brevo_event_track_failed", {
        user_id: input.userId,
        message_key: draft.message_key,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return { queued: true, message_id: data ?? null, contact };
}

export async function safeEnqueueCrmEmailForUser(input: EnqueueCrmEmailInput): Promise<void> {
  try {
    await enqueueCrmEmailForUser(input);
  } catch (error) {
    console.warn("[crm-messaging] enqueue_failed_non_blocking", {
      user_id: input.userId ?? null,
      message_key: input.messageKey,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function listCrmContactDashboardRows(): Promise<CrmContactDashboardRow[]> {
  const { data, error } = await supabaseAdmin
    .from("crm_contact_dashboard")
    .select("*")
    .order("contact_count", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throwCrmError("list_crm_contacts", error);
  return (data ?? []) as CrmContactDashboardRow[];
}

export async function listCrmEmailDeliveryRows(): Promise<CrmEmailDeliveryDashboardRow[]> {
  const { data, error } = await supabaseAdmin
    .from("crm_email_delivery_dashboard")
    .select("*")
    .order("activity_day", { ascending: false, nullsFirst: false })
    .order("message_key", { ascending: true })
    .limit(150);
  if (error) throwCrmError("list_crm_email_delivery", error);
  return (data ?? []) as CrmEmailDeliveryDashboardRow[];
}

export async function listCrmLifecycleMessagingRows(): Promise<
  CrmLifecycleMessagingDashboardRow[]
> {
  const { data, error } = await supabaseAdmin
    .from("crm_lifecycle_messaging_dashboard")
    .select("*")
    .order("last_activity_at", { ascending: false, nullsFirst: false })
    .order("message_key", { ascending: true })
    .limit(150);
  if (error) throwCrmError("list_crm_lifecycle_messages", error);
  return (data ?? []) as CrmLifecycleMessagingDashboardRow[];
}

export async function listCrmB2BLeadRows(): Promise<CrmB2BLeadsDashboardRow[]> {
  const { data, error } = await supabaseAdmin
    .from("crm_b2b_leads_dashboard")
    .select("*")
    .order("lead_day", { ascending: false, nullsFirst: false })
    .limit(100);
  if (error) throwCrmError("list_crm_b2b_leads", error);
  return (data ?? []) as CrmB2BLeadsDashboardRow[];
}

export async function getCrmDashboardSnapshot(): Promise<CrmDashboardSnapshot> {
  const [contacts, emailDelivery, lifecycleMessages, b2bLeads] = await Promise.all([
    listCrmContactDashboardRows(),
    listCrmEmailDeliveryRows(),
    listCrmLifecycleMessagingRows(),
    listCrmB2BLeadRows(),
  ]);

  return {
    version: CRM_DASHBOARD_VERSION,
    generated_at: new Date().toISOString(),
    platform: {
      contact_sync: "brevo",
      transactional_dispatch: "lovable_email_queue",
      service_email_consent: "not_required",
      lifecycle_email_consent: "required",
      under_13_routing: "parent_guardian_account_email",
    },
    contacts,
    email_delivery: emailDelivery,
    lifecycle_messages: lifecycleMessages,
    b2b_leads: b2bLeads,
  };
}
