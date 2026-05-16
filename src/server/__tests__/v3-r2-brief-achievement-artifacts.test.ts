import { access, mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitBriefAchievementTraces, emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';
import * as qaSinkModule from '@/server/v3/qa-artifact-sink.server';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('R2 brief achievement QA artefacts', () => {
  it('emits BriefRequirementTrace and BriefAchievementTrace when a brief exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-brief-'));
    const emitted = await emitBriefAchievementTraces({
      run_id: 'run-r2',
      analysis_run_id: 'run-r2',
      submission_id: 'sub-r2',
      take_id: 'take-r2',
      source_module: 'test',
      source_stage: 'unit',
      brief_text: 'Please film landscape. Include the song cut.',
      signals: { orientation: 'landscape' },
      raw_report_data: { detected_components: [{ type: 'song' }] },
      root_dir: root,
      internal_qa_emit: true,
    });
    expect(emitted.written).toBe(true);
    expect(emitted.emitted_artefact_ids).toEqual(expect.arrayContaining(['brief_requirement_trace', 'brief_achievement_trace']));
    const reqPath = path.join(root, 'run-r2/takes/take-take-r2/analysis-run-r2/brief/BriefRequirementTrace.json');
    const achPath = path.join(root, 'run-r2/takes/take-take-r2/analysis-run-r2/brief/BriefAchievementTrace.json');
    const requirementTrace = JSON.parse(await readFile(reqPath, 'utf8'));
    const achievementTrace = JSON.parse(await readFile(achPath, 'utf8'));
    expect(requirementTrace.requirements.length).toBeGreaterThan(0);
    expect(requirementTrace.internal_only).toBe(true);
    expect(requirementTrace.public_output_unchanged).toBe(true);
    expect(achievementTrace.summary.overall_brief_achievement).not.toBe('no_brief');
    expect(achievementTrace.internal_only).toBe(true);
    expect(achievementTrace.public_output_unchanged).toBe(true);
  });

  it('updates manifest and metrics without accepting Level 2 or public gates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-manifest-'));
    const trace = await emitBriefAchievementTraces({
      run_id: 'run-r2m', analysis_run_id: 'run-r2m', submission_id: 'sub-r2', take_id: 'take-r2', source_module: 'test', source_stage: 'unit',
      brief_text: 'Please film landscape.', signals: { orientation: 'landscape' }, root_dir: root, internal_qa_emit: true,
    });
    await emitQAManifestForAnalysisRun({
      run_id: 'run-r2m', analysis_run_id: 'run-r2m', submission_id: 'sub-r2', take_id: 'take-r2', root_dir: root, internal_qa_emit: true,
      emitted_artefact_ids: trace.emitted_artefact_ids,
      artefact_source_classification_by_id: { brief_requirement_trace: trace.source_classification, brief_achievement_trace: trace.source_classification },
      artefact_level2_spine_satisfaction_by_id: { brief_requirement_trace: false, brief_achievement_trace: false },
      real_v3_spine_artefact_ids: trace.emitted_artefact_ids,
      brief_requirement_trace_summary: trace.brief_requirement_trace_summary,
      brief_achievement_trace_summary: trace.brief_achievement_trace_summary,
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-r2m/manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-r2m/qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.brief_requirement_trace).toBe('emitted');
    expect(manifest.artefact_status_by_id.brief_achievement_trace).toBe('emitted');
    expect(manifest.missing_artifacts).not.toContain('brief_requirement_trace');
    expect(metrics.brief_requirement_itemisation_gate_status).toBe('passed');
    expect(metrics.brief_achievement_gate_status).toBe('passed_for_supported_requirements');
    expect(metrics.level2_status).toBe('not_accepted');
    expect(metrics.production_safe_status).toBe('blocked');
    expect(metrics.public_scoring_status).toBe('blocked');
    expect(metrics.public_technique_authority_status).toBe('blocked');
  });

  it('marks no-brief R2 artefacts not_applicable without writing trace files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-nobrief-'));
    const trace = await emitBriefAchievementTraces({
      run_id: 'run-r2n', analysis_run_id: 'run-r2n', submission_id: 'sub-r2', take_id: 'take-r2', source_module: 'test', source_stage: 'unit',
      brief_text: null, root_dir: root, internal_qa_emit: true,
    });
    expect(trace.emitted_artefact_ids).toEqual([]);
    expect(trace.not_applicable_artefact_ids).toEqual(['brief_requirement_trace', 'brief_achievement_trace']);
    await expect(access(path.join(root, 'run-r2n/takes/take-take-r2/analysis-run-r2n/brief/BriefRequirementTrace.json'))).rejects.toThrow();
    await emitQAManifestForAnalysisRun({
      run_id: 'run-r2n', analysis_run_id: 'run-r2n', submission_id: 'sub-r2', take_id: 'take-r2', root_dir: root, internal_qa_emit: true,
      emitted_artefact_ids: trace.emitted_artefact_ids,
      not_applicable_artefact_ids: trace.not_applicable_artefact_ids,
      brief_requirement_trace_summary: trace.brief_requirement_trace_summary,
      brief_achievement_trace_summary: trace.brief_achievement_trace_summary,
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-r2n/manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-r2n/qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.brief_requirement_trace).toBe('not_applicable');
    expect(manifest.artefact_status_by_id.brief_achievement_trace).toBe('not_applicable');
    expect(metrics.brief_achievement_gate_status).toBe('not_applicable');
    expect(metrics.level2_status).toBe('not_accepted');
  });

  it('does not mark R2 artefacts emitted when trace writes fail before requirement trace is written', async () => {
    vi.spyOn(qaSinkModule, 'writeQAArtifact').mockResolvedValue({
      written: false,
      sink_mode: 'file',
      sink_write_status: 'failed',
      warning: 'forced_write_failure',
      log_fallback_emitted: false,
    } as Awaited<ReturnType<typeof qaSinkModule.writeQAArtifact>>);
    const trace = await emitBriefAchievementTraces({
      run_id: 'run-r2f', analysis_run_id: 'run-r2f', submission_id: 'sub-r2', take_id: 'take-r2', source_module: 'test', source_stage: 'unit',
      brief_text: 'Please film landscape.', signals: { orientation: 'landscape' }, internal_qa_emit: true,
    });
    expect(trace.written).toBe(false);
    expect(trace.emitted_artefact_ids).toEqual([]);
    expect(trace.not_applicable_artefact_ids).toEqual([]);
  });

  it('keeps R2 artefacts missing in manifest when a brief existed but traces were not emitted', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r2-missing-'));
    await emitQAManifestForAnalysisRun({
      run_id: 'run-r2miss', analysis_run_id: 'run-r2miss', submission_id: 'sub-r2', take_id: 'take-r2', root_dir: root, internal_qa_emit: true,
      emitted_artefact_ids: [],
      brief_requirement_trace_summary: { brief_present: true, requirement_count: 1, unresolved_count: 0 },
      brief_achievement_trace_summary: { brief_present: true, requirement_count: 1, readiness_effect: 'not_assessable', overall_brief_achievement: 'not_assessable' },
    });
    const manifest = JSON.parse(await readFile(path.join(root, 'run-r2miss/manifest.json'), 'utf8'));
    const metrics = JSON.parse(await readFile(path.join(root, 'run-r2miss/qa/acceptance_metrics.json'), 'utf8'));
    expect(manifest.artefact_status_by_id.brief_requirement_trace).toBe('missing');
    expect(manifest.artefact_status_by_id.brief_achievement_trace).toBe('missing');
    expect(metrics.brief_requirement_itemisation_gate_status).toBe('missing');
    expect(metrics.brief_achievement_gate_status).toBe('missing');
    expect(metrics.level2_status).toBe('not_accepted');
  });
});
