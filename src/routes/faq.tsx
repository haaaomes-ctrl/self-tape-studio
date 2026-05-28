import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HelpCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FAQ_ITEMS } from "@/lib/launch-assets";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: brandTitle("FAQ") },
      {
        name: "description",
        content:
          "Frequently asked questions about TapeCoach reports, credits, briefs, partner visibility and video limits.",
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="FAQ"
        title="Answers before you upload."
        subtitle="A quick reference for performers, parents, schools, coaches and agents considering TapeCoach."
      />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <section className="space-y-4">
          {FAQ_ITEMS.map((item) => (
            <article key={item.question} className="rounded-md border border-border bg-card p-5">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <HelpCircle className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {item.question}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.answer}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/login">
              Create account and claim free report <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/b2b-interest">Partner interest</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
