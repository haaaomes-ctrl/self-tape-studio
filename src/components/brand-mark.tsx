/**
 * BrandMark — TapeCoach play-triangle mark.
 *
 * Renders the official brand asset (`src/assets/brand-mark.png`), a navy →
 * violet → soft-pink play triangle with a white wave through it. The PNG is
 * background-stripped so the mark sits cleanly on dark hero, light app
 * chrome and white footer surfaces alike.
 */
import brandMarkSrc from "@/assets/brand-mark.png";

type BrandMarkProps = {
  size?: number;
  className?: string;
  title?: string;
};

export function BrandMark({ size = 36, className, title }: BrandMarkProps) {
  return (
    <img
      src={brandMarkSrc}
      width={size}
      height={size}
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      loading="lazy"
      decoding="async"
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  );
}
