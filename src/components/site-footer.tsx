import { Link } from "@tanstack/react-router";
import { brand } from "@/config/brand";
import { BrandMark } from "@/components/brand-mark";

// Footer link groups and social media icons are intentionally hidden until
// those destinations exist. Restore FOOTER_GROUPS / SOCIALS arrays and the
// matching JSX below once the pages and social accounts are live.

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div>
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
            aria-label={`${brand.name} home`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-soft">
              <BrandMark size={28} />
            </span>
            <span>
              {brand.wordmark.lead}
              <span className="text-primary">{brand.wordmark.accent}</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sidebar-foreground/75">
            {brand.mission}
          </p>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-sidebar-foreground/10 pt-6 text-xs text-sidebar-foreground/60 sm:flex-row sm:items-center">
          <p>{brand.legal.copyright()}</p>
          <p>{brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
