import { Link, createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/credits-success")({
  head: () => ({
    meta: [
      { title: brandTitle("Credits payment received") },
      {
        name: "description",
        content: "Stripe Checkout confirmation for optional TapeCoach credit top-ups.",
      },
    ],
  }),
  component: CreditsSuccessPage,
});

function CreditsSuccessPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Credits"
        title="Payment received"
        subtitle="Your optional TapeCoach credit top-up is being confirmed."
        variant="app"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-semibold text-foreground">
                Checkout completed
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Credits will appear once payment confirmation finishes. Refreshing this page will
                not charge you again.
              </p>
            </div>
          </div>
          <Button asChild className="mt-5">
            <Link to="/dashboard">Go to dashboard</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
