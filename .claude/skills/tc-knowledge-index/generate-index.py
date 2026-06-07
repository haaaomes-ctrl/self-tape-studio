#!/usr/bin/env python3
"""tc-knowledge-index — regenerate knowledge/00-meta/INDEX.md.

Deterministic scan per SKILL.md:
  - spine headings from README.md, AGENTS.md, CLAUDE.md,
    tapecoach-v3-roadmap.md, docs/architecture/adr/*, docs/tapecoach/s10-*
  - corpus notes from knowledge/**/*.md (front-matter: id, status,
    spine_anchor, tags, confidence)
  - tolerant case-insensitive substring anchor resolution
Writes EXACTLY ONE file: knowledge/00-meta/INDEX.md. Never touches the spine.

Gap-list scope choice (documented): only `##`-level headings are listed as
documentation gaps — sub-headings inherit their parent's gap and listing
every sub-heading would flood the signal sections in a young corpus.
"""

from __future__ import annotations

import datetime
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "knowledge" / "00-meta" / "INDEX.md"

SPINE_FILES = [
    ("README", ROOT / "README.md"),
    ("AGENTS", ROOT / "AGENTS.md"),
    ("CLAUDE", ROOT / "CLAUDE.md"),
    ("roadmap", ROOT / "tapecoach-v3-roadmap.md"),
]


def collect_headings():
    """[(label_prefix, heading_text, level)] in document order + ADR ids."""
    headings = []
    for prefix, path in SPINE_FILES:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            m = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
            if m:
                headings.append((prefix, m.group(2), len(m.group(1))))
    for s10 in sorted((ROOT / "docs" / "tapecoach").glob("s10-*.md")):
        prefix = s10.stem
        for line in s10.read_text().splitlines():
            m = re.match(r"^(#{1,6})\s+(.*\S)\s*$", line)
            if m:
                headings.append((prefix, m.group(2), len(m.group(1))))
    adr_ids = []
    for adr in sorted((ROOT / "docs" / "architecture" / "adr").glob("*.md")):
        m = re.match(r"^(\d{4})-", adr.name)
        if m:
            adr_ids.append(f"ADR-{m.group(1)}")
    return headings, adr_ids


FM_LIST = re.compile(r"^\[(.*)\]$")


def parse_front_matter(text: str):
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    fm: dict[str, object] = {}
    for line in text[3:end].splitlines():
        m = re.match(r"^([A-Za-z_]+):\s*(.*)$", line)
        if not m:
            continue
        key, raw = m.group(1), m.group(2).split(" #")[0].strip()
        lm = FM_LIST.match(raw)
        if lm:
            items = [i.strip().strip("\"'") for i in lm.group(1).split(",") if i.strip()]
            fm[key] = items
        else:
            fm[key] = raw.strip("\"'")
    return fm


def collect_notes():
    notes = []
    for path in sorted((ROOT / "knowledge").rglob("*.md")):
        fm = parse_front_matter(path.read_text())
        if not fm or fm.get("tier") != "corpus":
            continue
        notes.append(
            {
                "id": fm.get("id", path.stem),
                "status": fm.get("status", "exploratory"),
                "anchors": fm.get("spine_anchor", []) or [],
                "tags": fm.get("tags", []) or [],
                "confidence": fm.get("confidence", "medium"),
            }
        )
    return notes


def resolve(label: str, headings, adr_ids):
    """Return canonical resolved key or None."""
    adr = re.fullmatch(r"ADR-(\d{4})", label.strip())
    if adr:
        return label.strip() if label.strip() in adr_ids else None
    m = re.match(r"^(.*?)\s*§\s*(.*)$", label.strip())
    if not m:
        return None
    file_part, section = m.group(1).strip().upper(), m.group(2).strip().lower()
    for prefix, heading, _level in headings:
        if prefix.upper() in (file_part, file_part.replace(" ", "")):
            if section in heading.lower():
                return f"{prefix} §{heading}"
    return None


