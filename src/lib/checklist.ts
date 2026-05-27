import {
  buildVideoDurationDecision,
  VIDEO_DURATION_HARD_CAP_COPY,
} from "@/lib/video-duration-policy";

// Build a synthetic brief from guided-prompt fields. Returns null if no fields filled.
export interface GuidedFields {
  roleType?: string;
  material?: string; // song / scene / mixed / dance / commercial
  reader?: string; // yes / no / n_a
  orientation?: string; // landscape / portrait / either
  accent?: string;
  instructions?: string;
}

export function buildGuidedBrief(g: GuidedFields): string | null {
  const lines: string[] = [];
  if (g.roleType?.trim()) lines.push(`Role / character type: ${g.roleType.trim()}`);
  if (g.material?.trim()) lines.push(`Material type: ${g.material.trim()}`);
  if (g.reader && g.reader !== "n_a") lines.push(`Reader present: ${g.reader}`);
  if (g.orientation && g.orientation !== "either")
    lines.push(`Required orientation: ${g.orientation}`);
  if (g.accent?.trim()) lines.push(`Accent / dialect: ${g.accent.trim()}`);
  if (g.instructions?.trim()) lines.push(`Special instructions: ${g.instructions.trim()}`);
  return lines.length ? lines.join("\n") : null;
}

// Lightweight client-side checks on a video file before upload.
export interface ChecklistResult {
  orientation: {
    value: "landscape" | "portrait" | "square";
    status: "ok" | "warn" | "fail";
    note: string;
  };
  duration: { seconds: number; status: "ok" | "warn" | "fail"; note: string };
  resolution: { width: number; height: number; status: "ok" | "warn" | "fail"; note: string };
  brightness: { value: number; status: "ok" | "warn" | "fail"; note: string };
  audio: { peak: number; rms: number; status: "ok" | "warn" | "fail"; note: string };
}

export async function analyzeVideoFile(
  file: File,
  options: { requiresLandscape?: boolean } = {},
): Promise<ChecklistResult> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video file"));
    });

    const w = video.videoWidth;
    const h = video.videoHeight;
    const orientationValue: "landscape" | "portrait" | "square" =
      w === h ? "square" : w > h ? "landscape" : "portrait";

    const orientationStatus: "ok" | "warn" | "fail" =
      options.requiresLandscape && orientationValue !== "landscape"
        ? "fail"
        : orientationValue === "landscape"
          ? "ok"
          : "warn";

    const durationDecision = buildVideoDurationDecision(video.duration);
    const durationStatus: "ok" | "warn" | "fail" =
      video.duration < 10
        ? "fail"
        : durationDecision.status === "over_hard_cap"
          ? "fail"
          : durationDecision.status === "over_soft_guidance"
            ? "warn"
            : "ok";

    const resolutionStatus: "ok" | "warn" | "fail" = h < 480 ? "fail" : h < 720 ? "warn" : "ok";

    // Sample a frame for brightness
    let brightnessVal = 0.5;
    try {
      await new Promise<void>((resolve) => {
        video.currentTime = Math.min(1, video.duration / 2);
        video.onseeked = () => resolve();
        setTimeout(() => resolve(), 1500);
      });
      const canvas = document.createElement("canvas");
      const sampleW = 64;
      const sampleH = Math.max(36, Math.round((h / w) * 64));
      canvas.width = sampleW;
      canvas.height = sampleH;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, sampleW, sampleH);
        const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          // Rec. 709 luma
          sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        }
        brightnessVal = sum / (data.length / 4) / 255;
      }
    } catch {
      // best-effort
    }

    const brightnessStatus: "ok" | "warn" | "fail" =
      brightnessVal < 0.18 ? "fail" : brightnessVal < 0.32 ? "warn" : "ok";

    // Audio probe via decodeAudioData. Skip on very large files — browsers OOM decoding 500MB+.
    let peak = 0;
    let rms = 0;
    const AUDIO_PROBE_MAX_BYTES = 80 * 1024 * 1024; // 80MB
    try {
      if (file.size > AUDIO_PROBE_MAX_BYTES) {
        throw new Error("file too large for in-browser audio probe");
      }
      const arrayBuf = await file.arrayBuffer();
      const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
      const Ctx = globalThis.AudioContext ?? browserWindow.webkitAudioContext;
      if (!Ctx) throw new Error("AudioContext unavailable");
      const audioCtx = new Ctx();
      try {
        const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        const ch = decoded.getChannelData(0);
        let p = 0;
        let sumSq = 0;
        // Subsample to keep it cheap
        const step = Math.max(1, Math.floor(ch.length / 50000));
        let n = 0;
        for (let i = 0; i < ch.length; i += step) {
          const v = Math.abs(ch[i]);
          if (v > p) p = v;
          sumSq += ch[i] * ch[i];
          n++;
        }
        peak = p;
        rms = Math.sqrt(sumSq / Math.max(1, n));
      } finally {
        await audioCtx.close().catch(() => {});
      }
    } catch {
      // some video containers can't be decoded by webaudio — leave zeros; we'll mark warn
    }

    const audioStatus: "ok" | "warn" | "fail" =
      peak === 0
        ? "warn"
        : peak < 0.05
          ? "fail"
          : peak > 0.99
            ? "warn"
            : rms < 0.01
              ? "warn"
              : "ok";

    return {
      orientation: {
        value: orientationValue,
        status: orientationStatus,
        note:
          orientationStatus === "fail"
            ? "The brief asks for landscape, but this tape is portrait."
            : orientationValue === "landscape"
              ? "Landscape — the casting standard."
              : "Portrait — fine if the brief allows it.",
      },
      duration: {
        seconds: video.duration,
        status: durationStatus,
        note:
          durationStatus === "fail"
            ? video.duration < 10
              ? "Very short — under 10 seconds. Make sure the take is complete."
              : VIDEO_DURATION_HARD_CAP_COPY
            : durationStatus === "warn"
              ? (durationDecision.message ?? "This video is over the target length.")
              : `${Math.round(video.duration)}s — within range.`,
      },
      resolution: {
        width: w,
        height: h,
        status: resolutionStatus,
        note:
          resolutionStatus === "fail"
            ? `Low resolution (${w}×${h}). Re-record at 720p or higher if possible.`
            : resolutionStatus === "warn"
              ? `${w}×${h} — okay, 1080p preferred.`
              : `${w}×${h} — clean resolution.`,
      },
      brightness: {
        value: brightnessVal,
        status: brightnessStatus,
        note:
          brightnessStatus === "fail"
            ? "Frame looks dark. Move toward a soft light source on your face."
            : brightnessStatus === "warn"
              ? "A bit dim. A little more front light would help."
              : "Lighting reads well in the sampled frame.",
      },
      audio: {
        peak,
        rms,
        status: audioStatus,
        note:
          peak === 0
            ? "Couldn't probe audio in the browser — we'll re-check during processing."
            : audioStatus === "fail"
              ? "Audio is very quiet. Move the mic closer or boost the input."
              : audioStatus === "warn"
                ? "Audio levels are uneven. Aim for consistent voice level without clipping."
                : "Audio levels look healthy.",
      },
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
