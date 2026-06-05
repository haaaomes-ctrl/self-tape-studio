// Legacy auth-callback landing. Sign-in uses emailRedirectTo = `${origin}/dashboard`
// (src/routes/login.tsx), so nothing in the live flow targets /auth/callback —
// but stale links in already-sent auth emails (and any lingering Supabase Auth
// URL configuration) still point here and previously 404ed. This route exists
// only to land those visitors on the dashboard.
//
// The redirect is performed client-side with window.location.replace so any
// auth tokens carried in the URL fragment (#access_token=…) survive the hop —
// a server-side 302 would drop the fragment before the Supabase client could
// consume it.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackRedirect,
});

function AuthCallbackRedirect() {
  useEffect(() => {
    window.location.replace(`/dashboard${window.location.search}${window.location.hash}`);
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to your dashboard…</p>
    </main>
  );
}
