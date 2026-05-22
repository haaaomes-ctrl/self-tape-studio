import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReadinessFirstReportShell } from '@/components/report/ReadinessFirstReportShell';
import { emitPublicReportPayloadArtifact, emitRenderPayloadArtifact } from '@/server/v3/qa-artifacts-wiring.server';

const READINESS_PUBLIC_FIELDS = [
  'report_data.schema_version',
  'report_data.submission_verdict',
  'report_data.fix_first',
  'report_data.priority_fixes',
  'report_data.strengths',
  'report_data.next_take_plan',
  'report_data.feedback_reliability',
  'report_data.brief_requirements',
];

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

function expectInOrder(html: string, labels: string[]) {
  let previous = -1;
  for (const label of labels) {
    const index = html.indexOf(label);
    expect(index, `${label} should render`).toBeGreaterThan(-1);
    expect(index, `${label} should render after previous label`).toBeGreaterThan(previous);
    previous = index;
  }
}

describe('R10.2A public-safe brief requirements checklist', () => {
  it('adds only report_data.brief_requirements to the readiness public payload allowlist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-2a-allowlist-'));
    const { renderPayload, publicPayload } = await emitAlignedPayload(root, 'run-r102a-allow', 't1', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: 'Worth another clean pass',
        fix_first: 'Land the final thought before cutting.',
        priority_fixes: ['Hold the final beat.'],
        strengths: ['The opening intention is clear.'],
        next_take_plan: { steps: ['Record one complete pass without stopping.'] },
        feedback_reliability: { status: 'partial' },
        brief_requirements: {
          status: 'available',
          summary: 'Brief requirements are shown only where they can be stated safely.',
          items: [{ label: 'Slate requirement', status: 'observed', note: 'Ident is present.' }],
        },
        overall_score: 92,
        technique_authority: { unsafe: true },
        comparison: { winner: 'take-2' },
      },
    });

    expect(renderPayload.allowed_field_paths).toEqual(READINESS_PUBLIC_FIELDS);
    expect(publicPayload.allowed_field_paths).toEqual(READINESS_PUBLIC_FIELDS);
    expect(renderPayload.allowed_field_paths.filter((field: string) => field.includes('brief'))).toEqual([
      'report_data.brief_requirements',
    ]);
    expect(publicPayload.report_data.brief_requirements).toEqual({
      status: 'available',
      summary: 'Brief requirements are shown only where they can be stated safely.',
      items: [{ label: 'Slate requirement', status: 'observed', note: 'Ident is present.' }],
    });
    expect(JSON.stringify(publicPayload.report_data)).not.toMatch(/overall_score|technique_authority|winner|take-2/i);
  });

  it('normalises brief requirement statuses and strips unsafe internals from the public payload shape', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-2a-shape-'));
    const { publicPayload } = await emitAlignedPayload(root, 'run-r102a-shape', 't2', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        brief_requirements: {
          status: 'available',
          summary: 'Brief requirements are shown only where they can be stated safely from the current report.',
          items: [
            { label: 'Slate requirement', status: 'observed', note: 'Ident appears in the take.' },
            { requirement: 'Accent requirement', status: 'missing', note: 'No public-safe support confirms the accent.' },
            { label: 'Framing instruction', status: 'unknown', note: 'Camera detail is not assessable.' },
            { label: 'Scene requirement', status: 'passed', note: 'Use this as a neutral unsupported status.' },
            { label: 'GateTrace missing', status: 'observed', note: 'truth_state:brief_requirement_001' },
          ],
          internal_qa: 'must not render',
        },
      },
    });

    expect(publicPayload.report_data.brief_requirements).toEqual({
      status: 'available',
      summary: 'Brief requirements are shown only where they can be stated safely from the current report.',
      items: [
        { label: 'Slate requirement', status: 'observed', note: 'Ident appears in the take.' },
        { label: 'Accent requirement', status: 'not_observed', note: 'No public-safe support confirms the accent.' },
        { label: 'Framing instruction', status: 'not_assessable', note: 'Camera detail is not assessable.' },
        { label: 'Scene requirement', status: 'not_assessable', note: 'Use this as a neutral unsupported status.' },
      ],
    });
    for (const item of publicPayload.report_data.brief_requirements.items) {
      expect(Object.keys(item).sort()).toEqual(['label', 'note', 'status']);
    }
    expect(JSON.stringify(publicPayload.report_data)).not.toMatch(/GateTrace|truth_state|internal_qa|passed/i);
  });

  it('does not invent brief checklist items when safe source content is missing', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-2a-no-invent-'));
    const { publicPayload: missingPayload } = await emitAlignedPayload(root, 'run-r102a-missing', 't3', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        submission_verdict: 'Worth another clean pass',
      },
    });
    expect(missingPayload.report_data.brief_requirements).toBeUndefined();
    expect(missingPayload.allowed_field_status_by_path['report_data.brief_requirements'].status).toBe('unavailable');

    const { publicPayload: unavailablePayload } = await emitAlignedPayload(root, 'run-r102a-unavailable', 't4', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        brief_requirements: null,
      },
    });
    expect(unavailablePayload.report_data.brief_requirements).toEqual({
      status: 'unavailable',
      summary: 'Brief requirements are not available in the current report.',
      items: [],
    });
  });

  it('renders the checklist after priority fixes and before preserve guidance without unsafe claims', async () => {
    const report = {
      report_data: {
        submission_verdict: 'Retake before submitting',
        fix_first: 'Land the final thought before cutting.',
        priority_fixes: ['Hold the final beat.'],
        brief_requirements: {
          status: 'available',
          summary: 'Brief checks are limited to public-safe requirements.',
          items: [
            { label: 'Slate requirement', status: 'observed', note: 'Ident is present.' },
            { label: 'Accent requirement', status: 'not_assessable', note: 'Not enough public-safe evidence.' },
          ],
        },
        strengths: ['The opening intention is clear.'],
        next_take_plan: { steps: ['Record one complete pass without stopping.'] },
        feedback_reliability: { status: 'partial' },
      },
    };
    const html = shellHtml(report);

    expectInOrder(html, [
      'Readiness',
      'Fix first',
      'Priority fixes',
      'Brief requirements',
      'Keep / preserve',
      'Next take plan',
      'Reliability / limitations',
    ]);
    expect(html).toContain('Slate requirement');
    expect(html).toContain('Observed');
    expect(html).toContain('Accent requirement');
    expect(html).toContain('Not assessable');
    expect(html.toLowerCase()).not.toContain('failed the brief');
    expect(html.toLowerCase()).not.toContain('castable');
  });

  it('keeps score, technique, comparison, casting-market and internal strings out of brief requirements', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'r10-2a-safety-'));
    const { publicPayload } = await emitAlignedPayload(root, 'run-r102a-safety', 't5', {
      report_data: {
        schema_version: 'tapecoach-v3-report',
        brief_requirements: {
          status: 'available',
          summary: 'GateTrace confirms missing evidence.',
          items: [
            { label: 'Readiness score 92', status: 'observed', note: 'score value 92' },
            { label: 'Technique authority: Stanislavski', status: 'observed' },
            { label: 'Comparison winner', status: 'observed' },
            { label: 'Role fit requirement', status: 'observed' },
            { label: 'Storage path requirement', status: 'observed', note: 'storage path qa-artifacts/run/a.json' },
            { label: 'Slate requirement', status: 'observed', note: 'Ident appears in the take.' },
          ],
        },
      },
    });

    expect(publicPayload.report_data.brief_requirements).toEqual({
      status: 'available',
      summary: null,
      items: [{ label: 'Slate requirement', status: 'observed', note: 'Ident appears in the take.' }],
    });
    const serialised = JSON.stringify(publicPayload.report_data);
    expect(serialised).not.toMatch(/score|Stanislavski|comparison winner|role fit|storage path|qa-artifacts|GateTrace/i);
  });
});
