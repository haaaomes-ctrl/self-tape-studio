import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { emitInternalQAArtifactManifest } from '@/server/v3/qa-artifacts.server';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

const originalCwd = process.cwd();
const originalQaRoot = process.env.QA_PROJECT_ROOT;
afterEach(() => {
  process.chdir(originalCwd);
  if (originalQaRoot == null) delete process.env.QA_PROJECT_ROOT;
  else process.env.QA_PROJECT_ROOT = originalQaRoot;
});

describe('v3 s9 README source-scope provenance', () => {
  it('A: README present at resolved project root even when cwd differs', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-project-present-'));
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'qa-cwd-other-'));
    const artefactRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-root-present-'));
    await writeFile(path.join(projectRoot, 'README.md'), '# controlling');
    process.env.QA_PROJECT_ROOT = projectRoot;
    process.chdir(cwd);
    const out = await emitInternalQAArtifactManifest({ run_id: 'run-a', take_id: 't1', analysis_run_id: 'run-a', submission_id: 's1', internal_qa_emit: true, root_dir: artefactRoot });
    const manifest = JSON.parse(await readFile(path.join(artefactRoot, 'run-a', 'manifest.json'), 'utf8'));
    expect(out.written).toBe(true);
    expect(manifest.source_scope_file).toBe('README.md');
    expect(manifest.controlling_source_file).toBe('README.md');
    expect(manifest.controlling_requirements_status).toBe('root_readme_present');
    expect(String(manifest.controlling_source_location_note)).not.toContain('not present');
  });

  it('B/D: falls back truthfully when README is absent and no override is forced', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-project-absent-'));
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'qa-cwd-absent-'));
    const artefactRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-root-absent-'));
    process.env.QA_PROJECT_ROOT = projectRoot;
    process.chdir(cwd);
    const out = await emitQAManifestForAnalysisRun({ run_id: 'run-b', take_id: 't1', analysis_run_id: 'run-b', submission_id: 's1', internal_qa_emit: true, root_dir: artefactRoot, emitted_artefact_ids: ['raw_report'] });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(artefactRoot, 'run-b', 'manifest.json'), 'utf8'));
    expect(manifest.source_scope_file).toBe('docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md');
    expect(manifest.controlling_requirements_status).not.toBe('root_readme_present');
    expect(manifest.controlling_source_location_note).toContain('resolved project root');
  });

  it('C: requested README override does not claim root_readme_present when absent', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-project-requested-'));
    const artefactRoot = await mkdtemp(path.join(os.tmpdir(), 'qa-root-requested-'));
    process.env.QA_PROJECT_ROOT = projectRoot;
    const out = await emitInternalQAArtifactManifest({ run_id: 'run-c', take_id: 't1', analysis_run_id: 'run-c', submission_id: 's1', internal_qa_emit: true, root_dir: artefactRoot, source_scope_file: 'README.md' });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(artefactRoot, 'run-c', 'manifest.json'), 'utf8'));
    expect(manifest.requested_source_scope_file).toBe('README.md');
    expect(manifest.source_scope_file).toBe('docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md');
    expect(manifest.controlling_requirements_status).toBe('operator_supplied_replacement_README');
    expect(manifest.controlling_source_location_note).toContain('Requested README.md was not present');
  });
});
