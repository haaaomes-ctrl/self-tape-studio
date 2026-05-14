import { mkdtemp, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitPublicClaimTraceFirstPass, emitScoreTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 score trace first pass', () => {
  it('emits from explicit score fields only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-score-'));
    const run = 'r1';
    const raw = { report_data: { overall_score: 91, overall_score_final: 91, overall_score_model: 90, scores: { vocal: 92, acting: 88 }, detected_components: [{ type: 'song', score: 94, weight: 0.6 }], brief_adherence_breakdown: { technical_compliance: 100, instruction_precision: 95 }, confidence: 95, consistency_modifier: 5 } };
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: raw, internal_qa_emit: true, root_dir: root });
    const out = await emitScoreTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: raw, public_claim_trace_data: { claims: claims.claims ?? [] }, internal_qa_emit: true, root_dir: root });
    expect(out.written).toBe(true);
    expect(out.emitted_artefact_ids).toContain('score_trace');
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', 'take-t1', `analysis-${run}`, 'traces', 'ScoreTrace.json'), 'utf8'));
    expect(payload.score_count).toBeGreaterThan(0);
    expect(out.score_trace_summary.score_count).toBe(payload.score_entries.length);
    expect(out.score_trace_summary.overall_count).toBe(3);
    expect(out.score_trace_summary.discipline_attribute_count).toBe(2);
    expect(out.score_trace_summary.component_score_count).toBe(1);
    expect(out.score_trace_summary.component_weight_count).toBe(1);
    expect(out.score_trace_summary.brief_adherence_subscore_count).toBe(2);
    expect(out.score_trace_summary.assessment_confidence_count).toBe(1);
    expect(out.score_trace_summary.calibration_modifier_count).toBe(1);
    expect(out.score_trace_summary.calibration_metadata_count).toBe(2);
    expect(payload.overall_readiness_public_score_status).toBe('blocked');
    expect(payload.score_entries.some((x:any)=>x.source_path==='report_data.overall_score')).toBe(true);
  });

  it('does not emit from prose numbers only', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-score-'));
    const out = await emitScoreTraceFirstPass({ run_id: 'r2', analysis_run_id: 'r2', submission_id: 's', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: { report_data: { notes: 'try 20% slower at 00:42 and hold for 10 seconds with three clear beats' } }, internal_qa_emit: true, root_dir: root });
    expect(out.written).toBe(false);
    expect(out.emitted_artefact_ids).toEqual([]);
  });
});
