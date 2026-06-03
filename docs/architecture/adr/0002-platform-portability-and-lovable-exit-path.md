# ADR-0002: Platform Portability & Lovable Exit Path

## Status

Accepted (2026-06-03)

## Context

TapeCoach uses Lovable for the application surface (UI/editor/frontend and the
short app/API shell) but owns its system of record (owned Supabase) and is moving
the durable, expensive analysis runtime onto its own Cloudflare infrastructure.
We want to avoid lock-in that would make leaving Lovable costly, while not
rewriting the working UI today.

## Decision

Keep a clear boundary between **platform-provided surface** and **owned runtime +
data**, so the platform (Lovable) is replaceable without touching product logic:

1. **Owned system of record.** All durable state (auditions, takes, media state,
   analysis run state, reports, QA artefacts, config, diagnostics) lives in the
   owned Supabase project — never in Lovable-only storage. See the cutover
   checklist runbook.
2. **Runtime-neutral analysis core.** The heavy S10 pipeline (`runAnalysisJob`)
   and its dependencies are server-only and free of Lovable/TanStack request
   primitives. Runtime env is injected (see ADR-0001) via a TanStack-free
   `runtime-env-als.server` module, so the analysis core runs in the Lovable
   runtime, a Cloudflare Worker, or any Node-like host.
3. **AI via a provider adapter.** AI access goes through an explicit provider
   adapter (Lovable AI gateway or OpenRouter), so the model gateway is swappable.
4. **The app shell is the only Lovable-coupled layer.** If Lovable is replaced,
   the migration surface is the UI/app shell + dispatch trigger — not the data,
   the analysis pipeline, or the durable runtime.

## Consequences

- The durable analysis runtime can be (and now is) hosted on Cloudflare
  independently of Lovable — see [ADR-0003](./0003-dedicated-cloudflare-analysis-worker.md).
- Lovable can be swapped for another frontend/host with bounded effort because
  data and analysis are owned and runtime-neutral.
- Cost: some duplication of runtime concerns (e.g. env wiring) across the app
  Worker and the analysis Worker; accepted in exchange for portability.

## Non-Goals

- No change to S10 prompts, scoring, report schemas, report UI, or canaries.
- Not a commitment to leave Lovable now — only to keep the exit cheap.
