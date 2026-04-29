import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, ShieldAlert, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { ChecklistView } from "@/components/checklist-view";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { analyzeVideoFile, type ChecklistResult } from "@/lib/checklist";
import { preflightVideoBasics, uploadFileToMux, UploadCancelledError } from "@/lib/mux-upload";
import { retryProcessTake, resetTake, resetTakeForReupload } from "@/server/process-take.functions";
import { createMuxDirectUpload } from "@/server/mux.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audition/$auditionId")({
  head: () => ({ meta: [{ title: "Audition — SelfTape" }] }),
  component: AuditionPage,
});

interface Take {
  id: string;
  take_number: number;
  status: string;
  error_message: string | null;
  overall_score: number | null;
  confidence: number | null;
  scores: Record<string, number | null> | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  checklist: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compliance_flags?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  score_breakdown?: any;
  created_at: string;
  mux_status?: string | null;
  processing_phase?: string | null;
}

interface Audition {
  id: string;
  title: string;
  brief: string | null;
  brief_source: "full" | "guided" | "none";
  mode: "brief" | "baseline";
  audition_level?: "learning" | "amateur" | "emerging" | "professional" | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extracted_brief?: any;
}

function AuditionPage() {
  const { auditionId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [audition, setAudition] = useState<Audition | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  async function refresh() {
    const { data: aud } = await supabase
      .from("auditions")
      .select("id, title, brief, brief_source, mode, audition_level, extracted_brief")
      .eq("id", auditionId)
      .single();
    if (aud) setAudition(aud as Audition);
    const { data: ts } = await supabase
      .from("takes")
      .select("*")
      .eq("audition_id", auditionId)
      .order("take_number");
    if (ts) {
      setTakes(ts as Take[]);
      if (!activeTakeId && ts.length) setActiveTakeId(ts[ts.length - 1].id);
    }
  }

  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, auditionId]);

  // Poll while any take is processing
  useEffect(() => {
    const anyProcessing = takes.some((t) => t.status === "processing" || t.status === "pending");
    if (!anyProcessing) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [takes]);

  if (!audition) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-6 py-16 text-sm text-muted-foreground">Loading…</main>
      </div>
    );
  }

  const activeTake = takes.find((t) => t.id === activeTakeId) ?? takes[takes.length - 1];
  const completed = takes.filter((t) => t.status === "complete");

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-10">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All auditions
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">{audition.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="font-normal">
                {audition.mode === "brief" ? "Brief-driven" : "Baseline"} mode
              </Badge>
              <span className="text-muted-foreground">
                {takes.length} take{takes.length === 1 ? "" : "s"} · max 3
              </span>
            </div>
          </div>
          {takes.length < 3 && (
            <Button variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add take
            </Button>
          )}
        </div>

        {showAdd && takes.length < 3 && (
          <AddTakeBlock
            audition={audition}
            nextNumber={takes.length + 1}
            onCancel={() => setShowAdd(false)}
            onUploaded={() => {
              setShowAdd(false);
              refresh();
            }}
          />
        )}

        {takes.length > 0 && (
          <div className="mt-8">
            <Tabs value={activeTakeId ?? takes[0].id} onValueChange={setActiveTakeId}>
              <TabsList>
                {takes.map((t) => (
                  <TabsTrigger key={t.id} value={t.id}>
                    Take {t.take_number}
                    {t.overall_score != null && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        · {t.overall_score}
                      </span>
                    )}
                  </TabsTrigger>
                ))}
                {completed.length >= 2 && (
                  <TabsTrigger value="compare">Compare</TabsTrigger>
                )}
              </TabsList>

              {takes.map((t) => (
                <TabsContent key={t.id} value={t.id} className="mt-6">
                  <TakeView take={t} />
                </TabsContent>
              ))}

              {completed.length >= 2 && (
                <TabsContent value="compare" className="mt-6">
                  <CompareView takes={completed} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        )}

        {!activeTake && (
          <p className="mt-10 text-sm text-muted-foreground">No takes yet.</p>
        )}
      </main>
    </div>
  );
}

