import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck, MailX } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brandTitle } from "@/config/brand";
import { unsubscribeFromLifecycleEmails } from "@/lib/unsubscribe.functions";

type UnsubscribeState =
  | { status: "idle" | "loading" }
  | { status: "done"; email: string | null }
  | { status: "invalid" }
  | { status: "error"; message: string };

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => ({
    meta: [{ title: brandTitle("Unsubscribe") }, { name: "robots", content: "noindex,nofollow" }],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const unsubscribe = useServerFn(unsubscribeFromLifecycleEmails);
  const { token } = Route.useSearch();
  const [state, setState] = useState<UnsubscribeState>({ status: "idle" });

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ status: "invalid" });
      return;
    }
    setState({ status: "loading" });
    unsubscribe({ data: { token } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setState({ status: "done", email: result.email });
        } else {
          setState({ status: "invalid" });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [token, unsubscribe]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-6 py-16">
        <section className="rounded-md border border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
              {state.status === "done" ? (
                <MailCheck className="h-5 w-5" />
              ) : (
                <MailX className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-foreground">
                {state.status === "done"
                  ? "Unsubscribed"
                  : state.status === "loading"
                    ? "Processing unsubscribe"
                    : "Unsubscribe link unavailable"}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {state.status === "done"
                  ? `${state.email ?? "This email address"} will no longer receive TapeCoach lifecycle emails. Service messages, such as report status or credit updates, may still be sent when needed.`
                  : state.status === "loading"
                    ? "Please wait while TapeCoach updates your email preferences."
                    : state.status === "error"
                      ? "TapeCoach could not update this unsubscribe request. Please contact support@tapecoach.co.uk."
                      : "This unsubscribe link is missing or has expired. Please contact support@tapecoach.co.uk."}
              </p>
              {state.status === "error" ? (
                <pre className="mt-3 overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                  {state.message}
                </pre>
              ) : null}
            </div>
          </div>
          <Button asChild className="mt-5">
            <Link to="/">Return to TapeCoach</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
