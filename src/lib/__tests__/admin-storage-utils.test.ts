import { describe, it, expect } from 'vitest';
import { buildQAArtifactDownloadFilename } from '@/lib/admin-storage-utils';

describe('buildQAArtifactDownloadFilename', () => {
  it('builds take/analysis filename', () => {
    expect(buildQAArtifactDownloadFilename('takes/take-abc/analysis-take-abc/manifest.json')).toBe('take-abc__analysis-take-abc__manifest.json');
    expect(buildQAArtifactDownloadFilename('takes/take-abc/analysis-take-abc/reports/raw_report.json')).toBe('take-abc__analysis-take-abc__raw_report.json');
    expect(buildQAArtifactDownloadFilename('takes/take-abc/analysis-take-abc/traces/EvidenceAnchors.json')).toBe('take-abc__analysis-take-abc__EvidenceAnchors.json');
  });
});
