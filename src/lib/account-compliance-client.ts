import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  buildAccountComplianceRecord,
  isAccountComplianceComplete,
  type AccountComplianceRecord,
  type AccountRouteFormState,
} from "@/lib/account-compliance";

export async function saveAccountCompliance(
  userId: string,
  state: AccountRouteFormState,
): Promise<AccountComplianceRecord> {
  const record = buildAccountComplianceRecord(userId, state);
  const { error } = await supabase
    .from("account_compliance")
    .upsert(record, { onConflict: "user_id" });
  if (error) throw error;
  return record;
}

export function useAccountCompliance(user: User | null) {
  const [row, setRow] = useState<AccountComplianceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setRow(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("account_compliance")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("account_compliance_lookup_failed", { message: error.message });
      setRow(null);
    } else {
      setRow((data ?? null) as AccountComplianceRecord | null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    row,
    loading,
    complete: isAccountComplianceComplete(row),
    refresh,
  };
}
