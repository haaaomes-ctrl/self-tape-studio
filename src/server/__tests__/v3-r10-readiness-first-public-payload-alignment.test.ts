import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReadinessFirstReportShell } from '@/components/report/ReadinessFirstReportShell';
import { emitPublicReportPayloadArtifact, emitRenderPayloadArtifact } from '@/server/v3/qa-artifacts-wiring.server';

async function readRenderPayload(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'reports', 'render_payload.json'), 'utf8'));
}

async function readPublicReportPayload(root: string, run: string, take: string) {
  return JSON.parse(await readFile(path.join(root, run, 'takes', `take-${take}`, `analysis-${run}`, 'reports', 'public_report_payload.json'), 'utf8'));
}

async function emitAlignedPayload(root: string, run: string, take: string, raw_report_data: Record<string, unknown>) {
  await emitRenderPayloadArtifact({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    internal_qa_emit: true,
    root_dir: root,
    raw_report_data,
  });
  const renderPayload = await readRenderPayload(root, run, take);
  await emitPublicReportPayloadArtifact({
    run_id: run,
    analysis_run_id: run,
    take_id: take,
    internal_qa_emit: true,
    root_dir: root,
    render_payload: { report_data: renderPayload.report_data },
    raw_report_data,
  });
  return {
    renderPayload,
    publicPayload: await readPublicReportPayload(root, run, take),
  };
}

function shellHtml(report: unknown): string {
  return renderToStaticMarkup(React.createElement(ReadinessFirstReportShell, { report, takeNumber: 1 }));
}

describe('R10.1C readiness-first public payload alignment', () => {
  it('normalises existing allowed fields and removes unsafe nested public payload values', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-1c-public-align-'));
    const { publicPayload } = await emitAlignedPayload(root, 'run-r101c-align', 't1', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: {
          label: 'Retake before submitting',
          reason: 'Audio is usable, but the ending needs a clearer landing.',
          brief_achievement_summary: 'This brief-only field must not render.',
          missing_requirements: ['This missing requirement must not render.'],
        },
        fix_first: { action: 'Land the final thought before cutting.' },
        priority_fixes: [
          { headline: 'Hold the final beat', rationale: 'It currently cuts off the story.' },
          '',
          { headline: 'Acting: 91' },
          { text: 'Keep the eyeline steady' },
          { headline: 'Fourth item should not render' },
        ],
        strengths: {
          items: [
            'The opening intention is clear.',
            'Good job',
            { point: 'The reader relationship is easy to follow.' },
          ],
        },
        next_take_plan: {
          steps: ['Run the ending twice.'],
          groups: [{ steps: ['Record one complete pass without stopping.'] }],
        },
        feedback_reliability: {
          status: 'partial',
          reason: 'Some parts of the assessment may be limited by the available tape evidence.',
          limitations: [
            'Fine facial detail is not fully assessable.',
            'GateTrace failed.',
          ],
        },
      },
    });

    expect(publicPayload.public_report_payload_status).toBe('emitted');
    expect(publicPayload.report_data.schema_version).toBe('tapecoach-v3-report');
    expect(publicPayload.report_data.submission_verdict).toEqual({
      label: 'Retake before submitting',
      reason: 'Audio is usable, but the ending needs a clearer landing.',
    });
    expect(publicPayload.report_data.fix_first).toBe('Land the final thought before cutting.');
    expect(publicPayload.report_data.priority_fixes).toEqual([
      'Hold the final beat',
      'Keep the eyeline steady',
      'Fourth item should not render',
    ]);
    expect(publicPayload.report_data.strengths).toEqual([
      'The opening intention is clear.',
      'The reader relationship is easy to follow.',
    ]);
    expect(publicPayload.report_data.next_take_plan).toEqual({
      steps: ['Run the ending twice.'],
      groups: [{ steps: ['Record one complete pass without stopping.'] }],
    });
    expect(publicPayload.report_data.feedback_reliability).toEqual({
      status: 'partial',
      reason: 'Some parts of the assessment may be limited by the available tape evidence.',
      limitations: ['Fine facial detail is not fully assessable.'],
    });
    expect(JSON.stringify(publicPayload.report_data)).not.toMatch(/brief-only|missing requirement|Acting: 91|Good job|GateTrace/i);

    const html = shellHtml({ report_data: publicPayload.report_data });
    expect(html).toContain('Retake before submitting');
    expect(html).toContain('Land the final thought before cutting.');
    expect(html).toContain('Fine facial detail is not fully assessable.');
    expect(html).not.toContain('Brief achievement');
    expect(html).not.toContain('GateTrace');
  });

  it('uses safe unavailable states for allowed reliability/readiness fields without inventing fixes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-1c-public-unavailable-'));
    const { publicPayload } = await emitAlignedPayload(root, 'run-r101c-unavailable', 't2', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        fix_first: { action: '' },
        priority_fixes: ['', null, { headline: '' }],
        strengths: [],
        next_take_plan: null,
      },
    });

    expect(publicPayload.public_report_payload_status).toBe('emitted');
    expect(publicPayload.report_data.submission_verdict).toEqual({
      status: 'unavailable',
      label: 'Readiness guidance is not available in the current report.',
    });
    expect(publicPayload.report_data.feedback_reliability).toEqual({
      status: 'unavailable',
      reason: 'Feedback reliability is not available in the current report.',
    });
    expect(publicPayload.report_data.fix_first).toBeUndefined();
    expect(publicPayload.report_data.priority_fixes).toBeUndefined();
    expect(publicPayload.report_data.strengths).toBeUndefined();
    expect(publicPayload.report_data.next_take_plan).toBeUndefined();
  });

  it('filters score, authority, comparison, internal IDs, gate names and raw-report-only strings from allowed fields', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-1c-public-safety-'));
    const { publicPayload } = await emitAlignedPayload(root, 'run-r101c-safety', 't3', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: { label: 'Submit after one more clean pass' },
        fix_first: 'GateTrace failed.',
        priority_fixes: [
          'Overall score 91',
          'Use Stanislavski technique terminology',
          'Keep the final button clearer',
          'Signed URL https://example.com/video.mp4',
        ],
        strengths: [
          'Clear public-safe choice.',
          'Evidence anchor take-12345678-1234-1234-1234-123456789abc must not render.',
        ],
        next_take_plan: {
          steps: [
            'Record the full pass.',
            'truth linkage missing',
            'Readiness 92',
          ],
        },
        feedback_reliability: {
          status: 'candidate_technique missing',
          reason: 'The public-safe report has enough observable guidance for this shell.',
          limitations: ['raw_report contains private detail'],
        },
        raw_report_only: 'This must not surface.',
      },
    });

    const serialised = JSON.stringify(publicPayload.report_data);
    expect(publicPayload.report_data.fix_first).toBeUndefined();
    expect(publicPayload.report_data.priority_fixes).toEqual(['Keep the final button clearer']);
    expect(publicPayload.report_data.strengths).toEqual(['Clear public-safe choice.']);
    expect(publicPayload.report_data.next_take_plan).toEqual({ steps: ['Record the full pass.'] });
    expect(publicPayload.report_data.feedback_reliability).toEqual({
      reason: 'The public-safe report has enough observable guidance for this shell.',
    });
    expect(serialised).not.toMatch(/overall score|Stanislavski|Signed URL|https:\/\/example.com|evidence anchor|truth linkage|Readiness 92|candidate_technique|raw_report|private detail|raw_report_only/i);
  });
});
