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

  it('keeps report-derived and supplied-brief technique wording non-satisfying for public technique authority', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r7',
      analysis_run_id: 'r7',
      submission_id: 's1',
      take_id: 't1',
      source_module: 'test',
      source_stage: 'unit',
      root_dir: root,
      internal_qa_emit: true,
      raw_report_data: {
        report_data: {
          brief_adherence_breakdown: { note: 'The supplied brief names Meisner repetition as context.' },
          category_notes: { acting: 'Meisner repetition is mentioned in the report snapshot.' },
          scores: { acting: 91 },
        },
      },
      evidence_anchors_data: {
        anchors: [{ evidence_anchor_id: 'ea-real-technique', source_family: 'real_runtime_v3', linked_truth_state_ids: ['r7:truth_state:media_readiness'] }],
      },
      public_claim_trace_data: { claims: [] },
      truth_state_map_data: {
        truth_state_entries: [{ truth_state_entry_id: 'r7:truth_state:media_readiness', key: 'media_readiness', state: 'known' }],
      },
    } as any);
    expect(out.written).toBe(true);
    expect(out.level2_satisfies).toBe(false);
    expect(out.source_family_summary.real_runtime_v3).toBe(0);
    const payload = JSON.parse(await readFile(path.join(root, 'r7', 'takes', 'take-t1', 'analysis-r7', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    expect(payload.cannot_satisfy_technique_observation_gate).toBe(true);
    expect(payload.gate_satisfaction_reason).toBe('legacy_report_snapshot_not_real_runtime_technique_evidence');
    expect(payload.blocker_codes).toContain('TechniqueObservation_legacy_only');
    expect(payload.observations.every((observation: any) => observation.source_artefact_id === 'raw_report')).toBe(true);
    expect(payload.observations.every((observation: any) => observation.observable_basis === 'legacy_report_snapshot')).toBe(true);
    expect(payload.observations.every((observation: any) => observation.public_technique_authority_status === 'blocked')).toBe(true);
    expect(payload.observations.every((observation: any) => observation.linked_truth_state_ids.length === 0)).toBe(true);
    expect(payload.observations.every((observation: any) => observation.cannot_satisfy_v3_gate === true)).toBe(true);
    expect(payload.observations.map((observation: any) => observation.source_path)).not.toContain('report_data.scores.acting');
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

  it('next_take_plan family is recognized and does not cross-link by text-only', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r4', analysis_run_id: 'r4', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', root_dir: root, internal_qa_emit: true,
      raw_report_data: { report_data: { next_take_plan: { groups: [{ items: ['Same instruction'] }] } } },
      public_claim_trace_data: { claims: [
        { claim_id: 'pc-fix', source_path: 'report_data.fix_first', claim_text: 'Same instruction' },
        { claim_id: 'pc-strength', source_path: 'report_data.strengths', claim_text: 'Same instruction' },
        { claim_id: 'pc-next', source_path: 'report_data.next_take_plan.groups[0].items[0]', claim_text: 'Same instruction' },
      ] },
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r4', 'takes', 'take-t1', 'analysis-r4', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    const obs = payload.observations.find((o:any)=>o.source_path==='report_data.next_take_plan.groups[0].items[0]');
    expect(obs).toBeDefined();
    expect(obs.linked_public_claim_ids).toContain('pc-next');
    expect(obs.linked_public_claim_ids).not.toContain('pc-fix');
    expect(obs.linked_public_claim_ids).not.toContain('pc-strength');
    await rm(root, { recursive: true, force: true });
  });
});
