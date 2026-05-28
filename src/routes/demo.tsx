import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PlayCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { DEMO_VIDEO_STEPS } from "@/lib/launch-assets";
import { brandTitle } from "@/config/brand";
import heroStage from "@/assets/hero-stage.jpg";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: brandTitle("Demo video") },
      {
        name: "description",
        content:
          "A short TapeCoach demo walkthrough showing upload context, evidence separation and report review.",
      },
    ],
  }),
  component: DemoPage,
});

function DemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Demo video"
        title="A 60-second walkthrough of the TapeCoach flow."
        subtitle="The launch demo shows the performer journey from brief and upload through to source-aware report guidance."
      />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <section className="overflow-hidden rounded-md border border-border bg-card shadow-soft">
          <div className="relative aspect-video bg-sidebar text-sidebar-foreground">
            <img
              src={heroStage}
              alt=""
              aria-hidden="true"
              className="h-full w-full object-cover opacity-55"
            />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.14_0.04_260_/_0.78),oklch(0.14_0.04_260_/_0.28))]" />
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-lg text-center">
                <PlayCircle className="mx-auto h-16 w-16 text-primary" />
                <p className="mt-5 font-display text-3xl font-bold tracking-tight text-white">
                  TapeCoach demo video
                </p>
                <p className="mt-3 text-sm leading-relaxed text-white/80">
                  Upload context, review evidence, read the report and choose the next action.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-4">
            {DEMO_VIDEO_STEPS.map((step) => (
              <article key={step.timestamp} className="rounded-md bg-secondary/35 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  {step.timestamp}
                </p>
                <h2 className="mt-2 font-display text-base font-bold text-foreground">
                  {step.title}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/example-report">
              See the example report <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/login">Claim free report</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
