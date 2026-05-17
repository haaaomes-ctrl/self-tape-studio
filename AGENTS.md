# TapeCoach Codex Operating Loop

## Controlling Sources

Implementation agents must read and follow these sources in order:

1. `README.md` controls product behaviour, report requirements, scoring rules, QA artefacts, validator gates, public/private boundaries and release decisions.
2. `tapecoach-v3-parallel-delivery-approach.md` controls delivery sequencing only.
3. `tapecoach-v3-roadmap.md` is planning/reference only.
4. `env-vars.md` documents expected QA environment variable names and secret names. Do not print, commit or expose secret values.
5. The specific GitHub issue, Codex prompt and acceptance gates for the current release slice.

If any source conflicts with `README.md`, `README.md` wins. Roadmap or delivery text must not approve public output, production release, public scoring or public technique authority.

## Mandatory Pre-Read

Before changing source, read `docs/tapecoach/v3/engineering-lessons-and-guardrails.md`.

## Codex Execution Rules

- Codex implements release-slice repository changes, runs targeted tests, runs the build and prepares PRs.
- Codex completion is not acceptance.
- Acceptance requires tests, build, QA artefact evidence, manifest/QA metrics evidence where scoped, live validation where scoped and release-gate confirmation.
- Escalate to the operator only for ambiguity, contradictions, protected-area exceptions and release/public-authority decisions.
- Classify the first failing gate before patching.
- Keep changes scoped to the release slice.
- Clean generated artefact churn before commit.

## Protected Areas

The following areas are blocked unless the issue explicitly authorises them and the PR records the exception:

- public output/report rendering changes;
- upload changes;
- Mux changes;
- webhook changes;
- release-state changes that would mark Level 2 accepted;
- release-state changes that would unblock `production_safe`, public scoring or public technique authority.

Default gate posture:

- Level 2 remains `not_accepted`.
- `production_safe` remains `blocked`.
- public scoring remains `blocked`.
- public technique authority remains `blocked`.

## Required Local Gates

Run these before requesting review unless the issue documents a narrower gate:

```sh
npm run test:contracts
npm run build
```

For gatekeeper or protected-area checks, also run:

```sh
npm run gate:release
```
