import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, ShieldAlert, Trash2, Upload, Video, X } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { ChecklistView } from "@/components/checklist-view";
import { AccountCompliancePanel } from "@/components/account-compliance-panel";
import { CreditUseNotice } from "@/components/credit-balance-panel";
import { VideoDurationNotice } from "@/components/video-duration-notice";
import { ConfirmDestructive } from "@/components/confirm-destructive";
import { UploadPolicyNotice } from "@/components/legal-policy-links";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AUDITION_DISCIPLINES,
  AUDITION_DISCIPLINE_LABELS,
  isAuditionDiscipline,
  type AuditionDiscipline,
} from "@/lib/audition-rules";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAccountCompliance } from "@/lib/account-compliance-client";
import { analyzeVideoFile, type ChecklistResult } from "@/lib/checklist";
import {
  buildUploadIdentityMetadata,
  preflightVideoBasics,
  uploadFileToMux,
  UploadCancelledError,
} from "@/lib/mux-upload";
import {
  buildVideoDurationDecision,
  buildVideoDurationSignals,
  VIDEO_DURATION_SUPPORT_EMAIL,
  type VideoDurationEventName,
  type VideoDurationStatus,
} from "@/lib/video-duration-policy";
import {
  retryProcessTake,
  resetTake,
  resetTakeForReupload,
} from "@/server-fns/process-take.functions";
import { deleteTake, deleteAudition } from "@/server-fns/delete.functions";
import { createMuxDirectUpload } from "@/server-fns/mux.functions";
import { trackVideoDurationUploadEvent } from "@/server-fns/video-duration-events.functions";
import { describeUploadError } from "@/lib/upload-errors";
import { cn } from "@/lib/utils";
import { brandTitle } from "@/config/brand";
import { readReportSchemaVersion } from "@/lib/report-schema";
import { V2ReportView } from "@/components/report/V2ReportView";
import {
  buildAnalyticsAttributionMetadata,
  readStoredAnalyticsAttribution,
  trackAnalyticsEvent,
} from "@/lib/analytics-attribution";
import {
  activeS10TakeVersions,
  buildS10TakeAnalysisRunId,
  nextS10TakeSlot,
} from "@/lib/take-lifecycle";

