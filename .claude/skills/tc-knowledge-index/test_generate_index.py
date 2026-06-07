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


def main():
    single = mod.parse_front_matter(SINGLE)
    multi = mod.parse_front_matter(MULTI)
    assert single is not None and multi is not None, "front matter failed to parse"
    expected_anchors = ["AGENTS §Core doctrine", "README §Calibration doctrine"]
    assert single["spine_anchor"] == expected_anchors, single["spine_anchor"]
    assert multi["spine_anchor"] == expected_anchors, multi["spine_anchor"]
    assert single["tags"] == multi["tags"] == ["alpha", "beta"], (single["tags"], multi["tags"])
    # Scalar fields must be unaffected by the multi-line array handling.
    for key in ("id", "tier", "status", "confidence"):
        assert single[key] == multi[key], (key, single[key], multi[key])
    print("ok: single-line and multi-line flow arrays parse identically")


if __name__ == "__main__":
    sys.exit(main())
