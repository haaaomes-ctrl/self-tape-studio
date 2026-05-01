import { Link } from "@tanstack/react-router";
import { Instagram, Linkedin, Music2, Youtube } from "lucide-react";
import logoUrl from "@/assets/tapecoach-logo.png";

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
  { label: "Instagram", icon: Instagram, href: "#" },
  { label: "TikTok", icon: Music2, href: "#" },
  { label: "YouTube", icon: Youtube, href: "#" },
  { label: "LinkedIn", icon: Linkedin, href: "#" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_2fr]">
          {/* Mission + socials */}
          <div>
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
              aria-label="TapeCoach home"
            >
              <img
                src={logoUrl}
                alt="TapeCoach logo"
                className="h-8 w-8 object-contain"
              />
              <span>
                Tape<span className="text-primary">Coach</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-sidebar-foreground/75">
              Private self-tape feedback before you submit.
            </p>
            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-sidebar-foreground/15 bg-sidebar-foreground/[0.04] text-sidebar-foreground/80 transition-colors hover:border-primary hover:text-primary"
                >
                  <s.icon className="h-4 w-4" />
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
                <ul className="mt-4 space-y-2.5">
                  {group.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        to={l.to}
                        className="text-sm text-sidebar-foreground/85 transition-colors hover:text-primary"
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
          <p>© {new Date().getFullYear()} TapeCoach. All rights reserved.</p>
          <p>Review your tape before it reaches the room.</p>
        </div>
      </div>
    </footer>
  );
}
