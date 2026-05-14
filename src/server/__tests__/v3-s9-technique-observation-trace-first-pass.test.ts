import path from 'node:path';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitTechniqueObservationTraceFirstPass, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('S9 technique observation trace first pass non-array extraction', () => {
  it('emits from category_notes/category_rationale/fix_first/brief/next_take_plan and skips numeric-only', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r1', analysis_run_id: 'r1', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', root_dir: root, internal_qa_emit: true,
      raw_report_data: { report_data: {
        category_notes: { acting: 'The transitions between thoughts are clear.', vocal: 'Strong contemporary legit technique.' },
        category_rationale: { acting: { what_works: 'Specific beats land.', why_not_full_score: 'Breath drops.' }, vocal: { close_gap: 'Support through phrase end.', standout_delta: '' } },
        fix_first: 'Sharpen the final consonants in the song.',
        brief_adherence_breakdown: { note: 'The tape follows framing requirements.', score: 92 },
        next_take_plan: { groups: [{ items: ['Maintain the legit vocal placement on higher notes.'] }] },
        scores: { vocal: 94 },
      }},
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r1', 'takes', 'take-t1', 'analysis-r1', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    const paths = payload.observations.map((o:any)=>o.source_path);
    expect(paths).toEqual(expect.arrayContaining([
      'report_data.category_notes.acting',
      'report_data.category_notes.vocal',
      'report_data.category_rationale.acting.what_works',
      'report_data.category_rationale.acting.why_not_full_score',
      'report_data.category_rationale.vocal.close_gap',
      'report_data.fix_first',
      'report_data.brief_adherence_breakdown.note',
      'report_data.next_take_plan.groups[0].items[0]',
    ]));
    expect(paths).not.toContain('report_data.scores.vocal');
    expect(payload.cannot_satisfy_technique_observation_gate).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it('detected_components object arrays emit text fields only', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r2', analysis_run_id: 'r2', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', root_dir: root, internal_qa_emit: true,
      raw_report_data: { report_data: { detected_components: [{ type: 'song', note: 'Technically secure contemporary legit.', score: 94 }] } },
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r2', 'takes', 'take-t1', 'analysis-r2', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    const texts = payload.observations.map((o:any)=>o.observation_text_safe_summary);
    expect(texts).toContain('Technically secure contemporary legit.');
    expect(texts).not.toContain('94');
    await rm(root, { recursive: true, force: true });
  });

  it('no placeholders: blank/malformed/numeric-only data does not emit', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r3', analysis_run_id: 'r3', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', root_dir: root, internal_qa_emit: true,
      raw_report_data: { report_data: { category_notes: { acting: '  ' }, category_rationale: { acting: { what_works: '' } }, brief_adherence_breakdown: { score: 91 }, scores: { vocal: 90 } } },
    });
    expect(out.written).toBe(false);
    await expect(access(path.join(root, 'r3', 'takes', 'take-t1', 'analysis-r3', 'traces', 'TechniqueObservationTrace.json'))).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it('manifest/metrics gate posture unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitQAManifestForAnalysisRun({ run_id:'take-t3', analysis_run_id:'take-t3', take_id:'t3', submission_id:'s1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids:['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','raw_report','evidence_anchors','public_claim_trace','technique_observation_trace'], artefact_source_classification_by_id:{ technique_observation_trace:'report_snapshot' }, artefact_level2_spine_satisfaction_by_id:{ technique_observation_trace:false }, technique_observation_trace_summary:{legacy_adapter:0,report_snapshot:3,real_runtime_v3:0,input_artifact:0,resolver_truth_state:0} });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'take-t3', 'manifest.json'), 'utf8'));
    const metrics = buildQAAcceptanceMetrics(manifest);
    expect(manifest.artefact_status_by_id.technique_observation_trace).toBe('emitted');
    expect(metrics.technique_observation_trace_status).toBe('emitted');
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    await rm(root, { recursive: true, force: true });
  });
});
