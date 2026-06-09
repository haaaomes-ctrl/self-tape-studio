#!/usr/bin/env python3
"""Regression test for parse_front_matter: a multi-line YAML flow array
(prettier's reflow style — opening bracket on the line after the key,
quoted entries, trailing comma) must parse identically to the same array
written on a single line, and scalar fields must be unaffected.

Run: python3 .claude/skills/tc-knowledge-index/test_generate_index.py
"""

import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "generate_index", Path(__file__).with_name("generate-index.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

SINGLE = """---
id: note-under-test
tier: corpus
status: current
spine_anchor: ["AGENTS §Core doctrine", "README §Calibration doctrine"]
tags: [alpha, beta]
confidence: high
---

body
"""

MULTI = """---
id: note-under-test
tier: corpus
status: current
spine_anchor:
  [
    "AGENTS §Core doctrine",
    "README §Calibration doctrine",
  ]
tags:
  [
    alpha,
    beta,
  ]
confidence: high
---

body
"""


# Same anchors/tags as SINGLE, written as YAML block sequences (`- item`).
# This is the regression guard for the prior parser bug, which dropped
# block-sequence arrays to ''.
BLOCK = """---
id: note-under-test
tier: corpus
status: current
spine_anchor:
  - "AGENTS §Core doctrine"
  - "README §Calibration doctrine"
tags:
  - alpha
  - beta
confidence: high
---

body
"""


def _note(nid, anchors, body):
    """Build a note dict shaped like collect_notes() output for the detector."""
    return {
        "id": nid,
        "anchors": anchors,
        "body": body,
        "path": f"knowledge/{nid}.md",
        "links": mod.parse_links_section(body),
        "wikilinks": {
            t.split("|")[0].split("#")[0].strip() for t in mod.WIKILINK.findall(body)
        },
    }


def test_parser():
    single = mod.parse_front_matter(SINGLE)
    multi = mod.parse_front_matter(MULTI)
    block = mod.parse_front_matter(BLOCK)
    assert single and multi and block, "front matter failed to parse"
    expected_anchors = ["AGENTS §Core doctrine", "README §Calibration doctrine"]
    assert single["spine_anchor"] == expected_anchors, single["spine_anchor"]
    assert multi["spine_anchor"] == expected_anchors, multi["spine_anchor"]
    assert block["spine_anchor"] == expected_anchors, block["spine_anchor"]
    assert single["tags"] == multi["tags"] == block["tags"] == ["alpha", "beta"], (
        single["tags"], multi["tags"], block["tags"]
    )
    # Scalar fields must be unaffected by any array handling.
    for key in ("id", "tier", "status", "confidence"):
        assert single[key] == multi[key] == block[key], (key, single[key], block[key])
    print("ok: single-line, flow and block-sequence arrays parse identically")


def test_half_wiring():
    kinds = lambda fs: sorted((f.kind, f.note_id) for f in fs)

    # (a) fully-wired note → no findings.
    wired = _note(
        "wired-note",
        ["ADR-0008", "README §Calibration doctrine"],
        "We follow ADR-0008 and README §Calibration doctrine here.\n"
        "Builds on [[sibling-note]].\n\n## Links\n\n- [[sibling-note]]\n",
    )
    assert mod.find_half_wiring([wired]) == [], kinds(mod.find_half_wiring([wired]))

    # (b) body ADR-0008 not in spine_anchor → missing-anchor w/ correct patch.
    n_b = _note("b-note", [], "This relates to ADR-0008.")
    fs = mod.find_half_wiring([n_b])
    assert ("missing-anchor", "b-note") in kinds(fs), kinds(fs)
    patch = next(f.patch for f in fs if f.kind == "missing-anchor")
    assert patch == 'add "ADR-0008" to spine_anchor of b-note', patch

    # (c) spine_anchor ADR with no body mention → unsupported-anchor.
    n_c = _note("c-note", ["ADR-0008"], "Body with no spine references at all.")
    fs = mod.find_half_wiring([n_c])
    assert ("unsupported-anchor", "c-note") in kinds(fs), kinds(fs)

    # (d) inline [[other-note]] not in ## Links → missing-link.
    n_d = _note("d-note", [], "See [[other-note]] for detail.\n\n## Links\n\n")
    fs = mod.find_half_wiring([n_d])
    assert ("missing-link", "d-note") in kinds(fs), kinds(fs)
    patch = next(f.patch for f in fs if f.kind == "missing-link")
    assert patch == "add [[other-note]] to ## Links of d-note", patch

    # (e) [[ADR-0008]] body wikilink → dangling-spine-wikilink (rule-3).
    n_e = _note("e-note", ["ADR-0008"], "Per [[ADR-0008]] we proceed. ADR-0008 governs.")
    fs = mod.find_half_wiring([n_e])
    assert ("dangling-spine-wikilink", "e-note") in kinds(fs), kinds(fs)
    print("ok: find_half_wiring covers both directions")


def main():
    test_parser()
    test_half_wiring()


if __name__ == "__main__":
    sys.exit(main())
