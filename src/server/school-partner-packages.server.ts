import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildSchoolPartnerCodeTemplate,
  buildSchoolPartnerPackagePatch,
  buildSchoolPartnerPoolInput,
  defaultSchoolPartnerPackageCatalogue,
  normaliseSchoolPartnerPackagePreset,
  SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT,
  sortSchoolPartnerPackages,
  type SchoolPartnerCodeTemplateInput,
  type SchoolPartnerPackageCatalogue,
  type SchoolPartnerPackagePresetInput,
} from "@/lib/school-partner-packages";
import { createPartnerCode, createPartnerCreditPool } from "@/server/partner-program.server";

const SELECT_FIELDS =
  "sku, name, description, package_tier, partner_type, display_context, billing_period, currency, unit_amount_pence, included_seats, credits_per_member, total_credits, per_user_cap, pool_period_type, progress_visibility_scope, active, display_order";

export async function getSchoolPartnerPackageCatalogue(): Promise<SchoolPartnerPackageCatalogue> {
  try {
    const { data, error } = await supabaseAdmin
      .from("partner_package_presets")
      .select(SELECT_FIELDS)
      .eq("display_context", SCHOOL_PARTNER_PACKAGE_DISPLAY_CONTEXT)
      .eq("partner_type", "school")
      .order("display_order", { ascending: true })
      .order("sku", { ascending: true });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[school-packages] catalogue_read_failed", error);
      return defaultSchoolPartnerPackageCatalogue();
    }

    return {
      ...defaultSchoolPartnerPackageCatalogue(),
      packages: sortSchoolPartnerPackages(
        data.map((row) => normaliseSchoolPartnerPackagePreset(row, "config")),
      ),
      source: "config",
    };
  } catch (err) {
    console.warn("[school-packages] catalogue_read_failed", err);
    return defaultSchoolPartnerPackageCatalogue();
  }
}

export async function upsertSchoolPartnerPackagePresets(inputs: SchoolPartnerPackagePresetInput[]) {
  const changedSkus: string[] = [];

  for (const input of inputs) {
    const patch = buildSchoolPartnerPackagePatch(input);
    if (!patch.name || !patch.description || !patch.package_tier) {
      throw new Response("new school package presets require name, description and tier", {
        status: 400,
      });
    }

    const { error } = await supabaseAdmin.from("partner_package_presets").upsert(patch, {
      onConflict: "sku",
    });

    if (error) {
      console.error("[school-packages] preset_write_failed", {
        sku: patch.sku,
        error: error.message,
      });
      throw new Response("school package preset write failed", { status: 500 });
    }

    changedSkus.push(patch.sku);
  }

  return { changed_skus: changedSkus, catalogue: await getSchoolPartnerPackageCatalogue() };
}

export async function createSchoolPartnerPackagePool(input: {
  preset: Parameters<typeof buildSchoolPartnerPoolInput>[0]["preset"];
  partner_id: string;
  period_start: string | Date;
  period_end: string | Date;
  created_by_user_id?: string | null;
}) {
  return createPartnerCreditPool(buildSchoolPartnerPoolInput(input));
}

export async function createSchoolPartnerPackageCode(
  input: SchoolPartnerCodeTemplateInput & { raw_code: string },
) {
  return createPartnerCode({
    ...buildSchoolPartnerCodeTemplate(input),
    raw_code: input.raw_code,
  });
}
