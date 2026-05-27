import { createFileRoute } from "@tanstack/react-router";
import { LegalPolicyPage } from "@/components/legal-policy-page";
import { getLegalPolicy } from "@/lib/legal-policies";
import { brandTitle } from "@/config/brand";

const policy = getLegalPolicy("ai-report-disclaimer");

export const Route = createFileRoute("/legal/ai-report-disclaimer")({
  head: () => ({
    meta: [
      { title: brandTitle(policy.title) },
      { name: "description", content: policy.description },
    ],
  }),
  component: () => <LegalPolicyPage policy={policy} />,
});
