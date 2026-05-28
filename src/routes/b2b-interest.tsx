import { useServerFn } from "@tanstack/react-start";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building2, Loader2, Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  B2B_INTEREST_COHORT_SIZES,
  B2B_INTEREST_PARTNER_TYPES,
  type B2BInterestPartnerType,
} from "@/lib/b2b-interest";
import {
  B2B_INTEREST_CONTACT_EMAIL,
  LAUNCH_B2B_AUDIENCES,
  LAUNCH_B2B_CTA,
} from "@/lib/launch-assets";
import {
  buildAnalyticsAttributionMetadata,
  readAnalyticsConsentState,
  readStoredAnalyticsAttribution,
} from "@/lib/analytics-attribution";
import { submitB2BInterest } from "@/server-fns/b2b-interest.functions";
import { brandTitle } from "@/config/brand";

type FormState = {
  partnerType: B2BInterestPartnerType;
  organisation: string;
  contactName: string;
  contactRole: string;
  email: string;
  cohortSize: string;
  message: string;
  contactConsent: boolean;
  website: string;
};

const INITIAL_FORM: FormState = {
  partnerType: "school",
  organisation: "",
  contactName: "",
  contactRole: "",
  email: "",
  cohortSize: "26-60",
  message: "",
  contactConsent: false,
  website: "",
};

export const Route = createFileRoute("/b2b-interest")({
  head: () => ({
    meta: [
      { title: brandTitle("B2B interest") },
      {
        name: "description",
        content:
          "Register school, coach or agent interest in funded TapeCoach report credits for performers.",
      },
    ],
  }),
  component: B2BInterestPage,
});

function B2BInterestPage() {
  const submitInterest = useServerFn(submitB2BInterest);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState<"idle" | "submitting" | "sent" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const analyticsAttribution = buildAnalyticsAttributionMetadata(
        readStoredAnalyticsAttribution(),
      );
      await submitInterest({
        data: {
          ...form,
          sourcePath: typeof window !== "undefined" ? window.location.pathname : "/b2b-interest",
          analyticsConsentState: readAnalyticsConsentState(),
          analyticsAttribution,
        },
      });
      setStatus("sent");
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus("failed");
      setError(
        err instanceof Error
          ? err.message
          : `The form could not be sent. Email ${B2B_INTEREST_CONTACT_EMAIL}.`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Schools, coaches and agents"
        title={LAUNCH_B2B_CTA}
        subtitle="Tell us what kind of pilot you want to run. TapeCoach will follow up with capped credit options and the relevant visibility rules."
      />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 pb-24 pt-12 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-4">
          {LAUNCH_B2B_AUDIENCES.map((audience) => (
            <article key={audience.type} className="rounded-md border border-border bg-card p-5">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">
                    {audience.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {audience.body}
                  </p>
                  <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    {audience.metric}
                  </p>
                </div>
              </div>
            </article>
          ))}
          <p className="text-sm leading-relaxed text-muted-foreground">
            B2B pilots do not create leaderboards. Full reports, videos and briefs stay private by
            default unless an explicit share route is enabled.
          </p>
        </section>

        <section className="rounded-md border border-border bg-card p-6 shadow-soft">
          <h2 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Register partner interest
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            This goes to TapeCoach support with source attribution where analytics consent allows.
          </p>

          {status === "sent" ? (
            <div className="mt-6 rounded-md border border-success/25 bg-success/10 p-4 text-sm text-foreground">
              Interest recorded. TapeCoach will follow up by email.
            </div>
          ) : null}

          <form className="mt-6 space-y-5" onSubmit={onSubmit}>
            <div className="hidden" aria-hidden="true">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(event) => update("website", event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Partner type" htmlFor="partnerType">
                <select
                  id="partnerType"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.partnerType}
                  onChange={(event) =>
                    update("partnerType", event.target.value as B2BInterestPartnerType)
                  }
                >
                  {B2B_INTEREST_PARTNER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Likely cohort size" htmlFor="cohortSize">
                <select
                  id="cohortSize"
                  className="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.cohortSize}
                  onChange={(event) => update("cohortSize", event.target.value)}
                >
                  {B2B_INTEREST_COHORT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Organisation or studio" htmlFor="organisation">
              <Input
                id="organisation"
                value={form.organisation}
                onChange={(event) => update("organisation", event.target.value)}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contact name" htmlFor="contactName">
                <Input
                  id="contactName"
                  value={form.contactName}
                  onChange={(event) => update("contactName", event.target.value)}
                  required
                />
              </Field>
              <Field label="Role" htmlFor="contactRole">
                <Input
                  id="contactRole"
                  value={form.contactRole}
                  onChange={(event) => update("contactRole", event.target.value)}
                />
              </Field>
            </div>

            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                required
              />
            </Field>

            <Field label="What would you like to test?" htmlFor="message">
              <Textarea
                id="message"
                value={form.message}
                onChange={(event) => update("message", event.target.value)}
                rows={5}
              />
            </Field>

            <label className="flex items-start gap-3 rounded-md border border-border bg-secondary/35 p-3 text-sm">
              <Checkbox
                checked={form.contactConsent}
                onCheckedChange={(checked) => update("contactConsent", checked === true)}
                required
              />
              <span className="leading-relaxed text-muted-foreground">
                TapeCoach may contact me about this school, coach or agency pilot enquiry.
              </span>
            </label>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={status === "submitting"}>
                {status === "submitting" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send interest
              </Button>
              <Button asChild variant="outline">
                <Link to="/trust">
                  Review trust rules <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