def nearest(label: str, headings):
    m = re.match(r"^(.*?)\s*§\s*(.*)$", label.strip())
    if not m:
        return None
    words = [w for w in re.findall(r"\w+", m.group(2).lower()) if len(w) > 3]
    best, best_score = None, 0
    for prefix, heading, _level in headings:
        score = sum(1 for w in words if w in heading.lower())
        if score > best_score:
            best, best_score = f"{prefix} §{heading}", score
    return best


def main():
    headings, adr_ids = collect_headings()
    notes = collect_notes()
    today = datetime.date.today().isoformat()

    anchor_map: dict[str, list] = {}
    unresolved = []
    orphans = []
    for note in notes:
        if not note["anchors"]:
            orphans.append(note)
            continue
        for label in note["anchors"]:
            key = resolve(label, headings, adr_ids)
            if key is None:
                unresolved.append((note, label))
            else:
                anchor_map.setdefault(key, []).append(note)

    status_rank = {"decided": 0, "current": 1, "exploratory": 2, "superseded": 3}
    lines = [
        "# Corpus Index (generated)",
        "",
        f"> Generated by tc-knowledge-index on {today}. Do not hand-edit.",
        "",
        "## Spine anchor → evidence",
        "",
    ]
    for key in sorted(anchor_map):
        lines.append(f"### {key}")
        lines.append("")
        for note in sorted(anchor_map[key], key=lambda n: status_rank.get(str(n["status"]), 9)):
            status = str(note["status"])
            if status in ("decided", "current"):
                lines.append(f"- **{status}** — [[{note['id']}]] ({note['confidence']})")
            elif status == "exploratory":
                lines.append(f"- _exploratory_ — [[{note['id']}]]")
            else:
                lines.append(f"- ~~superseded~~ — [[{note['id']}]]")
        lines.append("")

    live_keys = {
        key
        for key, ns in anchor_map.items()
        if any(n["status"] in ("decided", "current") for n in ns)
    }
    lines += ["## Documentation gaps (controlling facts with no live evidence)", ""]
    gap_count = 0
    for prefix, heading, level in headings:
        if level != 2:
            continue
        key = f"{prefix} §{heading}"
        if key not in live_keys:
            lines.append(f"- {key} — no current/decided note")
            gap_count += 1
    for adr in adr_ids:
        if adr not in live_keys:
            lines.append(f"- {adr} — no current/decided note")
            gap_count += 1
    lines.append("")

    lines += ["## Orphan notes (no spine anchor)", ""]
    if orphans:
        for note in orphans:
            tags = ", ".join(map(str, note["tags"])) or "untagged"
            lines.append(f"- [[{note['id']}]] — {tags}")
    else:
        lines.append("- (none)")
    lines.append("")

    lines += ["## Unresolved anchors (label matches no heading — fix the note)", ""]
    if unresolved:
        for note, label in unresolved:
            hint = nearest(label, headings)
            suffix = f' (nearest: "{hint}")' if hint else ""
            lines.append(f'- [[{note["id"]}]] → "{label}"{suffix}')
    else:
        lines.append("- (none)")
    lines.append("")

    counts = {s: sum(1 for n in notes if n["status"] == s) for s in status_rank}
    lines += [
        "## Counts",
        "",
        f"- Headings scanned: {len(headings)} (+ {len(adr_ids)} ADRs) | "
        f"Notes (current/decided/exploratory/superseded): "
        f"{counts['current']}/{counts['decided']}/{counts['exploratory']}/{counts['superseded']}",
        f"- Gaps (##-level): {gap_count} | Orphans: {len(orphans)} | Unresolved: {len(unresolved)}",
        "",
    ]

    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"headings={len(headings)} adrs={len(adr_ids)} notes={len(notes)}")
    print(f"gaps={gap_count} orphans={len(orphans)} unresolved={len(unresolved)}")
    for note, label in unresolved:
        print(f"UNRESOLVED: {note['id']} -> {label}")


if __name__ == "__main__":
    sys.exit(main())
