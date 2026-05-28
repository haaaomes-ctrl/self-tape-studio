import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardList, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EXAMPLE_REPORT_SUMMARY } from "@/lib/launch-assets";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/example-report")({
  head: () => ({
    meta: [
      { title: brandTitle("Example self-tape report") },
      {
        name: "description",
        content:
          "A fictional TapeCoach example report showing scoring basis, selected level, fix-first guidance and limitations.",
      },
    ],
  }),
  component: ExampleReportPage,
});

function ExampleReportPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow={EXAMPLE_REPORT_SUMMARY.label}
        title="What a TapeCoach report feels like."
        subtitle="This fictional sample shows the kind of source-aware, performer-facing guidance TapeCoach is built to produce. It is not an assessment of a real performer."
      />
      <main className="mx-auto max-w-5xl px-6 pb-24 pt-12">
        <section className="rounded-md border border-border bg-card p-6 shadow-soft sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Badge variant="outline">Example only</Badge>
              <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-foreground">
                {EXAMPLE_REPORT_SUMMARY.headline}
              </h2>
            </div>
            <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm">
              <p>
                <span className="font-semibold text-foreground">Scoring basis:</span>{" "}
                {EXAMPLE_REPORT_SUMMARY.scoringBasis}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Judged against:</span>{" "}
                {EXAMPLE_REPORT_SUMMARY.judgedAgainst}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-foreground">Recommendation:</span>{" "}
                {EXAMPLE_REPORT_SUMMARY.recommendation}
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <ReportList
              icon={ClipboardList}
              title="Brief snapshot"
              items={EXAMPLE_REPORT_SUMMARY.briefSnapshot}
            />
            <ReportList
              icon={CheckCircle2}
              title="Observed in the tape"
              items={EXAMPLE_REPORT_SUMMARY.observed}
            />
            <ReportList
              icon={ShieldAlert}
              title="Limitations"
              items={EXAMPLE_REPORT_SUMMARY.limitations}
            />
          </div>

          <div className="mt-8 grid gap-6 border-t border-border pt-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Fix first
              </p>
              <p className="mt-2 text-base leading-relaxed text-foreground">
                {EXAMPLE_REPORT_SUMMARY.fixFirst}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Preserve
              </p>
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {EXAMPLE_REPORT_SUMMARY.preserve.map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/login">
              Create account and claim free report <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/trust">Read trust and privacy notes</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function ReportList({
  icon: Icon,
  title,
  items,
}: {
  icon: typeof ClipboardList;
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="rounded-md border border-border bg-background p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
