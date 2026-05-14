import { describe, expect, it } from 'vitest';
import { filterAndSortArtifacts } from '@/lib/admin-storage-view-model';

const rows: any[] = [
  { path: 'takes/take-b/analysis-2/manifest.json', size: 5, lastModified: '2026-05-01T00:00:00Z', takeId: 'take-b', analysisRunId: 'analysis-2', comparisonRunId: null, artifactType: 'analysis-2', contentType: 'application/json' },
  { path: 'takes/take-a/analysis-1/reports/raw_report.json', size: 10, lastModified: '2026-05-02T00:00:00Z', takeId: 'take-a', analysisRunId: 'analysis-1', comparisonRunId: null, artifactType: 'reports', contentType: 'application/json' },
  { path: 'comparisons/comparison-9/comparison_raw.json', size: 1, lastModified: '2026-04-30T00:00:00Z', takeId: null, analysisRunId: null, comparisonRunId: 'comparison-9', artifactType: 'comparison-9', contentType: 'application/json' },
];

describe('filterAndSortArtifacts', () => {
  it('supports newest/oldest/name/size/type/take/analysis/comparison sorts', () => {
    expect(filterAndSortArtifacts(rows, '', 'newest')[0].path).toContain('raw_report');
    expect(filterAndSortArtifacts(rows, '', 'oldest')[0].path).toContain('comparison_raw');
    expect(filterAndSortArtifacts(rows, '', 'name_asc')[0].path).toContain('comparison-9');
    expect(filterAndSortArtifacts(rows, '', 'name_desc')[0].path).toContain('take-b');
    expect(filterAndSortArtifacts(rows, '', 'size_asc')[0].size).toBe(1);
    expect(filterAndSortArtifacts(rows, '', 'size_desc')[0].size).toBe(10);
    expect(filterAndSortArtifacts(rows, '', 'take')[0].takeId).toBe(null);
    expect(filterAndSortArtifacts(rows, '', 'analysis')[0].analysisRunId).toBe(null);
    expect(filterAndSortArtifacts(rows, '', 'comparison')[0].comparisonRunId).toBe(null);
    expect(filterAndSortArtifacts(rows, '', 'type')[0].artifactType).toBe('analysis-2');
  });

  it('filters by path substring / ids', () => {
    expect(filterAndSortArtifacts(rows, 'take-a', 'newest')).toHaveLength(1);
    expect(filterAndSortArtifacts(rows, 'comparison-9', 'newest')).toHaveLength(1);
    expect(filterAndSortArtifacts(rows, 'raw_report', 'newest')).toHaveLength(1);
  });
});
