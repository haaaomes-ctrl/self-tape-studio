export const VIDEO_DURATION_POLICY_VERSION = "s10-1-ds-15";

export const VIDEO_DURATION_SOFT_LIMIT_SECONDS = 5 * 60;
export const VIDEO_DURATION_HARD_LIMIT_SECONDS = 10 * 60;

export const VIDEO_DURATION_SOFT_WARNING_COPY =
  "Your video is over 5 minutes. TapeCoach can still analyse it, but longer tapes may take more time to process and can make the report less focused. For best results, upload the exact material requested in your brief. If your brief asks for a longer tape or multiple components, you can continue.";

export const VIDEO_DURATION_HARD_CAP_COPY =
  "This video is over TapeCoach's 10-minute limit. Please upload a version under 10 minutes. Keep the required audition material from your brief, and only trim unrelated lead-in, dead time or unused footage. If the brief specifically requires a longer tape, contact support.";

export const VIDEO_DURATION_SUPPORT_EMAIL = "support@tapecoach.co.uk";

export const VIDEO_DURATION_EVENT_NAMES = [
  "video_duration_warning_shown",
  "video_duration_warning_accepted",
  "video_duration_hard_cap_blocked",
] as const;

export type VideoDurationEventName = (typeof VIDEO_DURATION_EVENT_NAMES)[number];

export type VideoDurationStatus = "within_target" | "over_soft_guidance" | "over_hard_cap";

export type VideoDurationBand = "0_5_minutes" | "5_10_minutes" | "over_10_minutes";

export type VideoDurationCostBand = "standard_analysis" | "longer_analysis" | "blocked";

export interface VideoDurationDecision {
  durationSeconds: number;
  status: VideoDurationStatus;
  band: VideoDurationBand;
  costBand: VideoDurationCostBand;
  costReportingUnits: number;
  canUpload: boolean;
  requiresAcknowledgement: boolean;
  message: string | null;
}

export interface VideoDurationSignals {
  duration_seconds: number;
  duration_status: VideoDurationStatus;
  duration_band: VideoDurationBand;
  duration_cost_band: VideoDurationCostBand;
  duration_cost_reporting_units: number;
  duration_policy_version: string;
  duration_source: "browser_metadata" | "mux_metadata" | "checklist_metadata" | "signals";
}

export interface VideoDurationReportingInput {
  mux_duration_seconds?: number | null;
  signals?: unknown;
  checklist?: unknown;
}

export interface VideoDurationReportingRow extends VideoDurationSignals {
  source: VideoDurationSignals["duration_source"] | "unavailable";
}

export interface VideoDurationBandSummary {
  statusCounts: Record<VideoDurationStatus, number>;
  bandCounts: Record<VideoDurationBand, number>;
  totalCostReportingUnits: number;
  unavailableCount: number;
}

function finitePositiveNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normaliseDurationSeconds(seconds: number): number {
  return Math.round(seconds * 100) / 100;
}

export function classifyVideoDuration(seconds: number): VideoDurationStatus {
  if (seconds > VIDEO_DURATION_HARD_LIMIT_SECONDS) return "over_hard_cap";
  if (seconds > VIDEO_DURATION_SOFT_LIMIT_SECONDS) return "over_soft_guidance";
  return "within_target";
}

export function videoDurationBandForStatus(status: VideoDurationStatus): VideoDurationBand {
  if (status === "over_hard_cap") return "over_10_minutes";
  if (status === "over_soft_guidance") return "5_10_minutes";
  return "0_5_minutes";
}

export function videoDurationCostBandForStatus(status: VideoDurationStatus): VideoDurationCostBand {
  if (status === "over_hard_cap") return "blocked";
  if (status === "over_soft_guidance") return "longer_analysis";
  return "standard_analysis";
}

export function videoDurationCostReportingUnits(status: VideoDurationStatus): number {
  if (status === "over_hard_cap") return 0;
  if (status === "over_soft_guidance") return 2;
  return 1;
}

export function buildVideoDurationDecision(seconds: number): VideoDurationDecision {
  const durationSeconds = normaliseDurationSeconds(seconds);
  const status = classifyVideoDuration(durationSeconds);
  return {
    durationSeconds,
    status,
    band: videoDurationBandForStatus(status),
    costBand: videoDurationCostBandForStatus(status),
    costReportingUnits: videoDurationCostReportingUnits(status),
    canUpload: status !== "over_hard_cap",
    requiresAcknowledgement: status === "over_soft_guidance",
    message:
      status === "over_hard_cap"
        ? VIDEO_DURATION_HARD_CAP_COPY
        : status === "over_soft_guidance"
          ? VIDEO_DURATION_SOFT_WARNING_COPY
          : null,
  };
}

export function buildVideoDurationSignals(
  seconds: number,
  source: VideoDurationSignals["duration_source"] = "browser_metadata",
): VideoDurationSignals {
  const decision = buildVideoDurationDecision(seconds);
  return {
    duration_seconds: decision.durationSeconds,
    duration_status: decision.status,
    duration_band: decision.band,
    duration_cost_band: decision.costBand,
    duration_cost_reporting_units: decision.costReportingUnits,
    duration_policy_version: VIDEO_DURATION_POLICY_VERSION,
    duration_source: source,
  };
}

export function formatVideoDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export function isVideoDurationEventName(value: unknown): value is VideoDurationEventName {
  return (
    typeof value === "string" && (VIDEO_DURATION_EVENT_NAMES as readonly string[]).includes(value)
  );
}

export function extractTakeDurationReporting(
  input: VideoDurationReportingInput,
): VideoDurationReportingRow | null {
  const muxSeconds = finitePositiveNumber(input.mux_duration_seconds);
  if (muxSeconds != null) {
    return { ...buildVideoDurationSignals(muxSeconds, "mux_metadata"), source: "mux_metadata" };
  }

  const signals =
    input.signals && typeof input.signals === "object"
      ? (input.signals as Record<string, unknown>)
      : null;
  const signalSeconds =
    finitePositiveNumber(signals?.duration_seconds) ?? finitePositiveNumber(signals?.duration);
  if (signalSeconds != null) {
    return { ...buildVideoDurationSignals(signalSeconds, "signals"), source: "signals" };
  }

  const checklist =
    input.checklist && typeof input.checklist === "object"
      ? (input.checklist as Record<string, unknown>)
      : null;
  const checklistDuration =
    checklist?.duration && typeof checklist.duration === "object"
      ? (checklist.duration as Record<string, unknown>)
      : null;
  const checklistSeconds = finitePositiveNumber(checklistDuration?.seconds);
  if (checklistSeconds != null) {
    return {
      ...buildVideoDurationSignals(checklistSeconds, "checklist_metadata"),
      source: "checklist_metadata",
    };
  }

  return null;
}

export function summariseVideoDurationBands(
  inputs: VideoDurationReportingInput[],
): VideoDurationBandSummary {
  const summary: VideoDurationBandSummary = {
    statusCounts: {
      within_target: 0,
      over_soft_guidance: 0,
      over_hard_cap: 0,
    },
    bandCounts: {
      "0_5_minutes": 0,
      "5_10_minutes": 0,
      over_10_minutes: 0,
    },
    totalCostReportingUnits: 0,
    unavailableCount: 0,
  };

  for (const input of inputs) {
    const row = extractTakeDurationReporting(input);
    if (!row) {
      summary.unavailableCount += 1;
      continue;
    }
    summary.statusCounts[row.duration_status] += 1;
    summary.bandCounts[row.duration_band] += 1;
    summary.totalCostReportingUnits += row.duration_cost_reporting_units;
  }

  return summary;
}
