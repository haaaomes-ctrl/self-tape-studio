import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, Film, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDestructive } from "@/components/confirm-destructive";
import { CreditBalancePanel } from "@/components/credit-balance-panel";
import { ConsumerTopUpProducts } from "@/components/consumer-top-up-products";
import { AccountCompliancePanel } from "@/components/account-compliance-panel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountCompliance } from "@/lib/account-compliance-client";
import { deleteAudition } from "@/server-fns/delete.functions";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: brandTitle("Your auditions") }],
  }),
  component: DashboardPage,
});

interface AuditionRow {
  id: string;
  title: string;
  brief_source: string;
  mode: string;
  created_at: string;
  takes: {
    id: string;
    status: string;
    overall_score: number | null;
    confidence: number | null;
    take_number: number;
  }[];
}

function DashboardPage() {
  const { user, loading } = useAuth();
  const compliance = useAccountCompliance(user);
  const navigate = useNavigate();
  const [items, setItems] = useState<AuditionRow[] | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login" });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("auditions")
        .select(
          "id, title, brief_source, mode, created_at, takes(id, status, overall_score, confidence, take_number)",
        )
        .order("created_at", { ascending: false });
      if (!cancelled) {
        if (error) {
          console.error(error);
          setItems([]);
        } else {
          setItems(data as AuditionRow[]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Your work"
        title={compliance.complete ? "Your auditions" : "Account route"}
        subtitle={
          compliance.complete
            ? "Each audition holds up to 3 takes you can compare side by side."
            : "Complete account setup before uploading for analysis."
        }
        variant="app"
        actions={
          compliance.complete ? (
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="bg-white text-foreground hover:bg-white/90"
            >
              <Link to="/new">
                <Plus className="mr-2 h-4 w-4" /> New audition
              </Link>
            </Button>
          ) : null
        }
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-20 pt-12">
        {user && !compliance.loading && compliance.complete ? (
          <div className="space-y-4">
            <CreditBalancePanel />
            <ConsumerTopUpProducts />
          </div>
        ) : null}
        <div className="mt-10">
          {user && !compliance.loading && !compliance.complete ? (
            <AccountCompliancePanel userId={user.id} onCompleted={compliance.refresh} />
          ) : items === null ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="grid gap-4">
              {items.map((a) => {
                const best = a.takes
                  .filter((t) => t.overall_score != null)
                  .sort((x, y) => (y.overall_score ?? 0) - (x.overall_score ?? 0))[0];
                return (
                  <li key={a.id}>
                    <div className="group relative rounded-2xl border border-border bg-card shadow-soft transition-shadow hover:shadow-elevated">
                      <Link
                        to="/audition/$auditionId"
                        params={{ auditionId: a.id }}
                        className="block p-6 pr-16"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h2 className="truncate font-display text-lg font-semibold text-foreground">
                              {a.title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(a.created_at).toLocaleDateString(undefined, {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                              <Badge variant="secondary" className="font-normal">
                                {a.mode === "brief" ? "Brief-driven" : "Baseline"}
                              </Badge>
                              <span>
                                {a.takes.length} take{a.takes.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </div>
                          {best ? (
                            <div className="text-right">
                              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                                Best
                              </p>
                              <p className="font-display text-2xl font-bold text-primary">
                                {best.overall_score}
                              </p>
                            </div>
                          ) : (
                            <Badge variant="outline" className="font-normal">
                              {a.takes.some((t) => t.status === "processing")
                                ? "Processing…"
                                : "Awaiting upload"}
                            </Badge>
                          )}
                        </div>
                      </Link>
                      <div className="absolute right-3 top-3">
                        <ConfirmDestructive
                          title="Delete audition?"
                          description={`This will remove "${a.title}" and all ${a.takes.length} take${a.takes.length === 1 ? "" : "s"} (including reports and stored video). This cannot be undone.`}
                          confirmLabel="Delete audition"
                          trigger={(open) => (
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete audition ${a.title}`}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                open();
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                          onConfirm={async () => {
                            try {
                              await deleteAudition({ data: { auditionId: a.id } });
                              setItems((prev) => prev?.filter((x) => x.id !== a.id) ?? prev);
                              toast.success("Audition deleted");
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Could not delete audition",
                              );
                            }
                          }}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-secondary/30 px-8 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-card text-primary shadow-soft">
        <Film className="h-5 w-5" />
      </div>
      <h2 className="mt-5 font-display text-xl font-semibold">No auditions yet</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Upload your first self-tape, paste the brief if you have one, and we'll write the kind of
        notes a casting director would.
      </p>
      <Button asChild className="mt-6">
        <Link to="/new">
          <Plus className="mr-2 h-4 w-4" /> New audition
        </Link>
      </Button>
    </div>
  );
}
