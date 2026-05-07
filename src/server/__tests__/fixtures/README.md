# Take processing fixtures

Two suites, both consumed by the future-state regression harness.

## `legacy/` — Legacy preservation fixtures

Real production artefacts (or trimmed, anonymised copies) per branch:

- `mt/` — Musical Theatre
- `acting/` — Acting / monologue
- `dance/` — Dance
- `voice/` — Voice / singing
- `commercial/` — Commercial / self-tape

Each fixture is a JSON file containing the inputs (brief + Step 1 evidence
pass output) and the expected current public `report` JSON. Snapshot tests
pin the existing user-facing output exactly. Any phase that changes legacy
output without an explicit version bump must fail these.

Source artefacts are added incrementally as real outputs become available.
Where real outputs do not yet exist (Dance, Voice, Commercial), staged
fixtures are used and clearly marked with `"source": "staged"` in the JSON.

## `failures/` — Future-state failure fixtures

Synthetic / staged takes that reproduce known current MT failure modes.
Phase 0 only ships the fixtures and asserts current behaviour. Phases 2+
add detection assertions (counters > 0 on the failing fixture, 0 on the
clean control).

Failure modes covered (one fixture per mode, plus a clean control):

1. `01-generic-praise.json` — "strong vocals", "lovely energy", no anchors.
2. `02-acting-through-song-weak.json` — sung performance with no
   lyric-intention anchors.
3. `03-broad-vocal-praise.json` — vocal claims with no timestamped
   technical evidence (breath, support, placement, register events).
4. `04-timestamp-underproduction.json` — MT take 3–5 min long with fewer
   than 5 timestamped notes.
5. `05-role-fit-overclaim.json` — contains "highly castable", "would get
   a recall", "callback-ready", "commercial look", "marketable".
6. `06-presentation-polish-drift.json` — appearance / marketability /
   "commercial look" advice unrelated to performance.
7. `07-frame-break-coaching.json` — close-up brief, advice suggests
   walking, props, instrument hold or otherwise breaking frame.
8. `00-clean-control.json` — well-formed take with no failure mode.

Each fixture file shape:

```jsonc
{
  "id": "01-generic-praise",
  "branch": "mt",
  "source": "synthetic" | "staged" | "real",
  "failure_mode": "generic_praise",
  "brief": { /* extracted brief */ },
  "evidence_pass": { /* Step 1 output */ },
  "current_report": { /* what the live pipeline produces today */ },
  "phase2_expectations": {
    "scrub_counters": { /* counter > 0 on failing fixture */ }
  }
}
```

`phase2_expectations` is informational in Phase 0; the harness does not
assert against it yet.
