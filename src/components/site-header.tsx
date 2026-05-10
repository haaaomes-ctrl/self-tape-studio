import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/lib/auth";
import { brand } from "@/config/brand";
import { BrandMark } from "@/components/brand-mark";

const NAV_LINKS = [
  { label: "Features", to: "/about" as const },
  { label: "Pricing", to: "/about" as const },
  { label: "Agents", to: "/about" as const },
  { label: "Schools", to: "/about" as const },
  { label: "Blog", to: "/about" as const },
  { label: "Support", to: "/about" as const },
];

type SiteHeaderProps = {
  /** "transparent" lets the header sit on top of a dark hero (used on `/`). */
  variant?: "solid" | "transparent";
};

export function SiteHeader({ variant = "solid" }: SiteHeaderProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isTransparent = variant === "transparent";
  const onDark = isTransparent; // text colour family

  const shellClass = isTransparent
    ? scrolled
      ? "h-14 border-white/10 bg-[oklch(0.14_0.04_260)]/85 shadow-soft backdrop-blur"
      : "h-16 border-transparent bg-transparent"
    : scrolled
      ? "h-14 border-border/70 bg-background/95 shadow-soft backdrop-blur"
      : "h-16 border-transparent bg-background/80 backdrop-blur";

  const wordmarkLead = onDark ? "text-white" : "text-foreground";
  const navLink = onDark
    ? "rounded-md px-2.5 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white lg:px-3"
    : "rounded-md px-2.5 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:text-primary lg:px-3";
  const sideLink = onDark
    ? "hidden min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:text-white sm:inline-flex"
    : "hidden min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:text-primary sm:inline-flex";

  return (
    <header
      role="banner"
      className={["sticky top-0 z-30 w-full border-b transition-all duration-200", shellClass].join(" ")}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Logo + wordmark */}
        <Link
          to="/"
          className="flex min-h-11 items-center gap-2 font-display font-bold tracking-tight"
          aria-label={`${brand.name} home`}
        >
          <BrandMark size={scrolled ? 28 : 34} className="transition-all duration-200" />
          <span className="text-base sm:text-lg text-foreground">
            {brand.wordmark.lead}
            <span className="text-primary">{brand.wordmark.accent}</span>
          </span>
        </Link>

        {/* Primary nav — visible from md up; condensed on md, full on lg */}
        <nav
          className="hidden items-center gap-0.5 md:flex"
          aria-label="Primary"
        >
          {NAV_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-md px-2.5 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:text-primary lg:px-3"
              activeProps={{ className: "text-primary" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="hidden min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:text-primary sm:inline-flex"
                activeProps={{ className: "text-primary" }}
              >
                Dashboard
              </Link>
              <Button asChild size="sm" className="min-h-11">
                <Link to="/new">Review my tape</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                className="h-11 w-11"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:text-primary sm:inline-flex"
              >
                Log in
              </Link>
              <Button asChild size="sm" className="min-h-11">
                <Link to="/login" aria-label="Review my tape — start a new review">
                  Review my tape
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
