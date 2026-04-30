// Server-only Mux helpers. Never import from client code.
import Mux from "@mux/mux-node";

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
  return `https://stream.mux.com/${playbackId}/highest.mp4`;
}

// Legacy path used by takes uploaded before the `static_renditions:
// "highest"` configuration. We still honour it as a deterministic fallback
// when probes for `highest.mp4` return 404.
export function muxMp4LegacyUrl(
  playbackId: string,
  quality: "low" | "medium" | "high" = "high",
): string {
  return `https://stream.mux.com/${playbackId}/${quality}.mp4`;
}
