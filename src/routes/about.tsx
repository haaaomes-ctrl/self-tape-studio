import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { brand, brandTitle } from "@/config/brand";
import { VIDEO_DURATION_SUPPORT_EMAIL } from "@/lib/video-duration-policy";

const ABOUT_TITLE = `How ${brand.name} reviews your self-tape`;
const ABOUT_DESC = `${brand.name} gives you a private second look at your self-tape — structured feedback on performance, voice, setup and brief fit, so you can submit with more confidence.`;

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: brandTitle(ABOUT_TITLE) },
      { name: "description", content: ABOUT_DESC },
      { property: "og:title", content: brandTitle(ABOUT_TITLE) },
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
      <PageHeader
        eyebrow="How it works"
        title="A private second look — before your tape reaches the room."
        subtitle={
          <>
            {brand.name} gives you structured, performer-friendly feedback on your self-tape. It is
            built to feel like a trusted reader on call — quiet, supportive, and focused on helping
            you send your strongest take.
          </>
        }
      />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-14">
        <section className="space-y-10">
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
            icon={Clock}
            title="How long should my video be?"
            body={
              <>
                <p>
                  Videos up to 5 minutes do not show a length warning. From 5:01 to 10:00, TapeCoach
                  shows guidance, but you can continue if your brief asks for a longer tape or
                  multiple components.
                </p>
                <p className="mt-3">
                  Videos over 10 minutes are blocked before upload and report generation. Keep the
                  required audition material from your brief and trim unrelated lead-in, dead time
                  or unused footage. If the brief specifically requires a longer tape, contact{" "}
                  <a className="underline" href={`mailto:${VIDEO_DURATION_SUPPORT_EMAIL}`}>
                    {VIDEO_DURATION_SUPPORT_EMAIL}
                  </a>
                  .
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

        <div className="mt-16 rounded-md border border-border bg-card p-8 shadow-soft">
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
