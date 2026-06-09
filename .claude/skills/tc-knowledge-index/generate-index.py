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
    lines = text[3:end].splitlines()
    i = 0
    while i < len(lines):
        m = re.match(r"^([A-Za-z_]+):\s*(.*)$", lines[i])
        if not m:
            i += 1
            continue
        key, raw = m.group(1), m.group(2).split(" #")[0].strip()
        # A YAML block-sequence array follows an empty-value key with one or
        # more indented `- item` lines (prettier leaves these untouched). Collect
        # the consecutive dash items so the result equals the single-line form.
        if raw == "" and i + 1 < len(lines) and re.match(r"^\s*-\s+", lines[i + 1]):
            items = []
            while i + 1 < len(lines) and re.match(r"^\s*-\s+", lines[i + 1]):
                i += 1
                item = re.sub(r"^\s*-\s+", "", lines[i].split(" #")[0]).strip().strip("\"'")
                if item:
                    items.append(item)
            fm[key] = items
            i += 1
            continue
        # A flow array may open on the line after the key (prettier reflows
        # long arrays that way); pull the opening bracket onto `raw`.
        if raw == "" and i + 1 < len(lines) and lines[i + 1].strip().startswith("["):
            i += 1
            raw = lines[i].split(" #")[0].strip()
        # Accumulate a multi-line flow array until its closing bracket so the
        # joined text parses identically to the single-line form.
        while raw.startswith("[") and "]" not in raw and i + 1 < len(lines):
            i += 1
            raw = f"{raw} {lines[i].split(' #')[0].strip()}"
        lm = FM_LIST.match(raw)
        if lm:
            items = [item.strip().strip("\"'") for item in lm.group(1).split(",") if item.strip()]
            fm[key] = items
        else:
            fm[key] = raw.strip("\"'")
        i += 1
    return fm


WIKILINK = re.compile(r"\[\[([^\]]+)\]\]")


def split_body(text: str) -> str:
    """Return the note body — everything after the closing front-matter `---`.

    Mirrors parse_front_matter's delimiter handling so the body excludes the
    front matter exactly. Notes without front matter return the whole text.
    """
    if not text.startswith("---"):
        return text
    end = text.find("\n---", 3)
    if end == -1:
        return text
    rest = text[end + len("\n---") :]
    # Drop the remainder of the closing-delimiter line (e.g. a trailing newline).
    nl = rest.find("\n")
    return rest[nl + 1 :] if nl != -1 else ""


def parse_links_section(body: str) -> set[str]:
    """Collect `[[note-id]]` targets listed under a `## Links` heading.

    Reads only the wikilinks inside that section (up to the next `##`/`#`
    heading), so the structural guard can tell a declared link from an inline
    mention. Returns the bare target ids (before any `|alias` or `#anchor`).
    """
    links: set[str] = set()
    in_section = False
    for line in body.splitlines():
        if re.match(r"^#{1,6}\s", line):
            in_section = bool(re.match(r"^#{1,6}\s+Links\b", line, re.IGNORECASE))
            continue
        if in_section:
            for target in WIKILINK.findall(line):
                links.add(target.split("|")[0].split("#")[0].strip())
    return links


