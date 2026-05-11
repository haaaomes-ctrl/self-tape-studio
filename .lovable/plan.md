
## Brand mark + header polish + design consistency

Frontend-only. No business logic, routing, or backend changes.

### 1. Use the uploaded logo as the brand mark everywhere

- Copy `user-uploads://Screenshot_2026-05-01_at_11.59.45.png` → `src/assets/brand-mark.png`, trimming the white card so the background is transparent (the play-triangle mark sits cleanly on dark hero, light app chrome, and the white footer circle).
- Rewrite `src/components/brand-mark.tsx` to render an `<img>` of that asset, keeping the existing `size`, `className`, `title` props so `site-header.tsx` and `site-footer.tsx` need no changes. `width`/`height` from `size`, `alt` from `title`, lazy-loaded.
- Delete the now-unused inline SVG/gradient code. `src/assets/tapecoach-logo.png` stays untouched (still referenced by `brand.assets.logo` for OG fallback).

### 2. Footer logo in a white circle

In `src/components/site-footer.tsx`, wrap `<BrandMark />` in a 44px white circle so the dark mark stays crisp on the dark sidebar:

```tsx
<span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
  <BrandMark size={28} />
</span>
```

### 3. Landing-page header — fix legibility + flicker

The current "transparent on hero, solid when scrolled" variant is what causes both reported issues:
- Above the fold the header is fully transparent, but the hero photo has bright skin/hair tones directly under the nav links — white text disappears into them.
- As the user scrolls, the header swaps from `bg-transparent` to `bg-[oklch(...)]/85 backdrop-blur` in one step, which reads as a flicker when the hero is partially behind it.

Fix: drop the transparent state on `/` and make the header always-solid-dark on the landing page. Other routes keep the existing solid light chrome.

In `src/components/site-header.tsx`:
- Keep the `variant?: "solid" | "transparent"` prop signature, but treat `"transparent"` as **always-dark**:
  - Shell: `h-16` at top, `h-14` when scrolled, both with `bg-[oklch(0.14_0.04_260)] border-b border-white/10`. No conditional `bg-transparent`, no opacity swap.
  - Add `shadow-soft` only when `scrolled` so the section break reads, but background opacity stays constant — no flicker.
- Text colours stay on the on-dark branch (`text-white/85` → `text-white` on hover; "Coach" accent uses the light-blue token).

In `src/routes/index.tsx`:
- Keep `<SiteHeader variant="transparent" />`.
- Because the header is now opaque, lighten the hero scrim so the photo isn't double-darkened: `linear-gradient(90deg, oklch(0.14 0.04 260 / 0.62) 0%, oklch(0.14 0.04 260 / 0.32) 35%, transparent 65%)`. Bottom fade unchanged.

### 4. Apply the same design language to other pages

The landing page reads as **dark, premium, editorial**. The rest of the app (`/about`, `/login`, `/dashboard`, `/new`, `/audition/$`) currently uses generic light chrome with mismatched eyebrow chips, page titles and CTA strips — they don't feel part of the same product. Bring them into line **without rewriting their functionality**:

- **Shared page header pattern** — every non-landing page gets a short dark band that mirrors the landing hero: full-width `bg-[oklch(0.14_0.04_260)]` with off-white type, an optional eyebrow (small uppercase tracking), an H1 in Merriweather, and a one-line subtitle. The page body sits on the existing light `background` directly below.
  - Wrap this in a small reusable component `src/components/page-header.tsx` (`{ eyebrow?, title, subtitle?, actions? }`) so each route is a 3-line change.
  - Apply on `/about`, `/login` (where it currently shows the page title), `/dashboard`, `/new`, `/audition/$auditionId`. Existing inner content/forms stay exactly as they are.

- **Eyebrow chip unification** — replace the per-page `bg-secondary` + `Sparkles` chip in `/about` with the new `PageHeader` eyebrow. Drop the bespoke chips so we don't have two eyebrow styles.

- **Button/CTA consistency** — keep using the existing `Button` variants. Where pages currently use ad-hoc anchor styles (e.g. inline "Learn more" links), switch to `<Button variant="link">` so hover/focus matches the rest of the app. No new variants.

- **Card/section surfaces** — pages that use raw `border + bg-secondary/60` blocks (e.g. the `/about` CTA card) get standardised to the same `rounded-md border border-border bg-card shadow-soft` treatment used by report and dashboard surfaces, so card geometry is consistent.

- **Footer** — already shared via `<SiteFooter />`; just make sure every page that currently omits it (audit `/login`, `/new`) renders it for visual consistency.

No copy changes, no route additions, no schema or data work.

### Out of scope

- v2/v3 report internals, scoring, server functions.
- Auth flow, dashboard data, upload pipeline.
- Marketing copy rewrites.
