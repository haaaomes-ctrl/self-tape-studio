# Obsidian Setup & Usage for the TapeCoach Knowledge OS

**Role of Obsidian:** the human lens and dashboard layer over the git-backed corpus, and the integration hub for agents. Not the source of truth (the spine is), not how the AI retrieves (metadata + generated index are).
**Default layout (settled — repo is private):** the corpus is the `knowledge/` subfolder inside the repo, and **Obsidian is opened on `knowledge/`, not the repo root.** This keeps the spine and code physically outside the vault (so the Local REST API can never reach them) while the corpus still version-controls with the code.

---

## 1. Install and wire to the repo

1. Install Obsidian. **Open folder as vault → the repo's `knowledge/` directory.**
2. Add `knowledge/.obsidian/` to the repo `.gitignore`.
3. Install **Obsidian Git**; enable auto-commit + auto-pull on an interval (keeps vault = repo in sync; this is the shared dead-drop that removes manual syncing).
4. Optional, for live AI read/write from Cowork/Desktop: install **Local REST API**, generate and store a key (local, sensitive). Keep it read-primary. Because the vault is `knowledge/`-scoped, any write is confined to the corpus.

> Do not symlink the spine or application code into the vault — that would reopen the live-write hole the `knowledge/`-scoped vault closes.

---

## 2. Core features to use

- **Properties (front-matter):** the `tc-vault-note` schema (`status`, `spine_anchor`, `tags`, `confidence`, lineage, and `type` for handoffs). Everything keys off these.
- **Bases (core plugin, no install — 1.9.10+):** database views over Properties. The human equivalent of the generated `INDEX`/`DELTA`. See §3.
- **Graph + backlinks / Canvas:** human navigation and spatial work only. The AI does not traverse these.
- **Templater / QuickAdd:** enforce the note template at creation (human-side mirror of `tc-vault-note`).

---

## 3. Bases dashboards to create

Backed by note Properties; filter by folder/tag/property; table/cards/list/map. Suggested views (syntax may need adjusting to your version):

- **Status board** — all corpus notes grouped by `status` (exploratory / current / superseded / decided).
- **Capture log** — sorted by `updated` (recent first); a companion view surfacing notes that still have `## Open questions`. This is where the end-of-session capture ritual shows up.
- **Handoff board** — filter `type == "handoff"`, grouped by `status` (requested / in_progress / done); shows the work queued for and completed by Claude Code.
- **Evidence by anchor** — group by `spine_anchor`; mirrors `INDEX.md`.
- **Research queue** — `status == "exploratory"` AND research tag, sorted by `confidence`.
- **Supersession history** — `status == "superseded"`, showing `superseded_by` and `supersession_reason`.

Illustrative `.base` (status board, scoped to the corpus):

```yaml
filters:
  and:
    - 'file.path.startsWith("")' # vault root is already knowledge/
    - 'tier == "corpus"'
views:
  - type: table
    name: Status board
    group_by: status
    order:
      - file.name
      - status
      - confidence
      - updated
```

---

## 4. The end-of-session capture ritual (do this with the agent)

At the end of each session/day: say "capture this session" → `tc-conversation-ingestion` proposes a few sharp notes (decisions, research, open questions, completed handoffs) → review/edit together → approve → committed. Keep the bar high; raw logs go to `90-archive/`. The **Capture log** Base lets you see what landed and what open questions remain.

---

## 5. How each AI surface connects

| Surface                 | Connection                                                         | Notes                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code / Codex     | Native filesystem (reads the whole repo)                           | No MCP needed; the always-loaded `CLAUDE.md` pointer makes it corpus-aware.                                                                                       |
| Cowork / Claude Desktop | Local REST API built-in MCP, or Filesystem MCP at the vault folder | `claude mcp add --transport http obsidian https://127.0.0.1:27124/mcp/ --header "Authorization: Bearer <key>"`. Desktop bridges remote HTTP MCP via `mcp-remote`. |
| Claude.ai Projects      | GitHub connector (read); Tailscale Funnel for live                 | Connector is enough for reading the corpus and handoff results.                                                                                                   |

REST API and its MCP expose the same capabilities. Search: `/search/simple/` (fuzzy), `/search/` (JsonLogic). Self-signed cert — trust it or use the plain-HTTP endpoint locally.

---

## 6. Division of labour and security

**Human layer:** Properties, Bases, graph, Canvas. **AI/automation layer:** raw front-matter, generated `INDEX`/`DELTA`, the skills, handoffs. Same data, two surfaces; keep AI retrieval on metadata/index, not the graph.

**Security:** key is local and never committed; remote access via Tailscale, not public exposure; the repo (and therefore the vault) stays private — it holds product strategy and research.