// Tier thresholds for the "watching your tape" UX. Tied to the server-side
// reconciler ceiling (MAX_TOTAL_AGE_SECONDS = 180s) so the UI never shows a
// hard error before the backend has actually given up.
const TIER_FINALISING_SECONDS = 60;
const TIER_LONG_SECONDS = 120;
const TIER_GIVEUP_SECONDS = 180;

function useElapsedSeconds(startIso: string) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000)),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return elapsed;
}

function FailedTakeView({ take }: { take: Take }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const stuck = take.status === "processing" || take.status === "pending";

  async function onReplace(f: File | null) {
    if (!f || !user) return;
    setBusy(true);
    try {
      let checklist: ChecklistResult | null = null;
      try {
        checklist = await analyzeVideoFile(f);
      } catch {
        // best-effort
      }

      // Pre-upload preflight.
      if (checklist) {
        const pf = preflightVideoBasics(
          f,
          checklist.duration.seconds,
          checklist.audio.peak,
        );
        if (!pf.ok) {
          toast.error(pf.error ?? "Video failed pre-upload checks");
          return;
        }
        if (pf.warning) toast.warning(pf.warning);
      }

      const signals = checklist
        ? {
            orientation: checklist.orientation.value,
            width: checklist.resolution.width,
            height: checklist.resolution.height,
            duration: checklist.duration.seconds,
            brightness: checklist.brightness.value,
            audio_peak: checklist.audio.peak,
            audio_rms: checklist.audio.rms,
          }
        : null;

      // Reset the take row, then ask Mux for a fresh direct-upload URL,
      // then PUT the new file straight to Mux.
      await resetTakeForReupload({ data: { takeId: take.id, signals, checklist } });
      const { uploadUrl } = await createMuxDirectUpload({ data: { takeId: take.id } });
      if (!uploadUrl) throw new Error("Could not get an upload URL");
      await uploadFileToMux(uploadUrl, f);
      toast.success("Replacement uploaded — optimising and analysing now");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Replace failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <div className="flex items-center gap-2 text-destructive">
        <ShieldAlert className="h-4 w-4" />
        <p className="font-medium">
          {stuck ? "This take has been analysing for a while" : "Couldn't analyse this take"}
        </p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {stuck
          ? "Processing appears stuck. You can cancel and replace the video, or try again."
          : (take.error_message ?? "Something went wrong.")}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          className="hidden"
          onChange={(e) => onReplace(e.target.files?.[0] ?? null)}
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          Replace video
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retryProcessTake({ data: { takeId: take.id } });
              toast.success("Retrying analysis");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Retry failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Retry analysis
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retryProcessTake({ data: { takeId: take.id, allowOriginal: true } });
              toast.success("Retrying with highest quality");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Retry failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          Retry with highest quality
        </Button>
        {stuck && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={async () => {
              await resetTake({ data: { takeId: take.id } });
              toast.success("Cancelled — you can replace the video now.");
            }}
          >
            Cancel stuck analysis
          </Button>
        )}
      </div>
    </div>
  );
}

function PhaseStep({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          done ? "bg-success" : active ? "bg-primary animate-pulse" : "bg-border",
        )}
      />
      <span className={cn(done || active ? "text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
    </div>
  );
}

