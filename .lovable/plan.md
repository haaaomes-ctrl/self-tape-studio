# SelfTape — Audition Feedback App

A brief-aware self-tape evaluator that behaves like a credible first-pass casting reader, not a lab instrument. Phase 1 ships a stable, explainable AI judge backed by lightweight technical signals — and degrades gracefully when no casting brief is provided.

## Product Principles

- **Judgement system, not a measurement system.** The AI is the primary judge; signals support it.
- **Brief-aware, but brief-optional.** The brief defines what good looks like. Without one, the system applies a professional baseline.
- **Coach-like.** Encouraging, specific, timestamped, prioritised — never harsh or vague.
- **Stable over clever.** Consistency matters more than maximum instrumentation.
- **Honest about uncertainty.** Every report carries an explicit confidence score.
- **Doesn't punish creativity.** Intentional choices are respected, not penalised.

## MVP Scope (Phase 1)

Layered confidence architecture:

```text
Layer 1 — Core intelligence (this MVP)
  Multimodal LLM (Gemini 2.5 Pro) watches + listens to the tape
  Produces all category scores, reasoning, timestamped notes

Layer 2 — Signal validators (this MVP, lightweight)
  ffprobe → duration, orientation, resolution, framerate
  Audio loudness scan → average level, clipping, silence ratio
  Signals act as MODIFIERS (±10–15 per category), never as
  dominant scoring inputs.

Layer 3 — Arbitration (this MVP, simple rules)
  Mode selection (A vs B), audio cap, brief adherence flag,
  confidence calculation, first-5-seconds modifier.
```

Phase 2 (later): speech-to-text alignment, MediaPipe pose/eyeline.
Phase 3 (later): librosa pitch tracking, musical phrasing.

## Two Evaluation Modes

**Mode A — Brief-Driven (preferred).** Used when the user provides a casting brief.
- AI extracts audition type, constraints (orientation, reader, accent, tone), priority skills.
- Dynamic weights per audition type (Singing, Acting Scene, Musical Theatre, Dance, Commercial).
- Strict compliance scoring on Brief Adherence — penalties for non-compliance.
- Higher base confidence.

**Mode B — Baseline (fallback).** Used when no brief is provided.
- Assumes Musical Theatre default. Balanced weights:
  Acting 35 / Vocal 25 (if singing detected) / Audio 15 / Technical 15 / Compliance 10.
- "Brief Adherence" becomes a **professional standards check**: clean slate, framing, audio clarity, audition etiquette. No penalties for unknown constraints.
- Lower base confidence; report explains what a brief would unlock.

## Brief Helper (NEW)

The upload form treats the brief as **optional but recommended**. Three clear paths:

1. **Paste full brief** — best accuracy.
2. **Quick guided prompt** — short structured form: role type, song/scene/mixed, reader present?, required orientation, accent, special instructions. Filled fields are stitched into a synthetic brief and treated as a "partial brief" by the confidence model.
3. **Skip** — proceed in baseline mode with a one-line nudge explaining the trade-off.

Even a partial brief from the guided prompt boosts confidence vs no brief at all.

## Pre-Upload Checklist (NEW)

Before the tape enters processing, a fast "ready to submit?" check runs in the browser using the file metadata and a lightweight audio probe. It surfaces:

- Orientation (landscape / portrait, with brief comparison if known)
- Apparent lighting brightness (from a sampled frame)
- Audio level (too quiet / clipping / OK)
- File length (within sensible self-tape range)
- Brief: provided / partial / none
- Reader: declared present / absent (from the guided prompt)

Each item shows a green tick, amber warning, or red flag. Users can:
- **Fix and re-upload** (recommended for red flags), or
- **Submit anyway** (we still process, but the relevant signal lowers confidence).

This prevents avoidable bad tapes from getting a misleading score.

## Retake Comparison (NEW)

Each audition can hold **up to 3 takes**. After the first report, the user sees an "Add another take" button. Subsequent takes share the same brief and are scored under the same mode and weights, then displayed in a **side-by-side comparison view**:

- Columns: Take 1 / Take 2 / Take 3.
- Rows: Overall, Confidence, each category, top strength, top improvement.
- Deltas highlighted (e.g. "Vocal +6", "Audio −4").
- One "best take" badge based on overall score, with a sentence explaining why.

This delivers the immediate practical value of a progress dashboard without building one.

## Scoring Model

Five pillars, each scored 0–100:

- Technical Setup
- Audio Clarity
- Vocal Performance (only when singing is present)
- Acting / Performance
- Brief Adherence (Mode A) **or** Professional Standards (Mode B)

**Final score** = Σ(category × weight) + technical modifiers + engagement modifier.

