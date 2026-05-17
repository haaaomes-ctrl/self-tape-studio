# TapeCoach v3 PR

## Source Hierarchy

- [ ] I read `README.md`; it controls product behaviour, QA artefacts, public/private boundaries and release decisions.
- [ ] I used `tapecoach-v3-parallel-delivery-approach.md` for sequencing only.
- [ ] I did not use roadmap/planning material to override `README.md`.
- [ ] I read `docs/tapecoach/v3/engineering-lessons-and-guardrails.md`.

## Scope

Describe the release slice and files changed.

## Protected Boundaries

- [ ] No public output/report rendering changes.
- [ ] No upload changes.
- [ ] No Mux changes.
- [ ] No webhook changes.
- [ ] Level 2 remains `not_accepted`.
- [ ] `production_safe` remains `blocked`.
- [ ] public scoring remains `blocked`.
- [ ] public technique authority remains `blocked`.

If any box is unchecked, link the protected-area exception issue and operator approval.

## Gates

- [ ] `npm run test:contracts`
- [ ] `npm run build`
- [ ] QA artefact/storage validation evidence attached or marked not scoped.
- [ ] Live locked-down website QA attached or marked not scoped.

## Notes

Do not include secret values in this PR.