function ProcessingTakeView({ take }: { take: Take }) {
  const elapsed = useElapsedSeconds(take.created_at);
  const phase = take.processing_phase ?? "uploading";
  const [busy, setBusy] = useState(false);

  // Upload / transcoding tiers are independent of the analysis tiers — Mux
  // can take a couple of minutes to optimise a large file before analysis
  // even starts.
  if (phase === "uploading" || phase === "transcoding") {
    const copy =
      phase === "uploading"
        ? {
            title: "Uploading your tape…",
            sub: "Sending to secure storage. This is the only network step that depends on your connection.",
          }
        : {
            title: "Optimising your video…",
            sub: "Standardising format for fast, accurate analysis. Your performance is not altered. Usually 1–3 minutes.",
          };
    return (
      <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        <p className="mt-4 font-display text-lg font-semibold">{copy.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.sub}</p>
        <div className="mx-auto mt-6 max-w-xs space-y-1.5 text-left">
          <PhaseStep label="Upload" active={phase === "uploading"} done={phase !== "uploading"} />
          <PhaseStep
            label="Optimise"
            active={phase === "transcoding"}
            done={false}
          />
          <PhaseStep label="Analyse" active={false} done={false} />
        </div>
      </div>
    );
  }

  // Analysis tiers — driven by elapsed time since the take was created so
  // the UX doesn't depend on which retry attempt the backend is on.
  let title: string;
  let sub: string;
  if (elapsed < TIER_FINALISING_SECONDS) {
    title = "Watching your tape…";
    sub = "Reading the brief, checking technicals, writing notes. Usually under a minute.";
  } else if (elapsed < TIER_LONG_SECONDS) {
    title = "Finalising your video…";
    sub = "This can take a few extra seconds while the optimised file finishes preparing. Hang tight.";
  } else {
    title = "This is taking longer than expected";
    sub = "Your tape is still being prepared. You can wait, retry now, or cancel.";
  }

  const showActions = elapsed >= TIER_LONG_SECONDS;

  return (
    <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-soft">
      <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      <p className="mt-4 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <div className="mx-auto mt-6 max-w-xs space-y-1.5 text-left">
        <PhaseStep label="Upload" active={false} done={true} />
        <PhaseStep label="Optimise" active={false} done={true} />
        <PhaseStep label="Analyse" active={true} done={false} />
      </div>
      {showActions && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await retryProcessTake({ data: { takeId: take.id } });
                toast.success("Retrying analysis");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Retry failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Retry analysis
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await resetTake({ data: { takeId: take.id } });
                toast.success("Cancelled — you can replace the video now.");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Cancel failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// Server attaches a deterministic submission_verdict to the report. These
// helpers are local fallbacks (older takes pre-dating the verdict logic
// won't have one persisted) and styling lookups.
function deriveVerdictLabel(overall: number | null): string {
  const o = overall ?? 0;
  if (o >= 85) return "Strong for this level";
  if (o >= 75) return "Ready to submit";
  if (o >= 65) return "Worth another take";
  return "Not ready yet";
}

function verdictTone(label: string | undefined): string {
  switch (label) {
    // "Strong submit" kept for backwards-compat with legacy persisted takes.
    case "Strong submit":
    case "Strong for this level":
      return "text-success";
    case "Ready to submit":
      return "text-success";
    case "Worth another take":
      return "text-warning";
    case "Not ready yet":
      return "text-destructive";
    default:
      return "text-foreground";
  }
}


// Translates the underlying confidence + signal data into a friendly,
// non-technical trust indicator. Never surfaces the numeric score or
// "AI confidence" wording — users see one of three plain-language labels
// plus a one-line explanation that names the actual contributing factors
// (brief, audio, video quality, performance completeness).
function buildTrustIndicator(
  confidence: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  take: Take,
): { label: "Very reliable" | "Mostly reliable" | "Take with caution"; reason: string; tone: string } {
  const audio = report?.scores?.audio ?? null;
  const technical = report?.scores?.technical ?? null;
  const briefAdherence = report?.scores?.brief_adherence ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signals = (take as any).signals as
    | { duration?: number; audio_peak?: number }
    | null
    | undefined;
  const hasBrief = report?.mode === "brief";
  const components = Array.isArray(report?.detected_components) ? report.detected_components : [];
  const hasFullPerformance =
    components.length > 0 && (signals?.duration ?? 0) >= 15 && briefAdherence === null
      ? true
      : (signals?.duration ?? 0) >= 15;

  const positives: string[] = [];
  const concerns: string[] = [];

  if (hasBrief) positives.push("a casting brief to compare against");
  else concerns.push("no casting brief was provided");

  if (audio != null) {
    if (audio >= 75) positives.push("clear audio");
    else if (audio >= 50) concerns.push("audio that's a little muddy in places");
    else concerns.push("muffled or noisy audio");
  }

  if (technical != null) {
    if (technical >= 75) positives.push("good video quality");
    else if (technical < 50) concerns.push("video quality that made parts hard to read");
  }

  if (!hasFullPerformance) concerns.push("a short or partial performance");

  let label: "Very reliable" | "Mostly reliable" | "Take with caution";
  let tone: string;
  if (confidence >= 85 && concerns.length === 0) {
    label = "Very reliable";
    tone = "text-success";
  } else if (confidence >= 65 && concerns.length <= 1) {
    label = "Mostly reliable";
    tone = "text-foreground";
  } else {
    label = "Take with caution";
    tone = "text-warning";
  }

  // Build a single warm sentence from the strongest signal.
  let reason: string;
  if (label === "Very reliable") {
    const lead = positives.slice(0, 2).join(" and ") || "a clean tape all round";
    reason = `Based on ${lead} — you can lean into the feedback below.`;
  } else if (label === "Mostly reliable") {
    if (concerns.length > 0) {
      reason = `Solid read overall, but ${concerns[0]} — weigh the notes accordingly.`;
    } else {
      const lead = positives[0] ?? "a generally clean tape";
      reason = `Based on ${lead} — the feedback below is a fair guide.`;
    }
  } else {
    const lead = concerns.slice(0, 2).join(" and ") || "limited information to work from";
    reason = `Heads up: ${lead}. Treat the feedback as a directional steer rather than the final word.`;
  }

  return { label, reason, tone };
}

function TakeView({ take }: { take: Take }) {
  if (take.status === "pending" || take.status === "processing") {
    return <ProcessingTakeView take={take} />;
  }

  if (take.status === "error") {
    return <FailedTakeView take={take} />;
  }

  const r = take.report;
  if (!r) return null;

  const confidence = take.confidence ?? r.confidence ?? 0;
  const trust = buildTrustIndicator(confidence, r, take);

  const categories: { key: string; label: string }[] = [
    { key: "vocal", label: "Vocal" },
    { key: "acting", label: "Acting" },
    { key: "audio", label: "Audio" },
    { key: "technical", label: "Technical" },
    { key: "brief_adherence", label: r.mode === "brief" ? "Brief fit" : "Standards" },
    { key: "professional_presentation", label: "Professional presentation" },
  ];

  const components: Array<{ type: string; weight: number; score: number; note: string }> =
    Array.isArray(r.detected_components) ? r.detected_components : [];
  const showComponents = components.length > 1;

  const brk = r.brief_adherence_breakdown as
    | {
        material_compliance: number;
        technical_compliance: number;
        instruction_precision: number;
        professionalism_signals: number;
        note?: string;
      }
    | undefined;

  const riskFlags: Array<{ severity: "low" | "medium" | "high"; flag: string }> = Array.isArray(
    r.submission_risk_flags,
  )
    ? r.submission_risk_flags
    : [];

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="rounded-2xl border border-border bg-card p-8 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Casting headline
        </p>
        <p className="mt-2 font-display text-2xl font-semibold leading-snug tracking-tight">
          {r.casting_headline}
        </p>
        {r.casting_insight && (
          <p className="mt-3 text-sm text-muted-foreground">{r.casting_insight}</p>
        )}
        <div className="mt-6 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Verdict</p>
            <p
              className={cn(
                "mt-1 font-display text-xl font-semibold",
                verdictTone(r.verdict_final ?? r.submission_verdict?.label),
              )}
            >
              {r.verdict_final ?? r.submission_verdict?.label ?? deriveVerdictLabel(take.overall_score)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Overall</p>
            <p className="font-display text-5xl font-bold leading-none text-primary">
              {r.overall_score_final ?? take.overall_score}
            </p>
          </div>
        </div>
        {r.submission_verdict?.reason && (
          <p className="mt-2 text-sm text-muted-foreground">{r.submission_verdict.reason}</p>
        )}

        {/* Block reasons — explicit, user-facing */}
        {Array.isArray(r.block_reasons) && r.block_reasons.length > 0 && (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning">
              Why this isn't ready
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {r.block_reasons.map((reason: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-warning">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.extraction_confidence === "low" && (
          <p className="mt-3 text-xs text-muted-foreground">
            We may have misread parts of the brief — please review key details before relying on
            brief-fit feedback.
          </p>
        )}

        <div className="mt-5 rounded-md border border-border bg-secondary/30 p-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                trust.tone === "text-success"
                  ? "bg-success"
                  : trust.tone === "text-warning"
                    ? "bg-warning"
                    : "bg-primary",
              )}
            />
            <p className={cn("text-sm font-semibold", trust.tone)}>{trust.label}</p>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{trust.reason}</p>
        </div>
        {r.at_risk && (!Array.isArray(r.block_reasons) || r.block_reasons.length === 0) && (
          <div className="mt-5 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
            <p>This tape is flagged <strong>at risk</strong> — a brief requirement appears to be missing.</p>
          </div>
        )}
      </div>

      {/* Submission risk flags */}
      {riskFlags.length > 0 && (
        <div className="rounded-2xl border border-warning/40 bg-warning/5 p-6">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warning" />
            <h3 className="font-display text-base font-semibold">Submission risk</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Casting-compliance issues that could cause rejection.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {riskFlags.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
                    f.severity === "high"
                      ? "bg-destructive"
                      : f.severity === "medium"
                        ? "bg-warning"
                        : "bg-muted-foreground",
                  )}
                />
                <span>
                  <span className="mr-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {f.severity}
                  </span>
                  {f.flag}
                </span>
              </li>
            ))}
          </ul>
          {Array.isArray(r.casting_risk_explanations) && r.casting_risk_explanations.length > 0 && (
            <div className="mt-5 space-y-3 border-t border-warning/30 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                What this means for casting
              </p>
              {(r.casting_risk_explanations as Array<{
                flag: string;
                casting_impact: string;
                recall_impact: "unlikely_to_affect" | "may_reduce" | "likely_to_block";
              }>).map((e, i) => {
                const recallLabel =
                  e.recall_impact === "likely_to_block"
                    ? "Likely to block recall"
                    : e.recall_impact === "may_reduce"
                      ? "May reduce recall chances"
                      : "Unlikely to affect recall";
                const recallTone =
                  e.recall_impact === "likely_to_block"
                    ? "text-destructive"
                    : e.recall_impact === "may_reduce"
                      ? "text-warning"
                      : "text-muted-foreground";
                return (
                  <div key={i} className="text-sm">
                    <p className="font-medium">{e.flag}</p>
                    <p className="mt-0.5 text-muted-foreground">{e.casting_impact}</p>
                    <p className={cn("mt-0.5 text-xs font-medium", recallTone)}>{recallLabel}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Role fit (only when brief mode and notes present) */}
      {r.mode === "brief" && typeof r.role_fit_notes === "string" && r.role_fit_notes.trim() && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-baseline justify-between gap-4">
            <h3 className="font-display text-base font-semibold">Role fit</h3>
            <div className="flex items-center gap-3 text-xs">
              {typeof r.role_fit_modifier === "number" && r.role_fit_modifier !== 0 && (
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    r.role_fit_modifier > 0 ? "text-success" : "text-warning",
                  )}
                >
                  {r.role_fit_modifier > 0 ? "+" : ""}
                  {r.role_fit_modifier} to overall
                </span>
              )}
              {r.role_fit_confidence && (
                <span className="text-muted-foreground">
                  confidence: {r.role_fit_confidence}
                </span>
              )}
            </div>
          </div>
          <p className="mt-2 text-sm text-foreground">{r.role_fit_notes}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Role fit reflects alignment with the role's function and tone — never likeness or
            appearance.
          </p>
        </div>
      )}

      {/* Presentation notes — practical, optional, non-personal. Do not affect the score. */}
      {Array.isArray(r.presentation_notes) && r.presentation_notes.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">Presentation notes</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Practical camera-readability tips. These do not affect your score.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {(r.presentation_notes as string[]).map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Component breakdown (multi-part auditions) */}
      {showComponents && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-lg font-semibold">Component breakdown</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            This tape contains multiple performance components. Each is scored separately.
          </p>
          <div className="mt-5 space-y-4">
            {components.map((c, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium capitalize">
                    {c.type.replace(/_/g, " ")}
                    <span className="ml-2 text-xs text-muted-foreground">
                      weight {Math.round(c.weight * 100)}%
                    </span>
                  </span>
                  <span className="font-display text-lg font-semibold tabular-nums">{c.score}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${c.score}%` }}
                  />
                </div>
                {c.note && <p className="mt-1.5 text-xs text-muted-foreground">{c.note}</p>}
              </div>
            ))}
          </div>
          {typeof r.consistency_modifier === "number" && r.consistency_modifier !== 0 && (
            <p className="mt-5 text-xs text-muted-foreground">
              Cross-component consistency: {r.consistency_modifier > 0 ? "+" : ""}
              {r.consistency_modifier}
            </p>
          )}
        </div>
      )}

      {/* Categories */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Category breakdown</h2>
        <div className="mt-5 space-y-4">
          {categories.map((c) => {
            const score = r.scores?.[c.key];
            if (score == null) return null;
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="font-display text-lg font-semibold tabular-nums">{score}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${score}%` }}
                  />
                </div>
                {r.category_notes?.[c.key] && (
                  <p className="mt-1.5 text-xs text-muted-foreground">{r.category_notes[c.key]}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Brief adherence breakdown */}
      {brk && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">
            {r.mode === "brief" ? "Brief adherence breakdown" : "Professional standards breakdown"}
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              { key: "material_compliance", label: "Material compliance", weight: "35%" },
              { key: "technical_compliance", label: "Technical compliance", weight: "35%" },
              { key: "instruction_precision", label: "Instruction precision", weight: "20%" },
              { key: "professionalism_signals", label: "Professionalism", weight: "10%" },
            ].map((sub) => {
              const v = brk[sub.key as keyof typeof brk] as number | undefined;
              if (typeof v !== "number") return null;
              return (
                <div key={sub.key} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium">{sub.label}</span>
                    <span className="text-xs text-muted-foreground">{sub.weight}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-xl font-semibold tabular-nums">{v}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${v}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {brk.note && <p className="mt-4 text-xs text-muted-foreground">{brk.note}</p>}
        </div>
      )}

      {/* Fix first */}
      {r.fix_first && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
          <p className="text-xs font-medium uppercase tracking-wider text-primary">Fix this first</p>
          <p className="mt-2 text-base font-medium text-foreground">{r.fix_first}</p>
        </div>
      )}

      {/* Strengths + improvements */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">Top strengths</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {r.strengths?.map((s: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-success">+</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">Top improvements (in order)</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {r.improvements?.map((s: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">→</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Timestamps */}
      {r.timestamped_notes?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">Timestamped notes</h3>
          <ul className="mt-4 space-y-3 text-sm">
            {r.timestamped_notes.map(
              (n: { timestamp: string; note: string }, i: number) => (
                <li key={i} className="flex gap-4 border-b border-border pb-3 last:border-0">
                  <span className="font-mono text-xs tabular-nums text-primary">{n.timestamp}</span>
                  <span className="flex-1 text-foreground">{n.note}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {/* Drills */}
      {r.coaching_drills?.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <h3 className="font-display text-base font-semibold">Next take plan</h3>
          <ul className="mt-3 space-y-2 text-sm">
            {r.coaching_drills.map((d: string, i: number) => (
              <li key={i} className="flex gap-2">
                <span className="text-muted-foreground">•</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Signals */}
      {take.checklist && (
        <details className="rounded-2xl border border-border bg-card p-6 shadow-soft">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
            Show technical signals
          </summary>
          <div className="mt-4">
            <ChecklistView checklist={take.checklist} briefSource="none" />
          </div>
        </details>
      )}
    </div>
  );
}

function CompareView({ takes }: { takes: Take[] }) {
  const cats: { key: string; label: string }[] = [
    { key: "overall", label: "Overall" },
    { key: "confidence", label: "Confidence" },
    { key: "vocal", label: "Vocal" },
    { key: "acting", label: "Acting" },
    { key: "audio", label: "Audio" },
    { key: "technical", label: "Technical" },
    { key: "brief_adherence", label: "Brief / standards" },
  ];

  const best = [...takes].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold">Compare takes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Best take: <strong>Take {best.take_number}</strong> — {best.report?.casting_headline}
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 font-medium">Metric</th>
              {takes.map((t) => (
                <th key={t.id} className="py-2 text-right font-medium">
                  Take {t.take_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.key} className="border-b border-border last:border-0">
                <td className="py-3 font-medium">{c.label}</td>
                {takes.map((t) => {
                  let val: number | null = null;
                  if (c.key === "overall") val = t.overall_score;
                  else if (c.key === "confidence") val = t.confidence;
                  else val = t.scores?.[c.key] ?? null;
                  return (
                    <td key={t.id} className="py-3 text-right tabular-nums">
                      {val ?? "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AddTakeBlock({
  audition,
  nextNumber,
  onCancel,
  onUploaded,
}: {
  audition: Audition;
  nextNumber: number;
  onCancel: () => void;
  onUploaded: () => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const takeIdRef = useRef<string | null>(null);

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function pick(f: File | null) {
    setFile(f);
    setChecklist(null);
    if (!f) return;
    try {
      setChecklist(await analyzeVideoFile(f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read this video");
    }
  }

  async function upload() {
    if (!file || !user) return;

    if (checklist) {
      const pf = preflightVideoBasics(file, checklist.duration.seconds, checklist.audio.peak);
      if (!pf.ok) {
        toast.error(pf.error ?? "Video failed pre-upload checks");
        return;
      }
      if (pf.warning) toast.warning(pf.warning);
    }

    setBusy(true);
    setUploadPct(0);
    try {
      const signals = checklist
        ? {
            orientation: checklist.orientation.value,
            width: checklist.resolution.width,
            height: checklist.resolution.height,
            duration: checklist.duration.seconds,
            brightness: checklist.brightness.value,
            audio_peak: checklist.audio.peak,
            audio_rms: checklist.audio.rms,
          }
        : null;
      const { data: take, error: takeErr } = await supabase
        .from("takes")
        .insert([
          {
            audition_id: audition.id,
            user_id: user.id,
            take_number: nextNumber,
            video_path: null,
            status: "pending",
            mux_status: "uploading",
            processing_phase: "uploading",
            signals: signals as never,
            checklist: (checklist ?? null) as never,
          },
        ])
        .select("id")
        .single();
      if (takeErr || !take) throw takeErr ?? new Error("Could not create take");
      takeIdRef.current = take.id;

      const { uploadUrl } = await createMuxDirectUpload({ data: { takeId: take.id } });
      if (!uploadUrl) throw new Error("Could not get an upload URL");
      const controller = new AbortController();
      abortRef.current = controller;
      await uploadFileToMux(uploadUrl, file, setUploadPct, controller.signal);

      toast.success(`Take ${nextNumber} uploaded — optimising and analysing now`);
      onUploaded();
    } catch (err) {
      if (err instanceof UploadCancelledError) {
        toast.message("Upload cancelled");
        if (takeIdRef.current) {
          resetTake({ data: { takeId: takeIdRef.current } }).catch(() => {});
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      }
    } finally {
      setBusy(false);
      setUploadPct(0);
      abortRef.current = null;
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-secondary/40 p-6">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">Add take {nextNumber}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Same brief, same scoring weights — easy to compare.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> {file ? "Change" : "Choose file"}
        </Button>
        {file && (
          <span className="truncate text-sm text-muted-foreground">
            {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
          </span>
        )}
      </div>
      {busy && uploadPct > 0 && uploadPct < 100 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-muted-foreground">Uploading…</span>
            <span className="tabular-nums font-medium">{uploadPct}%</span>
          </div>
          <Progress value={uploadPct} />
        </div>
      )}
      {checklist && (
        <div className="mt-4">
          <ChecklistView checklist={checklist} briefSource={audition.brief_source} />
        </div>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Close
        </Button>
        {busy && uploadPct < 100 && (
          <Button variant="ghost" onClick={cancelUpload}>
            <X className="mr-2 h-4 w-4" /> Cancel upload
          </Button>
        )}
        <Button onClick={upload} disabled={!file || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Upload take {nextNumber}
        </Button>
      </div>
    </div>
  );
}
