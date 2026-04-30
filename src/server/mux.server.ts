// Server-only Mux helpers. Never import from client code.
import Mux from "@mux/mux-node";

const MUX_STREAM_ORIGIN = "https://stream.mux.com";
const TRAILING_MP4_GARBAGE_RE = /(\.mp4)[\\/\s\u0000-\u001F\u007F]+$/i;
const INVALID_PLAYBACK_ID_RE = /[\\/\s?#\u0000-\u001F\u007F]/;
const INVALID_URL_CHARS_RE = /[\s\u0000-\u001F\u007F]/;

let _client: Mux | undefined;

export function getMux(): Mux {
  if (!_client) {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) {
      throw new Error("MUX_TOKEN_ID / MUX_TOKEN_SECRET are not configured");
    }
    _client = new Mux({ tokenId, tokenSecret });
  }
  return _client;
}

export function sanitiseMuxPlaybackId(playbackId: string): string {
  const trimmed = playbackId.trim();
  if (!trimmed || INVALID_PLAYBACK_ID_RE.test(trimmed)) {
    throw new Error("Invalid Mux playback id");
  }
  return trimmed;
}

export function buildMuxHighestMp4Url(playbackId: string): string {
  const safePlaybackId = sanitiseMuxPlaybackId(playbackId);
  return `${MUX_STREAM_ORIGIN}/${safePlaybackId}/highest.mp4`;
}

export function buildMuxLegacyHighMp4Url(playbackId: string): string {
  const safePlaybackId = sanitiseMuxPlaybackId(playbackId);
  return `${MUX_STREAM_ORIGIN}/${safePlaybackId}/high.mp4`;
}

// Build the static MP4 URL for a Mux playback id.
//
// We provision uploads with `static_renditions: [{ resolution: "highest" }]`,
// which produces a single MP4 published at `<playback_id>/highest.mp4`. The
// legacy `low|medium|high.mp4` paths only exist when the deprecated
// `mp4_support` field was used and Mux generated multiple renditions. Some
// older takes may still have only `high.mp4` available — callers should
// prefer `highest.mp4` and fall back to `high.mp4` deterministically when
// the primary 404s.
//
// `_quality` is kept for call-site compatibility but ignored — all tiers
// resolve to the same `highest.mp4`.
export function muxMp4Url(
  playbackId: string,
  _quality: "low" | "medium" | "high" = "high",
): string {
  return buildMuxHighestMp4Url(playbackId);
}

// Legacy path used by takes uploaded before the `static_renditions:
// "highest"` configuration. We still honour it as a deterministic fallback
// when probes for `highest.mp4` return 404.
export function muxMp4LegacyUrl(
  playbackId: string,
  quality: "low" | "medium" | "high" = "high",
): string {
  if (quality !== "high") {
    throw new Error("Only legacy high.mp4 is supported");
  }
  return buildMuxLegacyHighMp4Url(playbackId);
}

// Repair only the specific stored-url corruption we've observed: garbage
// appended after the terminal `.mp4`.
export function normaliseMuxMp4Url(url: string): string {
  return url.trim().replace(TRAILING_MP4_GARBAGE_RE, "$1");
}

export function isValidMuxMp4Url(url: string): boolean {
  const normalised = normaliseMuxMp4Url(url);
  if (
    !normalised.startsWith(`${MUX_STREAM_ORIGIN}/`) ||
    !normalised.endsWith(".mp4") ||
    normalised.endsWith("/") ||
    normalised.endsWith("\\") ||
    INVALID_URL_CHARS_RE.test(normalised)
  ) {
    return false;
  }

  try {
    const parsed = new URL(normalised);
    return parsed.origin === MUX_STREAM_ORIGIN && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}
