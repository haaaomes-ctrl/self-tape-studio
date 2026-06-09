import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Eye } from "lucide-react";
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

function OrbitHero() {
  return (
    <div className="relative flex h-64 items-center justify-center overflow-hidden bg-brand-navy">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-brand-violet/25 blur-[80px] animate-pulse motion-reduce:animate-none" />
      <div
        className="pointer-events-none absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-brand-royal/25 blur-[80px] animate-pulse motion-reduce:animate-none"
        style={{ animationDelay: "1s" }}
      />

      {/* Orbit */}
      <div className="relative flex items-center justify-center">
        <div
          className="absolute h-40 w-40 rounded-full border-2 border-brand-violet/40 border-l-transparent border-b-transparent motion-safe:animate-spin motion-reduce:hidden"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute h-32 w-32 rounded-full border-2 border-brand-royal/40 border-r-transparent border-t-transparent motion-safe:animate-spin motion-reduce:hidden"
          style={{ animationDuration: "6s", animationDirection: "reverse" }}
        />

        {/* Core lens */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-xl backdrop-blur-md">
          <Eye className="h-8 w-8 text-brand-off-white" strokeWidth={1.75} />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent via-brand-royal/40 to-transparent motion-safe:animate-[orbitScan_2.4s_ease-in-out_infinite] motion-reduce:hidden" />
        </div>
      </div>

      <style>{`
        @keyframes orbitScan {
          0%, 100% { transform: translateY(-100%); opacity: 0; }
          50% { transform: translateY(100%); opacity: 1; }
        }
      `}</style>
    </div>
  );
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

        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft sm:p-10">
          <ProcessingHero stage={phase} />
          <p className="mt-6 font-display text-lg font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
          <p className="mt-3 text-xs text-muted-foreground tabular-nums">
            Elapsed: {formatElapsed(elapsed)}
          </p>
          <ol className="mx-auto mt-6 max-w-sm space-y-1.5 text-left">
            {STAGES.map((s, i) => (
              <li key={s.key}>
                <PhaseStep label={s.label} active={i === activeIdx} done={i < activeIdx} />
              </li>
            ))}
          </ol>

          <p className="mx-auto mt-6 max-w-md text-xs text-muted-foreground">
            We're still working. If anything fails, we'll retry automatically.
          </p>
          {longWaitNote && (
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">{longWaitNote}</p>
          )}
          {elapsed >= TIER_LONG_WAIT_SECONDS && (
            <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
              Feel free to grab a tea — we'll keep this running.
            </p>
          )}

          <div className="mt-8 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {}}
            >
              Cancel analysis
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
