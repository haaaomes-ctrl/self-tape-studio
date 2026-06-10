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
// audio / resolution QC, plus the in-browser audio DECODE probe) was removed.
// The audio probe could be skipped on large files, persisting audio_peak=0,
// which the model then parroted as silence; lighting/sound are now governed by
// the brief-aware analysis (the model observes audio/video from the file_url).
//
// Pre-upload still needs the video's DURATION (for the brief-independent length
// policy) and its DISPLAY DIMENSIONS (width×height ⇒ deterministic orientation
// for the server-side orientation_mismatch gate). Both are cheap container
// METADATA, read in one loadedmetadata pass — NOT a perceptual decode: no audio
// sampling, no frame sampling, no QC verdicts. Dimensions are reliable on any
// playable file, so they were never the contamination the audio fix removed.
export interface VideoMediaMetadata {
  durationSeconds: number;
  width: number | null;
  height: number | null;
}

export async function readVideoMediaMetadata(file: File): Promise<VideoMediaMetadata> {
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
    const width =
      Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? video.videoWidth : null;
    const height =
      Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? video.videoHeight : null;
    return {
      durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
      width,
      height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Duration-only convenience wrapper over readVideoMediaMetadata for call sites
// that do not persist dimensions.
export async function readVideoDurationSeconds(file: File): Promise<number> {
  return (await readVideoMediaMetadata(file)).durationSeconds;
}
