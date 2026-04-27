import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How SelfTape scores your tape" },
      {
        name: "description",
        content:
          "SelfTape is a judgement system, not a verdict. It adapts to your brief, explains its confidence, and tells you what to fix first.",
      },
      { property: "og:title", content: "How SelfTape scores your tape" },
      {
        property: "og:description",
        content: "Brief-aware, coach-like feedback for your audition self-tapes.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> How it works
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight">
          A first-pass casting reader, not a verdict.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          SelfTape is a judgement system supported by measurements — built to behave like a credible
          casting director or musical director who's seen thousands of tapes. It gives you the
          priority, not just a score.
        </p>

        <section className="mt-14 space-y-10">
          <Block
            icon={Layers}
            title="Two evaluation modes"
            body={
              <>
                <p>
                  <strong className="text-foreground">Brief-driven</strong> — when you provide a
                  casting brief, we extract the audition type, constraints, and priorities, and
                  weight your scores accordingly.
                </p>
                <p className="mt-3">
                  <strong className="text-foreground">Baseline</strong> — when there's no brief, we
                  apply a balanced professional rubric. The report tells you which mode was used and
                  what a brief would unlock.
                </p>
              </>
            }
          />
          <Block
            icon={ShieldCheck}
            title="Confidence is first-class"
            body={
              <>
                <p>
                  Every report ships with an explicit confidence score (0–100) based on brief
                  detail, audio quality, and video sanity. If we're not sure, we say so.
                </p>
                <p className="mt-3">
                  Audio that's too quiet caps the overall score. Brief-required elements that are
                  missing get flagged. We don't over-claim accuracy.
                </p>
              </>
            }
          />
          <Block
            icon={Sparkles}
            title="What you get"
            body={
              <ul className="ml-5 list-disc space-y-2">
                <li>A casting headline at the top — the one thing that defines the tape.</li>
                <li>Category scores (Technical, Audio, Vocal, Acting, Brief fit).</li>
                <li>Top 3 strengths and top 3 priority improvements.</li>
                <li>Timestamped notes and short coaching drills.</li>
                <li>Side-by-side comparison across up to 3 takes per audition.</li>
              </ul>
            }
          />
        </section>

        <div className="mt-16 rounded-2xl border border-border bg-secondary/50 p-8">
          <h2 className="font-display text-xl font-semibold">Ready to try it?</h2>
          <p className="mt-2 text-muted-foreground">
            Free during preview. Your tapes stay private to your account.
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link to="/login">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function Block({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Sparkles;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}
