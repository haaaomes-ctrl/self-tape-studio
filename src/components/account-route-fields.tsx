import { Checkbox } from "@/components/ui/checkbox";
import { LegalPolicyLink } from "@/components/legal-policy-links";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  isParentManagedRoute,
  type AccountRoute,
  type AccountRouteFormState,
} from "@/lib/account-compliance";
import { cn } from "@/lib/utils";

type AccountRouteFieldsProps = {
  value: AccountRouteFormState;
  onChange: (next: AccountRouteFormState) => void;
  disabled?: boolean;
};

const routes: Array<{
  value: AccountRoute;
  label: string;
  description: string;
}> = [
  {
    value: "self_service_13_plus",
    label: "13+ self-service",
    description: "For performers aged 13 or over managing their own account.",
  },
  {
    value: "parent_guardian",
    label: "Parent / guardian",
    description: "For an adult managing access for a young performer.",
  },
  {
    value: "under_13",
    label: "Under 13 performer",
    description: "Requires parent/guardian attestation before the account can be used.",
  },
];

export function AccountRouteFields({ value, onChange, disabled = false }: AccountRouteFieldsProps) {
  const parentManaged = isParentManagedRoute(value.accountRoute);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium">Account route</Label>
        <RadioGroup
          value={value.accountRoute}
          onValueChange={(next) =>
            onChange({
              ...value,
              accountRoute: next as AccountRoute,
              parentGuardianAttested: isParentManagedRoute(next as AccountRoute)
                ? value.parentGuardianAttested
                : false,
            })
          }
          className="mt-3 grid gap-3"
          disabled={disabled}
        >
          {routes.map((route) => (
            <Label
              key={route.value}
              htmlFor={`account-route-${route.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-colors hover:border-primary/50",
                value.accountRoute === route.value && "border-primary bg-primary/5",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <RadioGroupItem
                id={`account-route-${route.value}`}
                value={route.value}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">{route.label}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {route.description}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>

      {parentManaged && (
        <CheckboxRow
          id="parent-guardian-attestation"
          checked={value.parentGuardianAttested}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, parentGuardianAttested: checked })}
          label={
            value.accountRoute === "under_13"
              ? "I am the parent/guardian managing this under-13 performer account."
              : "I am the parent/guardian, or I have parent/guardian permission to manage this account."
          }
        />
      )}

      <div className="space-y-3">
        <Label className="text-sm font-medium">Required acceptance</Label>
        <CheckboxRow
          id="terms-accepted"
          checked={value.termsAccepted}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, termsAccepted: checked })}
          label={
            <>
              I accept the <LegalPolicyLink slug="terms">Terms of Service</LegalPolicyLink>.
            </>
          }
        />
        <CheckboxRow
          id="privacy-accepted"
          checked={value.privacyAccepted}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, privacyAccepted: checked })}
          label={
            <>
              I accept the <LegalPolicyLink slug="privacy">Privacy Policy</LegalPolicyLink>.
            </>
          }
        />
        <CheckboxRow
          id="ai-disclaimer-accepted"
          checked={value.aiDisclaimerAccepted}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, aiDisclaimerAccepted: checked })}
          label={
            <>
              I understand TapeCoach uses AI analysis, as described in the{" "}
              <LegalPolicyLink slug="ai-report-disclaimer">Disclaimer</LegalPolicyLink>,
              and cannot guarantee casting, callback, booking or employment outcomes.
            </>
          }
        />
      </div>

      <CheckboxRow
        id="marketing-consent"
        checked={value.marketingConsent}
        disabled={disabled}
        onCheckedChange={(checked) => onChange({ ...value, marketingConsent: checked })}
        label="Send me optional product and launch emails."
        helper="Marketing consent is separate and starts off."
      />
    </div>
  );
}

function CheckboxRow({
  id,
  checked,
  disabled,
  onCheckedChange,
  label,
  helper,
}: {
  id: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        className="mt-0.5"
      />
      <Label htmlFor={id} className="text-sm leading-relaxed">
        {label}
        {helper && (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{helper}</span>
        )}
      </Label>
    </div>
  );
}
