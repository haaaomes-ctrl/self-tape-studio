
# Rubric & Report Audit — per audition type

Read-only audit. No code changes proposed in this step. The Musical Theatre 4-minute (acting + song, brief and baseline) flow is treated as the regression anchor throughout.

## 1. Audition types currently supported

Defined in `src/lib/audition-rules.ts` (`AuditionType`) and mirrored in `src/server/evidence-pass.server.ts` and `src/server/process-take.server.ts`:

- `acting_scene`
- `monologue`
- `song`
- `musical_theatre`
- `dance`
- `commercial`
- `hybrid`
- `unknown`

Component-level enum (used inside `detected_components` in the report tool) is slightly narrower: `acting_scene | song | monologue | dance | commercial | slate | other`. There is no `musical_theatre` component — MT is represented as multiple components (e.g. `acting_scene` + `song`), which is what the current MT flow relies on.

## 2. Rubric categories (unchanged) and which are relevant per type

Six scoring categories exist today and stay as-is: `acting`, `vocal`, `audio`, `technical`, `brief_adherence`, `professional_presentation`. Weights from `weightsForType()`:

| Type | acting | vocal slot | audio | technical | brief | prof. pres. |
|---|---|---|---|---|---|---|
| acting_scene / monologue | 0.45 | 0.20 (spoken delivery) | 0.10 | 0.10 | 0.15 | implicit |
| song | 0.15 | 0.45 (sung) | 0.10 | 0.20 | 0.10 | implicit |
| musical_theatre | 0.30 | 0.30 (sung + spoken) | 0.10 | 0.15 | 0.15 | implicit |
| dance | 0.25 | 0.35 (technique proxy) | 0.05 | 0.25 | 0.10 | implicit |
| commercial | 0.60 | — | 0.05 | 0.15 | 0.20 | implicit |
| hybrid / unknown | 0.35 | 0.25 | 0.10 | 0.15 | 0.15 | implicit |

Notes:
- `professional_presentation` is always scored and shown today; it is not in the weights table because it feeds the `brief_adherence` family server-side.
- The `vocal` slot is semantically overloaded: sung performance for `song` / `musical_theatre`; spoken delivery for `acting_scene` / `monologue` / `commercial`; technique proxy for `dance`. The score itself stays — only the **label and category note framing** are mismatched.

## 3. Report sections — show / hide / rename per type

Report sections rendered in `src/routes/audition.$auditionId.tsx` `TakeView`:

```text
A. Casting headline + verdict + overall + block reasons + trust indicator
B. Submission risk flags (+ casting risk explanations)
C. Role fit (brief mode + non-empty role_fit_notes)
D. Presentation notes
E. Component breakdown (only when ≥2 components)
F. Category breakdown (any non-null category)
G. Brief / Standards adherence breakdown
H. Fix this first
I. Top strengths + Top improvements
J. Timestamped notes
K. Next take plan (coaching drills)
L. Technical signals (collapsed details)
```

Recommended per-type behaviour (UI-only mapping, no schema change):

| Section | acting / monologue | song | musical_theatre | dance | commercial | hybrid / unknown |
|---|---|---|---|---|---|---|
| A Headline/verdict | show | show | show | show | show | show |
| B Risk flags | show | show | show | show | show | show |
| C Role fit | brief mode only | brief mode only | brief mode only | brief mode only | brief mode only | brief mode only |
| D Presentation notes | show | show | show | show | show (esp. clothing/lens) | show |
| E Component breakdown | hide (single component) | hide unless spoken intro | **show** (acting + song) | hide unless mixed | hide | show when ≥2 |
| F Category breakdown | acting, **Voice / Speech**, audio, tech, brief, prof. pres. | **vocal (sung)**, audio, tech, brief, prof. pres.; hide acting if no spoken acting present | acting, vocal (sung), audio, tech, brief, prof. pres. | tech, audio, brief, prof. pres.; **hide vocal unless singing detected**; rename vocal slot if used for "Movement technique" | acting (presence/naturalism), audio, tech, brief, prof. pres.; hide vocal | show all populated |
| G Brief breakdown | show | show | show | show | show | show |
| H Fix first | show | show | show | show | show | show |
| I Strengths/improvements | show | show — must not invent acting feedback if no spoken content | show — must cover both components | show | show — focus on presence/naturalism/clarity | show |
| J Timestamps | show | show | **must span both acting and song** for MT regression | show | show | show |
| K Drills | show | show | show | show | show | show |
| L Technical signals | show | show | show | show | show | show |

