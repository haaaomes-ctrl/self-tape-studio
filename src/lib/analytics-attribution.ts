import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const ANALYTICS_ATTRIBUTION_SCHEMA_VERSION = "tapecoach_analytics_attribution_v1" as const;
export const ANALYTICS_CONSENT_STORAGE_KEY = "tapecoach_analytics_consent";
export const ANALYTICS_ATTRIBUTION_STORAGE_KEY = "tapecoach_analytics_attribution";
export const ANALYTICS_SESSION_KEY_STORAGE_KEY = "tapecoach_analytics_session_key";
export const ANALYTICS_LANDING_VIEW_STORAGE_KEY = "tapecoach_analytics_landing_viewed";
export const ANALYTICS_RETURN_MILESTONES_STORAGE_KEY = "tapecoach_analytics_return_milestones";
export const ANALYTICS_B2B_LEAD_STORAGE_KEY = "tapecoach_analytics_b2b_leads";

export const ANALYTICS_EVENT_NAMES = [
  "landing_view",
  "signup",
  "free_credit_grant",
  "partner_code_activation",
  "upload",
  "report_started",
  "report_completed",
  "report_viewed",
  "second_report",
  "return_7d",
  "return_30d",
  "b2b_lead",
  "creator_code_capture",
  "partner_code_capture",
  "purchase_started",
  "purchase_completed",
] as const;

