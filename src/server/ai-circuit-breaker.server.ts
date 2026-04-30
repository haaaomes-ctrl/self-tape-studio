// Worker-local AI circuit breaker.
//
// Tracks recent terminal AI failures (gemini_timeout / gemini_5xx /
// ai_network_error). When the count crosses the threshold within the
// rolling window, the circuit OPENS for OPEN_DURATION_MS — during which
// new analysis runs are routed straight to the fallback model.
//
// LIMITATION: state is per-Worker isolate. In a multi-isolate Cloudflare
// deployment each isolate maintains its own counter; there is no cross-
// isolate consensus. This is acceptable for the pilot — failure waves
// typically affect all isolates roughly together, and the breaker is a
// cost/latency safeguard, not a correctness boundary.
//
// To make the breaker durable later, swap the in-memory arrays for a
// shared store (KV, Durable Object, Postgres) — same public API.

type FailureKind = "gemini_timeout" | "gemini_5xx" | "ai_network_error";

const WINDOW_MS = 10 * 60_000; // 10 minutes
const FAILURE_THRESHOLD = 5;
const OPEN_DURATION_MS = 30 * 60_000; // 30 minutes

let failureTimestamps: number[] = [];
let openUntil = 0;

function pruneOld(now: number) {
  const cutoff = now - WINDOW_MS;
  if (failureTimestamps.length === 0) return;
  if (failureTimestamps[0] >= cutoff) return;
  failureTimestamps = failureTimestamps.filter((t) => t >= cutoff);
}

export function recordAiFailure(kind: FailureKind): void {
  const now = Date.now();
  pruneOld(now);
  failureTimestamps.push(now);
  if (
    openUntil <= now &&
    failureTimestamps.length >= FAILURE_THRESHOLD
  ) {
    openUntil = now + OPEN_DURATION_MS;
    console.warn("[take-pipeline] ai_circuit_opened", {
      failures_in_window: failureTimestamps.length,
      window_ms: WINDOW_MS,
      open_until: new Date(openUntil).toISOString(),
      last_failure_kind: kind,
    });
  }
}

export function isCircuitOpen(): boolean {
  const now = Date.now();
  if (openUntil <= now) {
    if (openUntil > 0) {
      // Just transitioned closed.
      console.info("[take-pipeline] ai_circuit_closed", {
        closed_at: new Date(now).toISOString(),
      });
      openUntil = 0;
      failureTimestamps = [];
    }
    return false;
  }
  return true;
}

export function circuitState(): {
  open: boolean;
  failures_in_window: number;
  open_until_ms: number;
} {
  const now = Date.now();
  pruneOld(now);
  return {
    open: openUntil > now,
    failures_in_window: failureTimestamps.length,
    open_until_ms: openUntil,
  };
}