// Public-safe headline picker for v1 + v2 reports. Mirrors the server-side
// helper in `report-output-enforcement.server.ts` (kept local to avoid
// importing a `.server` module into the client bundle).
function pickHeadline(report: unknown): string | null {
  if (!report || typeof report !== "object") return null;
  const r = report as Record<string, unknown>;
  for (const k of ["casting_headline", "headline", "casting_insight", "insight"]) {
    const v = r[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

type VideoDurationUploadSurface = "add_take_upload" | "replace_failed_take";

function recordVideoDurationEvent(
  eventName: VideoDurationEventName,
  durationSeconds: number,
  durationStatus: VideoDurationStatus,
  surface: VideoDurationUploadSurface,
) {
  void trackVideoDurationUploadEvent({
    data: {
      eventName,
      durationSeconds,
      durationStatus,
      surface,
    },
  }).catch(() => {});
}

async function buildTakeUploadSignals(file: File, checklist: ChecklistResult | null) {
  if (!checklist) {
    return { upload_identity: await buildUploadIdentityMetadata(file, null) };
  }

  return {
    orientation: checklist.orientation.value,
    width: checklist.resolution.width,
    height: checklist.resolution.height,
    duration: checklist.duration.seconds,
    ...buildVideoDurationSignals(checklist.duration.seconds),
    brightness: checklist.brightness.value,
    audio_peak: checklist.audio.peak,
    audio_rms: checklist.audio.rms,
    upload_identity: await buildUploadIdentityMetadata(file, checklist.duration.seconds),
  };
}

export const Route = createFileRoute("/audition/$auditionId")({
  head: () => ({ meta: [{ title: brandTitle("Audition") }] }),
  component: AuditionPage,
});

interface Take {
  id: string;
  take_number: number;
  take_slot: number | null;
  take_version_number: number | null;
  take_version_status: string | null;
  replaces_take_id: string | null;
  replaced_by_take_id: string | null;
  replacement_reason: string | null;
  analysis_run_id: string | null;
  report_model_status: string | null;
  qa_artifact_status: string | null;
  manifest_status: string | null;
  same_video_status: string | null;
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
  /** ARCH-Δ2: user-selected discipline. NULL only on legacy pre-Δ2 auditions. */
  discipline?: AuditionDiscipline | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extracted_brief?: any;
}

function AuditionPage() {
  const { auditionId } = Route.useParams();
  const { user, loading } = useAuth();
  const compliance = useAccountCompliance(user);
  const navigate = useNavigate();
  const [audition, setAudition] = useState<Audition | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [activeTakeId, setActiveTakeId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  // refresh() is held in a ref so visibility/focus listeners always call the
  // latest closure without re-binding listeners on every render.
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  async function refresh(reason: string = "poll") {
    const { data: aud } = await supabase
      .from("auditions")
      .select("id, title, brief, brief_source, mode, audition_level, discipline, extracted_brief")
      .eq("id", auditionId)
      .single();
    if (aud) setAudition(aud as Audition);
    const { data: ts } = await supabase
      .from("takes")
      .select("*")
      .eq("audition_id", auditionId)
      .order("take_number");
    if (ts) {
      const allVersions = ts as Take[];
      const next = activeS10TakeVersions(allVersions);
      setTakes(next);
      if ((!activeTakeId || !next.some((take) => take.id === activeTakeId)) && next.length) {
        setActiveTakeId(next[next.length - 1].id);
      }
      // Lightweight observability — confirms the UI received DB truth and
      // detects stuck-tab scenarios. No PII, no payload contents.
      const anyTerminal = next.some((t) => t.status === "error" || t.status === "complete");
      console.log("ui_poll_refresh", {
        reason,
        takes: next.length,
        take_versions: allVersions.length,
        statuses: next.map((t) => t.status),
        any_terminal: anyTerminal,
      });
    }
  }
  refreshRef.current = () => refresh("ref");

  useEffect(() => {
    if (!user) return;
    refresh("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, auditionId]);

  // Poll while any take is processing.
  // Keyed on a stable signature (ids + statuses) rather than the full takes
  // array so unrelated state changes don't re-create the interval, but a
  // genuine status flip immediately tears it down.
  const processingSignature = takes
    .filter((t) => t.status === "processing" || t.status === "pending")
    .map((t) => t.id)
    .sort()
    .join(",");
  useEffect(() => {
    if (!user) return;
    if (!processingSignature) return;
    const id = setInterval(() => {
      void refreshRef.current();
    }, 4000);
    return () => clearInterval(id);
  }, [processingSignature, user]);

  // Revalidate on tab focus / visibility change. Browsers throttle or freeze
  // setInterval in backgrounded tabs, so a tab that was open while the
  // server flipped the take to terminal can sit on stale "Preparing
  // analysis" copy indefinitely. Re-fetching on focus collapses that gap.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRef.current();
      }
    };
    const onFocus = () => {
      void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  // Stale-tab watchdog: if any take has been locally "processing" for more
  // than 12 minutes, force a server revalidation. The reconciler's hard
  // ceiling is 10 minutes, so by 12 minutes the DB must show a terminal
  // state; if the UI doesn't reflect that, our local view is stale.
  useEffect(() => {
    if (!user) return;
    if (!processingSignature) return;
    const STALE_THRESHOLD_MS = 12 * 60 * 1000;
    const id = setInterval(() => {
      const stale = takes.some((t) => {
        if (t.status !== "pending" && t.status !== "processing") return false;
        const age = Date.now() - new Date(t.created_at).getTime();
        return age >= STALE_THRESHOLD_MS;
      });
      if (stale) {
        console.warn("ui_stale_processing_revalidated", {
          processing_count: takes.filter((t) => t.status === "pending" || t.status === "processing")
            .length,
        });
        void refreshRef.current();
      }
    }, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processingSignature, user]);

  // One-shot terminal-state log. Fires when the UI first observes any take
  // becoming terminal — useful for confirming the polling/revalidation path
  // actually delivered the DB truth to the client.
  const loggedTerminalRef = useRef<Set<string>>(new Set());
  const trackedReportViewRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const t of takes) {
      if (
        (t.status === "error" || t.status === "complete") &&
        !loggedTerminalRef.current.has(t.id)
      ) {
        loggedTerminalRef.current.add(t.id);
        console.log("ui_terminal_state_received", {
          take_id: t.id,
          status: t.status,
          processing_phase: t.processing_phase ?? null,
        });
      }
      if (t.status === "complete" && t.report && !trackedReportViewRef.current.has(t.id)) {
        trackedReportViewRef.current.add(t.id);
        void trackAnalyticsEvent({
          eventName: "report_viewed",
          objectType: "report",
          objectId: t.id,
          auditionId,
          takeId: t.id,
        });
      }
    }
  }, [auditionId, takes]);

  if (!audition) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 text-sm text-muted-foreground">
          Loading…
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (user && !compliance.loading && !compliance.complete) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <PageHeader
          eyebrow="Account route"
          title="Complete account setup"
          subtitle="Complete account setup before uploading or re-running analysis."
          variant="app"
        />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-12">
          <AccountCompliancePanel userId={user.id} onCompleted={compliance.refresh} />
        </main>
        <SiteFooter />
      </div>
    );
  }

  const activeTake = takes.find((t) => t.id === activeTakeId) ?? takes[takes.length - 1];
  const completed = takes.filter((t) => t.status === "complete");
  const nextOpenTakeSlot = nextS10TakeSlot(takes);
  const canAddTake = nextOpenTakeSlot != null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        className="tc-print-exclude"
        eyebrow={`${audition.mode === "brief" ? "Brief-driven" : "Baseline"} mode · ${takes.length} take${takes.length === 1 ? "" : "s"} · max 3`}
        title={audition.title}
        variant="app"
        actions={
          <>
            <Button
              asChild
              variant="secondary"
              className="bg-white/10 text-white hover:bg-white/15"
            >
              <Link to="/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" /> All auditions
              </Link>
            </Button>
            {canAddTake && (
              <Button
                variant="secondary"
                className="bg-white text-foreground hover:bg-white/90"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="mr-2 h-4 w-4" /> Add take
              </Button>
            )}
            <ConfirmDestructive
              title="Delete audition?"
              description={`This will remove "${audition.title}" and all ${takes.length} take${takes.length === 1 ? "" : "s"} (including reports and stored video). This cannot be undone.`}
              confirmLabel="Delete audition"
              trigger={(open) => (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete audition"
                  className="text-white/80 hover:bg-white/10 hover:text-destructive"
                  onClick={open}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              onConfirm={async () => {
                try {
                  await deleteAudition({ data: { auditionId: audition.id } });
                  toast.success("Audition deleted");
                  navigate({ to: "/dashboard" });
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not delete audition");
                }
              }}
            />
          </>
        }
      />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 pb-24 pt-10">
        {showAdd && nextOpenTakeSlot != null && (
          <AddTakeBlock
            audition={audition}
            nextNumber={nextOpenTakeSlot}
            onCancel={() => setShowAdd(false)}
            onUploaded={(newTakeId) => {
              setShowAdd(false);
              // Force the newly-uploaded take to be the active tab so the
              // user sees its pending/processing state, not the previous
              // completed take or the Comparison tab.
              if (newTakeId) setActiveTakeId(newTakeId);
              refresh("after_upload");
            }}
          />
        )}

        {takes.length > 0 && (
          <div className="mt-8">
            {(() => {
              const hasRecommendation = completed.length >= 2;
              const defaultTab = hasRecommendation ? "recommend" : (activeTakeId ?? takes[0].id);
              const tabValue =
                activeTakeId === "recommend" || takes.some((t) => t.id === activeTakeId)
                  ? activeTakeId!
                  : defaultTab;
              return (
                <Tabs value={tabValue} onValueChange={setActiveTakeId}>
                  <TabsList className="tc-print-exclude">
                    {hasRecommendation && <TabsTrigger value="recommend">Comparison</TabsTrigger>}
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
                  </TabsList>

                  {hasRecommendation && (
                    <TabsContent value="recommend" className="mt-6">
                      <RecommendationView
                        takes={completed}
                        onOpenTake={(id) => setActiveTakeId(id)}
                      />
                    </TabsContent>
                  )}

                  {takes.map((t) => (
                    <TabsContent key={t.id} value={t.id} className="mt-6">
                      <div className="tc-print-exclude mb-3 flex justify-end">
                        <ConfirmDestructive
                          title="Delete take?"
                          description={`This will remove Take ${t.take_number} and its report. This cannot be undone.`}
                          confirmLabel="Delete take"
                          trigger={(open) => (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={open}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete take
                            </Button>
                          )}
                          onConfirm={async () => {
                            try {
                              await deleteTake({ data: { takeId: t.id } });
                              toast.success(`Take ${t.take_number} deleted`);
                              setTakes((prev) => prev.filter((x) => x.id !== t.id));
                              if (activeTakeId === t.id) setActiveTakeId(null);
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Could not delete take",
                              );
                            }
                          }}
                        />
                      </div>
                      <TakeView
                        take={t}
                        audition={audition}
                        isSoleTake={completed.length <= 1}
                        onReplacementUploaded={(newTakeId) => {
                          if (newTakeId) setActiveTakeId(newTakeId);
                          refresh("after_replacement_upload");
                        }}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              );
            })()}
          </div>
        )}

        {!activeTake && <p className="mt-10 text-sm text-muted-foreground">No takes yet.</p>}
      </main>
      <SiteFooter />
    </div>
  );
}

// Stage thresholds for the analysis-stage UX. The system owns retries — the
// user only ever sees a Cancel button while processing. Long-wait copy
// escalates with elapsed time but never asks the user to act.
const TIER_REASSURE_SECONDS = 45;
const TIER_LONG_WAIT_SECONDS = 180; // 3 min
const TIER_VERY_LONG_WAIT_SECONDS = 360; // 6 min

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

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

// FailedTakeView only renders for takes that have actually failed
// (status = "error"). Try again is the user's recovery surface here.
function FailedTakeView({
  take,
  onReplacementUploaded,
}: {
  take: Take;
  onReplacementUploaded?: (newTakeId?: string) => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

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

      if (checklist) {
        const durationDecision = buildVideoDurationDecision(checklist.duration.seconds);
        if (!durationDecision.canUpload) {
          recordVideoDurationEvent(
            "video_duration_hard_cap_blocked",
            durationDecision.durationSeconds,
            durationDecision.status,
            "replace_failed_take",
          );
          toast.error(
            `${durationDecision.message ?? "This video is over TapeCoach's upload limit."} ${VIDEO_DURATION_SUPPORT_EMAIL}`,
          );
          return;
        }
        if (durationDecision.requiresAcknowledgement) {
          recordVideoDurationEvent(
            "video_duration_warning_shown",
            durationDecision.durationSeconds,
            durationDecision.status,
            "replace_failed_take",
          );
          const proceed = window.confirm(
            `${durationDecision.message}\n\nContinue with this video?`,
          );
          if (!proceed) return;
          recordVideoDurationEvent(
            "video_duration_warning_accepted",
            durationDecision.durationSeconds,
            durationDecision.status,
            "replace_failed_take",
          );
        }

        const pf = preflightVideoBasics(f, checklist.duration.seconds, checklist.audio.peak);
        if (!pf.ok) {
          toast.error(pf.error ?? "Video failed pre-upload checks");
          return;
        }
        if (pf.warning && pf.durationStatus !== "over_soft_guidance") toast.warning(pf.warning);
      }

      const signals = await buildTakeUploadSignals(f, checklist);

      const replacement = await resetTakeForReupload({
        data: { takeId: take.id, signals, checklist },
      });
      const replacementTakeId = replacement.replacementTakeId;
      let uploadUrl: string | undefined;
      try {
        const res = await createMuxDirectUpload({ data: { takeId: replacementTakeId } });
        uploadUrl = res.uploadUrl;
      } catch (err) {
        const info = describeUploadError(err);
        throw new Error(info.message);
      }
      if (!uploadUrl)
        throw new Error("Video service did not return an upload URL. Please try again.");
      await uploadFileToMux(uploadUrl, f);
      toast.success("Replacement uploaded — optimising and analysing now");
      onReplacementUploaded?.(replacementTakeId);
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
        <p className="font-medium">Couldn't complete this analysis</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {take.error_message ??
          "We couldn't complete this attempt. Try again without re-uploading if your video is already saved."}
      </p>
      <UploadPolicyNotice className="mt-3" />
      <CreditUseNotice className="mt-4" enabled={Boolean(user)} replacement />
      <div className="mt-5 flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/*"
          className="hidden"
          onChange={(e) => onReplace(e.target.files?.[0] ?? null)}
        />
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retryProcessTake({ data: { takeId: take.id } });
              toast.success("Trying again");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Try again failed");
            } finally {
              setBusy(false);
            }
          }}
          title="We couldn't complete this attempt. Try again without re-uploading if your video is already saved."
        >
          Try again
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          Replace video
        </Button>
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

// 6-stage state machine for the take pipeline. Mapped from the
// `processing_phase` column the server writes at each transition.
const STAGES = [
  { key: "uploading", label: "Uploading your tape" },
  { key: "transcoding", label: "Optimising video" },
  { key: "analysis_pending", label: "Preparing analysis" },
  { key: "analysing", label: "Watching your tape" },
  { key: "writing", label: "Writing your report" },
  { key: "finalising", label: "Finalising results" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function stageIndexFor(phase: string, analysisElapsed: number): number {
  if (phase === "uploading") return 0;
  if (phase === "transcoding") return 1;
  if (phase === "analysis_pending") return 2;
  if (phase === "finalising") return 5;
  if (analysisElapsed >= 90) return 5;
  if (analysisElapsed >= TIER_REASSURE_SECONDS) return 4;
  return 3;
}

function StageList({ activeIdx }: { activeIdx: number }) {
  return (
    <ol className="mx-auto mt-6 max-w-sm space-y-1.5 text-left">
      {STAGES.map((s, i) => (
        <li key={s.key}>
          <PhaseStep label={s.label} active={i === activeIdx} done={i < activeIdx} />
        </li>
      ))}
    </ol>
  );
}

function ProcessingTakeView({ take }: { take: Take }) {
  const elapsed = useElapsedSeconds(take.created_at);
  const phase = (take.processing_phase ?? "uploading") as StageKey | string;
  const [busy, setBusy] = useState(false);

  const analysisElapsed = phase === "analysing" || phase === "analysis_pending" ? elapsed : 0;
  const activeIdx = stageIndexFor(phase, analysisElapsed);

  // Per-stage copy. The system owns retries — copy is reassuring at every
  // tier and never implies the user needs to act.
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

  // Long-wait reassurance copy (never asks the user to act).
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
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft sm:p-10">
      <ProcessingHero stage={phase} />
      <p className="mt-6 font-display text-lg font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        Elapsed: {formatElapsed(elapsed)}
      </p>
      <StageList activeIdx={activeIdx} />

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
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await resetTake({ data: { takeId: take.id } });
              toast.success("Cancelled — you can return to your audition.");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Cancel failed");
            } finally {
              setBusy(false);
            }
          }}
          className="text-destructive hover:text-destructive"
          title="Stop this attempt and return to your audition."
        >
          Cancel analysis
        </Button>
      </div>
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

// Plain-English banding for any 0–100 score. Display-only — does not change
// any threshold used by the scoring engine.
function scoreBand(score: number | null | undefined): {
  label: string;
  blurb: string;
  tone: string;
} {
  if (score == null) {
    return {
      label: "Not scored",
      blurb: "Not enough signal to score this area.",
      tone: "text-muted-foreground",
    };
  }
  if (score >= 90)
    return {
      label: "Submission-ready",
      blurb: "Meets a professional bar — send as-is.",
      tone: "text-success",
    };
  if (score >= 80)
    return {
      label: "Strong, refine if time",
      blurb: "Solid work; small polish would lift it further.",
      tone: "text-success",
    };
  if (score >= 70)
    return {
      label: "Usable, but needs work",
      blurb: "Reads on tape, but has noticeable rough edges.",
      tone: "text-warning",
    };
  return {
    label: "Re-record recommended",
    blurb: "Below the bar for a confident submission.",
    tone: "text-destructive",
  };
}

// Brief-fit specific phrasing — same numeric bands, casting-language labels.
function briefFitBand(score: number | null | undefined): {
  label: string;
  blurb: string;
  tone: string;
} {
  if (score == null)
    return {
      label: "Not assessed",
      blurb: "No brief to align against.",
      tone: "text-muted-foreground",
    };
  if (score >= 90)
    return {
      label: "Fully aligned",
      blurb: "Hits the brief's key requirements clearly.",
      tone: "text-success",
    };
  if (score >= 80)
    return { label: "Mostly aligned", blurb: "On-brief with minor gaps.", tone: "text-success" };
  if (score >= 70)
    return {
      label: "Partially aligned",
      blurb: "Some brief points missed — check before sending.",
      tone: "text-warning",
    };
  return {
    label: "Off-brief",
    blurb: "Important brief requirements not met.",
    tone: "text-destructive",
  };
}

// Translates the underlying confidence + signal data into a friendly,
// non-technical reliability indicator. Never surfaces the numeric score or
// "AI confidence" wording — users see one of three plain-language tiers
// (High / Medium / Low) plus a one-line "Why" naming the actual contributing
// factors (brief, audio, video quality, performance completeness).
function buildTrustIndicator(
  confidence: number,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  report: any,
  take: Take,
): {
  label:
    | "Feedback reliability: High"
    | "Feedback reliability: Medium"
    | "Feedback reliability: Low";
  reason: string;
  tone: string;
} {
  const audio = report?.scores?.audio ?? null;
  const technical = report?.scores?.technical ?? null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signals = (take as any).signals as
    | { duration?: number; audio_peak?: number }
    | null
    | undefined;
  const hasBrief = report?.mode === "brief";
  const components = Array.isArray(report?.detected_components) ? report.detected_components : [];
  // Authoritative duration is the server-side Mux duration. Client-supplied
  // signals.duration is a fallback only — it is often missing for completed
  // takes uploaded by older clients, which previously caused a false
  // "performance is short or partial" reliability concern.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const muxDuration = (take as any).mux_duration_seconds as number | null | undefined;
  const effectiveDuration =
    typeof muxDuration === "number" && Number.isFinite(muxDuration) && muxDuration > 0
      ? muxDuration
      : (signals?.duration ?? 0);
  // Treat as a full performance when the tape is at least 60s long AND at
  // least one component was detected. Below 60s a tape may legitimately be
  // a slate-only or partial submission.
  const hasFullPerformance = effectiveDuration >= 60 && components.length > 0;

  const positives: string[] = [];
  const concerns: string[] = [];

  if (hasBrief) positives.push("a casting brief was provided");
  else concerns.push("no casting brief was provided");

  if (audio != null) {
    if (audio >= 75) positives.push("clear audio");
    else if (audio >= 50) concerns.push("audio is a little muddy in places");
    else concerns.push("audio is muffled or noisy");
  }

  if (technical != null) {
    if (technical >= 75) positives.push("good video quality");
    else if (technical < 50) concerns.push("video quality made parts hard to read");
  }

  if (!hasFullPerformance) concerns.push("the performance is short or partial");

  let label:
    | "Feedback reliability: High"
    | "Feedback reliability: Medium"
    | "Feedback reliability: Low";
  let tone: string;

  // Server-side override (preferred). The server has authoritative duration,
  // evidence_sufficiency and confidence and can correct mismatches that the
  // client-side computation would otherwise produce (e.g. a spurious
  // "performance is short or partial" downgrade for a complete tape).
  const override =
    typeof report?.feedback_reliability_override === "string"
      ? report.feedback_reliability_override
      : null;
  if (override === "high") {
    label = "Feedback reliability: High";
    tone = "text-success";
    // Drop the spurious concern so the "Why" line is grounded.
    const idx = concerns.indexOf("the performance is short or partial");
    if (idx >= 0) concerns.splice(idx, 1);
  } else if (override === "medium") {
    label = "Feedback reliability: Medium";
    tone = "text-foreground";
  } else if (override === "low") {
    label = "Feedback reliability: Low";
    tone = "text-warning";
  } else if (confidence >= 85 && concerns.length === 0) {
    label = "Feedback reliability: High";
    tone = "text-success";
  } else if (confidence >= 65 && concerns.length <= 1) {
    label = "Feedback reliability: Medium";
    tone = "text-foreground";
  } else {
    label = "Feedback reliability: Low";
    tone = "text-warning";
  }

  // Build a single "Why: …" sentence from the strongest signals.
  let reason: string;
  if (label === "Feedback reliability: High") {
    const lead = positives.slice(0, 2).join(" and ") || "clear video and audio";
    reason = `Why: ${lead} — you can lean into the feedback below.`;
  } else if (label === "Feedback reliability: Medium") {
    if (concerns.length > 0) {
      reason = `Why: ${concerns[0]} — weigh the notes accordingly.`;
    } else {
      const lead = positives[0] ?? "a generally clean tape";
      reason = `Why: ${lead} — the feedback below is a fair guide.`;
    }
  } else {
    const lead = concerns.slice(0, 2).join(" and ") || "limited information to work from";
    reason = `Why: ${lead}. Treat the feedback as a directional steer rather than the final word.`;
  }

  return { label, reason, tone };
}

function TakeView({
  take,
  audition,
  isSoleTake,
  onReplacementUploaded,
}: {
  take: Take;
  audition: Audition;
  isSoleTake?: boolean;
  onReplacementUploaded?: (newTakeId?: string) => void;
}) {
  if (take.status === "pending" || take.status === "processing") {
    return <ProcessingTakeView take={take} />;
  }

  if (take.status === "error") {
    return <FailedTakeView take={take} onReplacementUploaded={onReplacementUploaded} />;
  }

  const r = take.report;
  if (!r) return null;

  // Phase 3B — schema-version branch. Only "v2-component" routes to the v2
  // renderer; missing/unknown/v1-legacy continues through the existing v1
  // path. Reads via readReportSchemaVersion so renderer source stays clean.
  if (readReportSchemaVersion(r) === "v2-component") {
    return (
      <V2ReportView
        report={r}
        takeNumber={take.take_number}
        takeSlot={take.take_slot}
        takeVersionNumber={take.take_version_number}
        takeVersionStatus={take.take_version_status}
        replacesTakeId={take.replaces_take_id}
        sameVideoStatus={take.same_video_status}
        auditionType={r.audition_type ?? null}
        takeId={take.id}
      />
    );
  }

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

  const readiness = getVerdictLabel(take);
  const ready = isReadyVerdict(readiness);
  const blockers: string[] = Array.isArray(r.block_reasons) ? r.block_reasons : [];
  const recommendation = ready
    ? "Submit this take"
    : blockers.length > 0
      ? "Re-record before submitting"
      : "Refine and consider another take";
  const guidanceReason: string =
    r.submission_verdict?.reason ??
    (ready
      ? "Scores and signals meet the bar for this level — you're good to send."
      : blockers.length > 0
        ? blockers[0]
        : r.fix_first
          ? `Tighten this first: ${r.fix_first}`
          : "A few things to sharpen before this is submission-ready.");

  return (
    <div className="space-y-6">
      {/* Action-first summary — practical decision before the detailed analysis */}
      <div
        className={cn(
          "rounded-2xl border p-7 shadow-soft",
          ready
            ? "border-success/40 bg-success/5"
            : blockers.length > 0
              ? "border-destructive/40 bg-destructive/5"
              : "border-warning/40 bg-warning/5",
        )}
      >
        <div className="flex flex-wrap items-center gap-6 sm:flex-nowrap">
          {/* Dominant overall score — primary signal */}
          <div className="flex shrink-0 flex-col items-center rounded-xl border border-border bg-card/70 px-6 py-4 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Overall score
            </p>
            <p className="mt-1 font-display text-7xl font-bold leading-none text-primary tabular-nums">
              {r.overall_score_final ?? take.overall_score ?? "—"}
            </p>
            <p
              className={cn(
                "mt-2 text-xs font-semibold",
                scoreBand(r.overall_score_final ?? take.overall_score).tone,
              )}
            >
              {scoreBand(r.overall_score_final ?? take.overall_score).label}
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-medium">
                Take {take.take_number}
              </Badge>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Submission guidance
              </p>
            </div>
            <p
              className={cn(
                "mt-2 font-display text-xl font-semibold leading-snug",
                verdictTone(readiness),
              )}
            >
              {recommendation}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{guidanceReason}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Readiness
            </p>
            <p className={cn("mt-1 text-sm font-semibold", verdictTone(readiness))}>{readiness}</p>
          </div>
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Feedback confidence
            </p>
            <p className={cn("mt-1 text-sm font-semibold", trust.tone)}>
              {trust.label.replace("Feedback reliability: ", "")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{trust.reason}</p>
          </div>
          <div className="rounded-md border border-border bg-card/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Fix this first
            </p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {r.fix_first ??
                (ready ? "Nothing critical — you're good to send." : "See improvements below.")}
            </p>
          </div>
        </div>

        {/* Block reasons — explicit, user-facing */}
        {blockers.length > 0 && (
          <div className="mt-5 rounded-md border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-warning">
              Why this isn't ready
            </p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {blockers.map((reason: string, i: number) => (
                <li key={i} className="flex gap-2">
                  <span className="text-warning">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {r.at_risk && blockers.length === 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-warning" />
            <p>
              This tape is flagged <strong>at risk</strong> — a brief requirement appears to be
              missing.
            </p>
          </div>
        )}
        {r.extraction_confidence === "low" && (
          <p className="mt-3 text-xs text-muted-foreground">
            We may have misread parts of the brief — please review key details before relying on
            brief-fit feedback.
          </p>
        )}
      </div>

      {/* Fix this first — primary coaching action, before any detailed breakdown */}
      {r.fix_first && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              1
            </span>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Fix this first
            </p>
          </div>
          <p className="mt-3 font-display text-xl font-semibold leading-snug tracking-tight text-foreground">
            {r.fix_first}
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Why it matters
              </p>
              <p className="mt-1.5 text-sm text-foreground">
                This is the highest-value improvement in this take — addressing it lifts how the
                whole performance reads to a casting eye.
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {ready ? "Before submitting" : "If you re-record"}
              </p>
              <p className="mt-1.5 text-sm text-foreground">
                {ready
                  ? "Before submitting, focus on this one adjustment — a quick pass is enough."
                  : "If you re-record, make this the main adjustment. Hold everything else steady."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sole-take re-record drills (kept; complements the action summary) */}
      {isSoleTake && <SoleTakeDecisionPanel take={take} />}

      {/* Casting headline — interpretive context for the score */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Casting headline
        </p>
        <p className="mt-2 font-display text-xl font-semibold leading-snug tracking-tight">
          {pickHeadline(r) ?? ""}
        </p>
        {r.casting_insight && (
          <p className="mt-3 text-sm text-muted-foreground">{r.casting_insight}</p>
        )}
      </div>

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
              {(
                r.casting_risk_explanations as Array<{
                  flag: string;
                  casting_impact: string;
                  recall_impact: "unlikely_to_affect" | "may_reduce" | "likely_to_block";
                }>
              ).map((e, i) => {
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
                <span className="text-muted-foreground">confidence: {r.role_fit_confidence}</span>
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
            {components.map((c, i) => {
              const band = scoreBand(c.score);
              return (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium capitalize">
                      {c.type.replace(/_/g, " ")}
                      <span className="ml-2 text-xs text-muted-foreground">
                        weight {Math.round(c.weight * 100)}%
                      </span>
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-display text-lg font-semibold tabular-nums">
                        {c.score}
                      </span>
                      <span className={cn("text-xs font-medium", band.tone)}>· {band.label}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  {c.note && <p className="mt-1.5 text-xs text-muted-foreground">{c.note}</p>}
                </div>
              );
            })}
          </div>
          {typeof r.consistency_modifier === "number" && r.consistency_modifier !== 0 && (
            <p className="mt-5 text-xs text-muted-foreground">
              Cross-component consistency: {r.consistency_modifier > 0 ? "+" : ""}
              {r.consistency_modifier}
            </p>
          )}
        </div>
      )}

      {/* Categories — supporting evidence, visually subordinate */}
      <div className="rounded-xl border border-border bg-secondary/20 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Supporting category scores
          </h2>
          <span className="text-[11px] text-muted-foreground">explains the overall</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          These scores explain why the overall lands where it does — they are not separate verdicts.
        </p>
        <div className="mt-4 space-y-3">
          {categories.map((c) => {
            const score = r.scores?.[c.key];
            if (score == null) return null;
            const band =
              c.key === "brief_adherence" && r.mode === "brief"
                ? briefFitBand(score)
                : scoreBand(score);
            return (
              <div key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                  <span className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {score}
                    </span>
                    <span className={cn("text-[11px] font-medium", band.tone)}>· {band.label}</span>
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-muted-foreground/60 transition-all"
                    style={{ width: `${score}%` }}
                  />
                </div>
                {r.category_notes?.[c.key] && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {r.category_notes[c.key]}
                  </p>
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
              const band = scoreBand(v);
              return (
                <div key={sub.key} className="rounded-md border border-border bg-secondary/30 p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium">{sub.label}</span>
                    <span className="text-xs text-muted-foreground">{sub.weight}</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="font-display text-xl font-semibold tabular-nums">{v}</span>
                    <span className={cn("text-xs font-medium", band.tone)}>· {band.label}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          {brk.note && <p className="mt-4 text-xs text-muted-foreground">{brk.note}</p>}
        </div>
      )}

      {/* Fix first — moved up as a prominent coaching card (see above) */}

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
            {r.timestamped_notes.map((n: { timestamp: string; note: string }, i: number) => (
              <li key={i} className="flex gap-4 border-b border-border pb-3 last:border-0">
                <span className="font-mono text-xs tabular-nums text-primary">{n.timestamp}</span>
                <span className="flex-1 text-foreground">{n.note}</span>
              </li>
            ))}
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
            <ChecklistView checklist={take.checklist} briefSource={audition.brief_source} />
          </div>
        </details>
      )}
    </div>
  );
}

function getVerdictLabel(take: Take): string {
  const r = take.report;
  return r?.verdict_final ?? r?.submission_verdict?.label ?? deriveVerdictLabel(take.overall_score);
}

function isReadyVerdict(label: string): boolean {
  return (
    label === "Ready to submit" || label === "Strong for this level" || label === "Strong submit"
  );
}

function SoleTakeDecisionPanel({ take }: { take: Take }) {
  const r = take.report;
  if (!r) return null;
  const verdict = getVerdictLabel(take);
  const ready = isReadyVerdict(verdict);
  const blockers: string[] = Array.isArray(r.block_reasons) ? r.block_reasons : [];
  const fixFirst: string | undefined = r.fix_first;
  const drills: string[] = Array.isArray(r.coaching_drills) ? r.coaching_drills : [];

  const recommendation = ready
    ? "Submit this take."
    : blockers.length > 0
      ? "Re-record before submitting."
      : "Worth another take if time allows.";

  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-soft",
        ready
          ? "border-success/40 bg-success/5"
          : blockers.length > 0
            ? "border-destructive/40 bg-destructive/5"
            : "border-warning/40 bg-warning/5",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Should I submit this?
      </p>
      <p className={cn("mt-2 font-display text-2xl font-semibold", verdictTone(verdict))}>
        {recommendation}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Verdict: {verdict}</p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            What to fix first
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {fixFirst ??
              (ready ? "Nothing critical — you're good to send." : "See improvements below.")}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            If you re-record
          </p>
          {drills.length > 0 ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {drills.slice(0, 3).map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Use the timestamped notes below as your re-record checklist.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationView({
  takes,
  onOpenTake,
}: {
  takes: Take[];
  onOpenTake: (id: string) => void;
}) {
  const ranked = [...takes].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));
  const best = ranked[0];
  const bestVerdict = getVerdictLabel(best);
  const bestReady = isReadyVerdict(bestVerdict);
  const bestBlockers: string[] = Array.isArray(best.report?.block_reasons)
    ? best.report.block_reasons
    : [];

  const recommendation = bestReady
    ? `Submit Take ${best.take_number}.`
    : bestBlockers.length > 0
      ? `Re-record — none of your takes are submission-ready yet.`
      : `Take ${best.take_number} is your strongest, but worth another take if you can.`;

  return (
    <div className="space-y-6">
      {/* Top recommendation */}
      <div
        className={cn(
          "rounded-2xl border p-6 shadow-soft",
          bestReady
            ? "border-success/40 bg-success/5"
            : bestBlockers.length > 0
              ? "border-destructive/40 bg-destructive/5"
              : "border-warning/40 bg-warning/5",
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Which take should I choose?
        </p>
        <p className={cn("mt-2 font-display text-2xl font-semibold", verdictTone(bestVerdict))}>
          {recommendation}
        </p>
        {(() => {
          const h = pickHeadline(best.report);
          return h ? <p className="mt-2 text-sm text-muted-foreground">"{h}"</p> : null;
        })()}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onOpenTake(best.id)}>
            Open Take {best.take_number} notes
          </Button>
        </div>
      </div>

      {/* Ranked list */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
        <h2 className="font-display text-lg font-semibold">Ranked takes</h2>
        <ul className="mt-4 space-y-3">
          {ranked.map((t, i) => {
            const v = getVerdictLabel(t);
            const band = scoreBand(t.overall_score);
            return (
              <li
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-secondary/30 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-display text-sm font-semibold">
                      #{i + 1} · Take {t.take_number}
                    </span>
                    <span className={cn("text-xs font-medium", verdictTone(v))}>{v}</span>
                  </div>
                  {(() => {
                    const h = pickHeadline(t.report);
                    return h ? (
                      <p className="mt-1 truncate text-xs text-muted-foreground">{h}</p>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-display text-2xl font-semibold tabular-nums text-primary">
                      {t.overall_score ?? "—"}
                    </span>
                    <p className={cn("text-[11px] font-medium", band.tone)}>{band.label}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => onOpenTake(t.id)}>
                    Notes
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Side-by-side comparison */}
      <CompareView takes={takes} />
    </div>
  );
}

function CompareView({ takes }: { takes: Take[] }) {
  const cats: { key: string; label: string }[] = [
    { key: "overall", label: "Overall" },
    { key: "vocal", label: "Vocal" },
    { key: "acting", label: "Acting" },
    { key: "audio", label: "Audio" },
    { key: "technical", label: "Technical" },
    { key: "brief_adherence", label: "Brief / standards" },
    { key: "confidence", label: "Confidence" },
  ];

  const best = [...takes].sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0))[0];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">
      <h2 className="font-display text-lg font-semibold">Compare takes</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Best take: <strong>Take {best.take_number}</strong>
        {(() => {
          const h = pickHeadline(best.report);
          return h ? <> — {h}</> : null;
        })()}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Overall score is the primary comparison metric. The rows below explain why.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pl-2 font-medium">Metric</th>
              {takes.map((t) => (
                <th key={t.id} className="py-2 pr-2 text-right font-medium">
                  Take {t.take_number}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => {
              const isOverall = c.key === "overall";
              return (
                <tr
                  key={c.key}
                  className={cn(
                    "border-b border-border last:border-0 align-top",
                    isOverall && "bg-primary/5",
                  )}
                >
                  <td
                    className={cn(
                      "py-3 pl-2",
                      isOverall
                        ? "font-display text-sm font-semibold text-foreground"
                        : "text-xs font-medium text-muted-foreground",
                    )}
                  >
                    {isOverall ? "Overall score" : c.label}
                    {isOverall && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wider text-primary">
                        primary
                      </span>
                    )}
                  </td>
                  {takes.map((t) => {
                    let val: number | null = null;
                    if (c.key === "overall") val = t.overall_score;
                    else if (c.key === "confidence") val = t.confidence;
                    else val = t.scores?.[c.key] ?? null;
                    if (c.key === "confidence") {
                      return (
                        <td
                          key={t.id}
                          className="py-3 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                        >
                          {val ?? "—"}
                        </td>
                      );
                    }
                    const band =
                      c.key === "brief_adherence" && t.report?.mode === "brief"
                        ? briefFitBand(val)
                        : scoreBand(val);
                    return (
                      <td key={t.id} className="py-3 pr-2 text-right">
                        <div
                          className={cn(
                            "tabular-nums",
                            isOverall
                              ? "font-display text-2xl font-bold text-primary"
                              : "text-sm text-foreground",
                          )}
                        >
                          {val ?? "—"}
                        </div>
                        {val != null && (
                          <div
                            className={cn(
                              "font-medium",
                              isOverall ? "text-xs" : "text-[10px]",
                              band.tone,
                            )}
                          >
                            {band.label}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
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
  onUploaded: (newTakeId?: string) => void;
}) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [durationWarningAccepted, setDurationWarningAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const takeIdRef = useRef<string | null>(null);
  // ARCH-Δ2: one discipline per audition — takes inherit it. Legacy
  // (pre-Δ2) auditions have NULL discipline: this dialog requires a
  // one-time selection and persists it to the audition BEFORE the take is
  // created (backfill-on-next-take; a discipline is never guessed).
  const [backfillDiscipline, setBackfillDiscipline] = useState<AuditionDiscipline | "">("");
  const needsDisciplineBackfill = !isAuditionDiscipline(audition.discipline);

  function cancelUpload() {
    abortRef.current?.abort();
  }

  async function pick(f: File | null) {
    setFile(f);
    setChecklist(null);
    setDurationWarningAccepted(false);
    if (!f) return;
    try {
      setChecklist(await analyzeVideoFile(f));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read this video");
    }
  }

  async function upload() {
    if (!file || !user) return;
    if (needsDisciplineBackfill && !isAuditionDiscipline(backfillDiscipline)) {
      toast.error("Choose the discipline for this audition before uploading.");
      return;
    }

    if (checklist) {
      const durationDecision = buildVideoDurationDecision(checklist.duration.seconds);
      if (!durationDecision.canUpload) {
        recordVideoDurationEvent(
          "video_duration_hard_cap_blocked",
          durationDecision.durationSeconds,
          durationDecision.status,
          "add_take_upload",
        );
        toast.error(durationDecision.message ?? "This video is over TapeCoach's upload limit.");
        return;
      }
      if (durationDecision.requiresAcknowledgement && !durationWarningAccepted) {
        toast.warning(
          durationDecision.message ?? "Review the video length guidance before upload.",
        );
        return;
      }
      const pf = preflightVideoBasics(file, checklist.duration.seconds, checklist.audio.peak);
      if (!pf.ok) {
        toast.error(pf.error ?? "Video failed pre-upload checks");
        return;
      }
      if (pf.warning && pf.durationStatus !== "over_soft_guidance") toast.warning(pf.warning);
    }

    setBusy(true);
    setUploadPct(0);
    try {
      // Legacy-audition backfill: persist the one-time discipline selection
      // BEFORE creating the take so the analysis guard sees it.
      if (needsDisciplineBackfill && isAuditionDiscipline(backfillDiscipline)) {
        const { error: disciplineErr } = await supabase
          .from("auditions")
          .update({ discipline: backfillDiscipline })
          .eq("id", audition.id);
        if (disciplineErr) {
          throw new Error("Could not save the discipline for this audition. Please try again.");
        }
      }

      const signals = await buildTakeUploadSignals(file, checklist);
      const analyticsAttribution = buildAnalyticsAttributionMetadata(
        readStoredAnalyticsAttribution(),
      );
      const newTakeId = crypto.randomUUID();
      const { data: take, error: takeErr } = await supabase
        .from("takes")
        .insert([
          {
            id: newTakeId,
            audition_id: audition.id,
            user_id: user.id,
            take_number: nextNumber,
            take_slot: nextNumber,
            take_version_number: 1,
            take_version_status: "active",
            analysis_run_id: buildS10TakeAnalysisRunId(newTakeId),
            report_model_status: "not_emitted",
            qa_artifact_status: "not_enabled",
            manifest_status: "not_enabled",
            same_video_status: "not_evaluated",
            take_lifecycle_metadata: {
              source: "add_take_upload",
            } as never,
            video_path: null,
            status: "pending",
            mux_status: "uploading",
            processing_phase: "uploading",
            signals: signals as never,
            checklist: (checklist ?? null) as never,
            analytics_attribution: analyticsAttribution as never,
          },
        ])
        .select("id")
        .single();
      if (takeErr || !take) throw takeErr ?? new Error("Could not create take");
      takeIdRef.current = take.id;
      void trackAnalyticsEvent({
        eventName: "upload",
        objectType: "take",
        objectId: take.id,
        auditionId: audition.id,
        takeId: take.id,
        properties: { upload_surface: "add_take_upload" },
      });

      let uploadUrl: string | undefined;
      try {
        const res = await createMuxDirectUpload({ data: { takeId: take.id } });
        uploadUrl = res.uploadUrl;
      } catch (err) {
        const info = describeUploadError(err);
        throw new Error(info.message);
      }
      if (!uploadUrl)
        throw new Error("Video service did not return an upload URL. Please try again.");
      const controller = new AbortController();
      abortRef.current = controller;
      await uploadFileToMux(uploadUrl, file, setUploadPct, controller.signal);

      toast.success(`Take ${nextNumber} uploaded — optimising and analysing now`);
      onUploaded(takeIdRef.current ?? undefined);
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
    <div className="tc-print-exclude mt-6 rounded-2xl border border-border bg-secondary/40 p-6">
      <div className="flex items-center gap-2">
        <Video className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-semibold">Add take {nextNumber}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Same brief, same scoring weights — easy to compare.
      </p>
      {needsDisciplineBackfill ? (
        <div className="mt-3">
          <Label className="text-sm font-medium">
            What are you auditioning with?{" "}
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Required. This audition predates discipline selection — choose it once and every take in
            this audition uses it.
          </p>
          <Select
            value={backfillDiscipline}
            onValueChange={(v) => setBackfillDiscipline(v as AuditionDiscipline)}
          >
            <SelectTrigger className="mt-2" aria-required="true">
              <SelectValue placeholder="Select a discipline…" />
            </SelectTrigger>
            <SelectContent>
              {AUDITION_DISCIPLINES.map((value) => (
                <SelectItem key={value} value={value}>
                  {AUDITION_DISCIPLINE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Discipline:{" "}
          <span className="font-medium text-foreground">
            {AUDITION_DISCIPLINE_LABELS[audition.discipline as AuditionDiscipline]}
          </span>
        </p>
      )}
      <UploadPolicyNotice className="mt-3" />
      <CreditUseNotice className="mt-3" enabled={Boolean(user)} />
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
          <VideoDurationNotice
            className="mt-4"
            seconds={checklist.duration.seconds}
            accepted={durationWarningAccepted}
            onShown={(status) => {
              if (status !== "over_soft_guidance") return;
              recordVideoDurationEvent(
                "video_duration_warning_shown",
                checklist.duration.seconds,
                status,
                "add_take_upload",
              );
            }}
            onAccept={() => {
              const decision = buildVideoDurationDecision(checklist.duration.seconds);
              setDurationWarningAccepted(true);
              recordVideoDurationEvent(
                "video_duration_warning_accepted",
                decision.durationSeconds,
                decision.status,
                "add_take_upload",
              );
            }}
            onChooseShorter={() => fileRef.current?.click()}
          />
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