def collect_notes():
    notes = []
    for path in sorted((ROOT / "knowledge").rglob("*.md")):
        text = path.read_text()
        fm = parse_front_matter(text)
        if not fm or fm.get("tier") != "corpus":
            continue
        body = split_body(text)
        inline = {t.split("|")[0].split("#")[0].strip() for t in WIKILINK.findall(body)}
        notes.append(
            {
                "id": fm.get("id", path.stem),
                "status": fm.get("status", "exploratory"),
                "anchors": fm.get("spine_anchor", []) or [],
                "tags": fm.get("tags", []) or [],
                "confidence": fm.get("confidence", "medium"),
                "body": body,
                "path": str(path.relative_to(ROOT)),
                "links": parse_links_section(body),
                "wikilinks": inline,
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


# --- Half-wiring structural guard ---------------------------------------------
#
# Each note carries two independent retrieval paths (see tc-vault-note "Link
# wiring"): the `spine_anchor` frontmatter array (read here) and body
# `[[note-id]]` wikilinks (read by Obsidian). A note is half-wired when one path
# references something the other does not back up. This guard checks BOTH
# directions on every rebuild and fails loudly so notes stay fully wired.
#
# Deterministic regexes only — no semantic inference:
BODY_ADR = re.compile(r"\bADR-\d{4}\b")
BODY_SPINE = re.compile(r"\b(README|AGENTS|CLAUDE)\s+§\s*([^\n.,;:)]+)")
ANCHOR_ADR = re.compile(r"^ADR-\d{4}$")
ANCHOR_SPINE = re.compile(r"^(README|AGENTS|CLAUDE)\s*§\s*(.+)$", re.IGNORECASE)


class Finding:
    """One half-wiring issue. `kind` is the machine label; `patch` is the
    exact one-line fix/removal hint surfaced in INDEX.md and on stderr."""

    def __init__(self, note_id: str, direction: str, kind: str, detail: str, patch: str):
        self.note_id = note_id
        self.direction = direction  # "A" (body→frontmatter) | "B" (frontmatter→body)
        self.kind = kind
        self.detail = detail
        self.patch = patch

    def line(self) -> str:
        return f"- [[{self.note_id}]] — {self.kind}: {self.detail} → {self.patch}"


def find_half_wiring(notes) -> list[Finding]:
    """Pure detector over the note dicts produced by collect_notes().

    Matching rule for spine clauses is deliberately conservative: a body
    `FILE §section` reference is considered "anchored" when an existing
    `spine_anchor` entry names the same FILE and the two section texts overlap
    as a case-insensitive substring EITHER way. The same overlap rule decides
    whether a `spine_anchor` clause is "supported" by the body. Substring-both-
    ways keeps abbreviations ("Calibration" ⊂ "Calibration doctrine") wired
    while avoiding cross-section false positives.
    """
    findings: list[Finding] = []
    for note in notes:
        nid = note["id"]
        body = note["body"]
        anchors = [str(a) for a in note["anchors"]]
        anchor_adrs = {a for a in anchors if ANCHOR_ADR.match(a)}
        # (file_upper, section_lower) pairs for the spine clauses in frontmatter.
        anchor_clauses = []
        for a in anchors:
            cm = ANCHOR_SPINE.match(a)
            if cm:
                anchor_clauses.append((cm.group(1).upper(), cm.group(2).strip().lower(), a))

        body_adrs = set(BODY_ADR.findall(body))
        body_clauses = [
            (f.upper(), s.strip(), s.strip().lower()) for f, s in BODY_SPINE.findall(body)
        ]

        # --- Direction A: body reference not wired into frontmatter/Links -----
        # A.1 ADR token in body but not in spine_anchor.
        for adr in sorted(body_adrs):
            if adr not in anchor_adrs:
                findings.append(
                    Finding(
                        nid, "A", "missing-anchor",
                        f'body cites {adr}',
                        f'add "{adr}" to spine_anchor of {nid}',
                    )
                )
        # A.2 README/AGENTS/CLAUDE §section in body with no overlapping anchor.
        for file_u, sec_raw, sec_l in body_clauses:
            anchored = any(
                af == file_u and (sec_l in asec or asec in sec_l)
                for af, asec, _ in anchor_clauses
            )
            if not anchored:
                label = f"{file_u} §{sec_raw}"
                findings.append(
                    Finding(
                        nid, "A", "missing-anchor",
                        f'body cites "{label}"',
                        f'add "{label}" to spine_anchor of {nid}',
                    )
                )
        # A.3 inline [[note-id]] in body but absent from the ## Links section.
        # Skip spine-shaped wikilink targets — those are rule-3 violations (A.4).
        for target in sorted(note["wikilinks"]):
            if BODY_ADR.fullmatch(target) or re.match(r"^(README|AGENTS|CLAUDE)\b", target):
                continue
            if target not in note["links"]:
                findings.append(
                    Finding(
                        nid, "A", "missing-link",
                        f'inline [[{target}]] not in ## Links',
                        f'add [[{target}]] to ## Links of {nid}',
                    )
                )
        # A.4 spine-shaped body wikilink (rule-3 violation: dangles in graph).
        for target in sorted(note["wikilinks"]):
            if BODY_ADR.fullmatch(target) or re.match(r"^(README|AGENTS|CLAUDE)\b", target):
                findings.append(
                    Finding(
                        nid, "A", "dangling-spine-wikilink",
                        f'body uses [[{target}]] for the spine',
                        f'convert [[{target}]] to plain text in {nid} and anchor it in spine_anchor',
                    )
                )
        # --- Direction B: frontmatter anchor with no supporting body reference -
        # B.1 ADR in spine_anchor never mentioned in the body.
        for adr in sorted(anchor_adrs):
            if adr not in body_adrs:
                findings.append(
                    Finding(
                        nid, "B", "unsupported-anchor",
                        f'spine_anchor "{adr}" not mentioned in body',
                        f'remove "{adr}" from spine_anchor of {nid} (or cite it in the body)',
                    )
                )
        # B.2 spine clause in spine_anchor with no FILE§ nor section-name in body.
        body_lower = body.lower()
        for af, asec, araw in anchor_clauses:
            file_hit = bool(re.search(rf"\b{af}\s+§", body, re.IGNORECASE))
            section_hit = asec in body_lower
            if not (file_hit or section_hit):
                findings.append(
                    Finding(
                        nid, "B", "unsupported-anchor",
                        f'spine_anchor "{araw}" not supported by body',
                        f'remove "{araw}" from spine_anchor of {nid} (or cite it in the body)',
                    )
                )
    # Dedupe: the same body reference can appear multiple times (e.g. a clause
    # cited in several paragraphs), but one patch line per (note, kind, patch)
    # keeps the report readable. Order is preserved.
    seen: set[tuple[str, str, str]] = set()
    unique: list[Finding] = []
    for f in findings:
        sig = (f.note_id, f.kind, f.patch)
        if sig not in seen:
            seen.add(sig)
            unique.append(f)
    return unique


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

    findings = find_half_wiring(notes)
    dir_a = [f for f in findings if f.direction == "A"]
    dir_b = [f for f in findings if f.direction == "B"]
    lines += [
        "## Half-wiring (structural guard — fix before relying on the graph)",
        "",
        "### Direction A — body reference not wired into frontmatter/Links",
        "",
    ]
    if dir_a:
        lines += [f.line() for f in dir_a]
    else:
        lines.append("- (none)")
    lines += [
        "",
        "### Direction B — frontmatter anchor with no supporting body reference",
        "",
    ]
    if dir_b:
        lines += [f.line() for f in dir_b]
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
        f"- Half-wiring: {len(findings)} (direction A: {len(dir_a)} | direction B: {len(dir_b)})",
        "",
    ]

    OUT.write_text("\n".join(lines))
    print(f"wrote {OUT.relative_to(ROOT)}")
    print(f"headings={len(headings)} adrs={len(adr_ids)} notes={len(notes)}")
    print(f"gaps={gap_count} orphans={len(orphans)} unresolved={len(unresolved)}")
    for note, label in unresolved:
        print(f"UNRESOLVED: {note['id']} -> {label}")

    # Fail loudly: print every finding and exit non-zero so a broken graph can't
    # pass a rebuild silently. INDEX.md has already been written above.
    if findings:
        print(f"HALF-WIRING: {len(findings)} findings "
              f"(direction A: {len(dir_a)} | direction B: {len(dir_b)})", file=sys.stderr)
        for f in findings:
            print(f"HALF-WIRING[{f.direction}/{f.kind}]: {f.note_id} -> {f.patch}",
                  file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
