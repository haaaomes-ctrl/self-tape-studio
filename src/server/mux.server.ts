// Server-only Mux helpers. Never import from client code.
import Mux from "@mux/mux-node";
import { getRequestEnv } from "@/worker-entry";

const MUX_STREAM_ORIGIN = "https://stream.mux.com";
// eslint-disable-next-line no-control-regex
const TRAILING_MP4_GARBAGE_RE = /(\.mp4)[\\/\s\u0000-\u001F\u007F]+$/i;
// eslint-disable-next-line no-control-regex
const INVALID_PLAYBACK_ID_RE = /[\\/\s?#\u0000-\u001F\u007F]/;
// eslint-disable-next-line no-control-regex
const INVALID_URL_CHARS_RE = /[\s\u0000-\u001F\u007F]/;

let _client: Mux | undefined;
let _clientKey: string | undefined;

export type MuxRuntimeEnv = {
  MUX_TOKEN_ID?: unknown;
  MUX_TOKEN_SECRET?: unknown;
  MUX_WEBHOOK_SECRET?: unknown;
};

export type MuxRuntimeDiagnostics = {
  mux_token_id_present: boolean;
  mux_token_secret_present: boolean;
  mux_webhook_secret_present: boolean;
};

export class MuxRuntimeConfigError extends Error {
  diagnostics: MuxRuntimeDiagnostics;

  constructor(diagnostics: MuxRuntimeDiagnostics) {
    super(
      "Missing Mux server environment variables. Ensure MUX_TOKEN_ID and MUX_TOKEN_SECRET are set.",
    );
    this.name = "MuxRuntimeConfigError";
    this.diagnostics = diagnostics;
  }
}

function cleanUnknownEnvValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentRuntimeEnv(env?: MuxRuntimeEnv | null): MuxRuntimeEnv | null {
  return env === undefined ? (getRequestEnv<MuxRuntimeEnv>() ?? null) : env;
}

function readRuntimeValue(env: MuxRuntimeEnv | null, key: keyof MuxRuntimeEnv): string | null {
  const hasRuntimeEnv = env !== undefined && env !== null;
  return (
    cleanUnknownEnvValue(env?.[key]) ??
    (hasRuntimeEnv ? null : cleanUnknownEnvValue(process.env[key]))
  );
}

export function resolveMuxRuntimeConfig(env?: MuxRuntimeEnv | null): {
  tokenId: string | null;
  tokenSecret: string | null;
  webhookSecret: string | null;
  diagnostics: MuxRuntimeDiagnostics;
} {
  const runtimeEnv = currentRuntimeEnv(env);
  const tokenId = readRuntimeValue(runtimeEnv, "MUX_TOKEN_ID");
  const tokenSecret = readRuntimeValue(runtimeEnv, "MUX_TOKEN_SECRET");
  const webhookSecret = readRuntimeValue(runtimeEnv, "MUX_WEBHOOK_SECRET");

  return {
    tokenId,
    tokenSecret,
    webhookSecret,
    diagnostics: {
      mux_token_id_present: Boolean(tokenId),
      mux_token_secret_present: Boolean(tokenSecret),
      mux_webhook_secret_present: Boolean(webhookSecret),
    },
  };
}

export function requireMuxRuntimeConfig(env?: MuxRuntimeEnv | null): {
  tokenId: string;
  tokenSecret: string;
  webhookSecret: string | null;
  diagnostics: MuxRuntimeDiagnostics;
} {
  const { tokenId, tokenSecret, webhookSecret, diagnostics } = resolveMuxRuntimeConfig(env);

  if (!tokenId || !tokenSecret) {
    throw new MuxRuntimeConfigError(diagnostics);
  }

  return { tokenId, tokenSecret, webhookSecret, diagnostics };
}

export function getMux(): Mux {
  const { tokenId, tokenSecret } = requireMuxRuntimeConfig();
  const nextClientKey = `${tokenId}:${tokenSecret}`;
  if (!_client || _clientKey !== nextClientKey) {
    _client = new Mux({ tokenId, tokenSecret });
    _clientKey = nextClientKey;
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
  if (
    !url.startsWith(`${MUX_STREAM_ORIGIN}/`) ||
    !url.endsWith(".mp4") ||
    url.endsWith("/") ||
    url.endsWith("\\") ||
    INVALID_URL_CHARS_RE.test(url)
  ) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.origin === MUX_STREAM_ORIGIN && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}
