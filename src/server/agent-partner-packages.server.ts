import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT,
  buildAgentPartnerCodeTemplate,
  buildAgentPartnerPackagePatch,
  buildAgentPartnerPoolInput,
  defaultAgentPartnerPackageCatalogue,
  normaliseAgentPartnerPackagePreset,
  sortAgentPartnerPackages,
  type AgentPartnerCodeTemplateInput,
  type AgentPartnerPackageCatalogue,
  type AgentPartnerPackagePresetInput,
} from "@/lib/agent-partner-packages";
import { createPartnerCode, createPartnerCreditPool } from "@/server/partner-program.server";

const SELECT_FIELDS =
  "sku, name, description, package_tier, partner_type, display_context, billing_period, currency, unit_amount_pence, included_seats, credits_per_member, total_credits, per_user_cap, pool_period_type, progress_visibility_scope, active, display_order";

export async function getAgentPartnerPackageCatalogue(): Promise<AgentPartnerPackageCatalogue> {
  try {
    const { data, error } = await supabaseAdmin
      .from("partner_package_presets")
      .select(SELECT_FIELDS)
      .eq("display_context", AGENT_PARTNER_PACKAGE_DISPLAY_CONTEXT)
      .eq("partner_type", "agent")
      .order("display_order", { ascending: true })
      .order("sku", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[agent-packages] catalogue_read_failed", error);
      return defaultAgentPartnerPackageCatalogue();
    }

    return {
      ...defaultAgentPartnerPackageCatalogue(),
      packages: sortAgentPartnerPackages(
        data.map((row) => normaliseAgentPartnerPackagePreset(row, "config")),
      ),
      source: "config",
    };
  } catch (err) {
    console.warn("[agent-packages] catalogue_read_failed", err);
    return defaultAgentPartnerPackageCatalogue();
  }
}

export async function upsertAgentPartnerPackagePresets(inputs: AgentPartnerPackagePresetInput[]) {
  const changedSkus: string[] = [];

  for (const input of inputs) {
    const patch = buildAgentPartnerPackagePatch(input);
    if (!patch.name || !patch.description || !patch.package_tier) {
      throw new Response("new agent package presets require name, description and tier", {
        status: 400,
      });
    }

    const { error } = await supabaseAdmin.from("partner_package_presets").upsert(patch, {
      onConflict: "sku",
    });

    if (error) {
      console.error("[agent-packages] preset_write_failed", {
        sku: patch.sku,
        error: error.message,
      });
      throw new Response("agent package preset write failed", { status: 500 });
    }

    changedSkus.push(patch.sku);
  }

  return { changed_skus: changedSkus, catalogue: await getAgentPartnerPackageCatalogue() };
}

export async function createAgentPartnerPackagePool(input: {
  preset: Parameters<typeof buildAgentPartnerPoolInput>[0]["preset"];
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}) {
  return createPartnerCreditPool(buildAgentPartnerPoolInput(input));
}

export async function createAgentPartnerPackageCode(
  input: AgentPartnerCodeTemplateInput & { raw_code: string },
) {
  return createPartnerCode({
    ...buildAgentPartnerCodeTemplate(input),
    raw_code: input.raw_code,
  });
}
