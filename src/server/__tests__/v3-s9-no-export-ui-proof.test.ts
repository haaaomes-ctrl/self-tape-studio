import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitNoExportProofBundle, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

const parse = async (p: string) => JSON.parse(await readFile(p, 'utf8'));

describe('v3 s9 no-export ui proof emission', () => {
  it('process-take wires the no-export proof bundle into ordinary runtime QA', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/server/process-take.server.ts'), 'utf8');
    expect(source).toContain('emitNoExportProofBundle');
    expect(source).toContain('no_export_source_proof');
    expect(source).toContain('no_export_config_proof');
    expect(source).toContain('no_export_ui_proof');
    expect(source).toContain('no_export_log_proof');
    expect(source).toContain('admin/internal only');
  });

  it('emits no_export_ui_proof, classifies internal/admin surfaces, and aligns manifest + metrics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-s913b-ui-'));
    const run = 'run-s913b-ui';
    const emitted = await emitNoExportProofBundle({
      run_id: run,
      root_dir: root,
      internal_qa_emit: true,
      proofs: {
        no_export_source_proof: { checked_paths: ['src/routes', 'src/components'] },
        no_export_config_proof: { checked_env_keys: ['EXPORT_ENABLED'] },
        no_export_log_proof: { checked_log_paths: ['src/server'] },
        no_export_ui_proof: {
          checked_routes: ['src/routes/__root.tsx', 'src/routes/admin/storage-downloads.tsx'],
          checked_components_or_files: ['src/components/report/V2ReportView.tsx'],
          admin_internal_surfaces_classified: ['src/routes/admin/storage-downloads.tsx: admin/internal only'],
          unsupported_or_unknown_surfaces: [],
          internal_only: false,
          privacy_classification: 'public',
          production_safe_status: 'accepted',
          public_scoring_status: 'accepted',
          public_technique_authority_status: 'accepted',
          level2_satisfaction: 'accepted',
        },
      },
    });

    expect(emitted.emitted_artefact_ids).toEqual(expect.arrayContaining(['no_export_ui_proof', 'no_export_proof']));
    await emitQAManifestForAnalysisRun({ run_id: run, root_dir: root, internal_qa_emit: true, emitted_artefact_ids: emitted.emitted_artefact_ids });

    const ui = await parse(path.join(root, run, 'export_or_no_export', 'no_export_ui_proof.json'));
    const bundle = await parse(path.join(root, run, 'export_or_no_export', 'no_export_proof.json'));
    const manifest = await parse(path.join(root, run, 'manifest.json'));
    const metrics = await parse(path.join(root, run, 'qa', 'acceptance_metrics.json'));

    expect(ui.schema_version).toBe('tapecoach_v3_no_export_ui_proof_v1');
    expect(ui.artefact_type).toBe('no_export_ui_proof');
    expect(ui.internal_only).toBe(true);
    expect(ui.privacy_classification).toBe('internal_private');
    expect(ui.public_export_ui_status).toBe('absent_in_customer_facing_surfaces');
    expect(ui.public_download_ui_status).toBe('absent_in_customer_facing_surfaces');
    expect(ui.public_share_ui_status).toBe('absent_in_customer_facing_surfaces');
    expect(ui.public_comparison_output_ui_status).toBe('absent_in_customer_facing_surfaces');
    expect(ui.forbidden_ui_surfaces_absent).toBe(true);
    expect(ui.admin_internal_surfaces_classified).toEqual(expect.arrayContaining(['src/routes/admin/storage-downloads.tsx: admin/internal only']));
    expect(ui.production_safe_status).toBe('blocked');
    expect(ui.public_scoring_status).toBe('blocked');
    expect(ui.public_technique_authority_status).toBe('blocked');
    expect(ui.level2_satisfaction).toBe('insufficient');

    expect(manifest.artefact_status_by_id.no_export_ui_proof).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.no_export_ui_proof).toBe('internal_no_export_ui_proof');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.no_export_ui_proof).toBe(false);
    expect(manifest.blocker_codes).not.toContain('no_export_proof_missing');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');

    expect(metrics.blocker_codes).not.toContain('no_export_proof_missing');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');

    expect(bundle.proof_family_status).toBe('complete');
    expect(bundle.level2_satisfaction).toBe('insufficient');
  });
});
