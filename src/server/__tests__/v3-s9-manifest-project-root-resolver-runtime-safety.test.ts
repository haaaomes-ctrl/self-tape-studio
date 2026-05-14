import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const upload = vi.fn();
vi.mock('@/integrations/supabase/client.server', () => ({
  supabaseAdmin: { storage: { from: vi.fn(() => ({ upload })) } },
}));

import * as qaArtifacts from '@/server/v3/qa-artifacts.server';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 project-root resolver runtime safety', () => {
  const tmpDirs: string[] = [];

  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({ error: null });
    process.env.QA_ARTIFACT_SINK = 'storage';
    process.env.V3_QA_ARTIFACTS_ENABLED = 'true';
    process.env.INTERNAL_QA_EMIT = 'true';
    delete process.env.QA_PROJECT_ROOT;
    delete process.env.PROJECT_ROOT;
  });

  afterEach(async () => {
    while (tmpDirs.length) {
      const dir = tmpDirs.pop();
      if (!dir) continue;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('findProjectRootFrom safely handles undefined input', () => {
    expect(() => qaArtifacts.findProjectRootFrom(undefined)).not.toThrow();
    expect(qaArtifacts.findProjectRootFrom(undefined)).toBeNull();
  });

  it('honours QA_PROJECT_ROOT explicit override when marker files are absent', async () => {
    const envRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-explicit-root-a-'));
    const nested = path.join(envRoot, 'nested');
    await rm(nested, { recursive: true, force: true });
    tmpDirs.push(envRoot);

    process.env.QA_PROJECT_ROOT = envRoot;
    const resolved = qaArtifacts.resolveProjectRootForQAManifest();
    expect(resolved).toBe(path.resolve(envRoot));
  });

  it('honours PROJECT_ROOT explicit override when QA_PROJECT_ROOT is absent', async () => {
    const envRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-explicit-root-b-'));
    tmpDirs.push(envRoot);
    process.env.PROJECT_ROOT = envRoot;

    const resolved = qaArtifacts.resolveProjectRootForQAManifest();
    expect(resolved).toBe(path.resolve(envRoot));
  });

  it('QA_PROJECT_ROOT takes precedence over PROJECT_ROOT', async () => {
    const qaRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-explicit-root-c-'));
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-explicit-root-d-'));
    tmpDirs.push(qaRoot, projectRoot);

    process.env.QA_PROJECT_ROOT = qaRoot;
    process.env.PROJECT_ROOT = projectRoot;

    expect(qaArtifacts.resolveProjectRootForQAManifest()).toBe(path.resolve(qaRoot));
  });

  it('invalid QA_PROJECT_ROOT falls back safely', () => {
    process.env.QA_PROJECT_ROOT = '/path/that/does/not/exist';
    expect(() => qaArtifacts.resolveProjectRootForQAManifest()).not.toThrow();
    const resolved = qaArtifacts.resolveProjectRootForQAManifest();
    expect(typeof resolved).toBe('string');
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved).not.toBe('/path/that/does/not/exist');
  });

  it('README provenance uses explicit root truthfully when README is missing', async () => {
    const envRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-explicit-root-e-'));
    tmpDirs.push(envRoot);
    process.env.QA_PROJECT_ROOT = envRoot;

    const out = await qaArtifacts.emitInternalQAArtifactManifest({
      run_id: 'take-explicit-root-1',
      analysis_run_id: 'take-explicit-root-1',
      take_id: 'explicit-root-1',
      submission_id: 's1',
      internal_qa_emit: true,
      emitted_artefact_ids: ['raw_report'],
    });

    expect(out.written).toBe(true);
    expect(out.manifest.controlling_requirements_status).toBe('operator_supplied_replacement_README');
    expect(out.manifest.source_scope_file).toBe('docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md');
  });

  it('previous runtime safety still holds for manifest + metrics live-shaped writes', async () => {
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

  it('process.cwd throwing does not break resolver', () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockImplementation(() => { throw new Error('cwd unavailable'); });
    expect(() => qaArtifacts.resolveProjectRootForQAManifest()).not.toThrow();
    const resolved = qaArtifacts.resolveProjectRootForQAManifest();
    cwdSpy.mockRestore();

    expect(typeof resolved).toBe('string');
    expect(resolved.length).toBeGreaterThan(0);
  });
});
