import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Music2, Youtube } from "lucide-react";
import { brand } from "@/config/brand";

const FOOTER_GROUPS: Array<{
  heading: string;
  links: Array<{ label: string; to: "/" | "/about" | "/login" | "/dashboard" | "/new" }>;
}> = [
  {
    heading: "Product",
    links: [
      { label: "Features", to: "/about" },
      { label: "How it works", to: "/about" },
      { label: "Example feedback", to: "/about" },
      { label: "Pricing", to: "/about" },
    ],
  },
  {
    heading: "For Performers",
    links: [
      { label: "Self-tape tips", to: "/about" },
      { label: "Checklist", to: "/about" },
      { label: "Blog", to: "/about" },
      { label: "Support", to: "/about" },
    ],
  },
  {
    heading: "For Industry",
    links: [
      { label: "For Agents", to: "/about" },
      { label: "For Schools", to: "/about" },
      { label: "Partnerships", to: "/about" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About us", to: "/about" },
      { label: "Contact", to: "/about" },
      { label: "Privacy", to: "/about" },
      { label: "Terms", to: "/about" },
    ],
  },
];

const SOCIALS = [
  { label: "Instagram", icon: Instagram, href: brand.socials.instagram },
  { label: "TikTok", icon: Music2, href: brand.socials.tiktok },
  { label: "YouTube", icon: Youtube, href: brand.socials.youtube },
  { label: "LinkedIn", icon: Linkedin, href: brand.socials.linkedin },
];

export function SiteFooter() {
  return (
    <footer role="contentinfo" className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          {/* Mission + socials */}
          <div>
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
              aria-label={`${brand.name} home`}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-foreground p-1.5">
                <img
                  src={brand.assets.logo}
                  alt=""
                  aria-hidden="true"
                  className="h-full w-full object-contain"
                />
              </span>
              <span>
                {brand.wordmark.lead}
                <span className="text-primary">{brand.wordmark.accent}</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-foreground/75">
              {brand.mission}
            </p>
            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={`${brand.name} on ${s.label}`}
                  className="flex h-11 w-11 items-center justify-center rounded-md border border-sidebar-foreground/15 bg-sidebar-foreground/[0.04] text-sidebar-foreground/85 transition-colors hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:text-primary"
                >
                  <s.icon className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {FOOTER_GROUPS.map((group) => (
              <div key={group.heading}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
                  {group.heading}
                </p>
                <ul className="mt-4 space-y-1">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="-mx-2 inline-block rounded-md px-2 py-2 text-sm text-sidebar-foreground/90 transition-colors hover:text-primary focus-visible:text-primary"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-sidebar-foreground/10 pt-6 text-xs text-sidebar-foreground/60 sm:flex-row sm:items-center">
          <p>{brand.legal.copyright()}</p>
          <p>{brand.tagline}</p>
        </div>
      </div>
    </footer>
  );
}
