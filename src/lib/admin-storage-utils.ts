export type QAArtifactIds = {
  takeId: string | null;
  analysisRunId: string | null;
  comparisonRunId: string | null;
  artifactType: string;
  basename: string;
  extension: string;
};

function sanitize(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function parseQAArtifactPath(storagePath: string): QAArtifactIds {
  const normalized = storagePath.replace(/^qa-artifacts\//, "");
  const parts = normalized.split("/").filter(Boolean);
  const basename = parts[parts.length - 1] ?? "artifact";
  const extMatch = basename.match(/(\.[^.]+)$/);
  const extension = extMatch?.[1] ?? "";
  const artifactType = parts.length > 1 ? parts[parts.length - 2] : "root";

  const takeId = parts.find((p) => /^take-[\w-]+$/i.test(p)) ?? null;
  const analysisRunId = parts.find((p) => /^analysis-[\w-]+$/i.test(p)) ?? null;
  const comparisonRunId = parts.find((p) => /^comparison-[\w-]+$/i.test(p)) ?? null;

  return { takeId, analysisRunId, comparisonRunId, artifactType, basename, extension };
}

export function buildQAArtifactDownloadFilename(storagePath: string): string {
  const ids = parseQAArtifactPath(storagePath);
  const stem = ids.basename.replace(/\.[^.]+$/, "");
  const segments = [ids.takeId, ids.analysisRunId, ids.comparisonRunId, stem].filter(Boolean).map((s) => sanitize(String(s)));
  const fallback = sanitize(storagePath.split("/").filter(Boolean).slice(-3).join("__")) || "artifact";
  return `${segments.join("__") || fallback}${ids.extension}`;
}

export function stableCollisionSuffix(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = (hash * 31 + path.charCodeAt(i)) >>> 0;
  return hash.toString(36).slice(0, 6);
}
