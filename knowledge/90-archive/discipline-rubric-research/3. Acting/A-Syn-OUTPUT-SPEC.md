{\rtf1\ansi\ansicpg1252\cocoartf2868
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 You are about to create a HANDOFF DOCUMENT for a new conversation.\
\
Goal:\
Compress all critical context from this conversation into a structured, minimal, high-signal summary that can be pasted into a new chat without loss of continuity.\
\
This handoff must preserve:\
- the completed Musical Theatre branch\
- the completed Dance branch\
- the current TapeCoach baseline constraints\
- the improved rubric-development workflow\
- the lessons learned from MT and Dance\
- the next-step process for the remaining discipline branches\
\
Do not browse.\
Do not do new research.\
Do not reopen MT or Dance.\
Do not rewrite the rubrics.\
Do not create implementation plans unless listed as pending.\
Do not include conversational commentary.\
Do not ask questions.\
Output only the structured handoff.\
\
Writing rules:\
- Be concise but complete.\
- Remove repetition, fluff, and outdated ideas.\
- Prioritise confirmed decisions, stable assets, insights, constraints and next actions.\
- Use clear headings and bullets.\
- Use precise UK English.\
- Do not include raw source tables unless they are critical.\
- Do not include old citation markers as source identifiers.\
- Use stable IDs where relevant:\
  - MT-S###\
  - MT-A##\
  - DANCE-S###\
  - DANCE-SYN-F##\
  - DANCE-AUDIT-I##\
  - DANCE-AUDIT-R##\
  - DANCE-REV-C##\
  - DANCE-REV-S##\
  - DANCE-OS-R##\
  - DANCE-OS-T##\
- Treat this handoff as the single source of truth for the new conversation.\
\
Structure the output EXACTLY as follows:\
\
---\
\
## 1. Objective\
Summarise the overarching product and research goal:\
- build reliable, evidence-backed, discipline-specific rubric improvements for TapeCoach\
- preserve stable product behaviour\
- improve feedback specificity, evidence requirements, fairness and non-regression\
- use MT and Dance as completed process templates for the wider prompt programme\
\
## 2. Current State\
Summarise what exists today:\
- current TapeCoach product baseline\
- shared six-field scoring model\
- current audition types\
- current pipeline\
- MT branch status\
- Dance branch status\
- completed assets/handoffs\
- what has not yet been implemented in product/code\
\
Include the current shared score fields:\
- technical\
- audio\
- vocal\
- acting\
- brief_adherence\
- professional_presentation\
\
Include the current protected workflow:\
- Mux upload/preparation\
- brief extraction\
- Step 1 multimodal evidence pass\
- Step 2 text-only polish pass\
- deterministic post-processing\
- server-side score recomputation\
- caps/verdict logic\
- safety/material/presentation scrubs\
- final persistence\
- UI/report rendering\
\
## 3. Key Decisions Made\
List confirmed decisions only.\
\
Must include:\
- MT research, synthesis, audit, revision, final audit and output-specificity mapping are complete at rubric/baseline level.\
- Dance research, synthesis, audit, revision, final audit and output-specificity mapping are complete at rubric/baseline level.\
- Product/code implementation and live-output QA are not complete.\
- Preserve current six operational score fields.\
- Preserve current type-specific weights unless explicitly authorised.\
- Preserve server-side score recomputation.\
- Preserve two-step evidence/polish pipeline.\
- Preserve locked-field enforcement.\
- Preserve MT acting + song stabilised flow.\
- Treat MT and Dance improvements as wording/evidence/guardrail/report-behaviour improvements, not schema rewrites.\
- Do not import exam-board or competition percentages as TapeCoach weights.\
- Do not turn practitioner taste, marketability, fame, follower count, body/type/appearance or production polish into scoring criteria.\
- Treat access needs and adapted performance contexts as fairness/assessability issues, not talent deficits.\
\
## 4. Core Insights & Learnings\
Capture the strongest findings from MT, Dance and the lessons-learned stage.\
\
Must include:\
- MT is centred on acting-through-song, vocal technique in service of story, movement in service of story, and integration.\
- MT feedback must require lyric/phrase/beat-level evidence.\
- Dance cannot be treated as one generic movement standard.\
- Dance requires style-specific handling for ballet, contemporary/modern, jazz/modern theatre, tap, commercial, street/hip-hop and MT dance.\
- Dance assessability is a precondition: full-body or task-sufficient visibility, stable framing, readable space, audible music where relevant, low-edit continuity and simple capture.\
- Dance-only reports must not show singing/voice wording where singing is absent.\
- Choreography pickup, direction response, adaptability and stamina are mainly live-room/callback evidence unless directly shown.\
- Accessibility-safe assessment requires separating adaptation from attainment and blocking deficit inference.\
- Output specificity is the acceptance standard, not just improved rubric wording.\
- Rubric development now means: score-field semantics + evidence rules + claim-scope rules + display semantics + regression tests.\
\
## 5. Constraints & Non-Negotiables\
List technical, product, safety and design constraints.\
\
Must include:\
- Do not change backend logic without explicit approval.\
- Do not change database/report schema without explicit approval.\
- Do not change public report JSON without explicit approval.\
- Do not change score fields, weights, caps, blockers, verdict thresholds or role-fit bounds without explicit approval.\
- Do not weaken MT stabilised flow.\
- Do not allow Step 2 to invent or alter locked scores, timestamps, verdicts or evidence.\
- Do not persist raw Step 1 evidence publicly.\
- Do not penalise access needs, mobility aids, seated adaptation, reduced range, convalescence, body difference or resource limitations.\
- Do not diagnose vocal, physical, injury or health conditions from tape.\
- Keep feedback grounded in observable evidence.\
- Keep UK terminology.\
\
## 6. Open Problems / Gaps\
List what remains unresolved.\
\
Must include:\
- Product/code implementation not yet executed.\
- Live-output QA not yet run for revised MT or Dance.\
- Frontend label-helper behaviour remains unverified.\
- Comparison-page label behaviour remains unverified.\
- Renderer/export timestamp behaviour remains unverified.\
- Dance structural vocal-proxy risk remains partly architectural.\
- MT through-composed rule set remains unresolved.\
- Dance commercial/street/hip-hop descriptors remain less universal than ballet/contemporary/jazz/tap.\
- Tap evidence remains thinner outside formal frameworks.\
- Score stability and rendered-output tests still need live verification.\
- Next disciplines still require full research and rubric workflow.\
\
## 7. Active Workstreams\
Summarise current and upcoming workstreams.\
\
Must include:\
- Completed: Musical Theatre branch.\
- Completed: Dance branch.\
- Pending: next discipline branch.\
- Pending: prompt/process upgrade for remaining programme.\
- Pending: cross-discipline consistency review after all discipline branches complete.\
- Pending: final revised rubric set for approval.\
- Pending: implementation plan only after approval.\
- Pending: live output QA and product-level non-regression tests.\
\
## 8. Design / Product Principles\
List the principles that should guide future outputs.\
\
Must include:\
- Preserve stable product behaviour first.\
- Improve specificity inside the current structure before proposing structural change.\
- Every report should be grounded in:\
  - this performer\
  - this tape\
  - this material/task\
  - this style/subtype\
  - observable evidence\
- Separate:\
  - performance quality\
  - technical assessability\
  - access/fairness issues\
  - process/workflow issues\
  - live-room-only capacities\
- Generic praise without observable evidence is a failure mode.\
- Source-type boundaries must be preserved.\
- If a criterion is not observable, do not score it.\
- If evidence is weak or context-specific, mark it as limitation or defer.\
- Revision must remain traceable from source to final audit.\
\
## 9. Important Context to Preserve\
Include only critical context needed to avoid quality loss.\
\
Must include:\
- Current TapeCoach baseline and shared schema.\
- Current MT protected anchor.\
- Current Dance revised-baseline status.\
- MT and Dance stable ID systems.\
- The now-standard process:\
  Research \uc0\u8594  Synthesis \u8594  Gap Audit \u8594  Revision \u8594  Final Audit \u8594  Output Specificity / Non-Regression Test Mapping\
- The traceability chain:\
  Source ID \uc0\u8594  evidence finding \u8594  audit recommendation ID \u8594  revision change ID \u8594  final audit check \u8594  output-specificity test\
- Key MT source families and recommendation IDs are already completed and should not be reopened unless explicitly needed.\
- Key Dance source families and output rules are completed and should not be reopened unless explicitly needed.\
- Dance output-specificity rules:\
  - DANCE-OS-R01 to DANCE-OS-R14\
- Dance output test scenarios:\
  - DANCE-OS-T01 to DANCE-OS-T15\
\
## 10. What to Ignore Going Forward\
List outdated or rejected directions.\
\
Must include:\
- Old turn-based citation markers as source identifiers.\
- Any \'93strong enough to proceed\'94 shortcut that skips assigned sources.\
- Any attempt to treat pedagogy, practitioner opinion or competition criteria as direct universal scoring.\
- Any attempt to import exact external percentages or weights.\
- Any attempt to treat follower count, fame, marketability, body/type/appearance or social-media profile as talent evidence.\
- Any broad rewrite that breaks baseline constraints.\
- Any unsupported subtype rules.\
- Any product implementation step before final approval and implementation planning.\
\
## 11. Next Step\
State what the new conversation should focus on immediately.\
\
The next conversation should:\
- confirm the next discipline branch\
- generate the next best prompt for that branch\
- use the improved v2 process\
- start with the correct mode recommendation\
- require baseline reconciliation, field-semantics scan, source-family planning and traceability from the start\
\
If the next branch is Acting, Voice/Singing or Additional Audition Types, prepare the source-census prompt using the v2 process rather than the old draft prompt unchanged.\
\
## 12. Lessons Learned to Apply to the Next Branch\
Include the updated lessons learned from MT and Dance.\
\
Must include:\
\
### A. Required audit readiness checks\
Every audit must confirm:\
- synthesis handoff present\
- rubric slice under audit present\
- baseline / guardrail pack present\
- optional prior or later rubric versions present\
- exact rubric version under audit\
- optional versions are context only\
- audit may proceed\
- input ambiguity\
- source ID alias issues\
- evidence gaps constraining the audit\
- whether any high-priority recommendation depends on weak or unclear evidence\
\
### B. Source alias and counting rule\
If legacy and repaired IDs both appear:\
- create an audit-stage Source ID Alias Map\
- treat matching source names and URLs as one source group\
- prefer repaired global IDs\
- preserve legacy IDs in notes\
- do not double-count aliases\
- state exact / normalised / approximate source counts\
- do not make high-priority claims from unclear provenance\
\
### C. Recommendation traceability rule\
Every audit recommendation must include:\
- stable recommendation ID\
- rubric area\
- current risk\
- specific recommended change\
- observable evidence required\
- subtype/style affected where relevant\
- source basis\
- evidence strength\
- baseline impact: preserve / improve / replace / remove / suppress conditionally / defer\
- priority\
- implementation caution\
\
High-priority recommendations must rely on:\
- at least one high-confidence source, or\
- multiple converging medium-confidence sources\
- no unresolved provenance issue\
\
### D. Baseline compatibility rule\
Every audit must include a Baseline Compatibility Check:\
- baseline constraint affected\
- compatible: yes/no\
- reason\
- required handling\
- priority\
\
If incompatible with backend, schema, pipeline, database, data-flow, scoring fields or fixed weights, mark:\
- defer\
- or preserve baseline \'97 revise only if compatible\
\
### E. Evidence-to-rubric traceability matrix\
Every audit must include:\
- synthesis evidence finding\
- Source ID(s)\
- rubric area affected\
- audit implication\
- recommendation ID(s)\
- confidence\
\
### F. Do-not-change section\
Every audit must include:\
\'93Areas Not to Change Yet Because Evidence Is Insufficient\'94\
\
Use it for:\
- unresolved subtype/style areas\
- unsupported weighting claims\
- discipline details deferred to later research\
- practitioner opinion too subjective for scoring\
- pedagogy/context sources that do not support formal scoring\
- proposed changes that would break baseline constraints\
\
### G. Revision traceability addendum\
Every revision prompt must require:\
- list all audit recommendation IDs\
- classify each as implement / preserve only / suppress conditionally / remove / defer / not implemented because baseline-incompatible\
- do not implement defer items\
- do not implement weak-evidence items\
- do not implement unauthorised schema/backend/weight changes\
- for every implemented change, provide recommendation ID, rubric area, source basis, baseline compatibility and non-regression reason\
- for every non-implemented item, state why and whether it remains a research gap, baseline constraint or final-audit watch item\
\
### H. Final audit / non-regression check\
Every final audit must verify:\
- audit handoff present\
- original rubric slice present\
- revised rubric slice present\
- baseline guardrail pack present\
- exact revised version under audit\
- recommendation implementation matrix\
- non-regression check\
- overreach check\
- generic-feedback check\
- remaining issues\
- final decision\
\
Do not rewrite the rubric during final audit unless explicitly required.\
\
### I. Output-specificity and QA mapping\
Every branch must now end with output-specificity mapping:\
- output-specificity rules\
- adversarial scenario pack\
- preserved non-regression tests\
- display-layer verification checklist\
- residual limitation register\
- live-output QA requirements\
\
### J. Process v2 for next discipline\
Use this sequence:\
Research \uc0\u8594  Synthesis \u8594  Gap Audit \u8594  Revision \u8594  Final Audit \u8594  Output Specificity / Non-Regression Test Mapping\
\
Preserve this chain:\
Source ID \uc0\u8594  evidence finding \u8594  audit recommendation ID \u8594  revision change ID \u8594  final audit check \u8594  output-specificity test\
\
### K. New readiness gates before next discipline\
Before the next discipline begins, confirm:\
- baseline reality gate\
- protected anchor gate\
- field semantics gate\
- source-family gate\
- evidence-anchor gate\
- display verification gate\
- limitation spine gate\
- completion gate\
\
End the handoff after section 12.\
Do not add further sections.}