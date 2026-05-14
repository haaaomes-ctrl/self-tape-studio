import path from 'node:path';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitTechniqueObservationTraceFirstPass, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('S9 technique observation trace first pass', () => {
  it('emits from legacy fields and stays insufficient', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const run = 'run1'; const take='t1';
    const raw = { report_data: { detected_components:['contemporary legit'], strengths:['grounded'], improvements:['clear diction'], timestamped_notes:[{timestamp:'00:01', note:'grounded beat'}] } };
    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: raw, root_dir: root, internal_qa_emit: true });
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: raw, evidence_anchors_data: { anchors: anchors.anchors ?? [] }, root_dir: root, internal_qa_emit: true });
    expect(claims.written).toBe(true);
    expect(claims.emitted_artefact_ids).toContain('public_claim_trace');
    expect(Array.isArray(claims.claims)).toBe(true);
    expect((claims.claims ?? []).length).toBeGreaterThan(0);
    expect((claims.claims ?? [])[0]).toEqual(expect.objectContaining({ claim_id: expect.any(String), source_path: expect.any(String) }));
    const out = await emitTechniqueObservationTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 's1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: raw, evidence_anchors_data: { anchors: anchors.anchors ?? [] }, public_claim_trace_data: { claims: (claims as any).claims ?? [] }, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    expect(payload.observation_count).toBeGreaterThan(0);
    expect(payload.cannot_satisfy_technique_observation_gate).toBe(true);
    expect(payload.observations.every((x:any)=>['legacy_adapter','report_snapshot'].includes(x.source_family))).toBe(true);
    expect(payload.observations.some((x:any)=>Array.isArray(x.linked_public_claim_ids) && x.linked_public_claim_ids.length > 0)).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it('does not emit without source and no placeholders', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({ run_id: 'r2', analysis_run_id: 'r2', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: {}, root_dir: root, internal_qa_emit: true });
    expect(out.written).toBe(false);
    await expect(access(path.join(root, 'r2', 'takes', 'take-t1', 'analysis-r2', 'traces', 'TechniqueObservationTrace.json'))).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it('manifest+metrics include emitted insufficient technique trace', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitQAManifestForAnalysisRun({ run_id:'take-t3', analysis_run_id:'take-t3', take_id:'t3', submission_id:'s1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids:['analysis_input_record','analysis_submission','analysis_take','resolver_output','truth_state_map','raw_report','evidence_anchors','public_claim_trace','technique_observation_trace'], artefact_source_classification_by_id:{ technique_observation_trace:'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id:{ technique_observation_trace:false } });
    expect(out.written).toBe(true);
    const manifest = JSON.parse(await readFile(path.join(root, 'take-t3', 'manifest.json'), 'utf8'));
    const metrics = buildQAAcceptanceMetrics(manifest);
    expect(metrics.technique_observation_trace_status).toBe('emitted');
    expect(metrics.technique_observation_gate_status).toBe('insufficient');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    await rm(root, { recursive: true, force: true });
  });

  it('does not create false public-claim links on non-match', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const raw = { report_data: { strengths: ['alpha text'], improvements: ['beta text'] } };
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r4', analysis_run_id: 'r4', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit', raw_report_data: raw,
      public_claim_trace_data: { claims: [{ claim_id: 'pc-t1-1', claim_text: 'no matching text', source_path: 'report_data.other[0]' }] }, root_dir: root, internal_qa_emit: true,
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r4', 'takes', 'take-t1', 'analysis-r4', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    expect(payload.observations.every((x:any)=>Array.isArray(x.linked_public_claim_ids) && x.linked_public_claim_ids.length === 0)).toBe(true);
    await rm(root, { recursive: true, force: true });
  });

  it('rejects timestamp-only evidence matching and preserves deterministic link rules', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 's9-tech-'));
    const out = await emitTechniqueObservationTraceFirstPass({
      run_id: 'r5', analysis_run_id: 'r5', submission_id: 's1', take_id: 't1', source_module: 'test', source_stage: 'unit',
      raw_report_data: { report_data: { timestamped_notes: [{ timestamp: '00:42', note: 'observation x' }, { timestamp: '00:42', note: 'match me' }, { timestamp: '00:42', note: 'different row' }] } },
      evidence_anchors_data: {
        anchors: [
          { evidence_anchor_id: 'ea-a', source_path: 'report_data.timestamped_notes[9].note', evidence_text: 'unrelated text', timestamp: '00:42' },
          { evidence_anchor_id: 'ea-b', source_path: 'report_data.timestamped_notes[1].note', evidence_text: 'match me', timestamp: '00:01' },
          { evidence_anchor_id: 'ea-c', source_path: 'report_data.timestamped_notes[2].note', evidence_text: 'different row', timestamp: '00:42' },
        ],
      },
      public_claim_trace_data: {
        claims: [
          { claim_id: 'pc-a', source_path: 'report_data.timestamped_notes[9].note', claim_text: 'unrelated text' },
          { claim_id: 'pc-b', source_path: 'report_data.timestamped_notes[1].note', claim_text: 'match me' },
        ],
      },
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(out.written).toBe(true);
    const payload = JSON.parse(await readFile(path.join(root, 'r5', 'takes', 'take-t1', 'analysis-r5', 'traces', 'TechniqueObservationTrace.json'), 'utf8'));
    const byPath = Object.fromEntries(payload.observations.map((o: any) => [o.source_path, o]));
    expect(byPath['report_data.timestamped_notes[0]'].linked_evidence_anchor_ids).toEqual([]);
    expect(byPath['report_data.timestamped_notes[0]'].linked_public_claim_ids).toEqual([]);
    expect(byPath['report_data.timestamped_notes[1]'].linked_evidence_anchor_ids).toContain('ea-b');
    expect(byPath['report_data.timestamped_notes[1]'].linked_public_claim_ids).toContain('pc-b');
    expect(byPath['report_data.timestamped_notes[2]'].linked_evidence_anchor_ids).toEqual(['ea-c']);
    expect(byPath['report_data.timestamped_notes[2]'].linked_evidence_anchor_ids).not.toContain('ea-a');
    await rm(root, { recursive: true, force: true });
  });
});
