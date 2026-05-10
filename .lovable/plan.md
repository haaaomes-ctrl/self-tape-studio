
## Hero & brand polish — round 2

Frontend-only. No business logic, no backend.

### 1. Restore + evolve the original brand mark

The current `BrandMark` (a generic play triangle on a flat tile) is a regression. The original `Brand_Icon.png` is a chunky **triangular "play" silhouette with a navy → purple → pink gradient and a white lightning/zig-zag line cutting through it** — that's the mark to evolve, and it's also (in a smaller, cleaner form) what the reference screenshot uses.

Approach:
- Rewrite `src/components/brand-mark.tsx` as an inline SVG that recreates this shape:
  - Rounded triangular "play" pointing right (not a square tile), matching the original silhouette.
  - Diagonal gradient `oklch` stops: deep navy `#0F1547` → violet `#6B3FD4` → soft pink `#E89BB0` (matched to the PNG).
  - White zig-zag stroke running diagonally across the play form (slightly offset highlight underneath for the soft glow seen in the original).
  - Drop the "tile background"; the gradient lives inside the play shape itself.
- Keep the same `size` / `className` props so `site-header.tsx` and `site-footer.tsx` need no changes.
- Keep `src/assets/tapecoach-logo.png` as the OG fallback; nothing else uses the PNG directly.

### 2. Remove the "Private self-tape feedback" eyebrow

In `src/routes/index.tsx`, delete the `<span>` chip with the `Sparkles` icon above the H1 (and drop the now-unused `Sparkles` import). The H1 becomes the first element in the hero copy block.

### 3. Lighten the hero scrim

The current left scrim is `0.97 → 0.92 → 0.55 → 0` — too heavy, washes the photo. Reference has almost no overlay; just enough to keep text legible.

Change to a softer left-only gradient:
- `linear-gradient(90deg, oklch(0.14 0.04 260 / 0.78) 0%, oklch(0.14 0.04 260 / 0.55) 28%, oklch(0.14 0.04 260 / 0.18) 50%, transparent 70%)`
- Drop the violet radial vignette entirely (the photo already has its own warm rim light).
- Keep the tiny bottom fade but reduce to `h-16` and `0.35` opacity so the section edge stays clean without darkening the performer.

### 4. Header background — match the hero on the landing page

Yes — on `/` the header should sit on the dark hero seamlessly (as in the reference), then switch to the light app chrome on every other route.

Implementation:
- Add a `variant?: "transparent" | "solid"` prop to `SiteHeader` (default `"solid"` so dashboard/login/etc. stay unchanged).
- In `src/routes/index.tsx`, render `<SiteHeader variant="transparent" />`.
- When `variant === "transparent"` AND `!scrolled`: header is fully transparent, no border, nav links + wordmark use `text-white/85` with `hover:text-white`, "Log in" white, primary CTA keeps its royal-blue fill.
- When `variant === "transparent"` AND `scrolled`: fade to `bg-[oklch(0.14_0.04_260)]/85 backdrop-blur` with a subtle white/10 bottom border so it stays dark-on-dark, matching the hero.
- Other routes are unaffected because they don't pass the prop.

### Out of scope

Other sections (why-self-tapes, six-dimensions, example report, testimonials, footer, CTA strip), copy, routing, auth, v2/v3 reports.
