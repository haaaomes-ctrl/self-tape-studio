import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitNoExportProofBundle, emitPublicReportPayloadArtifact, emitQAManifestForAnalysisRun, emitRenderPayloadArtifact, emitReportParityProof } from '@/server/v3/qa-artifacts-wiring.server';

async function readParity(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'parity', 'report_parity_result.json'), 'utf8'));
}

async function readRenderPayload(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'reports', 'render_payload.json'), 'utf8'));
}

async function readPublicReportPayload(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'reports', 'public_report_payload.json'), 'utf8'));
}

describe('v3-s9 report parity proof', () => {
  it('S9-17B: emits render_payload as an internal-only QA shadow artefact with the allowed report surface only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17b-render-'));
    const raw = {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: 'not_yet_ready',
        fix_first: 'Keep the eyeline active.',
        priority_fixes: ['Clarify the first beat.'],
        strengths: ['Clear text ownership.'],
        next_take_plan: { steps: ['Retake with a steadier frame.'] },
        feedback_reliability: { status: 'partial' },
        overall_score: 91,
        scores: { acting: 90 },
        technique_authority: { unsafe: true },
        comparison: { winner: 'take-2' },
        raw_prompt: 'private prompt text',
        signed_url: 'https://storage.example/video.mp4?signature=secret',
      },
    };
    const out = await emitRenderPayloadArtifact({
      run_id: 'run-render-1',
      analysis_run_id: 'run-render-1',
      take_id: 'tr1',
      submission_id: 'sub1',
      internal_qa_emit: true,
      root_dir: root,
      raw_report_data: raw,
    });
    expect(out.written).toBe(true);
    const payload = await readRenderPayload(root, 'run-render-1', 'tr1');
    expect(payload.artefact_type).toBe('render_payload');
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.public_output_unchanged).toBe(true);
    expect(payload.production_safe_status).toBe('blocked');
    expect(payload.public_scoring_status).toBe('blocked');
    expect(payload.public_technique_authority_status).toBe('blocked');
    expect(payload.cannot_satisfy_level2_by_itself).toBe(true);
    expect(payload.report_data).toEqual({
      schema_version: 'tapecoach-v3-report',
      submission_verdict: 'not_yet_ready',
      fix_first: 'Keep the eyeline active.',
      priority_fixes: ['Clarify the first beat.'],
      strengths: ['Clear text ownership.'],
      next_take_plan: { steps: ['Retake with a steadier frame.'] },
      feedback_reliability: { status: 'partial' },
    });
    expect(JSON.stringify(payload.report_data)).not.toMatch(/overall_score|scores|technique_authority|comparison|winner|raw_prompt|signature=secret|signed_url/);
    expect(payload.deferred_or_excluded_render_fields.some((field: any) => field.field_path === 'report_data.overall_score')).toBe(true);
    expect(payload.deferred_or_excluded_render_fields.some((field: any) => field.field_path === 'report_data.technique_authority')).toBe(true);
    expect(payload.deferred_or_excluded_render_fields.some((field: any) => field.field_path === 'report_data.comparison')).toBe(true);
    expect(payload.forbidden_field_scan.blocked_field_hit_count).toBe(0);
    expect(payload.blocked_field_hits).toEqual([]);
  });

  it('S9-17B: forbidden allowed render fields are blocked and omitted from the render payload report data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17b-render-blocked-'));
    await emitRenderPayloadArtifact({
      run_id: 'run-render-blocked',
      analysis_run_id: 'run-render-blocked',
      take_id: 'trb',
      internal_qa_emit: true,
      root_dir: root,
      raw_report_data: { report_data: { schema_version: 'v3', overall_score: 99, fix_first: 'Safe text' } },
      allowed_field_paths: ['report_data.schema_version', 'report_data.overall_score', 'report_data.fix_first'],
    });
    const payload = await readRenderPayload(root, 'run-render-blocked', 'trb');
    expect(payload.render_payload_status).toBe('emitted_blocked');
    expect(payload.blocker_codes).toContain('render_payload_forbidden_field_present');
    expect(payload.forbidden_field_scan.blocked_allowed_field_count).toBe(1);
    expect(payload.allowed_field_status_by_path['report_data.overall_score'].status).toBe('rendered_but_forbidden');
    expect(payload.report_data.overall_score).toBeUndefined();
    expect(payload.report_data.fix_first).toBe('Safe text');
    expect(payload.deferred_or_excluded_render_fields.some((field: any) => field.field_path === 'report_data.overall_score')).toBe(true);
  });

  it('S9-17D: blocks forbidden fields nested inside allowed render and public report objects', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17d-nested-forbidden-'));
    const raw = {
      report_data: {
        next_take_plan: {
          steps: ['Retake once.'],
          raw_prompt: 'private prompt must not pass through an allowed object',
          safe_nested: { token: 'secret-token' },
        },
      },
    };
    await emitRenderPayloadArtifact({
      run_id: 'run-nested-render',
      analysis_run_id: 'run-nested-render',
      take_id: 'tnr',
      internal_qa_emit: true,
      root_dir: root,
      raw_report_data: raw,
      allowed_field_paths: ['report_data.next_take_plan'],
    });
    const renderPayload = await readRenderPayload(root, 'run-nested-render', 'tnr');
    expect(renderPayload.render_payload_status).toBe('emitted_blocked');
    expect(renderPayload.blocker_codes).toContain('render_payload_forbidden_field_present');
    expect(renderPayload.blocked_field_hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'report_data.next_take_plan.raw_prompt' }),
      expect.objectContaining({ path: 'report_data.next_take_plan.safe_nested.token' }),
    ]));

    await emitPublicReportPayloadArtifact({
      run_id: 'run-nested-public',
      analysis_run_id: 'run-nested-public',
      take_id: 'tnp',
      internal_qa_emit: true,
      root_dir: root,
      render_payload: { report_data: renderPayload.report_data },
      allowed_field_paths: ['report_data.next_take_plan'],
    });
    const publicPayload = await readPublicReportPayload(root, 'run-nested-public', 'tnp');
    expect(publicPayload.public_report_payload_status).toBe('emitted_blocked');
    expect(publicPayload.blocker_codes).toContain('public_report_payload_forbidden_field_present');
    expect(publicPayload.blocked_field_hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'report_data.next_take_plan.raw_prompt' }),
      expect.objectContaining({ path: 'report_data.next_take_plan.safe_nested.token' }),
    ]));
  });

  it('S9-17D: preserves bracket-indexed allowed paths when copying render and public report payload fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17d-indexed-paths-'));
    const allowedFieldPaths = [
      'report_data.items[0].text',
      'report_data.sections[0].notes[0].text',
    ];
    await emitRenderPayloadArtifact({
      run_id: 'run-indexed-render',
      analysis_run_id: 'run-indexed-render',
      take_id: 'tir',
      internal_qa_emit: true,
      root_dir: root,
      raw_report_data: {
        report_data: {
          items: [{ text: 'First allowed item' }, { text: 'Second omitted item' }],
          sections: [{ notes: [{ text: 'Nested allowed note' }] }],
        },
      },
      allowed_field_paths: allowedFieldPaths,
    });
    const renderPayload = await readRenderPayload(root, 'run-indexed-render', 'tir');
    expect(renderPayload.render_payload_status).toBe('emitted');
    expect(renderPayload.allowed_field_status_by_path['report_data.items[0].text'].status).toBe('rendered_allowed');
    expect(renderPayload.allowed_field_status_by_path['report_data.sections[0].notes[0].text'].status).toBe('rendered_allowed');
    expect(renderPayload.report_data).toEqual({
      items: [{ text: 'First allowed item' }],
      sections: [{ notes: [{ text: 'Nested allowed note' }] }],
    });

    await emitPublicReportPayloadArtifact({
      run_id: 'run-indexed-public',
      analysis_run_id: 'run-indexed-public',
      take_id: 'tip',
      internal_qa_emit: true,
      root_dir: root,
      render_payload: { report_data: renderPayload.report_data },
      allowed_field_paths: allowedFieldPaths,
    });
    const publicPayload = await readPublicReportPayload(root, 'run-indexed-public', 'tip');
    expect(publicPayload.public_report_payload_status).toBe('emitted');
    expect(publicPayload.allowed_field_status_by_path['report_data.items[0].text'].status).toBe('public_safe_allowed');
    expect(publicPayload.allowed_field_status_by_path['report_data.sections[0].notes[0].text'].status).toBe('public_safe_allowed');
    expect(publicPayload.forbidden_field_scan.strict_subset_of_render_payload).toBe(true);
    expect(publicPayload.blocked_field_hits).toEqual([]);
    expect(publicPayload.report_data).toEqual(renderPayload.report_data);
  });

  it('S9-17C: emits public_report_payload as an internal-only sanitised subset of render payload', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17c-public-'));
    const renderPayload = {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: 'not_yet_ready',
        fix_first: 'Retake with a more active eyeline.',
        priority_fixes: ['Clarify the first beat.'],
        strengths: ['The text is clear.'],
        next_take_plan: ['Record one cleaner take.'],
        feedback_reliability: { status: 'partial' },
      },
    };
    const out = await emitPublicReportPayloadArtifact({
      run_id: 'run-public-1',
      analysis_run_id: 'run-public-1',
      take_id: 'tp1',
      submission_id: 'sub1',
      internal_qa_emit: true,
      root_dir: root,
      render_payload: renderPayload,
      raw_report_data: {
        report_data: {
          ...renderPayload.report_data,
          overall_score: 91,
          technique_authority: { unsafe: true },
          comparison: { winner: 'take-2' },
          raw_prompt: 'private prompt text',
          signed_url: 'https://storage.example/video.mp4?signature=secret',
        },
      },
    });
    expect(out.written).toBe(true);
    const payload = await readPublicReportPayload(root, 'run-public-1', 'tp1');
    expect(payload.artefact_type).toBe('public_report_payload');
    expect(payload.internal_only).toBe(true);
    expect(payload.privacy_classification).toBe('internal_private');
    expect(payload.public_output_unchanged).toBe(true);
    expect(payload.production_safe_status).toBe('blocked');
    expect(payload.public_scoring_status).toBe('blocked');
    expect(payload.public_technique_authority_status).toBe('blocked');
    expect(payload.public_comparison_output_status).toBe('blocked');
    expect(payload.cannot_satisfy_level2_by_itself).toBe(true);
    expect(payload.public_report_payload_status).toBe('emitted');
    expect(payload.report_data).toEqual(renderPayload.report_data);
    expect(JSON.stringify(payload.report_data)).not.toMatch(/overall_score|technique_authority|comparison|winner|raw_prompt|signature=secret|signed_url/);
    expect(payload.excluded_field_paths.some((field: any) => field.field_path === 'report_data.overall_score' && field.reason === 'raw_report_field_excluded_from_public_report_payload')).toBe(true);
    expect(payload.forbidden_field_scan.forbidden_fields_absent).toBe(true);
    expect(payload.forbidden_field_scan.strict_subset_of_render_payload).toBe(true);
    expect(payload.blocked_field_hits).toEqual([]);
  });

  it('S9-17C: blocks public report payload fields that are not in render payload or are forbidden', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17c-public-blocked-'));
    await emitPublicReportPayloadArtifact({
      run_id: 'run-public-blocked',
      analysis_run_id: 'run-public-blocked',
      take_id: 'tpb',
      internal_qa_emit: true,
      root_dir: root,
      render_payload: { report_data: { schema_version: 'v3', fix_first: 'Safe text' } },
      public_report_data: { report_data: { schema_version: 'v3', fix_first: 'Safe text', strengths: ['Extra public-only item'], overall_score: 99 } },
      allowed_field_paths: ['report_data.schema_version', 'report_data.fix_first', 'report_data.strengths', 'report_data.overall_score'],
    });
    const payload = await readPublicReportPayload(root, 'run-public-blocked', 'tpb');
    expect(payload.public_report_payload_status).toBe('emitted_blocked');
    expect(payload.blocker_codes).toContain('public_report_payload_forbidden_field_present');
    expect(payload.blocker_codes).toContain('public_report_payload_extra_path_not_in_render_payload');
    expect(payload.allowed_field_status_by_path['report_data.strengths'].reason).toBe('public_field_not_present_in_render_payload');
    expect(payload.allowed_field_status_by_path['report_data.overall_score'].status).toBe('blocked');
    expect(payload.report_data.strengths).toBeUndefined();
    expect(payload.report_data.overall_score).toBeUndefined();
    expect(payload.excluded_field_paths.some((field: any) => field.field_path === 'report_data.strengths')).toBe(true);
    expect(payload.excluded_field_paths.some((field: any) => field.field_path === 'report_data.overall_score')).toBe(true);
  });

  it('S9-17C: manifest finalisation auto-emits render and public payloads and can pass report parity for complete safe surfaces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-17b-manifest-'));
    const noExport = await emitNoExportProofBundle({
      run_id: 'run-s917b',
      root_dir: root,
      internal_qa_emit: true,
      proofs: {
        no_export_source_proof: { checked_paths: ['src/routes', 'src/components'], no_public_export_route_enabled: true },
        no_export_config_proof: { checked_env_keys: ['EXPORT_ENABLED', 'SHARE_ENABLED', 'DOWNLOAD_ENABLED'] },
        no_export_ui_proof: { checked_routes: ['src/routes/audition.$auditionId.tsx'], checked_components_or_files: ['src/components/report/V2ReportView.tsx'] },
        no_export_log_proof: { analysis_path_export_event_emitted: false, comparison_public_output_event_emitted: false },
      },
    });
    expect(noExport.emitted_artefact_ids).toEqual(expect.arrayContaining(['no_export_log_proof', 'no_export_proof']));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-s917b',
      analysis_run_id: 'run-s917b',
      take_id: 'trp',
      submission_id: 'sub1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report', ...noExport.emitted_artefact_ids],
      artefact_source_classification_by_id: { raw_report: 'legacy_adapter' },
      artefact_level2_spine_satisfaction_by_id: { raw_report: false },
      report_parity_input: {
        raw_report_data: {
          report_data: {
            schema_version: 'v3',
            submission_verdict: 'not_yet_ready',
            fix_first: 'Retake with a clearer first beat.',
            priority_fixes: ['Clarify the first beat.'],
            strengths: ['Text is clear.'],
            next_take_plan: ['Retake once.'],
            feedback_reliability: { status: 'partial' },
          },
        },
        public_report_payload: null,
        allowed_public_fields: [
          'report_data.schema_version',
          'report_data.submission_verdict',
          'report_data.fix_first',
          'report_data.priority_fixes',
          'report_data.strengths',
          'report_data.next_take_plan',
          'report_data.feedback_reliability',
        ],
      },
    });
    const renderPayload = await readRenderPayload(root, 'run-s917b', 'trp');
    expect(renderPayload.render_payload_status).toBe('emitted');
    const publicPayload = await readPublicReportPayload(root, 'run-s917b', 'trp');
    expect(publicPayload.public_report_payload_status).toBe('emitted');
    expect(publicPayload.report_data).toEqual(renderPayload.report_data);
    const parity = await readParity(root, 'run-s917b', 'trp');
    expect(parity.render_payload_available).toBe(true);
    expect(parity.render_payload_checked).toBe(true);
    expect(parity.public_report_payload_available).toBe(true);
    expect(parity.public_report_payload_checked).toBe(true);
    expect(parity.checked_surfaces).toContain('render_payload');
    expect(parity.checked_surfaces).toContain('public_report_payload');
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'render_payload_missing')).toBe(false);
    expect(parity.mismatches.some((m: any) => m.mismatch_type === 'public_report_payload_missing')).toBe(false);
    expect(parity.parity_status).toBe('passed');
    const manifest = JSON.parse(await readFile(path.join(root, 'run-s917b', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-s917b', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.render_payload).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.render_payload).toBe('internal_render_payload');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.render_payload).toBe(false);
    expect(manifest.artefact_status_by_id.public_report_payload).toBe('emitted');
    expect(manifest.artefact_source_classification_by_id.public_report_payload).toBe('internal_public_report_payload');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.public_report_payload).toBe(false);
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_log_proof).toBe('emitted');
    expect(manifest.artefact_status_by_id.no_export_proof).toBe('emitted');
    expect(manifest.no_export_status).toBe('no_export_proof_complete');
    expect(manifest.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(manifest.blocker_codes).not.toContain('no_export_proof_missing');
    expect(metrics.emitted_artefacts).toContain('render_payload');
    expect(metrics.emitted_artefacts).toContain('public_report_payload');
    expect(metrics.emitted_artefacts).toContain('parity_report');
    expect(metrics.emitted_artefacts).toContain('no_export_log_proof');
    expect(metrics.emitted_artefacts).toContain('no_export_proof');
    expect(metrics.export_or_no_export_status).toBe('no_export_proof_complete');
    expect(metrics.render_parity_status).toBe('passed');
    expect(metrics.report_parity_status).toBe('passed');
    expect(metrics.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(metrics.blocker_codes).not.toContain('no_export_proof_missing');
    expect(metrics.next_required_engineering_tasks).not.toContain('report parity proof');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('A/B: detects value drift on both public_report_payload and render_payload surfaces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-a-'));
    await emitReportParityProof({ run_id: 'run-a1', analysis_run_id: 'run-a1', take_id: 't1', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] });
    const p1 = await readParity(root, 'run-a1', 't1');
    expect(p1.parity_status).toBe('failed');
    expect(p1.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary' && m.surface==='public_report_payload')).toBe(true);

    await emitReportParityProof({ run_id: 'run-a2', analysis_run_id: 'run-a2', take_id: 't2', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, render_payload: { summary: 'B' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] });
    const p2 = await readParity(root, 'run-a2', 't2');
    expect(p2.parity_status).toBe('failed');
    expect(p2.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary' && m.surface==='render_payload')).toBe(true);
  });

  it('C/D/E: nested object, array and presence mismatches fail parity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-cde-'));
    await emitReportParityProof({ run_id: 'run-cde', analysis_run_id: 'run-cde', take_id: 't3', internal_qa_emit: true, root_dir: root, raw_report_data: { priority_fix: { title: 'A', detail: 'B' }, notes: ['a', 'b'], required_field: 'x' }, public_report_payload: { priority_fix: { title: 'A', detail: 'C' }, notes: ['b', 'a'] }, allowed_public_fields: ['priority_fix', 'notes', 'required_field'] });
    const p = await readParity(root, 'run-cde', 't3');
    expect(p.parity_status).toBe('failed');
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='priority_fix')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='notes')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='presence_mismatch' && m.field==='required_field')).toBe(true);
  });

  it('F/G: forbidden field leaks fail parity on both surfaces', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-fg-'));
    await emitReportParityProof({ run_id: 'run-fg', analysis_run_id: 'run-fg', take_id: 't4', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok', winner: 'take-1' }, public_report_payload: { summary: 'ok', scores: { overall: 99 } }, allowed_public_fields: ['summary'], blocked_field_paths: ['winner', 'scores'] });
    const p = await readParity(root, 'run-fg', 't4');
    expect(p.checked_surfaces).toEqual(['render_payload', 'public_report_payload']);
    expect(p.parity_status).toBe('failed');
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='render_payload' && m.field==='winner')).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='public_report_payload' && m.field==='scores')).toBe(true);
  });

  it('H/I: empty or missing allowed fields are insufficient', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-hi-'));
    await emitReportParityProof({ run_id: 'run-h', analysis_run_id: 'run-h', take_id: 't5', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: [] });
    const h = await readParity(root, 'run-h', 't5');
    expect(h.parity_status).toBe('insufficient');
    expect(h.level2_satisfaction).toBe('insufficient');
    expect(h.mismatches.some((m:any)=>m.mismatch_type==='allowed_public_fields_missing')).toBe(true);

    await emitReportParityProof({ run_id: 'run-i', analysis_run_id: 'run-i', take_id: 't6', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' } });
    const i = await readParity(root, 'run-i', 't6');
    expect(i.parity_status).toBe('insufficient');
    expect(i.mismatches.some((m:any)=>m.mismatch_type==='allowed_public_fields_missing')).toBe(true);
  });

  it('normalises malformed/blank allowed_public_fields and never throws', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-allowed-norm-'));
    const cases: Array<[string, any[]]> = [
      ['null', [null]],
      ['number', [123]],
      ['object-array', [{ path: 'summary' }, ['summary']]],
      ['blank', ['   ']],
    ];
    for (const [suffix, allowed] of cases) {
      const run = `run-allowed-${suffix}`;
      await expect(emitReportParityProof({ run_id: run, analysis_run_id: run, take_id: 'tn', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: allowed as any })).resolves.toBeTruthy();
      const p = await readParity(root, run, 'tn');
      expect(p.parity_status).toBe('insufficient');
      expect(p.level2_satisfaction).toBe('insufficient');
      expect(p.mismatches.some((m:any)=>m.mismatch_type==='allowed_public_fields_missing')).toBe(true);
      expect(p.invalid_allowed_public_field_count).toBeGreaterThanOrEqual(0);
      expect(p.dropped_allowed_public_field_count).toBeGreaterThanOrEqual(1);
    }
  });

  it('normalises mixed allowed/blocked path inputs and still enforces drift + forbidden checks', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-mixed-paths-'));

    await emitReportParityProof({ run_id: 'run-mixed-allowed-pass', analysis_run_id: 'run-mixed-allowed-pass', take_id: 'tm1', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, render_payload: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: [' summary ', null as any, '', 'summary', 123 as any] as any });
    const mixedPass = await readParity(root, 'run-mixed-allowed-pass', 'tm1');
    expect(mixedPass.checked_public_fields).toEqual(['summary']);
    expect(mixedPass.parity_status).toBe('passed');

    await emitReportParityProof({ run_id: 'run-mixed-allowed-drift', analysis_run_id: 'run-mixed-allowed-drift', take_id: 'tm2', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['   ', 'summary'] as any });
    const mixedDrift = await readParity(root, 'run-mixed-allowed-drift', 'tm2');
    expect(mixedDrift.parity_status).toBe('failed');
    expect(mixedDrift.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary')).toBe(true);

    await emitReportParityProof({ run_id: 'run-invalid-blocked', analysis_run_id: 'run-invalid-blocked', take_id: 'tm3', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A', internal_notes: 'private' }, allowed_public_fields: ['summary'], blocked_field_paths: [null as any, 123 as any, ' internal_notes '] as any });
    const invalidBlocked = await readParity(root, 'run-invalid-blocked', 'tm3');
    expect(invalidBlocked.parity_status).toBe('failed');
    expect(invalidBlocked.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='internal_notes')).toBe(true);

    await emitReportParityProof({ run_id: 'run-invalid-score-blocked', analysis_run_id: 'run-invalid-score-blocked', take_id: 'tm4', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A', custom_score: 77 }, allowed_public_fields: ['summary'], blocked_field_paths: [' custom_score '], blocked_score_field_paths: [null as any, 123 as any, ' custom_score '] as any });
    const invalidScoreBlocked = await readParity(root, 'run-invalid-score-blocked', 'tm4');
    expect(invalidScoreBlocked.parity_status).toBe('failed');
    expect(invalidScoreBlocked.blocked_score_fields_absent).toBe(false);
  });

  

  it('supports bracket-indexed allowed_public_fields for pass/drift/presence/out-of-range/malformed mixes without crashing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-bracket-'));

    await emitReportParityProof({
      run_id: 'run-bracket-pass', analysis_run_id: 'run-bracket-pass', take_id: 'tb1', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A', metrics: [{ label: 'x' }, { label: 'y' }] }] },
      public_report_payload: { sections: [{ summary: 'A', metrics: [{ label: 'x' }, { label: 'y' }] }] },
      render_payload: { sections: [{ summary: 'A', metrics: [{ label: 'x' }, { label: 'y' }] }] },
      allowed_public_fields: ['sections[0].summary', 'sections[0].metrics[1].label'],
    });
    const pass = await readParity(root, 'run-bracket-pass', 'tb1');
    expect(pass.parity_status).toBe('passed');
    expect(pass.mismatches.some((m:any)=>m.mismatch_type==='presence_mismatch')).toBe(false);
    expect(pass.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch')).toBe(false);

    await emitReportParityProof({
      run_id: 'run-bracket-public-drift', analysis_run_id: 'run-bracket-public-drift', take_id: 'tb2', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A' }] },
      public_report_payload: { sections: [{ summary: 'B' }] },
      allowed_public_fields: ['sections[0].summary'],
    });
    const publicDrift = await readParity(root, 'run-bracket-public-drift', 'tb2');
    expect(publicDrift.parity_status).toBe('failed');
    expect(publicDrift.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.surface==='public_report_payload' && m.field==='sections[0].summary')).toBe(true);

    await emitReportParityProof({
      run_id: 'run-bracket-render-drift', analysis_run_id: 'run-bracket-render-drift', take_id: 'tb3', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A' }] },
      public_report_payload: { sections: [{ summary: 'A' }] },
      render_payload: { sections: [{ summary: 'B' }] },
      allowed_public_fields: ['sections[0].summary'],
    });
    const renderDrift = await readParity(root, 'run-bracket-render-drift', 'tb3');
    expect(renderDrift.parity_status).toBe('failed');
    expect(renderDrift.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.surface==='render_payload' && m.field==='sections[0].summary')).toBe(true);

    await emitReportParityProof({
      run_id: 'run-bracket-presence', analysis_run_id: 'run-bracket-presence', take_id: 'tb4', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'a0' }, { summary: 'a1' }] },
      public_report_payload: { sections: [{ summary: 'a0' }] },
      allowed_public_fields: ['sections[1].summary'],
    });
    const presence = await readParity(root, 'run-bracket-presence', 'tb4');
    expect(presence.parity_status).toBe('failed');
    expect(presence.mismatches.some((m:any)=>m.mismatch_type==='presence_mismatch' && m.field==='sections[1].summary')).toBe(true);

    await expect(emitReportParityProof({
      run_id: 'run-bracket-oob', analysis_run_id: 'run-bracket-oob', take_id: 'tb5', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A' }] },
      public_report_payload: { sections: [{ summary: 'A' }] },
      allowed_public_fields: ['sections[99].summary'],
    })).resolves.toBeTruthy();
    const oob = await readParity(root, 'run-bracket-oob', 'tb5');
    expect(['passed','failed','insufficient']).toContain(oob.parity_status);

    await expect(emitReportParityProof({
      run_id: 'run-bracket-malformed', analysis_run_id: 'run-bracket-malformed', take_id: 'tb6', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A' }] },
      public_report_payload: { sections: [{ summary: 'A' }] },
      allowed_public_fields: ['sections[x].summary', 'sections[-1].summary', 'sections[].summary'] as any,
    })).resolves.toBeTruthy();
    const malformed = await readParity(root, 'run-bracket-malformed', 'tb6');
    expect(malformed.parity_status).toBe('insufficient');

    await emitReportParityProof({
      run_id: 'run-bracket-mixed', analysis_run_id: 'run-bracket-mixed', take_id: 'tb7', internal_qa_emit: true, root_dir: root,
      raw_report_data: { sections: [{ summary: 'A' }] },
      render_payload: { sections: [{ summary: 'A' }] },
      public_report_payload: { sections: [{ summary: 'A' }] },
      allowed_public_fields: [' sections[0].summary ', 'bad[x].value', null as any, 123 as any] as any,
    });
    const mixed = await readParity(root, 'run-bracket-mixed', 'tb7');
    expect(mixed.parity_status).toBe('passed');
    expect(mixed.checked_public_fields).toEqual(['sections[0].summary']);
  });

  it('J/K/L/M: undefined/function/symbol hashing is stable and does not throw', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-jklm-'));

    await expect(emitReportParityProof({ run_id: 'run-j1', analysis_run_id: 'run-j1', take_id: 't9', internal_qa_emit: true, root_dir: root, raw_report_data: { weird: undefined }, render_payload: { weird: undefined }, public_report_payload: { weird: undefined }, allowed_public_fields: ['weird'] })).resolves.toBeTruthy();
    const j = await readParity(root, 'run-j1', 't9');
    expect(j.parity_status).toBe('passed');

    await expect(emitReportParityProof({ run_id: 'run-k1', analysis_run_id: 'run-k1', take_id: 't10', internal_qa_emit: true, root_dir: root, raw_report_data: { weird: undefined }, public_report_payload: { weird: null }, allowed_public_fields: ['weird'] })).resolves.toBeTruthy();
    const k = await readParity(root, 'run-k1', 't10');
    expect(k.parity_status).toBe('failed');
    expect(k.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='weird')).toBe(true);

    await expect(emitReportParityProof({ run_id: 'run-l1', analysis_run_id: 'run-l1', take_id: 't11', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok', forbidden: undefined }, allowed_public_fields: ['summary'], blocked_field_paths: ['forbidden'] })).resolves.toBeTruthy();
    const l = await readParity(root, 'run-l1', 't11');
    expect(l.parity_status).toBe('failed');
    expect(l.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='forbidden')).toBe(true);

    const fn = function demoFn(){};
    await expect(emitReportParityProof({ run_id: 'run-m1', analysis_run_id: 'run-m1', take_id: 't12', internal_qa_emit: true, root_dir: root, raw_report_data: { f: fn, s: Symbol('x') }, public_report_payload: { f: fn, s: Symbol('x') }, allowed_public_fields: ['f', 's'] })).resolves.toBeTruthy();
  });

  it('typed equality guards against sentinel collisions and preserves identity semantics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-typed-eq-'));

    await emitReportParityProof({ run_id: 'run-te-1', analysis_run_id: 'run-te-1', take_id: 'tte1', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: undefined }, public_report_payload: { summary: '__undefined__' }, allowed_public_fields: ['summary'] });
    const te1 = await readParity(root, 'run-te-1', 'tte1');
    expect(te1.parity_status).toBe('failed');
    expect(te1.mismatches.some((m:any)=>m.mismatch_type==='value_mismatch' && m.field==='summary')).toBe(true);

    await emitReportParityProof({ run_id: 'run-te-2', analysis_run_id: 'run-te-2', take_id: 'tte2', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: '__undefined__' }, render_payload: { summary: '__undefined__' }, public_report_payload: { summary: '__undefined__' }, allowed_public_fields: ['summary'] });
    const te2 = await readParity(root, 'run-te-2', 'tte2');
    expect(te2.parity_status).toBe('passed');

    await emitReportParityProof({ run_id: 'run-te-3', analysis_run_id: 'run-te-3', take_id: 'tte3', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: null }, public_report_payload: { summary: 'null' }, allowed_public_fields: ['summary'] });
    const te3 = await readParity(root, 'run-te-3', 'tte3');
    expect(te3.parity_status).toBe('failed');

    await emitReportParityProof({ run_id: 'run-te-4', analysis_run_id: 'run-te-4', take_id: 'tte4', internal_qa_emit: true, root_dir: root, raw_report_data: { s: Symbol('x') }, public_report_payload: { s: '__symbol__:x' }, allowed_public_fields: ['s'] });
    const te4 = await readParity(root, 'run-te-4', 'tte4');
    expect(te4.parity_status).toBe('failed');

    const symA = Symbol('x');
    const symB = Symbol('x');
    await emitReportParityProof({ run_id: 'run-te-5', analysis_run_id: 'run-te-5', take_id: 'tte5', internal_qa_emit: true, root_dir: root, raw_report_data: { s: symA }, public_report_payload: { s: symB }, allowed_public_fields: ['s'] });
    const te5 = await readParity(root, 'run-te-5', 'tte5');
    expect(te5.parity_status).toBe('failed');

    await emitReportParityProof({ run_id: 'run-te-6', analysis_run_id: 'run-te-6', take_id: 'tte6', internal_qa_emit: true, root_dir: root, raw_report_data: { s: symA }, render_payload: { s: symA }, public_report_payload: { s: symA }, allowed_public_fields: ['s'] });
    const te6 = await readParity(root, 'run-te-6', 'tte6');
    expect(te6.parity_status).toBe('passed');

    const fn1 = function demoFn(){};
    const fn2 = function demoFn(){};
    await emitReportParityProof({ run_id: 'run-te-7', analysis_run_id: 'run-te-7', take_id: 'tte7', internal_qa_emit: true, root_dir: root, raw_report_data: { f: fn1 }, public_report_payload: { f: fn2 }, allowed_public_fields: ['f'] });
    const te7 = await readParity(root, 'run-te-7', 'tte7');
    expect(te7.parity_status).toBe('failed');

    await emitReportParityProof({ run_id: 'run-te-8', analysis_run_id: 'run-te-8', take_id: 'tte8', internal_qa_emit: true, root_dir: root, raw_report_data: { f: fn1 }, render_payload: { f: fn1 }, public_report_payload: { f: fn1 }, allowed_public_fields: ['f'] });
    const te8 = await readParity(root, 'run-te-8', 'tte8');
    expect(te8.parity_status).toBe('passed');

    await emitReportParityProof({ run_id: 'run-te-9', analysis_run_id: 'run-te-9', take_id: 'tte9', internal_qa_emit: true, root_dir: root, raw_report_data: { b: 10n }, render_payload: { b: 10n }, public_report_payload: { b: 10n }, allowed_public_fields: ['b'] });
    const te9 = await readParity(root, 'run-te-9', 'tte9');
    expect(te9.parity_status).toBe('passed');

    await emitReportParityProof({ run_id: 'run-te-10', analysis_run_id: 'run-te-10', take_id: 'tte10', internal_qa_emit: true, root_dir: root, raw_report_data: { b: 10n }, public_report_payload: { b: 11n }, allowed_public_fields: ['b'] });
    const te10 = await readParity(root, 'run-te-10', 'tte10');
    expect(te10.parity_status).toBe('failed');

    const circA: any = { tag: 'x' };
    circA.self = circA;
    const circB: any = { tag: 'x' };
    circB.self = circB;
    await expect(emitReportParityProof({ run_id: 'run-te-11', analysis_run_id: 'run-te-11', take_id: 'tte11', internal_qa_emit: true, root_dir: root, raw_report_data: { c: circA }, public_report_payload: { c: circB }, allowed_public_fields: ['c'] })).resolves.toBeTruthy();
    const te11 = await readParity(root, 'run-te-11', 'tte11');
    expect(['passed', 'failed', 'insufficient']).toContain(te11.parity_status);

    const undefinedSummary = te1.mismatches.find((m:any)=>m.field==='summary' && m.surface==='public_report_payload')?.value_diagnostic?.raw_value_summary;
    const stringSummary = te1.mismatches.find((m:any)=>m.field==='summary' && m.surface==='public_report_payload')?.value_diagnostic?.surface_value_summary;
    expect(undefinedSummary?.stable_hash_sha256).not.toBe(stringSummary?.stable_hash_sha256);
  });

  it('J/L: clean surfaces pass; canonical metadata preserved', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-jl-'));
    await emitReportParityProof({ run_id: 'run-j', analysis_run_id: 'run-j', take_id: 't7', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const p = await readParity(root, 'run-j', 't7');
    expect(p.parity_status).toBe('passed');
    expect(p.internal_only).toBe(true);
    expect(p.privacy_classification).toBe('internal_private');
    expect(p.schema_version).toBe('tapecoach_v3_report_parity_result_v1');
    expect(p.run_id).toBe('run-j');
    expect(p.analysis_run_id).toBe('run-j');
    expect(p.production_safe_status).toBe('blocked');
    expect(p.public_scoring_status).toBe('blocked');
    expect(p.public_technique_authority_status).toBe('blocked');
    expect(p.level2_satisfaction).toBe('satisfied');
    expect(p.public_output_permissions_checked).toBe(true);
    expect(p.render_payload_checked).toBe(true);
  });

  it('public_report_payload is required for pass even when render_payload matches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-public-required-'));
    const out = await emitReportParityProof({ run_id: 'run-pr', analysis_run_id: 'run-pr', take_id: 'tpr', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, render_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const p = await readParity(root, 'run-pr', 'tpr');
    expect(out.parity_status).toBe('insufficient');
    expect(p.parity_status).toBe('insufficient');
    expect(p.level2_satisfaction).toBe('insufficient');
    expect(p.public_report_payload_available).toBe(false);
    expect(p.public_output_permissions_checked).toBe(false);
    expect(p.render_payload_checked).toBe(true);
    expect(p.checked_surfaces).toContain('render_payload');
    expect(p.blocker_codes).toContain('parity_artefacts_missing');
  });

  it('render_payload is required for pass even when public_report_payload matches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-render-required-'));
    const out = await emitReportParityProof({ run_id: 'run-render-required', analysis_run_id: 'run-render-required', take_id: 'trr', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] });
    const p = await readParity(root, 'run-render-required', 'trr');
    expect(out.parity_status).toBe('insufficient');
    expect(p.parity_status).toBe('insufficient');
    expect(p.level2_satisfaction).toBe('insufficient');
    expect(p.render_payload_available).toBe(false);
    expect(p.render_payload_checked).toBe(false);
    expect(p.public_output_permissions_checked).toBe(true);
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='render_payload_missing')).toBe(true);
    expect(p.blocker_codes).toContain('parity_artefacts_missing');
  });


  it('forbidden leak precedence: missing raw_report_data still fails when forbidden fields leak', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-forbidden-precedence-'));
    await emitReportParityProof({
      run_id: 'run-forbidden-precedence',
      analysis_run_id: 'run-forbidden-precedence',
      take_id: 'tf',
      internal_qa_emit: true,
      root_dir: root,
      raw_report_data: null,
      public_report_payload: { summary: 'ok', winner: 'take-1' },
      allowed_public_fields: ['summary'],
      blocked_field_paths: ['winner'],
    });
    const p = await readParity(root, 'run-forbidden-precedence', 'tf');
    expect(p.parity_status).toBe('failed');
    expect(p.level2_satisfaction).toBe('insufficient');
    expect(p.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='winner')).toBe(true);
  });

  it('K: manifest + metrics align and parity blockers remain when parity fails', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-k-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-k',
      analysis_run_id: 'run-k',
      take_id: 't8',
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report'],
      report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] },
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-k', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-k', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted_blocked');
    expect(manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_report')?.blocker_code).toBe('parity_artefacts_missing');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.render_parity_status).toBe('failed');
    expect(metrics.report_parity_status).toBe('failed');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.parity_report).toBe(false);
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('J/S9-17C: ordinary runtime emits render and public payloads and clears report surface missing mismatches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-16e-report-parity-missing-surfaces-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-s916e-report-missing',
      analysis_run_id: 'run-s916e-report-missing',
      take_id: 't-report',
      compared_take_ids: ['t-report'],
      comparison_run_id: null,
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report'],
      report_parity_input: {
        raw_report_data: { report_data: { fix_first: 'Keep the eyeline steady.' } },
        render_payload: null,
        public_report_payload: null,
        allowed_public_fields: ['report_data.fix_first'],
      },
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-s916e-report-missing', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-s916e-report-missing', 'qa', 'acceptance_metrics.json'), 'utf8'));
    const parity = JSON.parse(await readFile(path.join(root, 'run-s916e-report-missing', 'takes', 'take-t-report', 'analysis-run-s916e-report-missing', 'parity', 'report_parity_result.json'), 'utf8'));
    const publicPayload = await readPublicReportPayload(root, 'run-s916e-report-missing', 't-report');

    expect(parity.parity_status).toBe('passed');
    expect(parity.render_payload_available).toBe(true);
    expect(parity.render_payload_checked).toBe(true);
    expect(parity.public_report_payload_available).toBe(true);
    expect(parity.public_report_payload_checked).toBe(true);
    expect(parity.mismatches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ mismatch_type: 'render_payload_missing' }),
    ]));
    expect(parity.mismatches).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ mismatch_type: 'public_report_payload_missing' }),
    ]));
    expect(publicPayload.public_report_payload_status).toBe('emitted');
    expect(publicPayload.report_data.fix_first).toBe('Keep the eyeline steady.');
    expect(manifest.artefact_status_by_id.render_payload).toBe('emitted');
    expect(manifest.artefact_status_by_id.public_report_payload).toBe('emitted');
    expect(metrics.emitted_artefacts).toContain('render_payload');
    expect(metrics.emitted_artefacts).toContain('public_report_payload');
    expect(metrics.render_parity_status).toBe('passed');
    expect(metrics.report_parity_status).toBe('passed');
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(manifest.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(metrics.blocker_codes).not.toContain('parity_artefacts_missing');
    expect(metrics.next_required_engineering_tasks).not.toContain('report parity proof');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('comparison parity requiredness: ordinary runs mark parity_comparison not_applicable and do not block solely for it', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-ordinary-'));
    const out = await emitReportParityProof({ run_id: 'run-ordinary', analysis_run_id: 'run-ordinary', take_id: 't1', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, render_payload: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] });
    await emitQAManifestForAnalysisRun({
      run_id: 'run-ordinary',
      analysis_run_id: 'run-ordinary',
      take_id: 't1',
      compared_take_ids: ['t1'],
      comparison_run_id: null,
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report', ...out.emitted_artefact_ids],
      artefact_level2_spine_satisfaction_by_id: { parity_report: out.parity_status === 'passed' },
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-ordinary', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-ordinary', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('not_applicable');
    expect(manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison')?.status).toBe('not_applicable');
    expect(manifest.missing_artifacts).not.toContain('parity_comparison');
    expect(manifest.blocker_codes).not.toContain('parity_artefacts_missing');
    const parityMissingInputs = ['parity_report', 'parity_comparison'].filter((id) => manifest.missing_artifacts.includes(id));
    expect(parityMissingInputs).toEqual([]);
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(manifest.blocker_codes).toContain('no_export_proof_missing');
  });

  it('comparison parity requiredness: report parity missing still blocks ordinary runs', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-ordinary-missing-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-ordinary-missing',
      analysis_run_id: 'run-ordinary-missing',
      take_id: 't1',
      compared_take_ids: ['t1'],
      comparison_run_id: null,
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-ordinary-missing', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-ordinary-missing', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('missing');
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('not_applicable');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.render_parity_status).toBe('missing');
    expect(metrics.report_parity_status).toBe('missing');
    expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
  });

  it('comparison parity requiredness: comparison-invoked runs still require parity_comparison', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-comparison-'));
    const out = await emitReportParityProof({ run_id: 'run-comp', analysis_run_id: 'run-comp', take_id: 'ta', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'A' }, render_payload: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] });
    await emitQAManifestForAnalysisRun({
      run_id: 'run-comp',
      analysis_run_id: 'run-comp',
      take_id: 'ta',
      compared_take_ids: ['ta', 'tb'],
      comparison_run_id: 'cmp-1',
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report', 'comparison_raw', ...out.emitted_artefact_ids],
      artefact_level2_spine_satisfaction_by_id: { parity_report: out.parity_status === 'passed' },
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-comp', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-comp', 'qa', 'acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_comparison).toBe('emitted_blocked');
    expect(manifest.missing_artifacts).not.toContain('parity_comparison');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.blocker_codes).toContain('parity_artefacts_missing');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('deferred required artefacts preserve blocker codes and propagate to metrics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-deferred-blockers-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-deferred',
      analysis_run_id: 'run-deferred',
      take_id: 'td',
      compared_take_ids: ['td', 'te'],
      comparison_run_id: 'cmp-deferred',
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report'],
      deferred_artefact_ids: ['parity_report', 'parity_comparison', 'no_export_proof'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-deferred', 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-deferred', 'qa', 'acceptance_metrics.json'), 'utf8'));

    const parityReport = manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_report');
    const parityComparison = manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison');
    const noExport = manifest.required_artifacts.find((a:any)=>a.artefact_id==='no_export_proof');
    expect(parityReport?.status).toBe('deferred');
    expect(parityReport?.blocker_code).toBe('parity_artefacts_missing');
    expect(parityComparison?.status).toBe('deferred');
    expect(parityComparison?.blocker_code).toBe('parity_artefacts_missing');
    expect(noExport?.status).toBe('deferred');
    expect(noExport?.blocker_code).toBe('no_export_proof_missing');
    expect(manifest.missing_artifacts).not.toContain('parity_comparison');
    expect(manifest.blocker_codes).toContain('parity_artefacts_missing');
    expect(manifest.blocker_codes).toContain('no_export_proof_missing');
    expect(metrics.blocker_codes).toEqual(manifest.blocker_codes);
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('unsatisfied emitted parity keeps blocker_code and emitted_blocked behaviour remains unchanged', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13d-emitted-suppress-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-emitted',
      analysis_run_id: 'run-emitted',
      take_id: 'te',
      compared_take_ids: ['te'],
      comparison_run_id: null,
      submission_id: 's1',
      internal_qa_emit: true,
      root_dir: root,
      emitted_artefact_ids: ['raw_report', 'parity_report'],
      emitted_blocked_artefact_ids: ['comparison_raw'],
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-emitted', 'manifest.json'), 'utf8'));
    const parityReport = manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_report');
    const parityComparison = manifest.required_artifacts.find((a:any)=>a.artefact_id==='parity_comparison');
    const comparisonRaw = manifest.required_artifacts.find((a:any)=>a.artefact_id==='comparison_raw');
    expect(parityReport?.status).toBe('emitted_blocked');
    expect(parityReport?.blocker_code).toBe('parity_artefacts_missing');
    expect(parityComparison?.status).toBe('emitted_blocked');
    expect(parityComparison?.blocker_code).toBe('parity_artefacts_missing');
    expect(comparisonRaw?.status).toBe('emitted_blocked');
  });

  it('O/P/Q: manifest flow emits parity in file/log sinks when report_parity_input exists, and stays missing when absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-opq-'));
    const prevSink = process.env.QA_ARTIFACT_SINK;

    process.env.QA_ARTIFACT_SINK = 'file';
    await emitQAManifestForAnalysisRun({ run_id: 'run-o', analysis_run_id: 'run-o', take_id: 'to', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, render_payload: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } });
    const manifestO = JSON.parse(await readFile(path.join(root, 'run-o', 'manifest.json'), 'utf8'));
    expect(manifestO.artefact_status_by_id.parity_report).toBe('emitted');

    process.env.QA_ARTIFACT_SINK = 'log';
    await emitQAManifestForAnalysisRun({ run_id: 'run-p', analysis_run_id: 'run-p', take_id: 'tp', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'B' }, allowed_public_fields: ['summary'] } });
    const manifestP = JSON.parse(await readFile(path.join(root, 'run-p', 'manifest.json'), 'utf8'));
    expect(manifestP.artefact_status_by_id.parity_report).toBe('emitted_blocked');
    expect(manifestP.blocker_codes).toContain('parity_artefacts_missing');

    await emitQAManifestForAnalysisRun({ run_id: 'run-q', analysis_run_id: 'run-q', take_id: 'tq', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'] });
    const manifestQ = JSON.parse(await readFile(path.join(root, 'run-q', 'manifest.json'), 'utf8'));
    expect(manifestQ.artefact_status_by_id.parity_report).toBe('missing');

    process.env.QA_ARTIFACT_SINK = prevSink;
  });

  it('B/D/E/F: emits run-scoped parity when take id is unavailable; handles unsafe identity without crash', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-runscoped-'));
    process.env.QA_ARTIFACT_SINK = 'file';
    await emitQAManifestForAnalysisRun({ run_id: 'run-rs', analysis_run_id: 'run-rs', submission_id: 's1', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, render_payload: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-rs', 'manifest.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.parity_report).toBe('emitted');
    const parity = JSON.parse(await readFile(path.join(root, 'run-rs', 'parity', 'report_parity_result.json'), 'utf8'));
    expect(parity.parity_status).toBe('passed');

    const bad = await emitQAManifestForAnalysisRun({ run_id: '../bad', analysis_run_id: '../bad', internal_qa_emit: true, root_dir: root, emitted_artefact_ids: ['raw_report'], report_parity_input: { raw_report_data: { summary: 'A' }, public_report_payload: { summary: 'A' }, allowed_public_fields: ['summary'] } } as any);
    expect(bad.written).toBe(false);
  });

  it('classifies blocked score/readiness leaks using blocked score path set', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-13c-scoreblock-'));
    const cases: Array<[string, any, 'render_payload'|'public_report_payload', boolean]> = [
      ['overall_readiness', { overall_readiness: 88 }, 'public_report_payload', true],
      ['overall_readiness', { overall_readiness: 88 }, 'render_payload', true],
      ['report_data.overall_readiness', { report_data: { overall_readiness: 86 } }, 'public_report_payload', true],
      ['overall_score', { overall_score: 90 }, 'public_report_payload', true],
      ['overall_score_final', { overall_score_final: 89 }, 'public_report_payload', true],
      ['score_value', { score_value: 77 }, 'public_report_payload', true],
      ['category_scores', { category_scores: { acting: 90 } }, 'public_report_payload', true],
      ['report_data.scores', { report_data: { scores: { overall: 91 } } }, 'public_report_payload', true],
      ['report_data.scores.overall', { report_data: { scores: { overall: 91 } } }, 'public_report_payload', true],
      ['report_data.overall_score_model', { report_data: { overall_score_model: 90 } }, 'render_payload', true],
      ['report_data.score_summary.overall', { report_data: { score_summary: { overall: 90 } } }, 'render_payload', true],
      ['report_data.score_breakdown.category_scores', { report_data: { score_breakdown: { category_scores: { acting: 88 } } } }, 'public_report_payload', true],
      ['report_data.readiness_score', { report_data: { readiness_score: 84 } }, 'public_report_payload', true],
      ['report_data.scores[0].value', { report_data: { scores: [{ value: 91 }] } }, 'public_report_payload', true],
      ['comparison', { comparison: { winner: 't2' } }, 'public_report_payload', false],
      ['winner', { winner: 't2' }, 'public_report_payload', false],
      ['recommendation', { recommendation: 'choose take 2' }, 'public_report_payload', false],
    ];
    for (const [field, patch, surface, shouldBeScoreLeak] of cases) {
      const run = `run-${field.replace(/\W/g,'-')}-${surface}`;
      const input: any = { run_id: run, analysis_run_id: run, take_id: 'ts', internal_qa_emit: true, root_dir: root, raw_report_data: { summary: 'ok' }, public_report_payload: { summary: 'ok' }, allowed_public_fields: ['summary'] };
      if (surface === 'render_payload') input.render_payload = { summary: 'ok', ...patch };
      else input.public_report_payload = { summary: 'ok', ...patch };
      await emitReportParityProof(input);
      const out = await readParity(root, run, 'ts');
      expect(out.parity_status).toBe('failed');
      expect(out.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && (m.field===field || String(m.field).startsWith(`${field}.`) || String(m.field).startsWith(`${field}[`)))).toBe(true);
      expect(out.blocked_score_fields_absent).toBe(!shouldBeScoreLeak);
      expect(out.public_scoring_status).toBe('blocked');
      expect(out.production_safe_status).toBe('blocked');
      expect(out.public_technique_authority_status).toBe('blocked');
      expect(out.level2_satisfaction).toBe('insufficient');
    }

    await emitReportParityProof({ run_id:'run-custom-private', analysis_run_id:'run-custom-private', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', internal_notes:'private' }, allowed_public_fields:['summary'], blocked_field_paths:['internal_notes'] });
    const customPrivate = await readParity(root, 'run-custom-private', 'ts');
    expect(customPrivate.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='internal_notes')).toBe(true);
    expect(customPrivate.forbidden_fields_absent).toBe(false);
    expect(customPrivate.blocked_internal_fields_absent).toBe(false);
    expect(customPrivate.blocked_score_fields_absent).toBe(true);
    expect(customPrivate.parity_status).toBe('failed');

    await emitReportParityProof({ run_id:'run-custom-score', analysis_run_id:'run-custom-score', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', custom_readiness_metric:73 }, allowed_public_fields:['summary'], blocked_field_paths:['custom_readiness_metric'], blocked_score_field_paths:['custom_readiness_metric'] });
    const customScore = await readParity(root, 'run-custom-score', 'ts');
    expect(customScore.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='custom_readiness_metric')).toBe(true);
    expect(customScore.blocked_score_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-custom-additive', analysis_run_id:'run-custom-additive', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', overall_score:99, internal_notes:'private' }, allowed_public_fields:['summary'], blocked_field_paths:['internal_notes'] });
    const customAdditive = await readParity(root, 'run-custom-additive', 'ts');
    expect(customAdditive.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='overall_score')).toBe(true);
    expect(customAdditive.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.field==='internal_notes')).toBe(true);
    expect(customAdditive.blocked_score_fields_absent).toBe(false);


    await emitReportParityProof({ run_id:'run-allowed-cannot-override-score', analysis_run_id:'run-allowed-cannot-override-score', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', report_data:{ scores:{ overall:99 } } }, allowed_public_fields:['summary'] });
    const allowCantOverride = await readParity(root, 'run-allowed-cannot-override-score', 'ts');
    expect(allowCantOverride.parity_status).toBe('failed');
    expect(allowCantOverride.blocked_score_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-readiness-note-safe', analysis_run_id:'run-readiness-note-safe', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, render_payload:{ summary:'ok' }, public_report_payload:{ summary:'ok', readiness_note:'narrative only' }, allowed_public_fields:['summary'] });
    const readinessNoteSafe = await readParity(root, 'run-readiness-note-safe', 'ts');
    expect(readinessNoteSafe.parity_status).toBe('failed');
    expect(readinessNoteSafe.mismatches.some((m:any)=>m.mismatch_type==='public_report_payload_extra_path' && m.field==='readiness_note')).toBe(true);

    await emitReportParityProof({ run_id:'run-tech-auth-public', analysis_run_id:'run-tech-auth-public', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', technique_authority:{ score: 1 } }, allowed_public_fields:['summary'] });
    const techAuthPublic = await readParity(root, 'run-tech-auth-public', 'ts');
    expect(techAuthPublic.parity_status).toBe('failed');
    expect(techAuthPublic.blocked_technique_authority_fields_absent).toBe(false);
    expect(techAuthPublic.public_technique_authority_status).toBe('blocked');

    await emitReportParityProof({ run_id:'run-tech-auth-render', analysis_run_id:'run-tech-auth-render', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, render_payload:{ summary:'ok', technique_authority: { leaked: true } }, allowed_public_fields:['summary'] });
    const techAuthRender = await readParity(root, 'run-tech-auth-render', 'ts');
    expect(techAuthRender.parity_status).toBe('failed');
    expect(techAuthRender.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && m.surface==='render_payload' && String(m.field).startsWith('technique_authority'))).toBe(true);
    expect(techAuthRender.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-tech-auth-report-data', analysis_run_id:'run-tech-auth-report-data', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', report_data: { technique_authority: { details: 'x' } } }, allowed_public_fields:['summary'] });
    const techAuthReportData = await readParity(root, 'run-tech-auth-report-data', 'ts');
    expect(techAuthReportData.parity_status).toBe('failed');
    expect(techAuthReportData.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-public-tech-auth', analysis_run_id:'run-public-tech-auth', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', public_technique_authority: { details: true } }, allowed_public_fields:['summary'] });
    const publicTechAuth = await readParity(root, 'run-public-tech-auth', 'ts');
    expect(publicTechAuth.parity_status).toBe('failed');
    expect(publicTechAuth.blocked_technique_authority_fields_absent).toBe(false);

    await emitReportParityProof({ run_id:'run-array-generic', analysis_run_id:'run-array-generic', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', items:[{ secret:'leak' }] }, allowed_public_fields:['summary'], blocked_field_paths:['items.secret'] });
    const arrayGeneric = await readParity(root, 'run-array-generic', 'ts');
    expect(arrayGeneric.parity_status).toBe('failed');
    expect(arrayGeneric.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && String(m.field).includes('items[0].secret'))).toBe(true);
    expect(arrayGeneric.blocked_score_fields_absent).toBe(true);

    await emitReportParityProof({ run_id:'run-array-container', analysis_run_id:'run-array-container', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', items:[{ nested:{ secret:'leak' } }] }, allowed_public_fields:['summary'], blocked_field_paths:['items'] });
    const arrayContainer = await readParity(root, 'run-array-container', 'ts');
    expect(arrayContainer.parity_status).toBe('failed');
    expect(arrayContainer.mismatches.some((m:any)=>m.mismatch_type==='forbidden_field_present' && String(m.field).startsWith('items['))).toBe(true);

    await emitReportParityProof({ run_id:'run-render-array-leak', analysis_run_id:'run-render-array-leak', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, render_payload:{ summary:'ok', items:[{ secret:'leak' }] }, allowed_public_fields:['summary'], blocked_field_paths:['items.secret'] });
    const renderArrayLeak = await readParity(root, 'run-render-array-leak', 'ts');
    expect(renderArrayLeak.parity_status).toBe('failed');
    expect(renderArrayLeak.mismatches.some((m:any)=>m.surface==='render_payload' && String(m.field).includes('items[0].secret'))).toBe(true);

    await emitReportParityProof({ run_id:'run-config-nested-score-array', analysis_run_id:'run-config-nested-score-array', take_id:'ts', internal_qa_emit:true, root_dir: root, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok', sections:[{ metrics:[{ score_value: 91 }] }] }, allowed_public_fields:['summary'], blocked_field_paths:['sections.metrics.score_value'], blocked_score_field_paths:['sections.metrics.score_value'] });
    const configNestedScoreArray = await readParity(root, 'run-config-nested-score-array', 'ts');
    expect(configNestedScoreArray.parity_status).toBe('failed');
    expect(configNestedScoreArray.blocked_score_fields_absent).toBe(false);

    const safeTakeRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-safe-take-'));
    const safeTakeOut = await emitReportParityProof({ run_id:'run-safe-take', analysis_run_id:'run-safe-take', take_id:'safe-take-1', internal_qa_emit:true, root_dir: safeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(safeTakeOut.written).toBe(true);
    await expect(readFile(path.join(safeTakeRoot, 'run-safe-take', 'takes', 'take-safe-take-1', 'analysis-run-safe-take', 'parity', 'report_parity_result.json'), 'utf8')).resolves.toBeTruthy();

    const runScopedRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-runscoped-2-'));
    const runScopedOut = await emitReportParityProof({ run_id:'run-no-take', analysis_run_id:'run-no-take', take_id:null, internal_qa_emit:true, root_dir: runScopedRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(runScopedOut.written).toBe(true);
    await expect(readFile(path.join(runScopedRoot, 'run-no-take', 'parity', 'report_parity_result.json'), 'utf8')).resolves.toBeTruthy();

    const unsafeTakeRoot = await mkdtemp(path.join(os.tmpdir(), 's9-13c-unsafe-take-'));
    const unsafeSlash = await emitReportParityProof({ run_id:'run-unsafe-slash', analysis_run_id:'run-unsafe-slash', take_id:'bad/take', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeSlash.written).toBe(false);
    expect(unsafeSlash.parity_status).toBe('insufficient');
    expect(unsafeSlash.blocker_codes).toContain('parity_artefacts_missing');
    const unsafeBackslash = await emitReportParityProof({ run_id:'run-unsafe-backslash', analysis_run_id:'run-unsafe-backslash', take_id:'bad\\take', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeBackslash.written).toBe(false);
    const unsafeEmpty = await emitReportParityProof({ run_id:'run-unsafe-empty', analysis_run_id:'run-unsafe-empty', take_id:'', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeEmpty.written).toBe(false);
    const unsafeDot = await emitReportParityProof({ run_id:'run-unsafe-dot', analysis_run_id:'run-unsafe-dot', take_id:'.', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeDot.written).toBe(false);
    expect(unsafeDot.parity_status).toBe('insufficient');
    expect(unsafeDot.blocker_codes).toContain('parity_artefacts_missing');
    const unsafeWhitespace = await emitReportParityProof({ run_id:'run-unsafe-whitespace', analysis_run_id:'run-unsafe-whitespace', take_id:'ts ', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafeWhitespace.written).toBe(false);
    expect(unsafeWhitespace.parity_status).toBe('insufficient');
    expect(unsafeWhitespace.blocker_codes).toContain('parity_artefacts_missing');
    const unsafePrefixed = await emitReportParityProof({ run_id:'run-unsafe-prefixed', analysis_run_id:'run-unsafe-prefixed', take_id:'take-ts', internal_qa_emit:true, root_dir: unsafeTakeRoot, raw_report_data:{ summary:'ok' }, public_report_payload:{ summary:'ok' }, allowed_public_fields:['summary'] });
    expect(unsafePrefixed.written).toBe(false);
    expect(unsafePrefixed.parity_status).toBe('insufficient');
    expect(unsafePrefixed.blocker_codes).toContain('parity_artefacts_missing');

  });

});
