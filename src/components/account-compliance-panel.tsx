import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AccountRouteFields } from "@/components/account-route-fields";
import { Button } from "@/components/ui/button";
import {
  defaultAccountRouteFormState,
  validateAccountRouteFormState,
} from "@/lib/account-compliance";
import { saveAccountCompliance } from "@/lib/account-compliance-client";

type AccountCompliancePanelProps = {
  userId: string;
  onCompleted: () => void;
};

export function AccountCompliancePanel({ userId, onCompleted }: AccountCompliancePanelProps) {
  const [form, setForm] = useState(defaultAccountRouteFormState);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validateAccountRouteFormState(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setBusy(true);
    try {
      await saveAccountCompliance(userId, form);
      toast.success("Account route saved");
      onCompleted();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save account route");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="font-display text-lg font-semibold">Complete account route</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Choose the correct account route and accept the required policies before uploading for
        analysis.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <AccountRouteFields value={form} onChange={setForm} disabled={busy} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Save and continue"}
          </Button>
        </div>
      </form>
    </section>
  );
}
