import { describe, expect, it } from 'vitest';
import { buildQAAcceptanceMetrics } from '@/server/v3/qa-artifacts.server';

describe('v3-s9 media observable input family projection truth linkage l2a closure', () => {
  it('keeps media-observable family blockers exact when runtime family arrays are absent', () => {
    const metrics = buildQAAcceptanceMetrics({
      run_id: 'media-family-missing',
      analysis_run_id: 'media-family-missing',
      take_id: 'ta',
      compared_take_ids: ['ta'],
      generated_at: new Date().toISOString(),
      emitted_artifacts: ['step1_observable_evidence'],
      missing_artifacts: [],
      emitted_blocked_artefact_ids: [],
      deferred_artifact_ids: [],
      not_applicable_artifact_ids: [],
      artefact_status_by_id: { step1_observable_evidence: 'emitted' },
      artefact_source_classification_by_id: { step1_observable_evidence: 'real_runtime_v3_partial' },
      artefact_level2_spine_satisfaction_by_id: { step1_observable_evidence: false },
      step1_observable_evidence_summary: {
        step1_media_input_status: 'metadata_only',
        video_observable_evidence_count: 0,
        audio_observable_evidence_count: 0,
        material_specific_performance_evidence_count: 0,
        performance_observable_evidence_count: 0,
        candidate_technique_evidence_count: 0,
        ordinary_analysis_proof_bundle_gate_status: 'insufficient',
        ordinary_analysis_proof_bundle_blocker_codes: [
          'video_observable_requires_media_observable_step1_input',
          'audio_observable_requires_media_observable_step1_input',
          'material_specific_performance_requires_media_observable_step1_input',
          'performance_observable_requires_media_observable_step1_input',
          'candidate_technique_requires_step1_observable_evidence',
        ],
      },
    });

    expect(metrics.ordinary_l2a_analysis_proof_status).not.toBe('satisfied');
    expect(metrics.video_observable_evidence_count).toBe(0);
    expect(metrics.audio_observable_evidence_count).toBe(0);
    expect(metrics.material_specific_performance_evidence_count).toBe(0);
    expect(metrics.performance_observable_evidence_count).toBe(0);
    expect(metrics.candidate_technique_evidence_count).toBe(0);
  });
});