**Hard constraints (both modes):**
- Audio Clarity < 50 → cap overall at 65.
- Brief Adherence < 40 (Mode A only) → flag as **At Risk**.
- Confidence < 60 → display warning banner.
- Portrait orientation only penalised when the brief explicitly requires landscape.
- First 5 seconds: strong start +5, weak start −5.

## Confidence Score

Every report includes an Evaluation Confidence Score (0–100), derived from:
- Brief presence (none / partial / full).
- Technical signal quality (audio clarity, video resolution, duration sanity).
- Data completeness.

Bands surfaced in UI:
- 90–100 — Highly reliable
- 75–89 — Reliable, minor uncertainty
- 60–74 — Moderately reliable
- <60 — Low confidence (warning banner)

## Report Output

- **Casting Headline (NEW)** — one plain-language line at the very top:
  *"This tape is strongest for voice."* or *"This tape is most weakened by unclear audio."*
  Generated by the AI from the category spread so users see the **priority**, not just the score.
- **Confidence band** with one-line explanation.
- **Overall score** plus mode badge (Brief-Driven / Baseline).
- **Category bars** with sub-scores and one-line rationale per category.
- **Top 3 strengths** and **top 3 priority improvements**.
- **Timestamped notes**: `00:42 — Slight pitch drop on sustained note. Focus on breath support.`
- **Fix this first** — single highest-impact change.
- **Next take focus** — 3 short coaching drills.
- **Signal panel** — collapsible, shows raw readings (avg dB, resolution, orientation).

## User Flow

1. **Sign in** — email magic link.
2. **New audition** — choose: paste brief / use guided prompt / skip. Upload video.
3. **Pre-upload checklist** — quick ready-to-submit review with fix-or-proceed options.
4. **Processing screen** with live status. Copy adapts to mode.
5. **Report page** — Casting Headline at top, then full breakdown.
6. **Add another take** — repeat upload + checklist; comparison view appears with 2+ takes.
7. **History** — past auditions (each may contain 1–3 takes), score, mode, confidence.

## Pages

- `/` — Landing.
- `/login` — Magic-link sign-in.
- `/dashboard` — Past auditions list.
- `/new` — Brief input (full / guided / skip) + video upload + checklist.
- `/audition/$id` — Audition view: shows current take's report, "Add another take", and (when 2+ takes exist) the side-by-side comparison.
- `/about` — Philosophy, mode explanations, what the app does and doesn't claim.

## Visual Direction

**Studio Light** palette — clean SaaS aesthetic that feels professional and calm:

- Background near-white `#fafbfc`, soft grey panels `#e8ecf1`.
- Text deep slate, generous line-height.
- Accent `#3b82f6` for scores, primary actions, progress.
- Casting Headline rendered in a quiet hero block — large, readable, no decoration.
- Checklist uses traffic-light dots (green/amber/red) without being shouty.
- Comparison view uses tabular alignment and subtle row striping.
- Typography: modern geometric sans for headings, humanist sans for body.
- Animation: gentle fades on processing, smooth bar fills on report.

## Technical Notes (for the build)

- **Storage**: video files in a private storage bucket, owner-only RLS.
- **Database**:
  - `auditions` — `user_id`, `brief` (nullable), `brief_source` (`full` | `guided` | `none`), `mode`, `created_at`.
  - `takes` — `audition_id`, `take_number` (1–3), `video_path`, `status`, `confidence`, `scores` JSONB, `report` JSONB (includes Casting Headline), `signals` JSONB, `checklist` JSONB, `created_at`.
- **Pre-upload checklist**: runs client-side using HTMLVideoElement metadata + a single sampled frame for brightness + WebAudio analyser for peak/avg level. Results are persisted with the take.
- **Processing**: TanStack server function. Extracts metadata + audio levels server-side (re-verifies client signals), selects Mode A vs B, sends video + signals + brief to Gemini via Lovable AI Gateway in a single structured-output call, computes confidence, applies arbitration, writes the report.
- **Casting Headline**: requested as a dedicated short string in the same structured output so it's always present.
- **Comparison view**: pure read-side query joining all takes for an audition; no extra processing.
- **Model**: `google/gemini-2.5-pro` (multimodal, long context). Falls back to `gemini-2.5-flash` if rate-limited.
- **Auth**: Lovable Cloud email auth with magic links.
- **Errors surfaced**: 402 and 429 are caught and shown as toasts with clear next steps.
- **Privacy**: short note that videos are processed by an AI model and stored in the user's account; users can delete a take or full audition any time.

## Out of Scope (Phase 1)

- Speech-to-text alignment, pitch tracking, MediaPipe pose/face — Phases 2/3.
- Cross-audition progress dashboards (within-audition retake comparison covers the immediate need).
- Sharing reports with agents/coaches.
- In-app mobile capture (upload only for now).
- Social/virality scoring layer.
