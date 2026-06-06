import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  getCurrentUserAccountCompliance,
  upsertCurrentUserAccountCompliance,
} from "@/server-fns/account-compliance.functions";
import {
  isAccountComplianceComplete,
  type AccountComplianceRecord,
  type AccountRouteFormState,
} from "@/lib/account-compliance";

export async function saveAccountCompliance(
  userId: string,
  state: AccountRouteFormState,
): Promise<AccountComplianceRecord> {
  const record = (await upsertCurrentUserAccountCompliance({
    data: state,
  })) as AccountComplianceRecord;
  if (record.user_id !== userId) {
    throw new Error("Account route could not be saved for this session. Please sign in again.");
  }
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
    try {
      // Self-healing server read: returns the row, repairing it once from
      // the signup auth metadata when missing (e.g. email-confirmation
      // signups where the signup-time save had no session). A user whose
      // consent is already recorded is sent onward instead of re-prompted.
      const data = await getCurrentUserAccountCompliance();
      setRow((data ?? null) as AccountComplianceRecord | null);
    } catch (error) {
      console.error("account_compliance_lookup_failed", {
        message: error instanceof Error ? error.message : String(error),
      });
      setRow(null);
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
