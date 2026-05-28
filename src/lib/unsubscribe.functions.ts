import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const UnsubscribeInput = z.object({
  token: z.string().min(8).max(128),
});

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "this email address";
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
}

export const unsubscribeFromLifecycleEmails = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => UnsubscribeInput.parse(input))
  .handler(async ({ data }) => {
    try {
      setResponseHeader("Cache-Control", "no-store");
    } catch (error) {
      void error;
    }

    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("email")
      .eq("token", data.token)
      .maybeSingle();

    if (tokenError) {
      console.error("[unsubscribe] token_lookup_failed", { error: tokenError.message });
      throw new Response("Could not process unsubscribe request", { status: 500 });
    }
    if (!tokenRow?.email) {
      return { ok: false as const, status: "invalid_token" as const, email: null };
    }

    const email = tokenRow.email.trim().toLowerCase();
    const now = new Date().toISOString();

    const { error: suppressError } = await supabaseAdmin.from("suppressed_emails").upsert(
      {
        email,
        reason: "unsubscribe",
        metadata: { source: "crm_unsubscribe_route", unsubscribed_at: now },
        created_at: now,
      },
      { onConflict: "email" },
    );
    if (suppressError) {
      console.error("[unsubscribe] suppression_write_failed", { error: suppressError.message });
      throw new Response("Could not process unsubscribe request", { status: 500 });
    }

    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .update({ used_at: now })
      .eq("token", data.token);

    await supabaseAdmin
      .from("crm_contacts")
      .update({
        marketing_consent: false,
        marketing_consent_at: null,
        lifecycle_messages_allowed: false,
      })
      .eq("normalized_email", email);

    return { ok: true as const, status: "unsubscribed" as const, email: maskEmail(email) };
  });
