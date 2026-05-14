import type { ArtifactEntry } from '@/lib/admin-storage.functions';

export type SortMode = 'newest'|'oldest'|'name_asc'|'name_desc'|'size_asc'|'size_desc'|'type'|'take'|'analysis'|'comparison';

export function parseLastModifiedTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function compareByLastModified(a: ArtifactEntry, b: ArtifactEntry, mode: 'newest' | 'oldest'): number {
  const ta = parseLastModifiedTime(a.lastModified);
  const tb = parseLastModifiedTime(b.lastModified);

  if (ta !== null && tb !== null) {
    if (ta !== tb) return mode === 'newest' ? tb - ta : ta - tb;
    return a.path.localeCompare(b.path);
  }
  if (ta !== null && tb === null) return -1;
  if (ta === null && tb !== null) return 1;
  return a.path.localeCompare(b.path);
}

export function filterAndSortArtifacts(data: ArtifactEntry[], filter: string, sortMode: SortMode): ArtifactEntry[] {
  const filtered = data.filter((f) =>
    [f.path, f.takeId, f.analysisRunId, f.comparisonRunId, f.artifactType, f.contentType]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );
  const arr = [...filtered];
  const byStr = (a: string | null, b: string | null) => (a ?? '').localeCompare(b ?? '');
  arr.sort((a, b) => {
    if (sortMode === 'newest') return compareByLastModified(a, b, 'newest');
    if (sortMode === 'oldest') return compareByLastModified(a, b, 'oldest');
    if (sortMode === 'name_asc') return a.path.localeCompare(b.path);
    if (sortMode === 'name_desc') return b.path.localeCompare(a.path);
    if (sortMode === 'size_asc') return a.size - b.size || a.path.localeCompare(b.path);
    if (sortMode === 'size_desc') return b.size - a.size || a.path.localeCompare(b.path);
    if (sortMode === 'type') return byStr(a.artifactType, b.artifactType) || a.path.localeCompare(b.path);
    if (sortMode === 'take') return byStr(a.takeId, b.takeId) || a.path.localeCompare(b.path);
    if (sortMode === 'analysis') return byStr(a.analysisRunId, b.analysisRunId) || a.path.localeCompare(b.path);
    if (sortMode === 'comparison') return byStr(a.comparisonRunId, b.comparisonRunId) || a.path.localeCompare(b.path);
    return a.path.localeCompare(b.path);
  });
  return arr;
}

export function getVisiblePaths(data: ArtifactEntry[], filter: string, sortMode: SortMode): string[] {
  return filterAndSortArtifacts(data, filter, sortMode).map((f) => f.path);
}
