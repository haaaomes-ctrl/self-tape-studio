import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "How TapeCoach reviews your self-tape" },
      {
        name: "description",
        content:
          "TapeCoach gives you a private second look at your self-tape — structured feedback on performance, voice, setup and brief fit, so you can submit with more confidence.",
      },
      { property: "og:title", content: "How TapeCoach reviews your self-tape" },
      {
        property: "og:description",
        content:
          "Private, structured self-tape review for actors, agents and teachers. A second look before you submit.",
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
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary-foreground">
          <Sparkles className="h-3 w-3 text-primary" /> How it works
        </span>
        <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight">
          A private second look — before your tape reaches the room.
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          TapeCoach gives you structured, performer-friendly feedback on your self-tape. It is built
          to feel like a trusted reader on call — quiet, supportive, and focused on helping you send
          your strongest take.
        </p>

        <section className="mt-14 space-y-10">
          <Block
            icon={Layers}
            title="Two ways to review"
            body={
              <>
                <p>
                  <strong className="text-foreground">With a brief</strong> — paste the casting
                  brief and we tailor the review around what the role is actually asking for, so the
                  notes match the tape you are sending.
                </p>
                <p className="mt-3">
                  <strong className="text-foreground">Without a brief</strong> — we apply a balanced
                  professional baseline. The report tells you which mode was used and what a brief
                  would unlock.
                </p>
              </>
            }
          />
          <Block
            icon={ShieldCheck}
            title="Honest about what we can see"
            body={
              <>
                <p>
                  Every report shows how confident the review is, based on brief detail, audio
                  quality and video clarity. If something is hard to assess, we say so rather than
                  overclaim.
                </p>
                <p className="mt-3">
                  Audio that is too quiet to judge fairly is flagged, not punished. Brief-required
                  elements that are missing are surfaced clearly so nothing slips past you.
                </p>
              </>
            }
          />
          <Block
            icon={Sparkles}
            title="What you get"
            body={
              <ul className="ml-5 list-disc space-y-2">
                <li>A clear headline at the top — the one thing that defines this take.</li>
                <li>
                  Category scores across performance choices, voice & clarity, framing & eyeline,
                  lighting & sound, brief fit and submission readiness.
                </li>
                <li>Top strengths and the priority changes worth making before you submit.</li>
                <li>Timestamped notes and short, practical drills you can act on.</li>
                <li>Side-by-side comparison across up to three takes per audition.</li>
              </ul>
            }
          />
        </section>

        <div className="mt-16 rounded-md border border-border bg-secondary/60 p-8 shadow-soft">
          <h2 className="font-display text-xl font-bold tracking-tight text-secondary-foreground">
            Ready for a second look?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Private by default. Your tape stays in your account — give yourself the best chance of
            sending a stronger take.
          </p>
          <Button asChild size="lg" className="mt-5">
            <Link to="/login">
              Review my tape <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
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
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-secondary-foreground">
          {title}
        </h2>
      </div>
      <div className="mt-4 space-y-3 text-base leading-relaxed text-muted-foreground">{body}</div>
    </div>
  );
}
