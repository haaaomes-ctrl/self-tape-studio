import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildCoachPartnerCodeTemplate,
  buildCoachPartnerPackagePatch,
  buildCoachPartnerPoolInput,
  COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT,
  defaultCoachPartnerPackageCatalogue,
  normaliseCoachPartnerPackagePreset,
  sortCoachPartnerPackages,
  type CoachPartnerCodeTemplateInput,
  type CoachPartnerPackageCatalogue,
  type CoachPartnerPackagePresetInput,
} from "@/lib/coach-partner-packages";
import { createPartnerCode, createPartnerCreditPool } from "@/server/partner-program.server";

const SELECT_FIELDS =
  "sku, name, description, package_tier, partner_type, display_context, billing_period, currency, unit_amount_pence, included_seats, credits_per_member, total_credits, per_user_cap, pool_period_type, progress_visibility_scope, active, display_order";

export async function getCoachPartnerPackageCatalogue(): Promise<CoachPartnerPackageCatalogue> {
  try {
    const { data, error } = await supabaseAdmin
      .from("partner_package_presets")
      .select(SELECT_FIELDS)
      .eq("display_context", COACH_PARTNER_PACKAGE_DISPLAY_CONTEXT)
      .eq("partner_type", "coach")
      .order("display_order", { ascending: true })
      .order("sku", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[coach-packages] catalogue_read_failed", error);
      return defaultCoachPartnerPackageCatalogue();
    }

    return {
      ...defaultCoachPartnerPackageCatalogue(),
      packages: sortCoachPartnerPackages(
        data.map((row) => normaliseCoachPartnerPackagePreset(row, "config")),
      ),
      source: "config",
    };
  } catch (err) {
    console.warn("[coach-packages] catalogue_read_failed", err);
    return defaultCoachPartnerPackageCatalogue();
  }
}

export async function upsertCoachPartnerPackagePresets(inputs: CoachPartnerPackagePresetInput[]) {
  const changedSkus: string[] = [];

  for (const input of inputs) {
    const patch = buildCoachPartnerPackagePatch(input);
    if (!patch.name || !patch.description || !patch.package_tier) {
      throw new Response("new coach package presets require name, description and tier", {
        status: 400,
      });
    }

    const { error } = await supabaseAdmin.from("partner_package_presets").upsert(patch, {
      onConflict: "sku",
    });

    if (error) {
      console.error("[coach-packages] preset_write_failed", {
        sku: patch.sku,
        error: error.message,
      });
      throw new Response("coach package preset write failed", { status: 500 });
    }

    changedSkus.push(patch.sku);
  }

  return { changed_skus: changedSkus, catalogue: await getCoachPartnerPackageCatalogue() };
}

export async function createCoachPartnerPackagePool(input: {
  preset: Parameters<typeof buildCoachPartnerPoolInput>[0]["preset"];
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}) {
  return createPartnerCreditPool(buildCoachPartnerPoolInput(input));
}

export async function createCoachPartnerPackageCode(
  input: CoachPartnerCodeTemplateInput & { raw_code: string },
) {
  return createPartnerCode({
    ...buildCoachPartnerCodeTemplate(input),
    raw_code: input.raw_code,
  });
}
