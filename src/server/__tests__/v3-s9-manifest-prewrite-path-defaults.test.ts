import { beforeEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload })) } },
}));

import * as qaArtifacts from '@/server/v3/qa-artifacts.server';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 manifest prewrite path defaults', () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.V3_QA_ARTIFACTS_ENABLED = 'true';
    process.env.INTERNAL_QA_EMIT = 'true';
  });

  it('writes manifest and metrics when root_dir is omitted', async () => {
    const run = 'take-a4f47a03-ee5d-4291-9142-40d3867d2441';
    const out = await emitQAManifestForAnalysisRun({
      run_id: run,
      analysis_run_id: run,
      take_id: 'a4f47a03-ee5d-4291-9142-40d3867d2441',
      submission_id: 'sub-1',
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report', 'analysis_input_record', 'analysis_submission', 'analysis_take', 'resolver_output', 'truth_state_map', 'evidence_anchors', 'public_claim_trace'],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false },
      legacy_adapter_artefact_ids: ['raw_report'],
      public_claim_trace_summary: { claim_count: 2, unsupported_claim_count: 1 },
    });

    expect(out.written).toBe(true);
    expect(out.warning).toBeNull();
    const keys = upload.mock.calls.map((c) => c[0]);
    expect(keys).toContain('take-a4f47a03-ee5d-4291-9142-40d3867d2441/analysis-take-a4f47a03-ee5d-4291-9142-40d3867d2441/manifest.json');
    expect(keys).toContain('take-a4f47a03-ee5d-4291-9142-40d3867d2441/analysis-take-a4f47a03-ee5d-4291-9142-40d3867d2441/qa/acceptance_metrics.json');
  });

  it('does not throw when project-root resolution is undefined and still writes manifest', async () => {
    const spy = vi.spyOn(qaArtifacts, 'resolveProjectRootForQAManifest').mockReturnValue(undefined as unknown as string);
    const out = await qaArtifacts.emitInternalQAArtifactManifest({
      run_id: 'take-tx1',
      analysis_run_id: 'take-tx1',
      take_id: 'tx1',
      submission_id: 's1',
      internal_qa_emit: true,
      manifest_relative_path: 'takes/take-tx1/analysis-take-tx1/manifest.json',
      emitted_artefact_ids: ['raw_report'],
    });
    spy.mockRestore();

    expect(out.written).toBe(true);
    expect(out.manifest.source_scope_file).toBe('docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md');
    expect(out.manifest.controlling_requirements_status).toBe('operator_supplied_replacement_README');
  });
});
