import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { LAUNCH_NO_OUTCOME_PROMISE, LAUNCH_TRUST_ASSETS } from "@/lib/launch-assets";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: brandTitle("Trust and privacy") },
      {
        name: "description",
        content:
          "How TapeCoach handles private reports, partner visibility, brief-aware assessment limits and outcome claims.",
      },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Trust assets"
        title="Private reports, clear limits and no casting promises."
        subtitle={LAUNCH_NO_OUTCOME_PROMISE}
      />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <section className="grid gap-5 md:grid-cols-2">
          {LAUNCH_TRUST_ASSETS.map((item) => (
            <article key={item.title} className="rounded-md border border-border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-foreground">{item.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-md border border-border bg-secondary/35 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-background text-primary">
                  <Lock className="h-5 w-5" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">
                  The full legal wording stays visible.
                </h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Terms, privacy, cookies, AI report limits and refund/credit handling are linked
                across the app so performers, parents and partners know the operating basis before
                they upload.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Button asChild variant="outline">
                <Link to="/legal/privacy">Privacy policy</Link>
              </Button>
              <Button asChild>
                <Link to="/faq">
                  FAQ <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
