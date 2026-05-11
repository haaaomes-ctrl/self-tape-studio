import type { ReactNode } from "react";

/**
 * PageHeader — shared dark band that sits below the site header on every
 * non-landing route. Mirrors the editorial tone of the landing hero so
 * /about, /login, /dashboard, /new and /audition all read as the same
 * product.
 */
type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Slim variant for app routes (dashboard / audition). Default is "marketing". */
  variant?: "marketing" | "app";
};

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  variant = "marketing",
}: PageHeaderProps) {
  const padY =
    variant === "app" ? "py-10 sm:py-12" : "py-14 sm:py-20";
  const titleSize =
    variant === "app"
      ? "text-3xl sm:text-4xl"
      : "text-4xl sm:text-5xl lg:text-6xl";
  return (
    <section
      aria-labelledby="page-header-title"
      className="relative isolate overflow-hidden border-b border-white/10 bg-[oklch(0.14_0.04_260)] text-white"
    >
      {/* Subtle violet wash to echo the landing hero gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_85%_30%,oklch(0.32_0.18_295_/_0.35),transparent_60%)]"
      />
      <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${padY}`}>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[oklch(0.78_0.14_255)]">
                {eyebrow}
              </p>
            )}
            <h1
              id="page-header-title"
              className={`mt-3 font-display font-bold leading-[1.05] tracking-tight text-white ${titleSize}`}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="mt-4 text-base leading-relaxed text-white/80 sm:text-lg">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </section>
  );
}
