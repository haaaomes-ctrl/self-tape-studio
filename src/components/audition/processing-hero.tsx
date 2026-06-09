import { cn } from "@/lib/utils";

/**
 * Animated hero used at the top of the processing card.
 *
 * Replaces the old <Loader2 /> spinner. A fluid, "melting" stick character
 * bounces inside a viewer panel with a dotted grid background and a scan
 * line that sweeps top-to-bottom on loop. The figure's motion is amplified
 * subtly per pipeline stage via `data-stage` (CSS reads it via CSS vars).
 *
 * Pure SVG + CSS keyframes (defined in src/styles.css). No JS animation,
 * no extra packages. Uses semantic colour tokens only.
 */
export function ProcessingHero({
  stage,
  className,
}: {
  stage: string;
  className?: string;
}) {
  return (
    <div
      data-stage={stage}
      className={cn(
        "tc-proc-hero relative mx-auto flex h-56 w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/30 sm:h-64",
        className,
      )}
    >
      {/* Dotted grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          color: "var(--brand-navy)",
        }}
      />

      {/* Scan line sweep */}
      <div
        aria-hidden
        className="tc-proc-scan pointer-events-none absolute inset-x-0 top-0 h-12"
      />

      {/* SVG figure. The morphing limb paths give the "fluid / melting"
          motion — a heavy goo filter ate the thin strokes, so we lean on
          the animation and rounded line caps instead. */}
      <svg
        aria-hidden
        viewBox="0 0 160 200"
        className="tc-proc-figure relative h-44 w-32 sm:h-52"
      >
        <g
          className="tc-proc-body"
          stroke="var(--brand-navy)"
          strokeWidth="9"
          strokeLinecap="round"
          fill="none"
        >
          {/* Head */}
          <circle cx="80" cy="34" r="16" className="tc-proc-head" fill="var(--brand-navy)" stroke="none" />
          {/* Neck merge (soft fill blob between head & torso for the gooey feel) */}
          <ellipse cx="80" cy="52" rx="6" ry="8" fill="var(--brand-navy)" stroke="none" />
          {/* Torso */}
          <path d="M80 52 Q82 90 80 130" className="tc-proc-torso" />
          {/* Limbs */}
          <path d="M80 70 Q60 92 56 118" className="tc-proc-arm-l" />
          <path d="M80 70 Q100 92 104 118" className="tc-proc-arm-r" />
          <path d="M80 130 Q66 158 60 184" className="tc-proc-leg-l" />
          <path d="M80 130 Q94 158 100 184" className="tc-proc-leg-r" />
        </g>
      </svg>

      {/* Status chip */}
      <div className="absolute bottom-3 left-3 rounded border border-border bg-background/90 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-tighter text-foreground">
        <span className="inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-primary align-middle [animation:tc-proc-pulse_1.2s_ease-in-out_infinite]" />
        <span className="ml-1.5 align-middle">Subject_01 · Active</span>
      </div>
    </div>
  );
}
