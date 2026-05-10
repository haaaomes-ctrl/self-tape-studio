/**
 * BrandMark — TapeCoach play-triangle mark.
 *
 * Rounded triangular "play" silhouette filled with a navy → violet → soft-pink
 * gradient, with a white zig-zag (lightning) line cutting diagonally across.
 * Evolved from the original Brand_Icon.png so the wordmark and the icon read
 * as the same family across header, footer and OG.
 */
type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

let GRADIENT_ID = 0;

export function BrandMark({ size = 36, className, title }: BrandMarkProps) {
  const id = ++GRADIENT_ID;
  const gid = `brandmark-fill-${id}`;
  const sid = `brandmark-shine-${id}`;
  const cid = `brandmark-clip-${id}`;

  // Rounded play-triangle path inside a 64x64 viewBox.
  // Slightly off-centre to feel optically balanced.
  const playPath =
    "M14 8 Q14 4 18 6 L54 30 Q58 32 54 34 L18 58 Q14 60 14 56 Z";

  // White zig-zag stroke running across the play form (lightning bolt feel).
  const zig = "M18 40 L30 32 L26 38 L42 28";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={gid} x1="6" y1="6" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          {/* navy → violet → soft pink, matched to the original Brand_Icon.png */}
          <stop offset="0%" stopColor="oklch(0.22 0.10 275)" />
          <stop offset="55%" stopColor="oklch(0.50 0.20 295)" />
          <stop offset="100%" stopColor="oklch(0.82 0.10 15)" />
        </linearGradient>
        <linearGradient id={sid} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.22" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <clipPath id={cid}>
          <path d={playPath} />
        </clipPath>
      </defs>

      {/* Filled play silhouette */}
      <path d={playPath} fill={`url(#${gid})`} />
      {/* Subtle top sheen, clipped to the silhouette */}
      <path d={playPath} fill={`url(#${sid})`} />

      {/* Soft white halo behind the bolt */}
      <g clipPath={`url(#${cid})`}>
        <path
          d={zig}
          fill="none"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={zig}
          fill="none"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