export const ANALYTICS_OBJECT_TYPES = [
  "user",
  "audition",
  "take",
  "report",
  "purchase",
  "partner_code",
  "credit_grant",
  "b2b_lead",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsObjectType = (typeof ANALYTICS_OBJECT_TYPES)[number];
export type AnalyticsConsentState =
  | "unknown"
  | "analytics_granted"
  | "analytics_denied"
  | "essential_only";

export type AnalyticsAttributionSnapshot = {
  schema_version: typeof ANALYTICS_ATTRIBUTION_SCHEMA_VERSION;
  attribution_available: true;
  consent_state: AnalyticsConsentState;
  attribution_key: string | null;
  session_key: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  creator_code: string | null;
  partner_code_hint: string | null;
  landing_path: string | null;
  referrer_host: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

export type AnalyticsAttributionMetadata = {
  schema_version: typeof ANALYTICS_ATTRIBUTION_SCHEMA_VERSION;
  attribution_available: boolean;
  consent_state: AnalyticsConsentState;
  attribution_key: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  creator_code: string | null;
  partner_code_hint: string | null;
  landing_path: string | null;
  referrer_host: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

type TrackAnalyticsEventInput = {
  eventName: AnalyticsEventName;
  objectType?: AnalyticsObjectType | null;
  objectId?: string | null;
  auditionId?: string | null;
  takeId?: string | null;
  properties?: Record<string, Json | undefined>;
};

const NON_ESSENTIAL_BROWSER_EVENTS = new Set<AnalyticsEventName>([
  "landing_view",
  "return_7d",
  "return_30d",
  "b2b_lead",
  "creator_code_capture",
  "partner_code_capture",
]);

const UNSAFE_PROPERTY_KEYS = new Set([
  "brief",
  "full_brief",
  "report",
  "raw_report",
  "prompt",
  "raw_prompt",
  "system_prompt",
  "user_prompt",
  "raw_response",
  "response_text",
  "video_url",
  "signed_url",
  "playback_url",
  "authorization",
  "api_key",
  "token",
  "secret",
  "cookie",
  "session",
]);

function browserStorage(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function randomKey(prefix: string): string {
  const maybeCrypto = globalThis.crypto;
  const raw =
    maybeCrypto && "randomUUID" in maybeCrypto
      ? maybeCrypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}_${raw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)}`;
}

function readJsonStorage<T>(key: string, kind: "local" | "session" = "local"): T | null {
  const raw = browserStorage(kind)?.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonStorage(key: string, value: unknown, kind: "local" | "session" = "local"): void {
  browserStorage(kind)?.setItem(key, JSON.stringify(value));
}

function getSessionKey(): string | null {
  const storage = browserStorage("session");
  if (!storage) return null;
  const existing = normaliseAttributionToken(
    storage.getItem(ANALYTICS_SESSION_KEY_STORAGE_KEY),
    80,
  );
  if (existing) return existing;
  const next = randomKey("session");
  storage.setItem(ANALYTICS_SESSION_KEY_STORAGE_KEY, next);
  return next;
}

export function normaliseAttributionToken(value: unknown, maxLength = 120): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  if (
    /https?:\/\//.test(lower) ||
    lower.includes("token=") ||
    lower.includes("signature=") ||
    lower.includes("signed") ||
    lower.includes("secret") ||
    lower.includes("authorization") ||
    lower.includes("cookie")
  ) {
    return null;
  }

  const cleaned = trimmed
    .replace(/[^a-zA-Z0-9._~:@/+ _-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

function normaliseCode(value: unknown): string | null {
  return normaliseAttributionToken(value, 80)?.toLowerCase() ?? null;
}

export function safePartnerCodeHint(value: unknown): string | null {
  const token = normaliseAttributionToken(value, 80);
  if (!token) return null;
  const compact = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return null;
  if (compact.length <= 8) return compact;
  return `${compact.slice(0, 3)}...${compact.slice(-3)}`;
}

function safePath(url: URL): string | null {
  const path = normaliseAttributionToken(url.pathname || "/", 160);
  return path || "/";
}

function safeReferrerHost(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    return normaliseAttributionToken(new URL(referrer).hostname, 120);
  } catch {
    return null;
  }
}

function hasAttributionSignal(attribution: Partial<AnalyticsAttributionSnapshot> | null): boolean {
  if (!attribution) return false;
  return Boolean(
    attribution.utm_source ||
    attribution.utm_medium ||
    attribution.utm_campaign ||
    attribution.utm_term ||
    attribution.utm_content ||
    attribution.creator_code ||
    attribution.partner_code_hint,
  );
}

function buildAttributionKey(
  attribution: Pick<
    AnalyticsAttributionSnapshot,
    | "utm_source"
    | "utm_medium"
    | "utm_campaign"
    | "utm_term"
    | "utm_content"
    | "creator_code"
    | "partner_code_hint"
  >,
): string | null {
  const key = [
    attribution.utm_source,
    attribution.utm_medium,
    attribution.utm_campaign,
    attribution.utm_term,
    attribution.utm_content,
    attribution.creator_code,
    attribution.partner_code_hint,
  ]
    .filter(Boolean)
    .join("|");
  return normaliseAttributionToken(key, 80);
}

function normaliseStoredAttribution(value: unknown): AnalyticsAttributionSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<AnalyticsAttributionSnapshot>;
  const firstSeenAt = normaliseAttributionToken(source.first_seen_at, 40);
  const lastSeenAt = normaliseAttributionToken(source.last_seen_at, 40);
  const attribution: AnalyticsAttributionSnapshot = {
    schema_version: ANALYTICS_ATTRIBUTION_SCHEMA_VERSION,
    attribution_available: true,
    consent_state: readAnalyticsConsentState(),
    attribution_key: normaliseAttributionToken(source.attribution_key, 80),
    session_key: normaliseAttributionToken(source.session_key, 80),
    utm_source: normaliseAttributionToken(source.utm_source, 80),
    utm_medium: normaliseAttributionToken(source.utm_medium, 80),
    utm_campaign: normaliseAttributionToken(source.utm_campaign, 120),
    utm_term: normaliseAttributionToken(source.utm_term, 120),
    utm_content: normaliseAttributionToken(source.utm_content, 120),
    creator_code: normaliseCode(source.creator_code),
    partner_code_hint: safePartnerCodeHint(source.partner_code_hint),
    landing_path: normaliseAttributionToken(source.landing_path, 160),
    referrer_host: normaliseAttributionToken(source.referrer_host, 120),
    first_seen_at: firstSeenAt ?? new Date().toISOString(),
    last_seen_at: lastSeenAt ?? firstSeenAt ?? new Date().toISOString(),
  };
  attribution.attribution_key = buildAttributionKey(attribution);
  return hasAttributionSignal(attribution) ? attribution : null;
}

export function extractAnalyticsAttributionFromUrl(
  urlInput: string,
  referrer: string | null = null,
  nowIso = new Date().toISOString(),
): AnalyticsAttributionSnapshot | null {
  let url: URL;
  try {
    url = new URL(urlInput);
  } catch {
    return null;
  }

  const params = url.searchParams;
  const attribution: AnalyticsAttributionSnapshot = {
    schema_version: ANALYTICS_ATTRIBUTION_SCHEMA_VERSION,
    attribution_available: true,
    consent_state: "analytics_granted",
    attribution_key: null,
    session_key: getSessionKey(),
    utm_source: normaliseAttributionToken(params.get("utm_source"), 80),
    utm_medium: normaliseAttributionToken(params.get("utm_medium"), 80),
    utm_campaign: normaliseAttributionToken(params.get("utm_campaign"), 120),
    utm_term: normaliseAttributionToken(params.get("utm_term"), 120),
    utm_content: normaliseAttributionToken(params.get("utm_content"), 120),
    creator_code: normaliseCode(
      params.get("creator_code") ?? params.get("creator") ?? params.get("ref"),
    ),
    partner_code_hint: safePartnerCodeHint(
      params.get("partner_code") ?? params.get("partner") ?? params.get("school_code"),
    ),
    landing_path: safePath(url),
    referrer_host: safeReferrerHost(referrer),
    first_seen_at: nowIso,
    last_seen_at: nowIso,
  };

  attribution.attribution_key = buildAttributionKey(attribution);
  return hasAttributionSignal(attribution) ? attribution : null;
}

export function mergeAnalyticsAttribution(
  existing: AnalyticsAttributionSnapshot | null | undefined,
  incoming: AnalyticsAttributionSnapshot | null | undefined,
  nowIso = new Date().toISOString(),
): AnalyticsAttributionSnapshot | null {
  const first = normaliseStoredAttribution(existing);
  const next = normaliseStoredAttribution(incoming);
  if (!first && !next) return null;
  if (!first) return next ? { ...next, last_seen_at: nowIso } : null;
  if (!next) return { ...first, last_seen_at: nowIso };

  const merged: AnalyticsAttributionSnapshot = {
    ...first,
    consent_state: readAnalyticsConsentState(),
    session_key: next.session_key ?? first.session_key,
    utm_source: first.utm_source ?? next.utm_source,
    utm_medium: first.utm_medium ?? next.utm_medium,
    utm_campaign: first.utm_campaign ?? next.utm_campaign,
    utm_term: first.utm_term ?? next.utm_term,
    utm_content: first.utm_content ?? next.utm_content,
    creator_code: next.creator_code ?? first.creator_code,
    partner_code_hint: next.partner_code_hint ?? first.partner_code_hint,
    landing_path: first.landing_path ?? next.landing_path,
    referrer_host: first.referrer_host ?? next.referrer_host,
    last_seen_at: nowIso,
  };
  merged.attribution_key = buildAttributionKey(merged);
  return hasAttributionSignal(merged) ? merged : null;
}

export function readAnalyticsConsentState(): AnalyticsConsentState {
  const value = browserStorage("local")?.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  if (
    value === "unknown" ||
    value === "analytics_granted" ||
    value === "analytics_denied" ||
    value === "essential_only"
  ) {
    return value;
  }
  if (value === "accepted") return "analytics_granted";
  if (value === "declined") return "analytics_denied";
  return "unknown";
}

export function writeAnalyticsConsentState(state: AnalyticsConsentState): void {
  browserStorage("local")?.setItem(ANALYTICS_CONSENT_STORAGE_KEY, state);
  if (state !== "analytics_granted") {
    browserStorage("local")?.removeItem(ANALYTICS_ATTRIBUTION_STORAGE_KEY);
  }
}

export function readStoredAnalyticsAttribution(): AnalyticsAttributionSnapshot | null {
  if (readAnalyticsConsentState() !== "analytics_granted") return null;
  return normaliseStoredAttribution(
    readJsonStorage<Partial<AnalyticsAttributionSnapshot>>(ANALYTICS_ATTRIBUTION_STORAGE_KEY),
  );
}

function writeStoredAnalyticsAttribution(attribution: AnalyticsAttributionSnapshot | null): void {
  if (!attribution) return;
  writeJsonStorage(ANALYTICS_ATTRIBUTION_STORAGE_KEY, attribution);
}

export function persistAnalyticsAttributionFromLocation(): AnalyticsAttributionSnapshot | null {
  if (typeof window === "undefined" || readAnalyticsConsentState() !== "analytics_granted") {
    return readStoredAnalyticsAttribution();
  }
  const nowIso = new Date().toISOString();
  const incoming = extractAnalyticsAttributionFromUrl(
    window.location.href,
    document.referrer || null,
    nowIso,
  );
  const merged = mergeAnalyticsAttribution(readStoredAnalyticsAttribution(), incoming, nowIso);
  writeStoredAnalyticsAttribution(merged);
  return merged;
}

export function buildAnalyticsAttributionMetadata(
  attribution: AnalyticsAttributionSnapshot | null,
): AnalyticsAttributionMetadata {
  if (!attribution) {
    return {
      schema_version: ANALYTICS_ATTRIBUTION_SCHEMA_VERSION,
      attribution_available: false,
      consent_state: readAnalyticsConsentState(),
      attribution_key: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      creator_code: null,
      partner_code_hint: null,
      landing_path: null,
      referrer_host: null,
      first_seen_at: null,
      last_seen_at: null,
    };
  }

  return {
    schema_version: ANALYTICS_ATTRIBUTION_SCHEMA_VERSION,
    attribution_available: true,
    consent_state: attribution.consent_state,
    attribution_key: attribution.attribution_key,
    utm_source: attribution.utm_source,
    utm_medium: attribution.utm_medium,
    utm_campaign: attribution.utm_campaign,
    utm_term: attribution.utm_term,
    utm_content: attribution.utm_content,
    creator_code: attribution.creator_code,
    partner_code_hint: attribution.partner_code_hint,
    landing_path: attribution.landing_path,
    referrer_host: attribution.referrer_host,
    first_seen_at: attribution.first_seen_at,
    last_seen_at: attribution.last_seen_at,
  };
}

export function buildAnalyticsAttributionAuthMetadata(
  attribution: AnalyticsAttributionSnapshot | null,
): { analytics_attribution: AnalyticsAttributionMetadata } {
  return { analytics_attribution: buildAnalyticsAttributionMetadata(attribution) };
}

export function shouldEmitAnalyticsEvent(
  eventName: AnalyticsEventName,
  consentState: AnalyticsConsentState,
): boolean {
  if (!NON_ESSENTIAL_BROWSER_EVENTS.has(eventName)) return true;
  return consentState === "analytics_granted";
}

function safeEventProperties(input: Record<string, Json | undefined> = {}): Record<string, Json> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, Json] => {
      const [key, value] = entry;
      return value !== undefined && !UNSAFE_PROPERTY_KEYS.has(key.toLowerCase());
    }),
  );
}

export async function trackAnalyticsEvent(input: TrackAnalyticsEventInput): Promise<string | null> {
  const consentState = readAnalyticsConsentState();
  if (!shouldEmitAnalyticsEvent(input.eventName, consentState)) return null;
  const attribution =
    consentState === "analytics_granted"
      ? (readStoredAnalyticsAttribution() ?? persistAnalyticsAttributionFromLocation())
      : null;

  const { data, error } = await supabase.rpc("record_analytics_event", {
    p_event_name: input.eventName,
    p_consent_state: consentState,
    p_attribution_key: attribution?.attribution_key ?? undefined,
    p_session_key: attribution?.session_key ?? getSessionKey() ?? undefined,
    p_utm_source: attribution?.utm_source ?? undefined,
    p_utm_medium: attribution?.utm_medium ?? undefined,
    p_utm_campaign: attribution?.utm_campaign ?? undefined,
    p_utm_term: attribution?.utm_term ?? undefined,
    p_utm_content: attribution?.utm_content ?? undefined,
    p_creator_code: attribution?.creator_code ?? undefined,
    p_partner_code_hint: attribution?.partner_code_hint ?? undefined,
    p_landing_path:
      attribution?.landing_path ??
      (typeof window !== "undefined"
        ? normaliseAttributionToken(window.location.pathname, 160)
        : undefined) ??
      undefined,
    p_referrer_host: attribution?.referrer_host ?? undefined,
    p_object_type: input.objectType ?? undefined,
    p_object_id: input.objectId ?? undefined,
    p_audition_id: input.auditionId ?? undefined,
    p_take_id: input.takeId ?? undefined,
    p_event_properties: safeEventProperties(input.properties),
  });

  if (error) {
    console.warn("[analytics] client_event_record_failed", {
      event_name: input.eventName,
      message: error.message,
    });
    return null;
  }
  return data ?? null;
}

export function trackLandingViewOnce(): void {
  if (typeof window === "undefined" || readAnalyticsConsentState() !== "analytics_granted") return;
  const key = `${window.location.origin}${window.location.pathname}`;
  const storage = browserStorage("session");
  if (storage?.getItem(ANALYTICS_LANDING_VIEW_STORAGE_KEY) === key) return;
  storage?.setItem(ANALYTICS_LANDING_VIEW_STORAGE_KEY, key);
  void trackAnalyticsEvent({
    eventName: "landing_view",
    properties: { path: window.location.pathname },
  });
}

export function trackReturnMilestones(): void {
  if (readAnalyticsConsentState() !== "analytics_granted") return;
  const attribution = readStoredAnalyticsAttribution();
  if (!attribution) return;
  const firstSeenAt = Date.parse(attribution.first_seen_at);
  if (!Number.isFinite(firstSeenAt)) return;
  const elapsedMs = Date.now() - firstSeenAt;
  const tracked =
    readJsonStorage<Record<string, true>>(ANALYTICS_RETURN_MILESTONES_STORAGE_KEY) ?? {};
  const nextTracked = { ...tracked };

  if (elapsedMs >= 7 * 24 * 60 * 60 * 1000 && !tracked.return_7d) {
    nextTracked.return_7d = true;
    void trackAnalyticsEvent({ eventName: "return_7d" });
  }
  if (elapsedMs >= 30 * 24 * 60 * 60 * 1000 && !tracked.return_30d) {
    nextTracked.return_30d = true;
    void trackAnalyticsEvent({ eventName: "return_30d" });
  }
  writeJsonStorage(ANALYTICS_RETURN_MILESTONES_STORAGE_KEY, nextTracked);
}

function isB2BLeadUrl(url: URL): boolean {
  const params = url.searchParams;
  if (params.has("b2b_lead") || params.has("partner_interest") || params.has("partner_type")) {
    return true;
  }
  const signal = `${params.get("utm_campaign") ?? ""} ${params.get("utm_content") ?? ""}`;
  return /\b(school|coach|agent|partner|b2b)\b/i.test(signal);
}

export function trackB2BLeadFromLocation(): void {
  if (typeof window === "undefined" || readAnalyticsConsentState() !== "analytics_granted") return;
  const url = new URL(window.location.href);
  if (!isB2BLeadUrl(url)) return;
  const leadKey = `${url.pathname}:${url.searchParams.get("partner_type") ?? "unknown"}:${
    url.searchParams.get("utm_campaign") ?? ""
  }`;
  const tracked = readJsonStorage<Record<string, true>>(ANALYTICS_B2B_LEAD_STORAGE_KEY) ?? {};
  if (tracked[leadKey]) return;
  writeJsonStorage(ANALYTICS_B2B_LEAD_STORAGE_KEY, { ...tracked, [leadKey]: true });
  void trackAnalyticsEvent({
    eventName: "b2b_lead",
    objectType: "b2b_lead",
    properties: {
      lead_type: normaliseAttributionToken(url.searchParams.get("partner_type"), 60) ?? "unknown",
    },
  });
}

export function rememberPartnerCodeAttribution(code: string): void {
  if (readAnalyticsConsentState() !== "analytics_granted") return;
  const partnerCodeHint = safePartnerCodeHint(code);
  if (!partnerCodeHint) return;
  const nowIso = new Date().toISOString();
  const merged = mergeAnalyticsAttribution(
    readStoredAnalyticsAttribution(),
    {
      schema_version: ANALYTICS_ATTRIBUTION_SCHEMA_VERSION,
      attribution_available: true,
      consent_state: "analytics_granted",
      attribution_key: null,
      session_key: getSessionKey(),
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
      utm_term: null,
      utm_content: null,
      creator_code: null,
      partner_code_hint: partnerCodeHint,
      landing_path: typeof window !== "undefined" ? window.location.pathname : null,
      referrer_host: null,
      first_seen_at: nowIso,
      last_seen_at: nowIso,
    },
    nowIso,
  );
  writeStoredAnalyticsAttribution(merged);
  void trackAnalyticsEvent({ eventName: "partner_code_capture", objectType: "partner_code" });
}

export function readAttributionFromUrl(
  url: URL,
  referrer: string | null = null,
  nowIso = new Date().toISOString(),
): AnalyticsAttributionSnapshot | null {
  return extractAnalyticsAttributionFromUrl(url.toString(), referrer, nowIso);
}

export function getAnalyticsConsentChoice(): "accepted" | "declined" | "unset" {
  const state = readAnalyticsConsentState();
  if (state === "analytics_granted") return "accepted";
  if (state === "analytics_denied" || state === "essential_only") return "declined";
  return "unset";
}

export function setAnalyticsConsentChoice(choice: "accepted" | "declined"): void {
  writeAnalyticsConsentState(choice === "accepted" ? "analytics_granted" : "analytics_denied");
}

export function captureAnalyticsAttributionFromLocation(): AnalyticsAttributionSnapshot | null {
  return persistAnalyticsAttributionFromLocation();
}

export function getStoredAnalyticsAttribution(): AnalyticsAttributionSnapshot | null {
  return readStoredAnalyticsAttribution();
}

export function analyticsAttributionPayload(): AnalyticsAttributionSnapshot | null {
  return readStoredAnalyticsAttribution() ?? persistAnalyticsAttributionFromLocation();
}
