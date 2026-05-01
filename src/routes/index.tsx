import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Eye,
  FileQuestion,
  HelpCircle,
  Lightbulb,
  Lock,
  Mic,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Theater,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

import heroStage from "@/assets/hero-stage.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TapeCoach — Review your tape before it reaches the room" },
      {
        name: "description",
        content:
          "Private, structured feedback on your performance, voice, setup and brief fit — before your tape reaches casting, agents or teachers.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SiteHeader />

      <main id="main" tabIndex={-1}>
      {/* Hero — theatre-inspired, dark backdrop */}
      <section
        aria-labelledby="hero-heading"
        className="relative isolate overflow-hidden bg-sidebar text-sidebar-foreground"
      >
        {/* Background image + gradient overlay for readability */}
        <div className="absolute inset-0 -z-10">
          <img
            src={heroStage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-center opacity-60"
            width={1920}
            height={1080}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(110deg, oklch(0.18 0.05 260 / 0.95) 0%, oklch(0.20 0.06 260 / 0.78) 45%, oklch(0.22 0.07 260 / 0.55) 100%)",
            }}
          />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-sidebar" />
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-foreground/15 bg-sidebar-foreground/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/80 backdrop-blur">
              <Sparkles className="h-3 w-3 text-primary" aria-hidden="true" /> Private self-tape feedback
            </span>
            <h1
              id="hero-heading"
              className="mt-5 font-display text-[2rem] font-black leading-[1.1] tracking-tight text-sidebar-foreground sm:mt-6 sm:text-5xl lg:text-6xl"
            >
              Review your tape before it reaches{" "}
              <span className="text-primary">the room.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-sidebar-foreground/80 sm:text-lg">
              Private, structured feedback on your performance, voice, setup and brief fit —
              before your tape reaches casting, agents or teachers.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link to="/login">
                  Review my tape <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-sidebar-foreground/25 bg-transparent text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground hover:border-sidebar-foreground/40"
              >
                <Link to="/about">See example feedback</Link>
              </Button>
            </div>
            <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-sidebar-foreground/70">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-sidebar-foreground/60" />
              <span>
                Private by default. No public posting. No judgement. Just clear notes before you submit.
              </span>
            </p>
          </div>

          {/* Right-hand visual — silhouetted stage detail framed by gradient */}
          <div className="relative hidden lg:block">
            <div className="absolute -inset-6 rounded-3xl bg-gradient-to-br from-primary/30 via-accent/20 to-transparent blur-2xl" />
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-sidebar-foreground/10 shadow-elevated">
              <img
                src={heroStage}
                alt="Performer mid-audition under stage lights with a self-tape camera"
                className="h-full w-full object-cover"
                width={800}
                height={1000}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-sidebar/70 via-transparent to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Why self-tapes are hard */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-start lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Self-tapes are hard to judge alone
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                You want to send your best take.
                <span className="block text-primary">We help you make sure you do.</span>
              </h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                {
                  icon: HelpCircle,
                  title: "Is this my best take?",
                  body: "Three takes in, every choice starts to blur. A second pair of eyes makes the call easier.",
                },
                {
                  icon: FileQuestion,
                  title: "Did I miss something in the brief?",
                  body: "It is easy to overlook a tone, a wardrobe note or a key requirement when you are also performing.",
                },
                {
                  icon: Mic,
                  title: "Is the audio, framing or lighting weakening my performance?",
                  body: "Small setup issues can quietly cost you the room — before your acting choices are even heard.",
                },
                {
                  icon: ShieldCheck,
                  title: "Am I sending the version that gives me the best chance?",
                  body: "Confidence to submit comes from clear, structured notes — not a gut check at midnight.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold leading-snug text-secondary-foreground">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What we check */}
      <section className="border-y border-border bg-secondary/40 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            What we check
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Six dimensions, every tape.
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Theater,
                accent: "bg-accent/15 text-accent",
                bar: "bg-accent",
                title: "Performance choices",
                body: "Clarity of intention, characterisation and emotional truth.",
              },
              {
                icon: Mic,
                accent: "bg-accent/15 text-accent",
                bar: "bg-accent",
                title: "Voice & clarity",
                body: "Projection, pace, diction and overall vocal quality.",
              },
              {
                icon: Eye,
                accent: "bg-primary/10 text-primary",
                bar: "bg-primary",
                title: "Framing & eyeline",
                body: "Composition, eyeline, headroom and positioning.",
              },
              {
                icon: Lightbulb,
                accent: "bg-success/15 text-success",
                bar: "bg-success",
                title: "Lighting & sound",
                body: "Lighting consistency, exposure, audio quality and noise.",
              },
              {
                icon: ClipboardList,
                accent: "bg-primary/10 text-primary",
                bar: "bg-primary",
                title: "Brief fit",
                body: "How well your tape meets the brief and key requirements.",
              },
              {
                icon: ShieldCheck,
                accent: "bg-accent/15 text-accent",
                bar: "bg-accent",
                title: "Submission readiness",
                body: "Overall polish, confidence and final checks.",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="group relative overflow-hidden rounded-md border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-md ${item.accent}`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-bold text-secondary-foreground">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                <span
                  className={`absolute inset-x-0 bottom-0 h-1 ${item.bar} opacity-80`}
                  aria-hidden="true"
                />
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Example feedback report */}
      <section className="bg-background py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:items-start lg:gap-14">
            <div className="lg:pt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Example feedback report
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Clear notes. <span className="text-primary">Stronger tapes.</span>
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                You'll get a detailed report with scores, strengths, timestamped notes and
                practical next steps — written in plain language you can act on.
              </p>
              <div className="mt-8">
                <Button asChild variant="outline">
                  <Link to="/about">See full example</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-6 shadow-elevated sm:p-8">
              <div className="grid gap-6 sm:grid-cols-[1fr_1.4fr] sm:gap-8">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Casting headline
                  </p>
                  <p className="mt-2 font-display text-lg font-bold leading-snug text-secondary-foreground">
                    "Strong performance choices — tighten audio and eyeline before submitting."
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Overall readiness
                      </p>
                      <p className="mt-1 font-display text-xl font-bold text-primary">
                        Nearly ready
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Priority fix
                      </p>
                      <p className="mt-1 text-sm font-medium text-foreground">
                        Improve audio consistency before sending.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Scores
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { label: "Performance choices", score: 8.5, color: "bg-primary" },
                      { label: "Voice & clarity", score: 8.0, color: "bg-primary" },
                      { label: "Framing & eyeline", score: 7.5, color: "bg-primary" },
                      { label: "Lighting & sound", score: 6.5, color: "bg-success" },
                      { label: "Brief fit", score: 8.0, color: "bg-primary" },
                      { label: "Submission readiness", score: 7.0, color: "bg-accent" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{row.label}</span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {row.score.toFixed(1)}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${row.color}`}
                            style={{ width: `${row.score * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-6 border-t border-border pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Top strengths
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {[
                      "Clear emotional intention",
                      "Strong vocal tone",
                      "Good connection to the role",
                    ].map((s) => (
                      <li key={s} className="flex items-start gap-2 text-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Before you submit
                  </p>
                  <ul className="mt-3 space-y-2 text-sm">
                    {[
                      "Re-record with more consistent audio",
                      "Lift eyeline slightly closer to lens",
                      "Trim the opening pause by 2 seconds",
                    ].map((s) => (
                      <li key={s} className="flex items-start gap-2 text-foreground">
                        <ScanLine className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust, privacy & testimonials */}
      <section className="bg-sidebar py-20 text-sidebar-foreground sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Private feedback you can trust
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-sidebar-foreground sm:text-4xl">
                Private feedback before the people who matter see it.
              </h2>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                {[
                  {
                    icon: Lock,
                    title: "Your tape stays private to your account.",
                  },
                  {
                    icon: Users,
                    title: "Feedback supports your choices, not judges your talent.",
                  },
                  {
                    icon: ShieldCheck,
                    title: "We check both performance and practical details.",
                  },
                  {
                    icon: ClipboardList,
                    title: "Structured notes you can actually use.",
                  },
                ].map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-sidebar-foreground/15 bg-sidebar-foreground/5 text-primary">
                      <item.icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-relaxed text-sidebar-foreground/85">
                      {item.title}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {[
                {
                  quote:
                    "TapeCoach gives me confidence before I send. It catches the little things I always miss.",
                  name: "Actor",
                },
                {
                  quote:
                    "I recommend it to my students. It's like having an extra set of expert eyes.",
                  name: "Acting Coach",
                },
                {
                  quote:
                    "It helps me see what works and what doesn't before I send it to my clients.",
                  name: "Agent",
                },
              ].map((t) => (
                <figure
                  key={t.name}
                  className="rounded-md border border-sidebar-foreground/10 bg-sidebar-foreground/[0.04] p-5 backdrop-blur"
                >
                  <blockquote className="text-sm leading-relaxed text-sidebar-foreground/90">
                    "{t.quote}"
                  </blockquote>
                  <figcaption className="mt-3 text-xs font-semibold uppercase tracking-wider text-primary">
                    — {t.name}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-background py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-md border border-border bg-card px-6 py-8 shadow-soft sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="font-display text-2xl font-bold tracking-tight text-secondary-foreground sm:text-3xl">
              Before you send it, <span className="text-primary">check it.</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Give yourself the best chance of sending a stronger tape.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Review my tape <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link to="/about">See how it works</Link>
            </Button>
          </div>
        </div>
      </section>

      </main>

      <SiteFooter />
    </div>
  );
}
