import { Link, useNavigate } from "@tanstack/react-router";
import { Film, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, signOut } from "@/lib/auth";

export function SiteHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Film className="h-4 w-4" />
          </span>
          SelfTape
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/about"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground" }}
          >
            About
          </Link>
          {user ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "text-foreground" }}
              >
                Dashboard
              </Link>
              <Button asChild size="sm">
                <Link to="/new">New audition</Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
