import { useEffect, useState } from "react";
import { BarChart3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  persistAnalyticsAttributionFromLocation,
  readAnalyticsConsentState,
  trackB2BLeadFromLocation,
  trackLandingViewOnce,
  trackReturnMilestones,
  writeAnalyticsConsentState,
  type AnalyticsConsentState,
} from "@/lib/analytics-attribution";

export function AnalyticsConsentBanner() {
  const [consentState, setConsentState] = useState<AnalyticsConsentState>("unknown");

  useEffect(() => {
    const state = readAnalyticsConsentState();
    setConsentState(state);
    if (state === "analytics_granted") {
      persistAnalyticsAttributionFromLocation();
      trackLandingViewOnce();
      trackReturnMilestones();
      trackB2BLeadFromLocation();
    }
  }, []);

  if (consentState !== "unknown") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-md border border-border bg-card p-4 shadow-elevated">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold text-foreground">
              Analytics and attribution
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Allow TapeCoach to remember campaign, creator and partner attribution and understand
              aggregate report-use habits.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              writeAnalyticsConsentState("essential_only");
              setConsentState("essential_only");
            }}
          >
            Essential only
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              writeAnalyticsConsentState("analytics_granted");
              setConsentState("analytics_granted");
              persistAnalyticsAttributionFromLocation();
              trackLandingViewOnce();
              trackReturnMilestones();
              trackB2BLeadFromLocation();
            }}
          >
            Allow
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Dismiss analytics notice"
            onClick={() => {
              writeAnalyticsConsentState("analytics_denied");
              setConsentState("analytics_denied");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsRouteTracker() {
  useEffect(() => {
    if (readAnalyticsConsentState() !== "analytics_granted") return;
    persistAnalyticsAttributionFromLocation();
    trackLandingViewOnce();
    trackReturnMilestones();
    trackB2BLeadFromLocation();
  }, []);

  return null;
}
