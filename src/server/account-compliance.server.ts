import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isAccountComplianceComplete,
  type AccountComplianceRecord,
} from "@/lib/account-compliance";

export async function assertAccountComplianceForReport(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("account_compliance")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("account_compliance_gate_lookup_failed", {
      user_id: userId,
      message: error.message,
    });
    throw new Error("POLICY_ACCEPTANCE_REQUIRED: Complete account route before analysis.");
  }

  if (!isAccountComplianceComplete(data as AccountComplianceRecord | null)) {
    throw new Error(
      "POLICY_ACCEPTANCE_REQUIRED: Complete account route and required policy acceptance before uploading for analysis.",
    );
  }
}
