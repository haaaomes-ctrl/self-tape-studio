# S10 Level-Relative Performer Calibration

S10 treats the selected performer level as the assessment standard, not tone.

Runtime values still enter the app as legacy `audition_level` values:

- `learning`
- `amateur`
- `emerging`
- `professional`

The S10 report contract maps those values to the product-level enum:

- `learning_school`
- `amateur_community`
- `emerging_training`
- `professional`

## Runtime Contract

Every scoring or judgement prompt receives a selected-level standard block with:

- selected level label;
- standard applied;
- evidence threshold;
- readiness standard;
- score meaning;
- level-specific AI judgement questions;
- blocker override instruction.

`readiness_score_judgement.selected_level_calibration` is the structured report field for performer-facing level reasoning. It must state:

- `selected_level`;
- `selected_level_label`;
- `standard_applied`;
- `evidence_threshold`;
- `readiness_standard`;
- `score_meaning`;
- `what_meets_level`;
- `what_falls_short`;
- `recommendation_impact`;
- `comparison_to_other_levels`;
- `confidence`.

The route renders this as `Selected-level calibration` and must show `Judged against: [selected performer level]`.

## Same Tape, Different Level

The observed tape evidence does not change when selected level changes.

The report may change:

- readiness interpretation;
- score language;
- recommendation;
- fix hierarchy;
- what counts as polish versus a level gap.

Mandatory brief blockers and assessability blockers override level-based praise at every selected level.
