import path from 'node:path';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitTechniqueObservationTraceFirstPass, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('S9 technique observation trace first pass', () => {
  it('prevents cross-family text-only public-claim linking and allows deterministic links', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r1', analysis_run_id: 'r1', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit',
      raw_report_data: { report_data: {
        timestamped_notes: [{ timestamp: '00:01', note: 'Shared phrase' }, { timestamp: '00:02', note: 'Index only' }, { timestamp: '00:03', note: 'Category vocal' }],
        strengths: ['Shared phrase', 'Shared phrase'],
        improvements: ['Unique improvement'],
        scores: { vocal: 94 },
        category_notes: [{ vocal: 'Category vocal' }],
      }},
      public_claim_trace_data: { claims: [
        { claim_id: 'pc-strength', source_path: 'report_data.strengths', claim_text: 'Shared phrase' },
        { claim_id: 'pc-strength-2', source_path: 'report_data.strengths', claim_text: 'Shared phrase' },
        { claim_id: 'pc-note-0', source_path: 'report_data.timestamped_notes[0].note', claim_text: 'Shared phrase' },
        { claim_id: 'pc-note-1', source_path: 'report_data.timestamped_notes[1].note', claim_text: 'Index only' },
        { claim_id: 'pc-note-4', source_path: 'report_data.timestamped_notes[4].note', claim_text: 'Index only' },
        { claim_id: 'pc-imp-1', source_path: 'report_data.improvements', claim_text: 'Unique improvement' },
        { claim_id: 'pc-imp-2', source_path: 'report_data.improvements', claim_text: 'Duplicate text' },
        { claim_id: 'pc-imp-3', source_path: 'report_data.improvements', claim_text: 'Duplicate text' },
        { claim_id: 'pc-score', source_path: 'report_data.strengths', claim_text: 'vocal: 94' },
        { claim_id: 'pc-cat-acting', source_path: 'report_data.category_notes.acting', claim_text: 'Category vocal' },
        { claim_id: 'pc-cat-vocal', source_path: 'report_data.category_notes.vocal', claim_text: 'Category vocal' },
      ]},
      root_dir: root, internal_qa_emit: true,
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r1', 'takes', 'take-t1', 'analysis-r1', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    const byPath = Object.fromEntries(payload.observations.map((o:any)=>[o.source_path, o]));

    expect(byPath['report_data.timestamped_notes[0].note'].linked_public_claim_ids).toContain('pc-note-0');
    expect(byPath['report_data.timestamped_notes[0].note'].linked_public_claim_ids).not.toContain('pc-strength');
    expect(byPath['report_data.timestamped_notes[1].note'].linked_public_claim_ids).toContain('pc-note-1');
    expect(byPath['report_data.timestamped_notes[1].note'].linked_public_claim_ids).not.toContain('pc-note-4');
    expect(byPath['report_data.improvements[0]'].linked_public_claim_ids).toEqual(['pc-imp-1']);
    expect(byPath['report_data.strengths[0]'].linked_public_claim_ids).toEqual([]); // ambiguous same-family duplicate text
    await rm(root, { recursive: true, force: true });
  });

  it('non-emission without sources', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({ run_id: 'r2', analysis_run_id: 'r2', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: {}, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(false);
    await expect(access(path.join(root, 'r2', 'takes', 'take-t1', 'analysis-r2', 'traces', 'TechniqueObservationTrace.json'))).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it('gate posture unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitQAManifestForAnalysisRun({ run_id:'take-t3', analysis_run_id:'take-t3', take_id:'t3', submission_id:'s1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids:['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','raw_report','evidence_anchors','public_claim_trace','technique_observation_trace'], artefact_source_classification_by_id:{ technique_observation_trace:'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id:{ technique_observation_trace:false } });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'take-t3', 'manifest.json'), 'utf8'));
    const metrics = buildQAAcceptanceMetrics(manifest);
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    await rm(root, { recursive: true, force: true });
  });
});
