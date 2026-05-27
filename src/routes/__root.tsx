import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsConsentBanner, AnalyticsRouteTracker } from "@/components/analytics-consent";
import { brand, brandHeadDefaults } from "@/config/brand";

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
      { title: brandHeadDefaults.title },
      { name: "description", content: brandHeadDefaults.description },
      { name: "author", content: brand.name },
      { property: "og:title", content: brandHeadDefaults.ogTitle },
      { property: "og:description", content: brandHeadDefaults.ogDescription },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: brand.name },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: brandHeadDefaults.twitterTitle },
      { name: "twitter:description", content: brandHeadDefaults.twitterDescription },
      { property: "og:image", content: brandHeadDefaults.ogImage },
      { name: "twitter:image", content: brandHeadDefaults.ogImage },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: brand.assets.favicon },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@400;700;900&display=swap",
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
  return (
    <>
      <AnalyticsRouteTracker />
      <Outlet />
      <AnalyticsConsentBanner />
    </>
  );
}
