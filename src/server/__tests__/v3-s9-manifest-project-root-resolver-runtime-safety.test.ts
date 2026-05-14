import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload })) } },
}));

import * as qaArtifacts from '@/server/v3/qa-artifacts.server';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 project-root resolver runtime safety', () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.V3_QA_ARTIFACTS_ENABLED = 'true';
    process.env.INTERNAL_QA_EMIT = 'true';
    delete process.env.QA_PROJECT_ROOT;
    delete process.env.PROJECT_ROOT;
  });

  it('findProjectRootFrom safely handles undefined input', () => {
    expect(() => qaArtifacts.findProjectRootFrom(undefined)).not.toThrow();
    expect(qaArtifacts.findProjectRootFrom(undefined)).toBeNull();
  });

  it('does not throw when resolver returns undefined and still writes manifest + metrics', async () => {
    const resolverSpy = vi.spyOn(qaArtifacts, 'resolveProjectRootForQAManifest').mockReturnValue(undefined as unknown as string);
    const run = 'take-test-id';
    const out = await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 'test-id',
      submission_id: 'sub-1',
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report', 'analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false },
      legacy_adapter_artefact_ids: ['raw_report'],
      public_claim_trace_summary: { claim_count: 2, unsupported_claim_count: 1 },
    });
    resolverSpy.mockRestore();

    expect(out.written).toBe(true);
    const keys = upload.mock.calls.map((c) => c[0]);
    expect(keys).toContain('take-test-id/analysis-take-test-id/manifest.json');
    expect(keys).toContain('take-test-id/analysis-take-test-id/qa/acceptance_metrics.json');
  });

  it('falls back safely when process.cwd throws', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockImplementation(() => { throw new Error('cwd unavailable'); });
    expect(() => qaArtifacts.resolveProjectRootForQAManifest()).not.toThrow();
    const resolved = qaArtifacts.resolveProjectRootForQAManifest();
    expect(typeof resolved).toBe('string');
    expect(resolved.length).toBeGreaterThan(0);

    const out = await qaArtifacts.emitInternalQAArtifactManifest({
      run_id: 'take-safe-1',
      analysis_run_id: 'take-safe-1',
      take_id: 'safe-1',
      submission_id: 'sub1',
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
    });
    cwdSpy.mockRestore();

    expect(out.written).toBe(true);
    expect(out.manifest.source_scope_file).toBe('docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md');
    expect(out.manifest.controlling_requirements_status).toBe('operator_supplied_replacement_README');

  });
});
