import { Link } from "@tanstack/react-router";
import { LEGAL_POLICY_LINKS, type LegalPolicySlug } from "@/lib/legal-policies";
import { cn } from "@/lib/utils";

const defaultLinkClass =
  "font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function LegalPolicyLink({
  slug,
  children,
  className,
}: {
  slug: LegalPolicySlug;
  children?: React.ReactNode;
  className?: string;
}) {
  const target = LEGAL_POLICY_LINKS.find((link) => link.slug === slug);
  if (!target) return null;

  return (
    <Link
      to={target.to}
      className={cn(defaultLinkClass, className)}
      onClick={(event) => event.stopPropagation()}
    >
      {children ?? target.label}
    </Link>
  );
}

export function UploadPolicyNotice({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      Uploads are processed under the <LegalPolicyLink slug="terms">Terms</LegalPolicyLink>,{" "}
      <LegalPolicyLink slug="privacy">Privacy Policy</LegalPolicyLink> and{" "}
      <LegalPolicyLink slug="ai-report-disclaimer">AI report disclaimer</LegalPolicyLink>. Credit
      restoration for failed reports is covered in the{" "}
      <LegalPolicyLink slug="refund-credit-policy">Refund and credit policy</LegalPolicyLink>.
    </p>
  );
}