Renames (label-only, no schema change):
- `vocal` → "Voice / Speech delivery" for `acting_scene`, `monologue`, `commercial`, `hybrid` when no singing detected.
- `vocal` → "Vocal performance" for `song` and `musical_theatre`.
- `vocal` → "Movement / technique" for `dance` (only when the slot is actually used).
- `acting` → "Presence & naturalism" for `commercial`.
- `brief_adherence` already toggles to "Standards" in baseline — keep.

## 4. Are new rubric categories needed?

No. All target outcomes can be expressed with the existing six categories plus existing component scores. The only addition users would perceive is the "musical interpretation" idea for MT — that already lives **inside `vocal`** per the server prompt at `process-take.server.ts:298` and as a per-component note in `detected_components`. Surfacing it does not require a new rubric category.

## 5. Sections currently inappropriate for some types

- **Acting category** is always present in the schema (`required` in `scores`), so a song-only tape can still receive an `acting` score and an `acting` category note even when there is no spoken acting. That risks "acting-scene feedback" appearing on a song-only tape.
- **Vocal label "Vocal"** appears for spoken-only tapes (acting/monologue/commercial), which reads as a singing comment.
- **Component breakdown** shows whenever `detected_components.length > 1`. Good for MT, but a single-component song or monologue should never show it — current logic is already correct (`showComponents = components.length > 1`).
- **Role fit** is gated on brief mode and non-empty notes — good. Baseline mode already suppresses it.
- **Brief adherence breakdown** title is renamed to "Professional standards breakdown" in baseline — good. But `material_compliance` wording inside notes can still leak brief-style language; that is a copy concern, not a structural one.

## 6. Does the UI already support conditional sections?

Partially. The current UI conditionals are:

- Component breakdown: `components.length > 1` ✓
- Role fit: `mode === "brief"` and notes present ✓
- Presentation notes: array length > 0 ✓
- Risk flags: array length > 0 ✓
- Brief breakdown: object present ✓
- Category rows: per-row null check (`if (score == null) return null`) ✓

What is **not** conditional today:
- Category labels are static (`{ key: "vocal", label: "Vocal" }`).
- Strengths/improvements/drills render unconditionally with whatever the model produced — there is no audition-type filter.
- Acting score always renders if non-null, regardless of whether spoken acting was detected.

So the UI supports per-section visibility via data presence, but does **not** yet do type-aware label swaps or type-aware suppression of populated-but-irrelevant categories. That gap is the main thing a follow-up step would close.

## 7. Risks to the existing Musical Theatre acting + song flow

The MT 4-minute flow depends on:

1. The model emitting `audition_type = "musical_theatre"` and `detected_components` containing **both** an acting component and a song component.
2. Component breakdown rendering when `components.length > 1`.
3. Category breakdown showing both `acting` and `vocal` with non-null scores.
4. Timestamped notes spanning both halves of the tape (enforced today by the evidence pass instruction at `evidence-pass.server.ts:277`).
5. Weights from `weightsForType("musical_theatre")` (acting 0.30 / vocal 0.30) being applied unchanged.

Concrete regression risks if templates become more type-specific:

- **Hiding vocal for non-singing types**: must check via `audition_type` not via "no detected song component", because MT tapes always include song. A naive "hide vocal if `acting_scene` present" rule would hide vocal on MT. Gate: only suppress vocal when `audition_type ∈ {acting_scene, monologue, commercial}`.
- **Hiding acting for `song`**: must not apply to `musical_theatre`. Same gate principle.
- **Renaming vocal label**: must key off `audition_type`, not the presence of a song component, otherwise MT (which has song) would still get "Vocal performance" — which is correct, but a hybrid acting+song tape mis-typed as `hybrid` could get the wrong label. Acceptable.
- **Component breakdown copy** ("This tape contains multiple performance components") must remain for MT. Any change that ties component breakdown to `audition_type === "hybrid"` would suppress it for MT. Current `length > 1` check is safe; do not change it.
- **Timestamp coverage**: any future filter that drops timestamps lacking a recognisable component tag could drop song timestamps if tagged as `vocal` rather than `song`. Keep timestamps unfiltered in the UI; the evidence pass already enforces chronological spread.
- **Strengths/improvements pruning**: if a future "drop acting strengths on song-only tapes" rule reads `audition_type === "song"`, it must not also fire for `musical_theatre`. Same guardrail.
- **Material policy already handles MT correctly** (no song-swap suggestions when `material_requested` is set) — leave as-is.

A regression test list for the MT case:
- `audition_type === "musical_theatre"`
- `detected_components` contains an `acting_scene` (or `monologue`) AND a `song`
- Component breakdown section is visible
- `scores.vocal` and `scores.acting` are both non-null and rendered
- `timestamped_notes` includes at least one timestamp inside each half
- Brief mode and baseline mode both produce a verdict + overall and do not error
- `score_breakdown.two_step` (when flag enabled) shows non-zero `timestamped_evidence_count`

## Recommendation for the next implementation step

Make the report **type-aware in presentation only** — no rubric, scoring, weights, thresholds, schema, or pipeline changes.

Scope of the proposed next step:

1. Add a small pure helper, e.g. `categoryLabelsForType(auditionType, detectedComponents)`, in `src/lib/audition-rules.ts`. Returns the label list currently hardcoded in `audition.$auditionId.tsx:805–812` and `1221–1229`, with type-aware overrides:
   - `vocal` label per the rename table above.
   - `acting` label → "Presence & naturalism" for `commercial`.
2. Add a `shouldRenderCategory(key, auditionType, detectedComponents)` helper that suppresses:
   - `vocal` for `acting_scene | monologue | commercial` when no `song` component is detected.
   - `acting` for `song` when no `acting_scene | monologue` component is detected.
   - Never suppresses anything for `musical_theatre`, `hybrid`, `unknown`.
3. Wire both helpers into `TakeView` (and the `CompareView` table) so labels and visibility key off `r.audition_type` and `r.detected_components`. Single source of truth.
4. Add a tiny prose guardrail in `report-polish.server.ts` enforcement: when `audition_type === "song"` and no spoken-acting component is detected, drop strengths/improvements whose only subject is acting-scene craft. Conservative — uses the existing "soft alignment" path, not deletion of anything that mentions "acting" generically. This is the only server-side change and it is opt-in via the existing two-step flag.
5. Add explicit MT regression assertions to the QA list in `.lovable/plan.md` so the next change cannot silently regress the 4-minute MT flow.

Out of scope (do not touch): `REPORT_TOOL` schema, `weightsForType`, `bandsForLevel`, `applyCapsAndLabel`, `computeBlockers`, evidence-pass tool schema, Mux pipeline, upload flow, brief extraction, material policy, two-step orchestration, DB schema, RLS, brand config.

Outcome: a song-only tape stops showing acting-scene feedback, an acting/monologue tape reads "Voice / Speech delivery" instead of "Vocal", a dance tape stops surfacing a stray "Vocal" row, a commercial tape leads with "Presence & naturalism" — and the MT 4-minute case continues to render acting + vocal + component breakdown + timestamps across both halves with identical scores.
