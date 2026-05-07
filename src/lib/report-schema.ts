/**
 * Report schema versioning helper.
 *
 * Single source of truth for the rule:
 *   - missing/null/unknown `schema_version` → "v1-legacy"
 *   - "v1-legacy" → existing v1 renderer
 *   - "v2-component" → reserved for Phase 3+
 *
 * Phase 0: this helper exists for future phases to import. It is intentionally
 * NOT wired into renderers in Phase 0 to preserve current behaviour exactly.
 */

export type ReportSchemaVersion = "v1-legacy" | "v2-component";

const KNOWN_VERSIONS: ReadonlySet<ReportSchemaVersion> = new Set([
  "v1-legacy",
  "v2-component",
]);

export function readReportSchemaVersion(report: unknown): ReportSchemaVersion {
  if (!report || typeof report !== "object") return "v1-legacy";
  const raw = (report as Record<string, unknown>).schema_version;
  if (typeof raw === "string" && KNOWN_VERSIONS.has(raw as ReportSchemaVersion)) {
    return raw as ReportSchemaVersion;
  }
  return "v1-legacy";
}
