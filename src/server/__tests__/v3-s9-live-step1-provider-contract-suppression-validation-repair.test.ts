import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildEvidencePassRequestBodyForProvider,
  filterRunEvidencePassForStep1,
  normaliseCompactStep1EvidenceForEvidencePass,
  parseCompactStep1EvidenceContent,
  selectEvidencePassProviderContract,
} from '@/server/evidence-pass.server';
import { emitQAManifestForAnalysisRun } from '@/server/v3/qa-artifacts-wiring.server';

describe('S9-19H live Step 1 provider contract and suppression validation repair', () => {
  it('uses plain JSON observations for the live Gemini/OpenRouter Step 1 provider contract', () => {
    const providerContract = selectEvidencePassProviderContract('google/gemini-3-flash-preview');
    const request = buildEvidencePassRequestBodyForProvider({
      model: 'google/gemini-3-flash-preview',
      contextText: 'Analyse observable Step 1 evidence only.',
      videoUrl: 'https://example.invalid/video.mp4',
      providerContract,
    });

    expect(providerContract).toBe('plain_json_observations');
    expect(request).not.toHaveProperty('tools');
    expect(request).not.toHaveProperty('tool_choice');
    expect(request).not.toHaveProperty('response_format');
    expect(JSON.stringify(request)).toContain('tapecoach_step1_observable_evidence_v1');
  });

  it('parses compact Step 1 JSON into accepted observable families without accepting judgements', () => {
    const compact = parseCompactStep1EvidenceContent(JSON.stringify({
      schema_version: 'tapecoach_step1_observable_evidence_v1',
      observations: [
        { family: 'video_observable', kind: 'framing_visible', summary: 'Head and shoulders framing remains visible.', source_basis: 'observed_video', confidence: 'high' },
        { family: 'audio_observable', kind: 'voice_audible', summary: 'The voice is audible during the spoken section.', source_basis: 'observed_audio', confidence: 'high' },
        { family: 'material_specific', kind: 'song_present', summary: 'A song section is present after the spoken scene.', source_basis: 'observed_audio', confidence: 'medium' },
        { family: 'performance_observable', kind: 'pause_observed', summary: 'A pause occurs before the final phrase.', timestamp_start_sec: 12, source_basis: 'observed_audio', confidence: 'medium' },
        { family: 'candidate_technique', kind: 'internal_descriptor', summary: 'Internal descriptor candidate only: eyeline shifts toward the reader.', source_basis: 'internal_shadow', confidence: 'low' },
        { family: 'performance_observable', kind: 'judgement', summary: 'Ready to submit because the performance is strong.', source_basis: 'observed_video', confidence: 'high' },
      ],
    }));
    const evidence = normaliseCompactStep1EvidenceForEvidencePass(compact);
    const filtered = filterRunEvidencePassForStep1(evidence, { model: 'google/gemini-3-flash-preview', durationSeconds: 90 });

    expect(evidence.step1_provider_contract).toBe('plain_json_observations');
    expect(filtered.video_observable_evidence_items).toHaveLength(1);
    expect(filtered.audio_observable_evidence_items).toHaveLength(1);
    expect(filtered.material_observable_evidence_items).toHaveLength(1);
    expect(filtered.performance_observable_evidence_items).toHaveLength(1);
    expect(filtered.candidate_technique_evidence).toHaveLength(1);
    expect(filtered.candidate_technique_evidence[0]).toMatchObject({
      evidence_modality: 'unknown',
      evidence_kind: 'candidate_technique_internal_descriptor',
    });
    expect(filtered.observable_evidence_items.some((item) => /Ready to submit/.test(item.safe_evidence_summary))).toBe(false);
  });

  it('preserves full report parity summary through final manifest emission for suppression proof metrics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 's9-19h-parity-summary-'));
    const previousSink = process.env.QA_ARTIFACT_SINK;
    process.env.QA_ARTIFACT_SINK = 'file';
    try {
      await emitQAManifestForAnalysisRun({
        run_id: 'run-s9-19h-parity',
        analysis_run_id: 'run-s9-19h-parity',
        take_id: 's9-19h',
        submission_id: 'sub-s9-19h',
        root_dir: root,
        internal_qa_emit: true,
        emitted_artefact_ids: ['raw_report'],
        report_parity_input: {
          raw_report_data: { summary: 'The spoken section is audible.' },
          render_payload: { summary: 'The spoken section is audible.' },
          public_report_payload: { summary: 'The spoken section is audible.' },
          allowed_public_fields: ['summary'],
        },
      });

      const manifest = JSON.parse(await readFile(path.join(root, 'run-s9-19h-parity', 'manifest.json'), 'utf8'));
      expect(manifest.report_parity_summary).toMatchObject({
        parity_status: 'passed',
        forbidden_fields_absent: true,
        blocked_score_fields_absent: true,
        blocked_technique_authority_fields_absent: true,
        public_technique_authority_content_scan_safe: true,
      });
    } finally {
      process.env.QA_ARTIFACT_SINK = previousSink;
    }
  });
});
