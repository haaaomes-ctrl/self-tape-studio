import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { emitEvidenceAnchorsFirstPass, emitPublicClaimTraceFirstPass, emitQAManifestForAnalysisRun, emitRawReportArtefact, emitScoreTraceFirstPass } from '@/server/v3/qa-artifacts-wiring.server';

describe('v3 s9 live flow trace wiring', () => {
  it('A/D/F: combined flow emits traces and manifest/metrics agree while gate posture stays blocked', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-live-wire-'));
    const run = 'take-t1';
    const take = 't1';
    const wrapped = { report_data: { schema_version: 'v1-legacy', timestamped_notes: [null, { timestamp: '00:07', note: 'eye-line drifts right before line' }, 'bad row', { timestamp: '00:19', text: 'breath support drops on phrase end' }], strengths: ['grounded choices'], improvements: ['cleaner diction'], priority_fixes: ['reduce plosives'], category_notes: ['good momentum'], category_rationale: ['needs clearer objective turn'], verdict_final: 'ready soon', submission_verdict: { label: 'close', reason: 'delivery uneven' }, overall_score: 77, scores: { acting: 80 } } };
    await emitRawReportArtefact({ run_id: run, take_id: take, submission_id: 'sub1', source_stage: 'unit', source_module: 'test', report_data: wrapped.report_data, root_dir: root, internal_qa_emit: true });
    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'process-take.server', source_stage: 'process_take_success', raw_report_data: wrapped, root_dir: root, internal_qa_emit: true });
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'test', source_stage: 'unit', raw_report_data: wrapped, evidence_anchors_data: { anchors: anchors.anchors ?? [] }, root_dir: root, internal_qa_emit: true });
    const scoreTrace = await emitScoreTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: take, source_module: 'process-take.server', source_stage: 'process_take_success', raw_report_data: wrapped, public_claim_trace_data: { claims: claims.claims ?? [] }, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: take, submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report', ...(anchors.written ? ['evidence_anchors'] : []), ...(claims.written ? ['public_claim_trace'] : []), ...(scoreTrace.written ? ['score_trace'] : [])], artefact_source_classification_by_id: { raw_report: 'legacy_adapter', evidence_anchors: 'legacy_adapter', public_claim_trace: 'legacy_adapter', ...(scoreTrace.written ? { score_trace: 'legacy_adapter' } : {}) }, artefact_level2_spine_satisfaction_by_id: { raw_report: false, evidence_anchors: false, public_claim_trace: false, ...(scoreTrace.written ? { score_trace: false } : {}) }, legacy_adapter_artefact_ids: ['raw_report', 'evidence_anchors', 'public_claim_trace', ...(scoreTrace.written ? ['score_trace'] : [])], public_claim_trace_summary: claims.summary, score_trace_summary: scoreTrace.written ? scoreTrace.score_trace_summary : undefined });
    const anchorsTrace = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'EvidenceAnchors.json'), 'utf8'));
    const claimsTrace = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'PublicClaimTrace.json'), 'utf8'));
    const scorePayload = JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'traces', 'ScoreTrace.json'), 'utf8'));
    expect(scorePayload.source_module).toBe('process-take.server');
    expect(scorePayload.source_stage).toBe('process_take_success');
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa/acceptance_metrics.json'), 'utf8'));

    expect(anchors.written).toBe(true);
    expect(claims.written).toBe(true);
    expect(scoreTrace.written).toBe(true);
    expect(anchorsTrace.anchors.map((a: any) => a.source_path)).toEqual(expect.arrayContaining(['report_data.timestamped_notes[1].note', 'report_data.timestamped_notes[3].text']));
    expect(claimsTrace.claims.filter((c: any) => ['eye-line drifts right before line', 'breath support drops on phrase end'].includes(c.claim_text)).map((c: any) => c.source_path)).toEqual(expect.arrayContaining(['report_data.timestamped_notes[1].note', 'report_data.timestamped_notes[3].text']));
    expect(scorePayload.score_count).toBeGreaterThan(0);
    expect(manifest.emitted_artifacts).toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace', 'score_trace']));
    expect(manifest.missing_artifacts).not.toEqual(expect.arrayContaining(['evidence_anchors', 'public_claim_trace', 'score_trace']));
    expect(metrics.required_artefact_counts.emitted).toBe(manifest.emitted_artifacts.length);
    expect(metrics.missing_required_artefacts).toEqual(manifest.missing_artifacts);
    expect(metrics.evidence_anchor_trace_status).toBe(manifest.artefact_status_by_id.evidence_anchors);
    expect(metrics.public_claim_trace_status).toBe(manifest.artefact_status_by_id.public_claim_trace);
    expect(metrics.score_trace_status).toBe('emitted');
    expect(manifest.score_trace_summary.score_count).toBeGreaterThan(0);
    expect(metrics.score_trace_overall_count).toBe(manifest.score_trace_summary.overall_count);
    expect(metrics.score_trace_gate_status).toBe('insufficient');
    expect(manifest.blocker_codes).not.toContain('ScoreTrace_missing');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
    expect(metrics.gf01_rt15_status).toBe('blocked');
  });

  it('B: does not predeclare traces when no source data exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-live-wire-none-'));
    const run = 'take-t2';
    const wrapped = { report_data: { schema_version: 'v1-legacy' } };
    const anchors = await emitEvidenceAnchorsFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: 't2', source_module: 'test', source_stage: 'unit', raw_report_data: wrapped, root_dir: root, internal_qa_emit: true });
    const claims = await emitPublicClaimTraceFirstPass({ run_id: run, analysis_run_id: run, submission_id: 'sub1', take_id: 't2', source_module: 'test', source_stage: 'unit', raw_report_data: wrapped, evidence_anchors_data: null, root_dir: root, internal_qa_emit: true });
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 't2', submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false }, legacy_adapter_artefact_ids: ['raw_report'] });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    expect(anchors.written).toBe(false);
    expect(claims.written).toBe(false);
    expect(manifest.emitted_artifacts).not.toContain('evidence_anchors');
    expect(manifest.emitted_artifacts).not.toContain('public_claim_trace');
  });

  it('C/E: propagates raw_report legacy classification and truthful source scope metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'qa-live-wire-meta-'));
    const run = 'take-t3';
    await emitQAManifestForAnalysisRun({ run_id: run, analysis_run_id: run, take_id: 't3', submission_id: 'sub1', root_dir: root, internal_qa_emit: true, emitted_artefact_ids: ['raw_report'], artefact_source_classification_by_id: { raw_report: 'legacy_adapter' }, artefact_level2_spine_satisfaction_by_id: { raw_report: false }, legacy_adapter_artefact_ids: ['raw_report'] });
    const manifest = JSON.parse(await readFile(path.join(root, run, 'manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, run, 'qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_source_classification_by_id.raw_report).toBe('legacy_adapter');
    expect(manifest.artefact_level2_spine_satisfaction_by_id.raw_report).toBe(false);
    expect(manifest.legacy_adapter_artefact_ids).toContain('raw_report');
    expect(metrics.legacy_adapter_artefacts).toContain('raw_report');
    expect(metrics.real_v3_spine_artefacts).not.toContain('raw_report');
    expect(['README.md', 'docs/tapecoach/v3/PROJECT_SCOPE_AND_QA_APPROACH.md']).toContain(manifest.source_scope_file);
    expect(manifest.controlling_source_file).toBe(manifest.source_scope_file);
    if (manifest.source_scope_file === 'README.md') expect(manifest.controlling_requirements_status).toBe('root_readme_present');
    else expect(manifest.controlling_requirements_status).toBe('operator_supplied_replacement_README');
  });
});
