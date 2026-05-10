## Goal

Refresh the homepage to match the attached reference: new hero photo, deeper contrast, and a refined gradient "play" brand mark.

## 1. Hero photo

- Copy `user-uploads://Ginger_Hero_Hair_Down.png` to `src/assets/hero-ginger.jpg` and swap the import in `src/routes/index.tsx` (replace `hero-stage.jpg`).
- Re-position the image (`object-[78%_center]`) so the performer sits to the right and the dark studio area falls behind the headline.
- Tighten the left-side gradient overlay so the navy fades to fully transparent on the right (rather than the current 4-stop wash). This gives the photo more presence and increases headline contrast.

## 2. Colour & contrast pass

- Deepen hero background to near-black-navy (matches the reference's richer dark) and brighten the "room." accent toward the example's lighter royal/cyan blue.
- Increase headline weight/size on desktop slightly and ensure body copy uses `text-sidebar-foreground` at 90% for stronger contrast.
- Keep all changes via existing semantic tokens (`--sidebar`, `--primary`); no hardcoded hexes in components. If the hero needs a darker shade, add a `--hero-bg` token in `src/styles.css` rather than inlining colour.
- Section headings and the "Coach" wordmark accent shift to the brighter royal blue used in the reference (adjust `--primary` luminance one notch if needed, verified against AA contrast on light cards).

## 3. Brand mark refinement

The reference logo is a rounded-square tile with a violet→royal→cyan diagonal gradient and a white play-triangle inset (with a subtle inner highlight). Our current logo is a flat PNG.

- Create `src/components/brand-mark.tsx` — an inline SVG component rendering:
  - 28–36px rounded square (radius ~22% of size)
  - Linear gradient from brand violet (top-left) through royal blue to a lighter cyan-blue (bottom-right) using existing brand tokens
  - White play triangle, slightly inset, with a soft inner highlight stroke
  - Accepts `size` and `className` props
- Replace the `<img src={brand.assets.logo} />` usage in `src/components/site-header.tsx` and `src/components/site-footer.tsx` with `<BrandMark />`.
- Update `src/config/brand.ts` to keep the PNG only for OG/social fallbacks; UI logos use the SVG component.
- Update the small play-icon used in the pre-footer CTA strip (if present) to the same component for consistency.

## Out of scope

- No copy changes, no new sections, no auth/business-logic changes.
- No edits to v2/v3 report code.

## Verification

- Visual check via browser screenshot at the current viewport (946px) and a desktop width to confirm hero composition, contrast and the new brand mark.
