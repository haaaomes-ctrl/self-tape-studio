import { createFileRoute } from "@tanstack/react-router";
import { ConsumerTopUpProducts } from "@/components/consumer-top-up-products";
import { PageHeader } from "@/components/page-header";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { brandTitle } from "@/config/brand";

export const Route = createFileRoute("/credits")({
  head: () => ({
    meta: [
      { title: brandTitle("Credits") },
      {
        name: "description",
        content:
          "TapeCoach credit information, including optional paid top-ups that sit behind free and partner-funded access.",
      },
    ],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <PageHeader
        eyebrow="Credits"
        title="TapeCoach credits"
        subtitle="Free monthly and partner-funded access come first. Paid top-ups are optional."
        variant="app"
      />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
        <ConsumerTopUpProducts />
      </main>
      <SiteFooter />
    </div>
  );
}
