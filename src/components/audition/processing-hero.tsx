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
        style={{ color: "#091E42" }}
      >
        {/* Head */}
        <circle cx="80" cy="34" r="16" fill="currentColor" />
        {/* Neck blob */}
        <ellipse cx="80" cy="52" rx="6" ry="8" fill="currentColor" />
        {/* Torso */}
        <line x1="80" y1="52" x2="80" y2="130" stroke="currentColor" strokeWidth="10" strokeLinecap="round" />
        {/* Arms — wrapped so we can rotate the group */}
        <g className="tc-proc-arm-l" style={{ transformOrigin: "80px 70px" }}>
          <line x1="80" y1="70" x2="56" y2="118" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        </g>
        <g className="tc-proc-arm-r" style={{ transformOrigin: "80px 70px" }}>
          <line x1="80" y1="70" x2="104" y2="118" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        </g>
        {/* Legs */}
        <g className="tc-proc-leg-l" style={{ transformOrigin: "80px 130px" }}>
          <line x1="80" y1="130" x2="60" y2="184" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        </g>
        <g className="tc-proc-leg-r" style={{ transformOrigin: "80px 130px" }}>
          <line x1="80" y1="130" x2="100" y2="184" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
        </g>
      </svg>
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
