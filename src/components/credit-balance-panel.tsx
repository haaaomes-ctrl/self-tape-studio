import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CreditCard,
  Gift,
  Handshake,
  Loader2,
  RefreshCcw,
  Ticket,
  WalletCards,
} from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import type { CreditBalanceSnapshot } from "@/lib/credit-balance";
import {
  FAILED_REPORT_CREDIT_RESTORED_COPY,
  REPLACEMENT_REPORT_CREDIT_COPY,
  REPORT_CREDIT_UNIT_COPY,
} from "@/lib/credit-balance";
import {
  activateCurrentUserPartnerCode,
  getCreditBalance,
} from "@/server-fns/credit-balance.functions";
import { cn } from "@/lib/utils";
import { rememberPartnerCodeAttribution, trackAnalyticsEvent } from "@/lib/analytics-attribution";

type CreditBalancePanelProps = {
  className?: string;
  showTopUpLink?: boolean;
};

type CreditUseNoticeProps = {
  className?: string;
  enabled?: boolean;
  replacement?: boolean;
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function pluralCredits(count: number): string {
  return `${count} credit${count === 1 ? "" : "s"}`;
}

function useCreditBalance(enabled = true) {
  const loadBalance = useServerFn(getCreditBalance);
  const [snapshot, setSnapshot] = useState<CreditBalanceSnapshot | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  async function refreshBalance() {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const next = (await loadBalance()) as CreditBalanceSnapshot;
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credit balance could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { snapshot, setSnapshot, loading, error, refreshBalance };
}

function BalanceStat({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-foreground">{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </div>
    </div>
  );
}

export function CreditBalancePanel({ className, showTopUpLink = true }: CreditBalancePanelProps) {
  const { user, loading: authLoading } = useAuth();
  const activateCode = useServerFn(activateCurrentUserPartnerCode);
  const canLoadBalance = Boolean(user) && !authLoading;
  const { snapshot, setSnapshot, loading, error, refreshBalance } =
    useCreditBalance(canLoadBalance);
  const [code, setCode] = useState("");
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    setActivating(true);
    setActivationError(null);
    try {
      const next = (await activateCode({ data: { code: trimmed } })) as CreditBalanceSnapshot;
      rememberPartnerCodeAttribution(trimmed);
      void trackAnalyticsEvent({
        eventName: "partner_code_activation",
        objectType: "partner_code",
        properties: { source: "credit_balance_panel" },
      });
      setSnapshot(next);
      setCode("");
      toast.success("Partner code activated.");
    } catch (err) {
      setActivationError(
        err instanceof Error ? err.message : "Partner code could not be activated.",
      );
    } finally {
      setActivating(false);
    }
  }

  const nextFreeDate = formatDate(snapshot?.free_monthly?.next_refresh_at ?? null);

  return (
    <section className={cn("rounded-md border border-border bg-secondary/30 p-4", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-soft">
            <WalletCards className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-foreground">Credit balance</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {REPORT_CREDIT_UNIT_COPY}
            </p>
          </div>
        </div>
        <Button type="button" size="sm" variant="ghost" onClick={() => void refreshBalance()}>
          <RefreshCcw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {authLoading || loading ? (
        <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking credits...
        </p>
      ) : !user ? (
        <div className="mt-4 rounded-md border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Sign in to see your free, partner-funded and paid credit balance or activate a partner
            code.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : snapshot ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <BalanceStat
              icon={<WalletCards className="h-4 w-4" />}
              label="Available"
              value={pluralCredits(snapshot.total_available_credits)}
              detail="Used before paid top-ups where possible."
            />
            <BalanceStat
              icon={<Gift className="h-4 w-4" />}
              label="Free monthly"
              value={snapshot.free_monthly.status_label}
              detail={nextFreeDate ? `Period date: ${nextFreeDate}` : null}
            />
            <BalanceStat
              icon={<Handshake className="h-4 w-4" />}
              label="Partner-funded"
              value={pluralCredits(snapshot.partner_funded_balance)}
              detail={
                snapshot.partner_allowances.length
                  ? `${snapshot.partner_allowances.length} active allowance${snapshot.partner_allowances.length === 1 ? "" : "s"}`
                  : "No active partner allowance."
              }
            />
            <BalanceStat
              icon={<CreditCard className="h-4 w-4" />}
              label="Paid top-ups"
              value={pluralCredits(snapshot.paid_credit_balance)}
              detail="Paid credits roll over."
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-semibold">Partner code</h3>
              </div>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={submitCode}>
                <Input
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="Enter partner code"
                  maxLength={64}
                  autoComplete="off"
                />
                <Button type="submit" disabled={activating || !code.trim()}>
                  {activating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Activate
                </Button>
              </form>
              {activationError ? (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {activationError}
                </p>
              ) : null}
              {snapshot.partner_allowances.length > 0 ? (
                <ul className="mt-4 space-y-2 text-sm">
                  {snapshot.partner_allowances.map((allowance) => (
                    <li
                      key={allowance.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/40 px-3 py-2"
                    >
                      <span className="font-medium text-foreground">{allowance.partner_name}</span>
                      <span className="text-muted-foreground">
                        {pluralCredits(allowance.remaining_credits)} left of{" "}
                        {allowance.allowance_credits}
                        {allowance.expires_at
                          ? `, expires ${formatDate(allowance.expires_at) ?? "soon"}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display text-sm font-semibold">Before generating a report</h3>
                <Badge variant="outline" className="font-normal">
                  Credit use
                </Badge>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>{REPORT_CREDIT_UNIT_COPY}</li>
                <li>{REPLACEMENT_REPORT_CREDIT_COPY}</li>
                <li>{FAILED_REPORT_CREDIT_RESTORED_COPY}</li>
              </ul>
              {showTopUpLink ? (
                <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link to="/credits">
                    <CreditCard className="h-4 w-4" />
                    Buy credits
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {snapshot.source_breakdown.length > 0 ? (
            <details className="mt-4 rounded-md border border-border bg-card p-4">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                Show credit sources
              </summary>
              <ul className="mt-3 space-y-2 text-sm">
                {snapshot.source_breakdown.map((entry, index) => (
                  <li
                    key={`${entry.source}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>{entry.label}</span>
                    <span className="text-muted-foreground">
                      {pluralCredits(entry.remaining_credits)}
                      {entry.expires_at
                        ? `, expires ${formatDate(entry.expires_at) ?? "soon"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export function CreditUseNotice({
  className,
  enabled = true,
  replacement = false,
}: CreditUseNoticeProps) {
  const { snapshot, loading } = useCreditBalance(enabled);
  const available = snapshot?.total_available_credits ?? null;
  const noCredits = available === 0;

  return (
    <div
      className={cn(
        "rounded-md border p-3 text-sm",
        noCredits ? "border-warning/40 bg-warning/10" : "border-border bg-secondary/40",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{REPORT_CREDIT_UNIT_COPY}</p>
          <p className="mt-1 text-muted-foreground">
            {replacement
              ? REPLACEMENT_REPORT_CREDIT_COPY
              : "This upload starts a fresh report run."}
          </p>
          <p className="mt-1 text-muted-foreground">{FAILED_REPORT_CREDIT_RESTORED_COPY}</p>
          {enabled ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {loading
                ? "Checking available credits..."
                : available === null
                  ? "Credit balance could not be checked here; the server will verify before upload."
                  : `Available now: ${pluralCredits(available)}.`}
            </p>
          ) : null}
        </div>
        <Button asChild size="sm" variant={noCredits ? "default" : "outline"}>
          <Link to="/credits">
            <CreditCard className="h-4 w-4" />
            Credits
          </Link>
        </Button>
      </div>
    </div>
  );
}
