import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Compass, Eye, Sparkles, Upload } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import tapecoachLogo from "@/assets/tapecoach-logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SelfTape — Honest feedback on your audition tape" },
      {
        name: "description",
        content:
          "Upload your self-tape, get coach-like feedback in minutes. Brief-aware scoring, timestamped notes, and a clear priority for your next take.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> A first-pass casting reader, in your pocket
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
            Honest, coach-like feedback on your{" "}
            <span className="text-primary">self-tape</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Upload your audition. Optionally paste the brief. Get a casting headline, category
            scores, timestamped notes, and the one thing to fix first — in minutes.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/login">
                Try it free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="h-12 px-6 text-base">
              <Link to="/about">How it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Free during preview · Your tapes stay private to your account
          </p>
        </div>

        {/* Mock report card */}
        <div className="mx-auto mt-20 max-w-4xl">
          <div className="rounded-2xl border border-border bg-card p-2 shadow-elevated">
            <div className="rounded-xl bg-secondary/60 p-8">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Casting headline
                  </p>
                  <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground">
                    "Strong vocal tone — most weakened by inconsistent audio."
                  </p>
                </div>
                <div className="rounded-lg bg-card px-4 py-3 text-center shadow-soft">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall</p>
                  <p className="font-display text-3xl font-bold text-primary">78</p>
                </div>
              </div>
              <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
                {[
                  ["Vocal", 82],
                  ["Acting", 75],
                  ["Audio", 64],
                  ["Technical", 80],
                  ["Brief fit", 85],
                ].map(([label, score]) => (
                  <div key={label as string}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium tabular-nums text-foreground">{score}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Built like a credible reader, not a verdict machine.
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              SelfTape behaves like a skilled first-pass casting director or musical director —
              giving you the priority, not just the score.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Upload,
                title: "Upload + brief (optional)",
                body: "Drop your tape. Paste the casting brief, fill the quick prompt, or skip it — we adapt.",
              },
              {
                icon: Eye,
                title: "Pre-upload checklist",
                body: "We catch orientation, lighting, audio level and length issues before they cost you a tape.",
              },
              {
                icon: Compass,
                title: "Casting headline + scores",
                body: "One plain-language priority at the top, then category scores, timestamps and drills.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="font-display text-3xl font-bold tracking-tight text-foreground">
            What makes the feedback trustworthy
          </h2>
          <ul className="mt-8 space-y-5">
            {[
              "The brief defines what good looks like. Without one, we apply a professional baseline — and tell you which mode we used.",
              "Every report shows a confidence band so you know how sure the system is.",
              "Audio that's too quiet? Score is capped — we won't over-claim what we can't fairly judge.",
              "Intentional creative choices aren't punished. Portrait is fine if the brief allows it.",
              "Compare up to 3 takes side-by-side and see which one casting will respond to most.",
            ].map((line) => (
              <li key={line} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <span className="text-foreground">{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg" className="h-12 px-6 text-base">
              <Link to="/login">
                Get started <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-sidebar-border bg-sidebar py-10 text-sidebar-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 text-sm sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <img
              src={tapecoachLogo}
              alt="TapeCoach logo"
              className="h-7 w-7 object-contain"
            />
            <span className="font-display text-base font-bold tracking-tight">
              Tape<span className="text-primary">Coach</span>
            </span>
            <span className="ml-3 text-sidebar-foreground/70">
              Review your tape before it reaches the room.
            </span>
          </div>
          <Link to="/about" className="text-sidebar-foreground/80 hover:text-sidebar-foreground">
            How we score
          </Link>
        </div>
      </footer>
    </div>
  );
}
