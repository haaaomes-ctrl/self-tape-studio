import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitNoExportProofBundle, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

const parse = async (p: string) => JSON.parse(await readFile(p, 'utf8'));

describe('v3 s9 no-export source/config/log proof emission', () => {
  it('emits source/config/log plus bundle as internal-only, keeps ui proof missing and gates blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s913a-'));
    const run = 'run-s913a';
    const emitted = await emitNoExportProofBundle({
      run_id: run,
      root_dir: root,
      internal_qa_emit: true,
      proofs: {
        no_export_source_proof: { checked_paths: ['src/routes', 'src/server-fns'], no_public_export_route_enabled: true },
        no_export_config_proof: { checked_env_keys: ['EXPORT_ENABLED', 'SHARE_ENABLED'], unknown_keys_present: [] },
        no_export_log_proof: { analysis_path_export_event_emitted: false, comparison_public_output_event_emitted: false, live_log_access: 'unavailable_internal_only' },
      },
    });
    expect(emitted.written).toBe(true);
    expect(emitted.emitted_artefact_ids).toEqual(expect.arrayContaining(['no_export_source_proof', 'no_export_config_proof', 'no_export_log_proof', 'no_export_proof']));
    expect(emitted.emitted_artefact_ids).not.toContain('no_export_ui_proof');

    await emitQAManifestForAnalysisRun({ run_id: run, root_dir: root, internal_qa_emit: true, emitted_artefact_ids: emitted.emitted_artefact_ids });
    const manifest = await parse(path.join(root, run, 'manifest.json'));
    const metrics = await parse(path.join(root, run, 'qa', 'acceptance_metrics.json'));
    const src = await parse(path.join(root, run, 'export_or_no_export', 'no_export_source_proof.json'));
    const cfg = await parse(path.join(root, run, 'export_or_no_export', 'no_export_config_proof.json'));
    const log = await parse(path.join(root, run, 'export_or_no_export', 'no_export_log_proof.json'));
    const bundle = await parse(path.join(root, run, 'export_or_no_export', 'no_export_proof.json'));

    expect(src.internal_only).toBe(true);
    expect(cfg.internal_only).toBe(true);
    expect(log.internal_only).toBe(true);
    expect(bundle.internal_only).toBe(true);

    expect(manifest.artefact_status_by_id.no_export_source_proof).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_config_proof).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_log_proof).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_proof).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_ui_proof).toBe('missing');
    expect(manifest.blocker_codes).toContain('no_export_proof_missing');

    expect(metrics.blocker_codes).toContain('no_export_proof_missing');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(bundle.proof_family_status).toBe('partial_ui_proof_missing');
  });

  it('does not emit no_export_proof bundle when source/config/log trio is incomplete', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s913a-missing-'));
    const out = await emitNoExportProofBundle({ run_id: 'run-s913a-missing', root_dir: root, internal_qa_emit: true, proofs: { no_export_source_proof: { ok: true }, no_export_config_proof: { ok: true } } });
    expect(out.emitted_artefact_ids).toEqual(expect.arrayContaining(['no_export_source_proof', 'no_export_config_proof']));
    expect(out.emitted_artefact_ids).not.toContain('no_export_proof');
  });
});
