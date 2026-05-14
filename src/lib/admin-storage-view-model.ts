import type { ArtifactEntry } from '@/lib/admin-storage.functions';

export type SortMode = 'newest'|'oldest'|'name_asc'|'name_desc'|'size_asc'|'size_desc'|'type'|'take'|'analysis'|'comparison';

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
    if (sortMode === 'newest') return Date.parse(b.lastModified ?? '') - Date.parse(a.lastModified ?? '');
    if (sortMode === 'oldest') return Date.parse(a.lastModified ?? '') - Date.parse(b.lastModified ?? '');
    if (sortMode === 'name_asc') return a.path.localeCompare(b.path);
    if (sortMode === 'name_desc') return b.path.localeCompare(a.path);
    if (sortMode === 'size_asc') return a.size - b.size;
    if (sortMode === 'size_desc') return b.size - a.size;
    if (sortMode === 'type') return byStr(a.artifactType, b.artifactType);
    if (sortMode === 'take') return byStr(a.takeId, b.takeId);
    if (sortMode === 'analysis') return byStr(a.analysisRunId, b.analysisRunId);
    if (sortMode === 'comparison') return byStr(a.comparisonRunId, b.comparisonRunId);
    return 0;
  });
  return arr;
}
