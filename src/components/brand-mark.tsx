/**
 * BrandMark — TapeCoach gradient "play" tile.
 *
 * Rounded-square tile with a violet → royal → cyan diagonal gradient and a
 * white play triangle. Used in the site header, footer and CTA strip.
 */
type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

let GRADIENT_ID = 0;

export function BrandMark({ size = 36, className, title }: BrandMarkProps) {
  // Stable per-instance id so multiple marks on the page don't clash.
  const gid = `brandmark-grad-${++GRADIENT_ID}`;
  const hid = `brandmark-shine-${GRADIENT_ID}`;
  const radius = Math.round(size * 0.24);

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
        <linearGradient id={gid} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          {/* violet → royal → bright sky-blue */}
          <stop offset="0%" stopColor="oklch(0.578 0.247 287.9)" />
          <stop offset="55%" stopColor="oklch(0.609 0.182 257.3)" />
          <stop offset="100%" stopColor="oklch(0.78 0.14 235)" />
        </linearGradient>
        <linearGradient id={hid} x1="0" y1="0" x2="0" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0.28" />
          <stop offset="55%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx={radius} ry={radius} fill={`url(#${gid})`} />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx={radius - 1}
        ry={radius - 1}
        fill={`url(#${hid})`}
      />
      {/* Play triangle, optically centred */}
      <path
        d="M25 19.5 L47 31.2 a1 1 0 0 1 0 1.6 L25 44.5 a1 1 0 0 1 -1.5 -0.85 V20.35 A1 1 0 0 1 25 19.5 Z"
        fill="white"
      />
    </svg>
  );
}
