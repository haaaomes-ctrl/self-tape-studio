import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitComparisonRuntimeArtifacts } from '@/server/v3/qa-artifacts-wiring';

describe('v3 s8-25 comparison runtime trace wiring', () => {
  it('default disabled writes nothing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    const out = await emitComparisonRuntimeArtifacts({ run_id: 'c1', take_ids: ['t1','t2'], comparison_data: {}, root_dir: root, internal_qa_emit: false });
    expect(out.written).toBe(false);
  });

  it('writes comparison raw and traces when enabled', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    await emitComparisonRuntimeArtifacts({
      run_id: 'c2', internal_qa_emit: true, root_dir: root, fixture_id: 'GF-01 / RT-15 / MT-same-video-20260511', take_ids: ['t1','t2','t3'],
      comparison_data: { recommendation: { label: 'Submit Take 2' }, ranking: ['t2','t1','t3'] }, comparison_id: 'cmp-2',
    });
    const raw = JSON.parse(await readFile(path.join(root, 'c2', 'comparison', 'comparison.raw.json'), 'utf8'));
    expect(raw.comparison_data.recommendation.label).toBe('Submit Take 2');
    const dup = JSON.parse(await readFile(path.join(root, 'c2', 'comparison_traces', 'duplicate_detection_trace.json'), 'utf8'));
    expect(dup.data.duplicate_or_near_duplicate_detected).toBe('unverified_by_system');
    expect(dup.blocker_codes).toContain('automated_duplicate_detection_missing');
  });

  it('evidence delta and suppression traces mark unsafe without decisive evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    await emitComparisonRuntimeArtifacts({ run_id:'c3', internal_qa_emit:true, root_dir:root, take_ids:['t1','t2','t3'], comparison_data:{ recommendation:{label:'Submit Take 2'} } });
    const ev = JSON.parse(await readFile(path.join(root, 'c3', 'comparison_traces', 'evidence_delta_trace.json'), 'utf8'));
    expect(ev.data.decisive_evidence_delta_exists).toBe(false);
    const sup = JSON.parse(await readFile(path.join(root, 'c3', 'comparison_traces', 'comparison_suppression_trace.json'), 'utf8'));
    expect(sup.data.public_recommendation_allowed).toBe(false);
  });

  it('repeatability captures 91/94/91 and same-confidence masking', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-cmp-'));
    await emitComparisonRuntimeArtifacts({ run_id:'c4', internal_qa_emit:true, root_dir:root, take_ids:['t1','t2','t3'], comparison_data:{} });
    const rep = JSON.parse(await readFile(path.join(root, 'c4', 'comparison_traces', 'same_video_repeatability_trace.json'), 'utf8'));
    expect(rep.data.score_values).toEqual([91,94,91]);
    expect(rep.data.same_confidence_masking_detected).toBe(true);
  });
});
