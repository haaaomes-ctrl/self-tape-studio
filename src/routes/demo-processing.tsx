import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { OrbitHero } from "@/components/audition/orbit-hero";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/demo-processing")({
  head: () => ({ meta: [{ title: brandTitle("Processing demo") }] }),
  component: DemoProcessingPage,
});

const TIER_REASSURE_SECONDS = 45;
const TIER_LONG_WAIT_SECONDS = 180;
const TIER_VERY_LONG_WAIT_SECONDS = 360;

const STAGES = [
  { key: "uploading", label: "Uploading your tape" },
  { key: "transcoding", label: "Optimising video" },
  { key: "analysis_pending", label: "Preparing analysis" },
  { key: "analysing", label: "Watching your tape" },
  { key: "writing", label: "Writing your report" },
  { key: "finalising", label: "Finalising results" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

function stageIndexFor(phase: StageKey, analysisElapsed: number): number {
  if (phase === "uploading") return 0;
  if (phase === "transcoding") return 1;
  if (phase === "analysis_pending") return 2;
  if (phase === "finalising") return 5;
  if (analysisElapsed >= 90) return 5;
  if (analysisElapsed >= TIER_REASSURE_SECONDS) return 4;
  return 3;
}


type StageState = "done" | "active" | "pending";

function StageRow({ label, state }: { label: string; state: StageState }) {
  if (state === "active") {
    return (
      <div className="-mx-3 flex items-center gap-3 rounded-xl bg-secondary px-3 py-3 ring-1 ring-primary/15">
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary">
          <span className="h-2 w-2 rounded-full bg-primary motion-safe:animate-pulse" />
        </span>
        <span className="text-sm font-semibold text-primary">{label}</span>
        <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary">
          ACTIVE
        </span>
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className="flex items-center gap-3 opacity-60">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success">
          <Check className="h-3 w-3 text-success-foreground" strokeWidth={4} />
        </span>
        <span className="text-sm font-medium text-foreground line-through">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
      <span className="text-sm font-medium text-muted-foreground/70">{label}</span>
    </div>
  );
}

function DemoProcessingPage() {
  const [phase, setPhase] = useState<StageKey>("analysing");
  const [elapsed, setElapsed] = useState(20);
  const [running, setRunning] = useState(true);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const analysisElapsed = phase === "analysing" || phase === "analysis_pending" ? elapsed : 0;
  const activeIdx = stageIndexFor(phase, analysisElapsed);

  let title: string;
  let sub: string;
  if (phase === "uploading") {
    title = "Uploading your tape…";
    sub = "Sending to secure storage. This is the only step that depends on your connection.";
  } else if (phase === "transcoding") {
    title = "Optimising your video…";
    sub = "Standardising format for fast, accurate analysis. Your performance is not altered.";
  } else if (phase === "analysis_pending") {
    title = "Preparing your video for analysis";
    sub =
      "Your video is being optimised for review. We're checking every few seconds and will move on automatically.";
  } else if (phase === "finalising") {
    title = "Finalising your results";
    sub = "Almost there — preparing your report.";
  } else if (analysisElapsed < TIER_REASSURE_SECONDS) {
    title = "Watching your tape";
    sub = "We're reviewing the performance, brief, sound and technical setup.";
  } else if (analysisElapsed < 90) {
    title = "Writing your feedback";
    sub = "We're turning the analysis into clear notes and next steps.";
  } else {
    title = "Finalising your results";
    sub = "Almost there — preparing your report.";
  }

  let longWaitNote: string | null = null;
  if (elapsed >= TIER_VERY_LONG_WAIT_SECONDS) {
    longWaitNote = "Still working. Longer videos can take up to 10 minutes.";
  } else if (elapsed >= TIER_LONG_WAIT_SECONDS) {
    longWaitNote = "Still working — this is taking longer than usual, but it has not failed.";
  } else if (elapsed >= 60) {
    longWaitNote =
      "Longer videos or larger files can take longer. In some cases, analysis can take up to 10 minutes.";
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Demo"
        title="Processing screen"
        subtitle="Preview-only — what the performer sees while their tape is being analysed."
        variant="app"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-20 pt-10">
        {/* Demo controls */}
        <div className="mb-6 rounded-xl border border-dashed border-border bg-muted/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Demo controls
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {STAGES.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant={phase === s.key ? "default" : "outline"}
                onClick={() => setPhase(s.key)}
              >
                {s.label}
              </Button>
            ))}
            <span className="mx-2 h-6 w-px bg-border" />
            <Button size="sm" variant="outline" onClick={() => setElapsed(0)}>
              Reset timer
            </Button>
            <Button size="sm" variant="outline" onClick={() => setElapsed((e) => e + 30)}>
              +30s
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRunning((r) => !r)}>
              {running ? "Pause" : "Resume"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-border bg-card text-left shadow-soft">
          <OrbitHero />

          <div className="px-8 pt-8 text-center sm:px-10">
            <h2 className="font-display text-2xl font-bold text-brand-navy">{title}</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{sub}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-ping" />
              <span className="text-xs font-semibold uppercase tracking-wider text-secondary-foreground tabular-nums">
                Elapsed: {formatElapsed(elapsed)}
              </span>
            </div>
          </div>

          <ol className="mx-auto mt-8 max-w-sm space-y-3 px-8 pb-6 sm:px-10">
            {STAGES.map((s, i) => {
              const state: StageState =
                i < activeIdx ? "done" : i === activeIdx ? "active" : "pending";
              return (
                <li key={s.key}>
                  <StageRow label={s.label} state={state} />
                </li>
              );
            })}
          </ol>

          {(longWaitNote || elapsed >= TIER_LONG_WAIT_SECONDS) && (
            <div className="mx-auto max-w-md px-8 pb-6 text-center sm:px-10">
              {longWaitNote && (
                <p className="text-xs text-muted-foreground">{longWaitNote}</p>
              )}
              {elapsed >= TIER_LONG_WAIT_SECONDS && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Feel free to grab a tea — we'll keep this running.
                </p>
              )}
            </div>
          )}

          <div className="flex justify-center pb-6">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {}}
            >
              Cancel analysis
            </Button>
          </div>

          {/* Bottom progress bar */}
          <div className="h-1.5 w-full bg-secondary">
            <div
              className={cn(
                "h-full bg-gradient-to-r from-brand-royal to-brand-violet transition-all duration-700",
              )}
              style={{ width: `${Math.round(((activeIdx + 1) / STAGES.length) * 100)}%` }}
            />
          </div>
        </div>

      </main>
      <SiteFooter />
    </div>
  );
}
