I want to continue the design planning from your plan

&nbsp;

## Cinematic aperture loading card with fluid stick character

### Scope

Update `src/components/audition/ProcessingTakeView.tsx` (shared by `/audition/$auditionId` and `/demo-processing`) to replace the small Loader2 spinner with the selected "Cinematic aperture" treatment: a hero panel featuring an animated stick character with a fluid, melting motion style, a scanning grid background, and the 6-stage list intact below.

Both the demo route and the real processing screen will receive the redesign — the user asked to "bring to life the 6 stages", and both routes share this component.

### Visual approach

Match the selected prototype's composition exactly:

- Rounded bordered card with offset shadow on an off-white page.
- Hero panel (~h-72) on top: subtle dotted grid background + a vertical scan-line that sweeps top→bottom on loop.
- Centred stick figure (head, torso, two arms, two legs) with `body-bounce`, `head-bob`, and limb-swing keyframes — extended into a **fluid, melting** style via:
  - SVG figure using `<path>` limbs with control points that ripple (CSS variable / SMIL) so limbs flow rather than pivot rigidly.
  - A soft `filter: url(#goo)` SVG gooey filter on the figure group so head/joints blob-merge during motion.
  - Gentle skew/wobble on the torso for a drip feel.
- Small mono "Subject_01: Active" status chip in the hero corner.
- Stage-aware: the figure's motion shifts subtly per stage (amplitude/timing toggled via a `data-stage` attribute) so each step feels different. Stage list and all copy stay intact.
- Below the hero: title (Merriweather), one-line subtitle, the full 6-step list with done / active-pulse / pending rows.
- Footer chip shows the existing **elapsed timer** (not an "estimated remaining" — AGENTS forbids predicting non-deterministic ETAs).

### Brand reconciliation

The prototype was neo-brutalist mono (#1A1A1A / #F4F4F4). To honour brand memory:

- Keep the prototype's bordered-card composition, scan-line, gooey character, mono chip.
- Recolour: card border + figure stroke → navy `#091E42`; scan-line + active pulse → royal `#2F80ED`; active stage glow → violet `#7B4DFF`; page bg → off-white `#F8F9FB`; done ticks → success `#2F855A`. All via existing semantic tokens.
- Headline font: Merriweather. Mono chip: system mono stack (no new font dependency).

Say the word if you'd rather I keep the verbatim mono palette instead.

### Files touched

- `src/components/audition/ProcessingTakeView.tsx` — replace the hero spinner block with the SVG character + scan-line + status chip; keep timer, stage list, reassurance copy, cancel link.
- `src/styles.css` — add keyframes (`limb-swing-*`, `head-bob`, `body-bounce`, `scan-line`, `melt-drip`) and the gooey SVG filter helper. No new colour tokens.
- No new packages. No route, schema, server-function, or analysis-pipeline changes.

### Verification

- `/demo-processing` — cycle all 6 stages via demo controls; confirm the character keeps moving, scan-line loops, active row pulses, timer ticks, no layout shift between stages.
- Spot-check at 375px width — card scales, character doesn't overflow.
- `tsc --noEmit` clean.

### Out of scope

- No copy changes, no removal of the 6-stage list, no progress percentage.
- No changes to `/audition/$auditionId` polling or business logic.