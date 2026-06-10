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

// S11-AUDIO-01: the brief-blind pre-upload checklist (orientation / lighting /
// audio / resolution QC, plus the in-browser audio decode probe) was removed.
// The probe could be skipped on large files, persisting audio_peak=0, which the
// model then parroted as silence; orientation/lighting/sound are now governed by
// the brief-aware analysis (the model observes audio/video from the file_url).
//
// Pre-upload still needs the video's DURATION for the brief-independent length
// policy (hard cap / soft-guidance notice / identity duration capture). This
// reads metadata only — no audio decode, no frame sampling, no QC verdicts.
export async function readVideoDurationSeconds(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read this video file"));
    });
    return Number.isFinite(video.duration) ? video.duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}
