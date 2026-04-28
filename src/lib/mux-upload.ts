// Direct upload helper: PUTs a File to a Mux direct-upload URL.
// Mux uses a signed Google Cloud Storage URL that accepts a single PUT for
// files up to a few GB. We stream progress via XHR so the UI can show %.
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export function uploadFileToMux(
  url: string,
  file: File,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadCancelledError());
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new UploadCancelledError());
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(file);
  });
}

// Pre-upload validation. Hard-rejects oversized or overly long files so the
// user doesn't waste bandwidth on a take that will fail downstream.
export interface PreflightOptions {
  maxBytes?: number;
  maxSeconds?: number;
}

export interface PreflightResult {
  ok: boolean;
  error?: string;
  warning?: string;
}

export function preflightVideoBasics(
  file: File,
  durationSeconds: number,
  audioPeak: number,
  opts: PreflightOptions = {},
): PreflightResult {
  const maxBytes = opts.maxBytes ?? 500 * 1024 * 1024; // 500 MB
  const maxSeconds = opts.maxSeconds ?? 10 * 60; // 10 min

  if (file.size > maxBytes) {
    return {
      ok: false,
      error: `File is ${(file.size / 1024 / 1024).toFixed(0)}MB — limit is ${(
        maxBytes /
        1024 /
        1024
      ).toFixed(0)}MB. Re-export at a lower bitrate.`,
    };
  }
  if (durationSeconds > maxSeconds) {
    return {
      ok: false,
      error: `Video is ${Math.round(
        durationSeconds,
      )}s — limit is ${maxSeconds}s. Trim to a shorter take.`,
    };
  }
  if (audioPeak === 0) {
    return {
      ok: true,
      warning:
        "We couldn't detect any audio in this file — the analysis will continue but audio scoring may be unreliable.",
    };
  }
  return { ok: true };
}
