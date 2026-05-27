import { createFileRoute } from "@tanstack/react-router";
import { LegalPolicyPage } from "@/components/legal-policy-page";
import { getLegalPolicy } from "@/lib/legal-policies";
import { brandTitle } from "@/config/brand";

const policy = getLegalPolicy("cookies");

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: brandTitle(policy.title) },
      { name: "description", content: policy.description },
    ],
  }),
  component: () => <LegalPolicyPage policy={policy} />,
});
