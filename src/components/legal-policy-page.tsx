import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { LegalPolicy } from "@/lib/legal-policies";

export function LegalPolicyPage({ policy }: { policy: LegalPolicy }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow={`Effective ${policy.effectiveDate}`}
        title={policy.title}
        subtitle={policy.description}
        variant="app"
        actions={
          <Button
            asChild
            variant="secondary"
            className="bg-white text-foreground hover:bg-white/90"
          >
            <Link to="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Account
            </Link>
          </Button>
        }
      />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-24 pt-12">
        <div className="space-y-10">
          {policy.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-2xl font-bold tracking-tight text-secondary-foreground">
                {section.heading}
              </h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-base leading-relaxed text-muted-foreground">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-base leading-relaxed text-muted-foreground">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
