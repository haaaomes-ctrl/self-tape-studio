{\rtf1\ansi\ansicpg1252\cocoartf2869
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\froman\fcharset0 Times-Roman;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs24 \cf0 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec2 # GF-01 / RT-15 \'97 MT Same-Video Repeatability Fixture \'97 20260511\
\
## Fixture identity\
\
fixture_id: GF-01 / RT-15 / MT-same-video-20260511\
\
purpose:\
Same Musical Theatre video submitted three times to the same audition with the same brief, to test repeatability, component stability, comparison safety and false-winner suppression.\
\
video_file_name:\
Self Tape Video 2026-04-27 at 16.50.50.mp4\
\
same_media_confirmation:\
Confirmed by operator. No additional proof required for current fixture registration.\
\
future_automation_requirement:\
System should compute media hash / media_asset_id consistency automatically for repeatability QA.\
\
## Take mapping\
\
take_1:\
  report_pdf: 20260511 Test 1.pdf\
  score: 91\
  mux_playback_id: O00N3Jf00zTRgZSR302Pe4SNdBLdVi00H9AKjHbnKG6Lu500\
  upload_time: <45s\
\
take_2:\
  report_pdf: 20260511 Test 2.pdf\
  score: 94\
  mux_playback_id: LhNQ155VMa6stalf01hTnJpxGTH7Rj013BE4nU8kd7brk\
  upload_time: <45s\
\
take_3:\
  report_pdf: 20260511 Test 3.pdf\
  score: 91\
  mux_playback_id: GxNB7kVz02PIyuE01Ytrv00EW01r89uk2Ld7TLoY3yS3cHs\
  upload_time: <45s\
\
comparison:\
  report_pdf: 20260511 Comparison.pdf\
  recommendation: Take 2\
  displayed_scores: 91 / 94 / 91\
\
## Evidence classification\
\
rendered_report_pdfs:\
  class: rendered_manual_print_report_evidence\
  accepted_use:\
    - visible output QA\
    - wording review\
    - score variance symptom evidence\
    - component split symptom evidence\
  not_accepted_for:\
    - raw report JSON\
    - EvidenceAnchor proof\
    - PublicClaimTrace proof\
    - ScoreTrace proof\
    - validator trace proof\
    - redaction proof\
    - parity proof\
    - export proof\
\
comparison_pdf:\
  class: rendered_manual_print_comparison_evidence\
  accepted_use:\
    - GF-01 / RT-15 failure evidence\
    - score-first comparison symptom evidence\
    - forced-winner symptom evidence\
  not_accepted_for:\
    - comparison JSON\
    - comparison suppression trace\
    - duplicate detection trace\
    - same-video repeatability proof\
    - parity proof\
\
mux_logs:\
  class: video_lifecycle_context\
  accepted_use:\
    - upload and asset lifecycle context\
    - playback ID mapping support\
  not_accepted_for:\
    - report trace proof\
    - comparison trace proof\
    - same-video proof by itself\
\
server_logs_json:\
  class: server_log_context\
  accepted_use:\
    - operational endpoint context\
    - request/error evidence\
  not_accepted_for:\
    - raw report JSON\
    - comparison JSON\
    - EvidenceAnchor\
    - PublicClaimTrace\
    - ModelRunTrace\
\
export_status:\
  operator_statement: export button does not exist\
  accepted_use:\
    - export absence clue\
  not_accepted_for:\
    - accepted no-export proof\
  required_future_proof:\
    - no_export_source_proof.json\
    - no_export_config_proof.json\
    - no_export_UI_proof.json\
    - no_export_log_proof.json\
\
## Current failure classification\
\
classification:\
  - partial_level_2_rendered_artefact_evidence\
  - not accepted_level_2_full_artefact_QA\
  - GF-01_current_failure_confirmed\
  - RT-15_current_failure_confirmed\
  - comparison_score_first_logic_still_present\
  - same_video_forced_winner_still_present\
  - component_split_instability_still_present\
  - same_confidence_masking_still_present\
  - audio_technical_score_instability_present\
  - public_technique_name_risk_present\
  - brief_truth_state_trace_required\
  - raw_JSON_missing\
  - comparison_JSON_missing\
  - EvidenceAnchor_trace_missing\
  - PublicClaimTrace_missing\
  - TechniqueObservation_trace_missing\
  - ScoreTrace_missing\
  - ModelRunTrace_missing\
  - validator_trace_missing\
  - redaction_trace_missing\
  - export_proof_missing\
  - no_export_proof_missing\
  - not_build_ready\
  - not_hidden_beta_ready\
  - not_external_release_ready\
  - not_public_technique_authority_ready\
  - not_production_safe\
\
## Required future artefacts\
\
P0 required:\
  - raw report JSON for each take\
  - comparison JSON\
  - EvidenceAnchors\
  - PublicClaimTrace\
  - TechniqueObservationTrace\
  - ScoreTrace\
  - ModelRunTrace\
  - resolver_output\
  - TruthStateMap\
  - validator_trace\
  - redaction_trace\
  - duplicate_detection_trace\
  - no_material_difference_trace\
  - evidence_delta_trace\
  - comparison_suppression_trace\
  - same_video_repeatability_trace\
  - route_variance_trace\
  - no-export source/config/UI/log proof\
  - parity artefacts}