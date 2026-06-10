## Goal

On the live audition processing screen (`src/routes/audition.$auditionId.tsx`), the loading state still renders the old stick-figure `ProcessingHero`. Replace it with the circular orbit animation we built in the demo so the real flow matches the approved design.

## Changes

1. **`src/routes/audition.$auditionId.tsx`**
   - Remove the `ProcessingHero` import (line 14).
   - Replace `<ProcessingHero stage={phase} />` (line 791) with the orbit hero (dark navy panel, two counter-rotating rings, glass lens core with `Eye` icon, scan sweep keyframe) — same component shape as `OrbitHero` in `src/routes/demo-processing.tsx`.
   - The `stage`/`phase` prop is not needed by the orbit hero, so it is dropped.

2. **Extract `OrbitHero` into a shared component** at `src/components/audition/orbit-hero.tsx` so both the demo route and the real audition route render the exact same animation. Update `src/routes/demo-processing.tsx` to import from the new location (delete its local copy).

3. **Delete `src/components/audition/processing-hero.tsx`** and the associated `.tc-proc-*` keyframes in `src/styles.css` (search and remove only the stick-figure-specific rules: `tc-proc-hero`, `tc-proc-scan`, `tc-proc-figure`, `tc-proc-arm-*`, `tc-proc-leg-*`, `tc-proc-pulse`). No other styles touched.

## Out of scope

- No changes to stage list, copy, timer, progress bar, or any business logic.
- No changes to the demo controls or routing.

## Verification

- Visit `/demo-processing` and a real `/audition/:id` in the "analysing" phase; confirm the same orbit animation renders, no stick figure remains, and no console errors.
