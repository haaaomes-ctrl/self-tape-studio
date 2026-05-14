import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitPublicClaimTraceFirstPass, emitScoreTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 score trace first pass', () => {
  it('emits from explicit score fields only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-score-'));
    const run = 'r1';
    const raw = { report_data: { overall_score: 91, overall_score_final: 91, overall_score_model: 90, scores: { vocal: 92, acting: 88 }, detected_components: [{ type: 'acting_scene', score: 88, weight: 0.4 }, { type: 'song', score: 94, weight: 0.6 }], brief_adherence_breakdown: { technical_compliance: 100, instruction_precision: 95 }, confidence: 95, consistency_modifier: 5 } };
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: raw, internal_qa_emit: true, root_dir: root });
    const out = await emitScoreTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: raw, public_claim_trace_data: { claims: claims.claims ?? [] }, internal_qa_emit: true, root_dir: root });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'ScoreTrace.json'), 'utf8'));
    expect(out.score_trace_summary.score_count).toBe(payload.score_entries.length);
    expect(out.score_trace_summary.component_score_count).toBe(2);
    expect(out.score_trace_summary.component_weight_count).toBe(2);
    expect(out.score_trace_summary.calibration_metadata_count).toBe(2);
    const componentScoreEntry = payload.score_entries.find((x:any)=>x.source_path==='report_data.detected_components[0].score');
    const componentWeightEntry = payload.score_entries.find((x:any)=>x.source_path==='report_data.detected_components[0].weight');
    expect(componentScoreEntry.score_scale).toBe('0-100');
    expect(componentWeightEntry.score_scale).toBe('0-1');
    expect(componentWeightEntry.score_value).toBe(0.4);
    expect(componentWeightEntry.public_display_status).toBe('internal_only');
  });

  it('skips invalid component weights safely', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-score-'));
    const out = await emitScoreTraceFirstPass({ run_id: 'r3', analysis_run_id: 'r3', submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: { report_data: { detected_components: [{ type: 'song', weight: 1.2 }, { type: 'slate', weight: -0.1 }, { type: 'acting_scene', weight: '0.5' }] } }, internal_qa_emit: true, root_dir: root });
    expect(out.written).toBe(true);
    expect(out.score_trace_summary.component_weight_count).toBe(1);
    expect(out.score_trace_summary.skipped_component_weight_out_of_range).toBe(2);
  });

  it('does not emit from prose numbers only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-score-'));
    const out = await emitScoreTraceFirstPass({ run_id: 'r2', analysis_run_id: 'r2', submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: { report_data: { notes: 'try 20% slower at 00:42 and hold for 10 seconds with three clear beats' } }, internal_qa_emit: true, root_dir: root });
    expect(out.written).toBe(false);
  });
});
