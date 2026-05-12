{\rtf1\ansi\ansicpg1252\cocoartf2869
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 # TapeCoach v3 \'97 Scope, QA Approach and Definition of Done\
\
## 1. Product scope\
\
TapeCoach evaluates whether a self-tape is ready to submit for the performer\'92s selected level, audition type and optional casting brief.\
\
The report must answer:\
1. Is this tape good enough to submit?\
2. If not, what should the performer fix first?\
\
The product judgement should combine UK casting-director, agent and acting / vocal / movement-coach perspectives.\
\
Customer value is the filter for every decision.\
\
## 2. Architecture scope\
\
TapeCoach v3 is a gold-standard system architecture redesign.\
\
The rebuild covers:\
1. System architecture redesign.\
2. Technique library.\
3. User input review.\
4. Analysis pipeline review.\
5. Output and comparison improvements.\
\
The old six fields \'97 technical, audio, vocal, acting, brief_adherence and professional_presentation \'97 are legacy/debug/comparator context only. They are not the v3 scoring brain.\
\
## 3. Environment rule\
\
All testing is production testing.\
\
There is no separate staging, pre-prod or beta environment in scope.\
\
Testing occurs on the live TapeCoach website, with access controlled by product/engineering policy.\
\
The distinction is not environment. The distinction is exposure state:\
- internal QA / dev-team access\
- tester access\
- customer-facing release\
\
## 4. Evidence levels\
\
Level 0 \'97 Planning/documentation:\
Architecture documents, manifests, source maps, defect lists.\
\
Level 1 \'97 Source-only:\
Inspected source files, type contracts, validators, tests.\
\
Level 2 \'97 Specific-run artefact QA:\
Raw report JSON, rendered report, comparison JSON, EvidenceAnchors, PublicClaimTrace, ScoreTrace, ModelRunTrace, validator trace, redaction trace and parity artefacts for a specific run.\
\
Level 3 \'97 Repeatability:\
Repeated-run or model-route variance evidence.\
\
Level 4 \'97 Controlled live-output evidence:\
Live production-domain QA with complete artefact bundles and P0 gates passing.\
\
Source-only evidence cannot prove run output correctness.\
Manual page prints cannot prove raw JSON, traceability, export parity or no-export proof.\
\
## 5. Required QA artefact bundle\
\
Every analysis run intended for QA should produce:\
\
- manifest.json\
- input_record.json\
- resolver_output.json\
- TruthStateMap.json\
- raw_report.json\
- render_payload.json\
- rendered_report artefact\
- EvidenceAnchors.json\
- PublicClaimTrace.json\
- TechniqueObservationTrace.json where relevant\
- ScoreTrace.json\
- ModelRunTrace.json\
- validator_trace.json\
- redaction_trace.json\
- UKEnglishGateResult.json\
- public_private_leakage_result.json\
\
Every comparison run should also produce:\
\
- comparison.raw.json\
- comparison.render_payload.json\
- rendered comparison artefact\
- duplicate_detection_trace.json\
- no_material_difference_trace.json\
- evidence_delta_trace.json\
- comparison_suppression_trace.json\
- same_video_repeatability_trace.json\
- route_variance_trace.json\
\
Export must produce an export manifest and parity proof.\
If export does not exist, no-export proof requires source, config, UI and log evidence.\
\
## 6. Same-video comparison rule\
\
For the same video submitted repeatedly to the same audition with the same brief:\
\
- The system must detect duplicate or near-duplicate input.\
- The system must not force a winner unless there is a decisive evidence delta.\
- Overall score must not be the primary winner-forcing metric.\
- Component split instability must trigger a warning or suppression.\
- Same-confidence masking must be blocked.\
- The expected safe result is no reliable material difference, analysis variance warning, or suppressed recommendation.\
\
GF-01 / RT-15 is the P0 acceptance fixture for this rule.\
\
## 7. Technique public authority rule\
\
Technique names must not appear publicly unless they pass:\
\
1. Source stability.\
2. Self-tape observability.\
3. Fairness and safety.\
4. Repeatability.\
5. Public wording quality.\
6. EvidenceAnchor linkage.\
7. PublicClaimTrace linkage.\
8. Benchmark requirement.\
9. Expert review where required.\
10. Display eligibility.\
\
Until then, technique terms remain:\
- internal_shadow\
- descriptor_only\
- limitation_only\
- blocked\
\
No row may become production_safe without explicit later approval.\
\
## 8. Output and comparison direction\
\
The future report and comparison experience should move away from visible numerical score-first feedback.\
\
User-facing output should prioritise:\
- qualitative readiness language\
- selected-level calibration\
- component-aware evidence\
- first fix\
- next-take plan\
- limitations\
- comparison only where there is a reliable evidence delta\
\
Internal scoring may remain private for calibration, gates and debugging.\
\
## 9. Definition of done for the current stage\
\
Current stage is complete when:\
\
- GF-01 / RT-15 evidence is registered.\
- Current same-video false-winner defect is documented.\
- Evidence folder and fixture manifest exist.\
- Artefact bundle requirements are defined.\
- Source emitters are found or missing-emitter implementation tickets are created.\
- Public named technique display remains blocked.\
- Public scoring remains blocked.\
- production_safe remains blocked.\
- The next implementation work can add automated artefact emitters.\
\
This stage does not require public release.\
This stage does not require public technique authority.\
This stage does not require export implementation.\
\
## 10. Current P0 blockers\
\
- Missing raw report JSON.\
- Missing comparison JSON.\
- Missing EvidenceAnchors.\
- Missing PublicClaimTrace.\
- Missing ScoreTrace.\
- Missing ModelRunTrace.\
- Missing validator trace.\
- Missing redaction trace.\
- Missing TruthStateMap.\
- Missing resolver output.\
- Missing same-video repeatability trace.\
- Missing route variance trace.\
- Missing comparison suppression trace.\
- Missing no-export source/config/UI/log proof.\
- Same-video forced winner.\
- Score-first comparison logic.\
- Same-confidence masking.\
- Component split instability.\
- Public technique-name risk.\
- Brief/truth-state trace gaps.\
\
## 11. Next track\
\
After the QA artefact-emitter path is defined, deep technique-library work resumes.\
\
Technique-library research should be automated where possible:\
- source crawling and classification\
- alias extraction\
- definition extraction\
- observability tagging\
- public wording gating\
- blocked wording mapping\
- benchmark need generation\
\
Human review is used only for high-impact public-facing candidates, access/fairness issues, disputed terminology and maturity advancement.}