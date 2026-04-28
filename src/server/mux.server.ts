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

// Build the static MP4 URL for a Mux playback id at a given rendition quality.
// Requires the asset to have been created with mp4_support: 'standard'.
//   medium  → ~720p (standard / first attempt)
//   high    → ~1080p (high-quality retry)
export function muxMp4Url(playbackId: string, quality: "low" | "medium" | "high"): string {
  return `https://stream.mux.com/${playbackId}/${quality}.mp4`;
}
