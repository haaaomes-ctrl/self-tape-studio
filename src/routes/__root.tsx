import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold tracking-tight text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SelfTape — Honest feedback on your audition tape" },
      {
        name: "description",
        content:
          "Upload a self-tape and get coach-like, brief-aware feedback in minutes. Casting headline, scores, timestamped notes, and what to fix first.",
      },
      { name: "author", content: "SelfTape" },
      { property: "og:title", content: "SelfTape — Honest feedback on your audition tape" },
      {
        property: "og:description",
        content:
          "Upload a self-tape and get coach-like, brief-aware feedback in minutes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "SelfTape — Honest feedback on your audition tape" },
      { name: "description", content: "Self-Tape Studio provides AI-powered feedback for audition tapes." },
      { property: "og:description", content: "Self-Tape Studio provides AI-powered feedback for audition tapes." },
      { name: "twitter:description", content: "Self-Tape Studio provides AI-powered feedback for audition tapes." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9798fe19-4dbb-45b5-9487-32c83e228598/id-preview-b7d444ff--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app-1777409239157.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9798fe19-4dbb-45b5-9487-32c83e228598/id-preview-b7d444ff--af0c387f-c90b-4efa-b943-dc325d1a44f5.lovable.app-1777409239157.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-center" />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
