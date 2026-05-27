import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AccountRouteFields } from "@/components/account-route-fields";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { brand, brandTitle } from "@/config/brand";
import {
  buildAccountComplianceAuthMetadata,
  defaultAccountRouteFormState,
  validateAccountRouteFormState,
} from "@/lib/account-compliance";
import { saveAccountCompliance } from "@/lib/account-compliance-client";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: brandTitle("Sign in") }],
  }),
  component: LoginPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "At least 8 characters").max(128),
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountRouteForm, setAccountRouteForm] = useState(defaultAccountRouteFormState);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (mode === "signup") {
      const validationError = validateAccountRouteFormState(accountRouteForm);
      if (validationError) {
        toast.error(validationError);
        return;
      }
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirectTo = `${window.location.origin}/dashboard`;
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: redirectTo,
            data: buildAccountComplianceAuthMetadata(accountRouteForm),
          },
        });
        if (error) throw error;
        if (data.user) {
          try {
            await saveAccountCompliance(data.user.id, accountRouteForm);
          } catch (saveErr) {
            console.warn("account_compliance_signup_save_failed", saveErr);
            toast.warning("Account created. Complete the account route before uploading.");
          }
        }
        toast.success("Account created — you're in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Account"
        title={`Welcome to ${brand.name}`}
        subtitle="Sign in to upload tapes and review your reports."
        variant="app"
      />
      <main className="flex-1">
        <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-20 pt-12">
          <div className="mt-10 w-full rounded-2xl border border-border bg-card p-6 shadow-soft">
            <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-6">
                <p className="text-sm text-muted-foreground">
                  Use the email and password you signed up with.
                </p>
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <p className="text-sm text-muted-foreground">
                  Create an account to keep your tapes and reports together.
                </p>
              </TabsContent>
            </Tabs>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
              {mode === "signup" && (
                <AccountRouteFields
                  value={accountRouteForm}
                  onChange={setAccountRouteForm}
                  disabled={busy}
                />
              )}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
