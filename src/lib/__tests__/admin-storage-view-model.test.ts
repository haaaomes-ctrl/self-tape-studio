import { describe, expect, it } from 'vitest';
import { canDeletePaths, canZipPaths, compareByLastModified, filterAndSortArtifacts, getVisiblePaths } from '@/lib/admin-storage-view-model';

const rows: any[] = [
  { path: 'takes/take-b/analysis-2/manifest.json', size: 5, lastModified: '2026-05-01T00:00:00Z', takeId: 'take-b', analysisRunId: 'analysis-2', comparisonRunId: null, artifactType: 'analysis-2', contentType: 'application/json' },
  { path: 'takes/take-a/analysis-1/reports/raw_report.json', size: 10, lastModified: '2026-05-02T00:00:00Z', takeId: 'take-a', analysisRunId: 'analysis-1', comparisonRunId: null, artifactType: 'reports', contentType: 'application/json' },
  { path: 'comparisons/comparison-9/comparison_raw.json', size: 1, lastModified: null, takeId: null, analysisRunId: null, comparisonRunId: 'comparison-9', artifactType: 'comparison-9', contentType: 'application/json' },
  { path: 'takes/take-z/analysis-z/manifest.json', size: 2, lastModified: 'not-a-date', takeId: 'take-z', analysisRunId: 'analysis-z', comparisonRunId: null, artifactType: 'analysis-z', contentType: 'application/json' },
];

describe('filterAndSortArtifacts', () => {
  it('supports sort modes and filtering', () => {
    expect(filterAndSortArtifacts(rows, '', 'name_asc')[0].path).toContain('comparison-9');
    expect(filterAndSortArtifacts(rows, '', 'size_desc')[0].size).toBe(10);
    expect(filterAndSortArtifacts(rows, 'take-a', 'newest')).toHaveLength(1);
  });

  it('newest puts valid dates first and null/invalid last deterministically', () => {
    const out = filterAndSortArtifacts(rows, '', 'newest').map((r) => r.path);
    expect(out[0]).toContain('raw_report');
    expect(out[1]).toContain('take-b');
    expect(out.slice(2)).toEqual([
      'comparisons/comparison-9/comparison_raw.json',
      'takes/take-z/analysis-z/manifest.json',
    ]);
  });

  it('oldest puts valid dates first and null/invalid last deterministically', () => {
    const out = filterAndSortArtifacts(rows, '', 'oldest').map((r) => r.path);
    expect(out[0]).toContain('take-b');
    expect(out[1]).toContain('raw_report');
    expect(out.slice(2)).toEqual([
      'comparisons/comparison-9/comparison_raw.json',
      'takes/take-z/analysis-z/manifest.json',
    ]);
  });

  it('date comparator never returns NaN', () => {
    const value = compareByLastModified(rows[2], rows[3], 'newest');
    expect(Number.isNaN(value)).toBe(false);
  });

  it('visible paths respect filter for download-all-visible', () => {
    const visible = getVisiblePaths(rows, 'take-', 'name_asc');
    expect(visible).toHaveLength(3);
    expect(visible).not.toContain('comparisons/comparison-9/comparison_raw.json');
  });

  it('zip guard blocks >500 and empty payloads', () => {
    expect(canZipPaths([]).ok).toBe(false);
    expect(canZipPaths(Array.from({ length: 501 }, (_, i) => `p-${i}`)).ok).toBe(false);
    expect(canZipPaths(Array.from({ length: 500 }, (_, i) => `p-${i}`)).ok).toBe(true);
  });

  it('delete guard blocks >500 and empty payloads', () => {
    expect(canDeletePaths([]).ok).toBe(false);
    expect(canDeletePaths(Array.from({ length: 501 }, (_, i) => `p-${i}`)).ok).toBe(false);
    expect(canDeletePaths(Array.from({ length: 500 }, (_, i) => `p-${i}`)).ok).toBe(true);
  });

});
