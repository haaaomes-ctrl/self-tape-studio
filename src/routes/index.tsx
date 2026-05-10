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
  Theater,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";

import heroStage from "@/assets/hero-ginger.jpg";
import { brand, brandTitle } from "@/config/brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: brandTitle() },
      { name: "description", content: brand.description },
      { property: "og:title", content: brandTitle() },
      { property: "og:description", content: brand.shareDescription },
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
      <SiteHeader variant="transparent" />

      <main id="main" tabIndex={-1}>
      {/* Hero — cinematic full-bleed stage visual */}
      <section
        aria-labelledby="hero-heading"
        className="relative isolate overflow-hidden bg-[oklch(0.16_0.04_260)] text-sidebar-foreground"
      >
        <div className="absolute inset-0 -z-10">
          <img
            src={heroStage}
            alt=""
            aria-hidden="true"
            className="h-full w-full object-cover object-[78%_center]"
            width={1920}
            height={820}
          />
          {/* Soft left scrim — keeps copy legible without flattening the photo */}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,oklch(0.14_0.04_260_/_0.78)_0%,oklch(0.14_0.04_260_/_0.55)_28%,oklch(0.14_0.04_260_/_0.18)_50%,transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,oklch(0.14_0.04_260_/_0.35))]" />
        </div>

        <div className="mx-auto flex min-h-[74vh] w-full max-w-7xl items-center px-4 py-14 sm:px-6 sm:py-20 lg:min-h-[80vh] lg:py-24">
          <div className="max-w-2xl">
            <h1
              id="hero-heading"
              className="font-display text-4xl font-black leading-[1.02] tracking-tight text-white sm:text-5xl lg:text-[5.25rem]"
            >
              Review your tape before it reaches
              <span className="block bg-gradient-to-r from-[oklch(0.72_0.16_255)] to-[oklch(0.82_0.13_235)] bg-clip-text text-transparent">
                the room.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/90 sm:text-xl/relaxed">
              Private, structured feedback on your performance, voice, setup and brief fit — before your tape reaches casting, agents or teachers.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="px-7">
                <Link to="/login">
                  Review my tape <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-sidebar-foreground/35 bg-sidebar/20 text-sidebar-foreground backdrop-blur hover:border-sidebar-foreground/60 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
              >
                <Link to="/about">See example feedback</Link>
              </Button>
            </div>

            <p className="mt-6 flex max-w-lg items-start gap-2 text-sm leading-relaxed text-sidebar-foreground/75">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-sidebar-foreground/65" />
              <span>Private by default. No public posting. No judgement. Just clear notes before you submit.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Why self-tapes are hard */}
      <section className="bg-background py-14 sm:py-16">
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
      <section className="border-y border-border bg-secondary/40 py-14 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            What we check
          </p>
          <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Six dimensions, every tape.
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                className="group relative overflow-hidden rounded-md border border-border bg-card p-5 shadow-soft transition-shadow hover:shadow-elevated"
              >
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-md ${item.accent}`}
                >
                  <item.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-lg font-bold text-secondary-foreground">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
      <section className="bg-background py-14 sm:py-16">
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
      <section className="bg-sidebar py-14 text-sidebar-foreground sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Private feedback you can trust
              </p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-sidebar-foreground sm:text-4xl">
                Private feedback before the people who matter see it.
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
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

            <div className="space-y-3">
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
      <section className="bg-background pb-0 pt-12">
        <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-5 rounded-t-md border border-b-0 border-border bg-card px-6 py-7 shadow-soft sm:flex-row sm:items-center sm:px-10">
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
