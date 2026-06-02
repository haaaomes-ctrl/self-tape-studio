# ADR-001: Durable Analysis Runtime

## Status

Accepted

## Date

2026-06-02

## Context

TapeCoach has migrated backend data, auth, storage, and configuration ownership to an owned Supabase project while continuing to use Lovable for the UI, editor, and frontend workflow.

The current runtime shape is:

- Lovable UI/frontend provides the performer and operator-facing application surface.
- Owned Supabase provides the system database, authentication, storage, and runtime configuration.
- Mux provides video upload, processing, playback readiness, and signed media access.
- Cloudflare Worker/Queue provides dispatch and queue infrastructure for asynchronous analysis work.
- OpenRouter is available for AI model calls.

The existing Cloudflare queue bridge can dispatch jobs, but the heavy S10 analysis path still cannot rely on Lovable inbound request runtime. `runProcessTake` and the heavy S10 analysis flow need a durable runtime that can process queued work outside a long-running inbound Lovable request.

## Decision

Lovable remains the UI/editor/frontend environment only.

Owned Supabase is the system of record for auditions, take versions, media state, analysis run state, reports, QA artefact status, configuration, and operator-visible diagnostics.

Cloudflare Worker/Queue becomes the durable analysis runtime for queued take-processing work. The queue consumer will run the analysis job directly, using runtime-neutral adapters for database, storage, media, AI, configuration, logging, and status persistence.

OpenRouter provides AI model calls for the analysis runtime through an explicit provider adapter.

`runProcessTake` and heavy S10 analysis must move out of Lovable inbound request runtime. Lovable may trigger or display analysis state, but it must not own the long-running analysis request lifecycle.

## Non-Goals

This decision does not change S10 prompt, scoring, calibration, report model, or performer-facing report behavior.

This decision does not redesign the Lovable UI.

This decision does not change canary logic or canonical canary expectations.

This decision does not require legacy Lovable data import unless a later implementation step explicitly identifies that imported data is needed for runtime parity or smoke testing.

## Implementation Sequence

### Phase 1: Owned Supabase Cutover Complete

Confirm the owned Supabase project is the authoritative backend for database, auth, storage, and configuration used by the analysis/report pipeline.

### Phase 2: Inventory `runProcessTake` Dependencies

Identify all dependencies used by `runProcessTake` and the heavy S10 analysis path, including database clients, Supabase storage access, Mux media access, AI client calls, environment variables, prompt/config loading, report persistence, QA artefact persistence, logging, and status transitions.

### Phase 3: Extract Runtime-Neutral Analysis Env and Adapters

Introduce an analysis runtime environment that is not coupled to Lovable inbound request primitives. Define adapters for:

- Supabase database access.
- Supabase storage access.
- Mux signed media access and media metadata.
- AI provider transport.
- Runtime configuration.
- Logging and diagnostics.
- Analysis/report/QA status persistence.

### Phase 4: OpenRouter Provider Adapter

Implement an OpenRouter AI provider adapter that preserves the existing S10 analysis contract while isolating model transport details, request formatting, retries, response parsing, and provider-specific error handling.

### Phase 5: Cloudflare Queue Consumer Direct Runner

Move queued take-processing execution into the Cloudflare queue consumer. The consumer should load the job, resolve the active take version and runtime configuration from owned Supabase, run the heavy analysis through the runtime-neutral adapters, and persist the report and statuses back to owned Supabase.

### Phase 6: Smoke Test

Run a full-length take through the Cloudflare queue consumer outside Lovable. The run must either complete successfully or safe-error with useful persisted diagnostics.

### Phase 7: Canonical Canaries

Run canonical canaries against the Cloudflare-hosted runtime to verify report parity, S10 behavior, take lifecycle behavior, duplicate/same-video handling, and operator diagnostics remain consistent with the existing product contract.

## Risks

- Worker compatibility: existing analysis code may depend on Node.js APIs, filesystem behavior, process globals, or package features that are not compatible with Cloudflare Workers.
- AI model transport differences: OpenRouter request/response shape, streaming behavior, retries, rate limits, model metadata, and error semantics may differ from the current AI transport.
- Service-role secret handling: Supabase service-role credentials must be scoped, stored, and accessed through Cloudflare secrets without leaking to Lovable frontend code or performer-facing output.
- Mux signed media access: the worker runtime must be able to generate or retrieve valid signed media URLs and fetch assessable media within expiry and permission constraints.
- Duplicate queue delivery: queue consumers must be idempotent so repeated delivery does not create duplicate active reports, corrupt take state, or mislabel stale comparisons.
- Long wall time: full S10 analysis may exceed practical Worker execution limits and may require chunking, retries, staged status updates, or a later durable orchestration pattern.
- Report parity: moving runtime must not change S10 judgement, scoring basis, selected-level calibration, role/material treatment, red-line filtering, or report routing.

## Acceptance Criteria

- A full-length take completes or safe-errors outside Lovable inbound request runtime.
- Heavy S10 analysis does not use `waitUntil` as its durability mechanism.
- No Lovable inbound long request is required for heavy S10 analysis.
- The generated report, analysis status, and relevant diagnostics are persisted to owned Supabase.
- The Lovable UI renders the report from owned Supabase.
