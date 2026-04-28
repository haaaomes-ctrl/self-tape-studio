import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { ChecklistView } from "@/components/checklist-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { analyzeVideoFile, buildGuidedBrief, type ChecklistResult, type GuidedFields } from "@/lib/checklist";
import { preflightVideoBasics, uploadFileToMux } from "@/lib/mux-upload";
import { createMuxDirectUpload } from "@/server/mux.functions";

export const Route = createFileRoute("/new")({
  head: () => ({ meta: [{ title: "New audition — SelfTape" }] }),
  component: NewAuditionPage,
});

const titleSchema = z.string().trim().min(1).max(120);

function NewAuditionPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [briefMode, setBriefMode] = useState<"full" | "guided" | "skip">("full");
  const [fullBrief, setFullBrief] = useState("");
  const [guided, setGuided] = useState<GuidedFields>({
    material: "song",
    reader: "n_a",
    orientation: "either",
  });
  const [file, setFile] = useState<File | null>(null);
  const [checking, setChecking] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  async function onPickFile(f: File | null) {
    setFile(f);
    setChecklist(null);
    if (!f) return;
    setChecking(true);
    try {
      const requiresLandscape =
        briefMode === "guided" && guided.orientation === "landscape";
      const result = await analyzeVideoFile(f, { requiresLandscape });
      setChecklist(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read this video");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    if (!user) return;
    if (!file) {
      toast.error("Pick a video file first");
      return;
    }
    const titleParsed = titleSchema.safeParse(title || "Untitled audition");
    if (!titleParsed.success) {
      toast.error("Title is required");
      return;
    }

    // Pre-upload preflight: hard reject oversized / overlong files.
    if (checklist) {
      const pf = preflightVideoBasics(
        file,
        checklist.duration.seconds,
        checklist.audio.peak,
      );
      if (!pf.ok) {
        toast.error(pf.error ?? "Video failed pre-upload checks");
        return;
      }
      if (pf.warning) toast.warning(pf.warning);
    }

    setSubmitting(true);
    setUploadPct(0);
    try {
      // 1. Determine brief
      let brief: string | null = null;
      let briefSource: "full" | "guided" | "none" = "none";
      let mode: "brief" | "baseline" = "baseline";
      if (briefMode === "full" && fullBrief.trim()) {
        brief = fullBrief.trim().slice(0, 8000);
        briefSource = "full";
        mode = "brief";
      } else if (briefMode === "guided") {
        const built = buildGuidedBrief(guided);
        if (built) {
          brief = built;
          briefSource = "guided";
          mode = "brief";
        }
      }

      // 2. Create audition
      const { data: aud, error: audErr } = await supabase
        .from("auditions")
        .insert([
          {
            user_id: user.id,
            title: titleParsed.data,
            brief,
            brief_source: briefSource,
            mode,
          },
        ])
        .select("id")
        .single();
      if (audErr || !aud) throw audErr ?? new Error("Could not create audition");

      // 3. Insert take row (no video_path — Mux owns the file)
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
            audition_id: aud.id,
            user_id: user.id,
            take_number: 1,
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

      // 4. Ask the server for a Mux direct-upload URL (server enforces daily cap)
      const { uploadUrl } = await createMuxDirectUpload({ data: { takeId: take.id } });
      if (!uploadUrl) throw new Error("Could not get an upload URL");

      // 5. PUT the file straight to Mux. Webhook fires processTake when ready.
      await uploadFileToMux(uploadUrl, file, setUploadPct);

      toast.success("Uploaded — optimising and analysing your tape");
      navigate({ to: "/audition/$auditionId", params: { auditionId: aud.id } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
      setSubmitting(false);
      setUploadPct(0);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-12">
        <h1 className="font-display text-3xl font-bold tracking-tight">New audition</h1>
        <p className="mt-1 text-muted-foreground">
          Add the brief if you have it — it makes the feedback much more accurate.
        </p>

        <div className="mt-10 space-y-8">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <Label htmlFor="title" className="text-sm font-medium">
              Audition title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wicked — Elphaba sides"
              className="mt-2"
              maxLength={120}
            />
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Casting brief</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Optional but recommended. With a brief we can score against the actual ask.
            </p>

            <Tabs
              value={briefMode}
              onValueChange={(v) => setBriefMode(v as "full" | "guided" | "skip")}
              className="mt-5"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="full">Paste brief</TabsTrigger>
                <TabsTrigger value="guided">Quick prompt</TabsTrigger>
                <TabsTrigger value="skip">Skip</TabsTrigger>
              </TabsList>

              <TabsContent value="full" className="mt-5">
                <Textarea
                  value={fullBrief}
                  onChange={(e) => setFullBrief(e.target.value)}
                  placeholder="Paste the casting brief, sides notes, or any instructions you were given…"
                  className="min-h-[160px]"
                  maxLength={8000}
                />
              </TabsContent>

              <TabsContent value="guided" className="mt-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="role">Role / character type</Label>
                    <Input
                      id="role"
                      value={guided.roleType ?? ""}
                      onChange={(e) => setGuided({ ...guided, roleType: e.target.value })}
                      placeholder="e.g. comedic ingénue"
                      className="mt-2"
                      maxLength={120}
                    />
                  </div>
                  <div>
                    <Label>Material</Label>
                    <Select
                      value={guided.material}
                      onValueChange={(v) => setGuided({ ...guided, material: v })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="song">Song</SelectItem>
                        <SelectItem value="scene">Scene / monologue</SelectItem>
                        <SelectItem value="mixed">Song + scene</SelectItem>
                        <SelectItem value="dance">Dance / movement</SelectItem>
                        <SelectItem value="commercial">Commercial / screen</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reader present?</Label>
                    <Select
                      value={guided.reader}
                      onValueChange={(v) => setGuided({ ...guided, reader: v })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="n_a">Not applicable</SelectItem>
                        <SelectItem value="yes">Yes — reader off-camera</SelectItem>
                        <SelectItem value="no">No — solo to camera</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Orientation</Label>
                    <Select
                      value={guided.orientation}
                      onValueChange={(v) => setGuided({ ...guided, orientation: v })}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="either">Either is fine</SelectItem>
                        <SelectItem value="landscape">Landscape required</SelectItem>
                        <SelectItem value="portrait">Portrait required</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="accent">Accent / dialect</Label>
                    <Input
                      id="accent"
                      value={guided.accent ?? ""}
                      onChange={(e) => setGuided({ ...guided, accent: e.target.value })}
                      placeholder="e.g. RP, Standard American"
                      className="mt-2"
                      maxLength={80}
                    />
                  </div>
                  <div>
                    <Label htmlFor="instr">Special instructions</Label>
                    <Input
                      id="instr"
                      value={guided.instructions ?? ""}
                      onChange={(e) => setGuided({ ...guided, instructions: e.target.value })}
                      placeholder="e.g. slate first, 32-bar cut"
                      className="mt-2"
                      maxLength={200}
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="skip" className="mt-5">
                <p className="rounded-md border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
                  We'll apply the professional baseline rubric and lower the confidence score.
                  You can still get useful, coach-like feedback.
                </p>
              </TabsContent>
            </Tabs>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6 shadow-soft">
            <h2 className="font-display text-lg font-semibold">Upload video</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              MP4 or MOV, up to 750MB. Large files are automatically optimised for fast,
              accurate feedback — your performance is not altered.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> {file ? "Change file" : "Choose file"}
              </Button>
              {file && (
                <span className="truncate text-sm text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              )}
            </div>

            {checking && (
              <p className="mt-5 inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
              </p>
            )}

            {checklist && (
              <div className="mt-6">
                <p className="mb-2 text-sm font-medium">Pre-upload checklist</p>
                <ChecklistView
                  checklist={checklist}
                  briefSource={
                    briefMode === "full" && fullBrief.trim()
                      ? "full"
                      : briefMode === "guided" && buildGuidedBrief(guided)
                        ? "guided"
                        : "none"
                  }
                  readerDeclared={
                    briefMode === "guided" && (guided.reader === "yes" || guided.reader === "no")
                      ? (guided.reader as "yes" | "no")
                      : undefined
                  }
                />
              </div>
            )}
          </section>

          <div className="flex justify-end">
            <Button size="lg" onClick={submit} disabled={!file || submitting || checking}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                "Upload & analyse"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
