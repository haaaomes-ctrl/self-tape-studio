# TapeCoach Knowledge OS — Setup Walkthrough (for a first-timer)

**Who this is for:** you, setting this up yourself, without assuming you know git or the command line. If a word is unfamiliar, check the **Glossary** at the end.

**The golden rule of this guide:** you will mostly **tell Claude Code what to do in plain English and approve its work** — you rarely type technical commands yourself. Wherever you see a box like this:

> **Say to Claude Code:**
>
> ```text
> …a prompt to copy and paste…
> ```

…you copy that text into Claude Code and let it do the mechanical work, then read what it did and say yes/no. This is safer for a non-technical operator and matches how the rest of the system works.

**What you'll end up with:** your knowledge stored as plain files inside your repo, viewable and editable in Obsidian; Claude Code aware of that knowledge automatically; a five-minute end-of-day habit that keeps it current; and dashboards that show you the state of everything at a glance.

---

## The mental model — four places, one flow

1. **GitHub** — the cloud home of your project (`self-tape-studio`). The master copy lives here.
2. **The repo on your computer** — a local copy of that project, a normal folder you can see in Finder/Explorer. Your work happens here, then syncs back to GitHub.
3. **Claude Code** — the assistant that reads and changes the repo for you. It does the technical work; you direct and approve.
4. **Obsidian** — your window into the knowledge folder (`knowledge/`): reading notes, dashboards, the graph.

The flow: you direct Claude Code → it changes files on a **branch** (a safe, separate copy of your work) → you approve via a **Pull Request** (a reviewed merge back into the master copy). Nothing reaches the master copy without your approval.

## Your safety net (read this once, then relax)

Everything in this setup is **additive** (it only adds files) and happens on a **branch**. If anything looks wrong, you throw the branch away and you're exactly back where you started — see **Undo / rollback** near the end. You genuinely cannot break your live product by following this guide.

## What you need, and how long it takes

- A **paid Claude plan** (Pro or higher — the free plan doesn't include Claude Code).
- **Claude Code** installed (Part A).
- **Obsidian** installed (free).
- Access to the **`self-tape-studio`** repo on GitHub (you have this).
- The **`tapecoach-knowledge-os.zip`** file (you've downloaded it).
- Roughly **60–90 minutes** for the one-time setup (Parts A–B). The daily habit afterwards is about **five minutes**.

---

# Part A — Get the tools ready

### A1. Confirm your paid Claude plan

Claude Code needs a paid plan. If you're on Pro or Max already, you're set. (Free Claude does not include Claude Code.)

### A2. Install Claude Code (pick the friendliest path)

You have two good options. **For a first-timer, use the Desktop app** — it lets you use Claude Code without ever touching a terminal.

- **Option 1 — Desktop app (recommended, no terminal):** download the Claude desktop app for macOS or Windows from the official site, install it, open it, and sign in with your Claude account. It includes Claude Code with a graphical interface.
- **Option 2 — Native installer (a single command, still no Node.js needed):**
  - macOS/Linux: open the **Terminal** app and paste `curl -fsSL https://claude.ai/install.sh | bash`, then press Enter.
  - Windows: open **PowerShell** and paste `irm https://claude.ai/install.ps1 | iex`, then press Enter.
  - Then type `claude` and press Enter, and sign in with your Claude account when prompted.

> Official, always-current instructions: https://docs.claude.com/en/docs/claude-code/overview — if anything below differs from that page, trust the page.

✓ **You should see:** Claude Code opens and, after sign-in, is ready for a prompt. If something's off, run `claude doctor` (it checks your setup and tells you what's wrong), or just ask the desktop app's help.

> _Note on Node.js:_ the **Desktop app and native installer need no Node.js**. Your **project itself** uses Node to build and test, but you don't have to manage that by hand — when a later step runs the project's checks, Claude Code will tell you if anything (like Node) is missing and walk you through it.

### A3. Install Obsidian

Download Obsidian (free) from obsidian.md and install it. Don't open a vault yet — we point it at the right folder in Step 3.

### A4. Make sure the repo is on your computer

Claude Code works on a local copy of the project. If you already have the `self-tape-studio` folder on your machine, note where it is. If you're not sure, ask Claude Code:

> **Say to Claude Code:**
>
> ```text
> Is the self-tape-studio repository already on this computer? If yes, tell me its folder path. If no, clone it from my GitHub (haaaomes-ctrl/self-tape-studio) into a sensible folder and tell me where you put it.
> ```

✓ **You should see:** a folder path (e.g. `/Users/you/projects/self-tape-studio`). Keep it handy.

### A5. Slack — later

You only need Slack for the optional "level up" part (Part E). Skip it for now.

---

# Part B — The one-time setup

Do these four steps in order. After Step 4 you have a working foundation, and you can stop there for a while before doing Parts C–E.

### Step 1 — Make a safe workspace and add the files

**1a. Put the zip where Claude Code can reach it.** In Finder (macOS) or File Explorer (Windows), drag `tapecoach-knowledge-os.zip` into the **top level of the `self-tape-studio` folder** (the path from A4).

**1b. Let Claude Code do the rest:**

> **Say to Claude Code:**
>
> ```text
> I've put tapecoach-knowledge-os.zip in the top folder of this repo. Please:
> 1. Create and switch to a new branch called chore/knowledge-os-bootstrap.
> 2. Unzip it to a temporary folder.
> 3. Copy the knowledge/ folder and the .claude/ folder from inside it into the repo, WITHOUT overwriting anything I already have.
> 4. Add knowledge/.obsidian/ to .gitignore, and add knowledge/00-meta/INDEX.md and knowledge/00-meta/DELTA-REGISTER.md to .prettierignore.
> 5. Show me the list of exactly what was added and confirm nothing existing was changed.
> Do NOT commit yet — I want to review first.
> ```

✓ **You should see:** a list of new files under `knowledge/` and `.claude/skills/`, and a note that nothing existing was modified.
⚠️ **If it mentions changing or overwriting an existing file:** stop and ask it to explain before continuing.

### Step 2 — Switch on Claude Code's awareness of your knowledge

This is the step that lets you work _in_ Claude Code instead of copy-pasting between tools. It makes two small, reviewed additions to your "spine" (your controlling files) and proves the change is safe.

> **Say to Claude Code:**
>
> ```text
> Now apply the two spine changes from the proposals and prove it's safe:
> 1. Open knowledge/00-meta/proposals/CLAUDE-md-addition.md and add its suggested block to the repo's CLAUDE.md (create CLAUDE.md if it doesn't exist).
> 2. Using knowledge/00-meta/proposals/ADR-knowledge-os.md, create a new ADR in docs/architecture/adr/ with the next number in sequence — tell me the number first.
> 3. Run the project's own checks — type-check, tests, formatting, and build — and report the results. Some tests may have known pre-existing failures; flag anything NEW.
> 4. If the checks pass, stage everything, commit with the message "chore: bootstrap Knowledge OS", push the branch, and give me the link to open a Pull Request.
> Explain anything that looks off before committing.
> ```

✓ **You should see:** the ADR number, a clean-ish check result (only known failures, nothing new), and a **link to open a Pull Request (PR)** on GitHub.

**2b. Approve the PR.** Open that link in your browser. A PR is just a reviewed list of changes. Skim it — it should be mostly new files plus two small additions (to `CLAUDE.md` and a new ADR file). When you're happy, click the green **Merge** button. That folds the changes into your master copy.

⚠️ **If the checks show new failures, or the diff changes code you didn't expect:** don't merge. Ask Claude Code to explain, or pause here — this is a fine moment to get a second opinion.

> This step is the **only** time the setup touches your controlling files, and you applied it through a reviewed PR. The system never edits those files on its own afterwards.

### Step 3 — Open Obsidian on the knowledge folder and turn on sync

**3a. Open the right folder as a vault.** In Obsidian: **Open folder as vault** → navigate into your `self-tape-studio` folder → select the **`knowledge`** folder inside it (⚠️ _not_ the whole repo). Opening only `knowledge/` is what keeps your code and controlling files safely outside Obsidian's reach.

**3b. Keep it in sync with GitHub.** Install the **Obsidian Git** community plugin: Settings (gear icon) → **Community plugins** → **Browse** → search "Obsidian Git" → **Install** → **Enable**. In its settings, turn on auto-commit and auto-pull on an interval (e.g. every 10 minutes). This keeps your vault and the repo matched automatically.

✓ **You should see:** your notes (the `00-meta`, `10-research`, etc. folders) listed in Obsidian's sidebar.

**3c. (Optional, can skip) Live AI reading from the desktop/Cowork apps.** This needs the "Local REST API" plugin and a one-line connection in Claude Code. It's not required — Claude Code already reads the files from the repo. If you want it later, ask Claude Code to walk you through "connecting Obsidian as an MCP server."

### Step 4 — Confirm the five skills are loaded

Skills are the reusable instructions Claude Code follows for knowledge tasks. They came in the zip. Restart Claude Code (close and reopen) so it picks them up, then:

> **Say to Claude Code:**
>
> ```text
> List the skills you can see, and confirm these five are loaded: tc-vault-note, tc-conversation-ingestion, tc-knowledge-index, tc-delta-register, tc-handoff. If any are missing, tell me why.
> ```

✓ **You should see:** all five named.
⚠️ **If one is missing:** ask Claude Code to check that its file is named exactly `SKILL.md` (capital letters matter) in the right folder. For using these inside a Claude.ai Project chat (not Claude Code), go to Settings → Features, enable Skills, and upload the matching `.skill` files.

**🎉 You now have the foundation.** It's completely reasonable to stop here, use it for a week or two, and come back for Parts C–E. The everyday value is in Part C next.

---

# Part C — Your daily habit: capture the session (the five-minute one)

**What this does, and why it's the keystone.** This is the habit that turns the empty filing system into a knowledge base. Every working session throws off decisions, dead-ends you ruled out, research, and open questions — and left in the chat window, they evaporate. Five minutes at the end of a session distils the few things worth keeping into proper notes. Skip it and the vault stays thin (exactly what you noticed when you opened it); do it consistently and the corpus compounds — and the index and dashboards finally have something to work with. It's also your debrief: the review step is where _you_ see "what did we decide today, and what's still open."

**When to run it.** At the end of a working session or day, and after any thread that produced something worth remembering — a decision, a design discussion, a research dig. Skip it after trivial or purely operational chats; there's nothing to keep.

**Where to run it.** In Claude Code, or in a Claude.ai Project chat with the five skills enabled (Settings → Features → Skills). It works on the conversation you've just had, so run it in that same session before you close it.

### Step 1 — Trigger the capture

> **Say to Claude Code:**
>
> ```text
> Capture this session. Review what we did and propose a small number of well-formed notes for the knowledge vault — decisions, useful research, and open questions — using the tc-vault-note schema. Set the discipline field where a note is specific to one (acting / mt / singing / dance / commercial), add a Monday reference if it ties to tracked work, and tag any note that still has unresolved questions `open-question`. Show them to me to edit and approve before saving anything. Keep it to a few sharp notes, not a transcript.
> ```

The `tc-conversation-ingestion` skill reads back over the session, picks the items worth keeping, and drafts each as a complete note — not a stub — following the schema. It proposes first and saves nothing yet.

✓ **You should see:** a short list of proposed notes — usually two to four from a substantive session — each with a title, a status, a discipline tag where relevant, and a written-out body. Anything that should change the README or architecture is flagged as a `decided` note _plus a proposal_, never applied to the spine directly.
⚠️ **If nothing happens or it misreads you:** say "use the tc-conversation-ingestion skill to capture this session."
⚠️ **If it proposes ten notes or a wall of text:** say "be more selective — only the few things genuinely worth keeping, and fold related points into one note." The bar is signal, not coverage.

### Step 2 — Review and approve (your 60-second judgement)

Read the proposals and adjust. You're checking four things:

- **Worth keeping?** Cut anything trivial.
- **One idea per note?** Ask it to split a note that's trying to hold two.
- **Right status?** New thinking is `exploratory`; your settled best understanding is `current`; a ratified decision is `decided` (with a proposal to change the spine); anything it replaces should mark the old note `superseded`.
- **Tagged right?** Discipline set if it's discipline-specific; a Monday reference if it ties to tracked work.

Edit the wording inline, or just tell Code what to change, then approve. This pass is the entire point of "propose, don't auto-save" — it's the bar that keeps the corpus sharp, and it doubles as your end-of-day debrief.

> **Say to Claude Code (optional, recommended):**
>
> ```text
> Before we save, give me a quick on-screen briefing of this session: decisions, open questions, anything handed to Code, and anything completed.
> ```
>
> This briefing is for _you_, on screen — it isn't saved as a note (it only summarises the notes you're about to keep).

### Step 3 — Save and sync

On your approval, the notes are written under `knowledge/` in the right folder (research → `10-research/`, decision context → `20-decisions-context/`, ideas → `40-product-ideas/`, and so on). If Obsidian Git is running (Part B, Step 3b) they sync to GitHub on the next interval; otherwise tell Code "commit the new notes."

✓ **You should see:** the new notes appear in Obsidian's sidebar within a minute or two, and — once you've built them — your **Capture log** and **Status board** dashboards (Part D) update to include them.

### Step 4 — Keep the raw thread, only if it earns it (optional)

If a session was rich enough that you might want the full transcript later, tell Code "archive the raw conversation to `knowledge/90-archive/`." That preserves it losslessly without cluttering your real notes — the same archive-vs-corpus split that governs the backfill. Most sessions don't need it; the distilled notes are usually enough.

---

**The one rule that keeps this valuable:** a few sharp notes beat a transcript dump, every time. The corpus is worth something _because_ it's curated — let captures balloon and retrieval degrades and the dashboards turn to noise. When in doubt, keep less; you can always distil more from the archive later.

**The rhythm.** At about five minutes a session, this compounds quietly — a month of disciplined captures is a genuinely useful knowledge base. It's also the "review outcomes" half of your SRO role: the capture review plus the dashboards are how you stay on top of what the system (and later the agents) produce, without living in the detail.

---

# Part D — Build your cockpit (dashboards)

**What this does and why.** Dashboards turn your notes into at-a-glance views — the "review outcomes" half of your SRO role. They use Obsidian's built-in **Bases** (a core plugin, nothing to install). One expectation to set: your vault is nearly empty right now, so these will look sparse until your captures and the backfill fill them — you're building the instruments before there's much to read, and they come alive as notes accrue. They also key off note **properties**, so the meta-docs like DESIGN/README (which have no `status` field) won't clutter them; only proper schema notes appear.

**First, confirm Bases is on:** Settings → Core plugins → make sure **Bases** is enabled (it's on by default in recent Obsidian).

A note on shape: rather than five separate files, the cleaner approach is **one base with five views** that you switch between — that's how Bases is designed to be used.

## The fast path (recommended): let Code build it

The quickest route is to have Claude Code write the base file for you, configured to your schema; then you just open it and tweak.

> **Say to Claude Code:**
>
> ```text
> Create an Obsidian Base file at knowledge/00-meta/cockpit.base for my corpus, using the tc-vault-note schema (properties include: status, type, discipline, confidence, created, updated, tags, source, superseded_by, supersession_reason, pr, monday_ref). Give it these views, Table layout unless noted:
> 1. Status board — notes where status is not empty; columns title, status, discipline, updated; grouped by status.
> 2. Capture log — notes where status is not empty; columns title, created, updated, status, discipline; sorted by created, newest first.
> 3. Handoffs — notes where type is "handoff"; columns title, status, pr, monday_ref, updated; grouped by status.
> 4. Research queue — notes where status is "exploratory" and tags contains "research"; columns title, confidence, discipline, updated; grouped by confidence.
> 5. Superseded — notes where status is "superseded"; columns title, superseded_by, supersession_reason, updated; sorted by updated, newest first.
> 6. Open questions — notes where tags contains "open-question"; columns title, discipline, status, updated; sorted by updated, newest first.
> Use valid current Bases YAML syntax, and tell me how to open it in Obsidian.
> ```

Then in Obsidian, open `cockpit.base` from the sidebar and switch views from the menu in the **top-left**.

## The manual path (to understand and tweak it)

Worth knowing even if Code built it, so you can adjust filters yourself.

**Create the base:** Command Palette (Cmd/Ctrl-P) → **Bases: Create new base** → name it (e.g. "Cockpit") → save it in the vault (e.g. in `00-meta/`).

**The toolbar** across the top is where everything happens: **View** (create/switch views, pick the layout — Table, Cards, List), **Filter** (which notes show), **Properties** (which columns show), **Sort** (sorts _and_ groups), **Results** (limit/export), **Search**, **New**.

**To build one view:**

1. **Filter** → add a condition as **Property / Operator / Value** (e.g. Property `status`, Operator _is not empty_). "All the following are true" combines conditions with AND.
2. **Properties** → tick the fields you want as columns.
3. **Sort** → choose a property to sort by, or **group by** a property to cluster notes into sections (Obsidian groups by one property at a time).
4. **View → Add view** for the next one; each view keeps its own filter, columns, and sort.

(There's also a `</>` **advanced editor** in the Filter menu if you ever want the raw syntax.)

### The five views, spelled out

- **Status board** — Filter: `status` _is not empty_. Columns: title, status, discipline, updated. **Group by** `status`. → every note clustered into exploratory / current / superseded / decided.
- **Capture log** — Filter: `status` _is not empty_. Columns: title, created, updated, status, discipline. Sort: `created`, new → old. → what you've captured, most recent first.
- **Handoff board** — Filter: `type` _is_ `handoff`. Columns: title, status, pr, monday_ref, updated. **Group by** `status`. → requested / in_progress / done / blocked. (Try the **Cards** layout for a kanban feel.)
- **Research queue** — Filter: `status` _is_ `exploratory` **and** `tags` _contains_ `research`. Columns: title, confidence, discipline, updated. **Group by** `confidence`. → high / medium / low clusters. (Confidence is a text field, so _group_ it rather than sort — sorting high/medium/low alphabetically isn't meaningful.)
- **Supersession history** — Filter: `status` _is_ `superseded`. Columns: title, superseded_by, supersession_reason, updated. Sort: `updated`, new → old. → what was replaced, and why.
- **Open questions** — Filter: `tags` _contains_ `open-question`. Columns: title, discipline, status, updated. Sort: `updated`, new → old. → a live list of unresolved questions across the corpus.

### How the open-questions view stays populated

Bases filters on a note's **properties**, not on body text, so open questions are surfaced via a tag rather than by reading the `## Open questions` heading. The capture skill (`tc-conversation-ingestion`) applies this for you: any note it creates that still has open questions is tagged `open-question`, and the tag is removed once the questions are resolved — so the view is a live to-do, not an ever-growing pile. Two practical notes: add "tag any note with unresolved questions `open-question`" to your Step-1 capture prompt as reinforcement, and for older or hand-written notes you can also run Obsidian's search `line:("## Open questions")` to catch any that predate the tag.

✓ **You should see:** one base with several views you can switch between — sparse now, filling as you capture and backfill. This is your operator cockpit: the review-outcomes half of the job, at a glance.

---

# Part E — Level up when the foundation feels comfortable

These add power but also moving parts. **Don't start here.** Do them one at a time, only once Parts A–D feel routine, and lean on Claude Code to walk you through the exact clicks — some of these are newer features whose menus may have shifted since this was written. Check the official docs (https://docs.claude.com/en/docs/claude-code/overview) for the current steps.

### E1 — The handoff convention (when you do use a separate chat)

If you plan something in a Claude.ai chat and want Claude Code to build it, use a handoff so nothing gets copy-pasted by hand:

> **Say in the chat:** `Hand this to Code` (it writes a work-order note).
> **Say to Claude Code later:** `Pick up the open handoff` (it reads the note, does the work on a branch, writes the result back, and opens a PR).

### E2 — The engineer pair (this is what fully removes you from the middle)

The goal: an **implementer** and a **reviewer** working together inside Claude Code, so you only approve the day's plan and decide the big calls. This uses Claude Code's **Agent Teams**, a newer capability. The simplest way in is to ask Claude Code directly:

> **Say to Claude Code:**
>
> ```text
> I'd like to set up an "engineer pair": one agent that implements changes and a second senior-developer agent that reviews its plan and code against our acceptance criteria and our ADR rule, looping until it approves or escalates to me. Walk me through enabling Agent Teams and configuring these two roles step by step. Set them to escalate to me on uncertainty and to stop after a set number of review rounds rather than looping forever.
> ```

Three independent checks should sit before anything merges: the reviewer agent, GitHub's automated PR review, and you. (At the time of writing, Agent Teams is enabled with an experimental setting in Claude Code; ask Claude Code or the docs for the current toggle.)

### E3 — Slack as your control panel

So you can watch and steer from your phone instead of the terminal: connect Claude Code's Slack integration so plan-approvals, status, and escalations appear in a channel you choose. Agents talk to _each other_ inside Claude Code; **Slack is just for you to monitor and approve.** Ask Claude Code or see the docs for the current connection steps, and keep an eye on usage cost (a team of agents uses noticeably more than a single chat).

### E4 — The bigger pieces (later, and optional)

In order, each only when a real need shows up: the **README atomisation + Business Analyst & Project Manager** (Tranche 2 — defines your requirements and keeps your Monday backlog healthy), then the **index** and **delta register** (which show what's documented and where the product stands vs. intent), then the **Solutions Architect** (Tranche 3) and **Marketing**. See `IMPLEMENTATION-PLAN.md` for the full sequence. Add each only if it clearly saves you effort or improves decisions.

---

# Troubleshooting (common first-timer snags)

- **"command not found: claude"** — Claude Code isn't installed or your terminal needs reopening. Close the terminal, open a new one, try again; or use the Desktop app instead. `claude doctor` diagnoses most issues.
- **The project's checks fail with new errors in Step 2** — don't merge. Ask Claude Code: "explain these failures and whether they're caused by our additions." Markdown notes can't cause code failures, so a new failure points to something pre-existing or an environment gap (e.g. Node not installed) — Claude Code can guide the fix.
- **A skill doesn't show up** — restart Claude Code; confirm the file is exactly `SKILL.md`.
- **Obsidian shows the whole repo, not just notes** — you opened the repo root instead of the `knowledge` folder. Close the vault and re-open on `knowledge/`.
- **You feel out of your depth on a step** — that's expected on the Part E items. It's fine to pause, or to ask Claude Code to explain a step in plain English before you do it.

# Undo / rollback

Everything lives on the `chore/knowledge-os-bootstrap` branch until you merge. To abandon the whole thing before merging:

> **Say to Claude Code:**
>
> ```text
> Switch back to the main branch and delete the chore/knowledge-os-bootstrap branch — I want to discard all of this.
> ```

After that you're exactly as you were. Generated files (the index and delta register) can always be deleted and regenerated.

# Glossary

- **Repo / repository** — your project's folder of files, version-controlled. Lives on GitHub and as a copy on your computer.
- **Branch** — a safe, separate line of work. Changes on a branch don't affect the master copy until merged.
- **Pull Request (PR)** — a reviewed request to merge a branch into the master copy. You approve by clicking Merge.
- **Merge** — folding approved changes into the master copy.
- **Terminal / command line** — the text window where you type commands. The Desktop app lets you avoid it.
- **Spine** — your small set of controlling files (README, ADRs, etc.); the source of truth.
- **Corpus** — your knowledge notes under `knowledge/`; the reasoning and history.
- **Vault** — what Obsidian calls the folder it's showing (here, `knowledge/`).
- **ADR** — Architecture Decision Record; a short file recording an important decision.
- **Skill** — reusable instructions Claude Code follows for a task (you have five).
- **Gate / checks** — the project's automated tests (type-check, tests, formatting, build) that must pass.
- **Tranche** — a stage in which you add a new agent to the team.
- **MCP** — the way Claude connects to an outside tool (like Obsidian or Slack). Optional here.

# Appendix — one-page command runbook (for when you're comfortable)

For a returning or confident user who prefers raw commands, the equivalent of Parts A–B:

```bash
# Step 1 — branch + additive install
git checkout main && git pull
git checkout -b chore/knowledge-os-bootstrap
unzip tapecoach-knowledge-os.zip -d /tmp/kos
cp -r /tmp/kos/tapecoach-knowledge-os/knowledge ./
cp -r /tmp/kos/tapecoach-knowledge-os/.claude ./
grep -qxF 'knowledge/.obsidian/' .gitignore || echo 'knowledge/.obsidian/' >> .gitignore
printf 'knowledge/00-meta/INDEX.md\nknowledge/00-meta/DELTA-REGISTER.md\n' >> .prettierignore
git status   # confirm additive only

# Step 2 — apply the two spine proposals by hand:
#   • paste knowledge/00-meta/proposals/CLAUDE-md-addition.md block into CLAUDE.md
#   • create docs/architecture/adr/NNNN from proposals/ADR-knowledge-os.md (next number)
# then run the repo's own checks (type-check / tests / format / build), then:
git add knowledge .claude .gitignore .prettierignore CLAUDE.md docs/architecture/adr
git commit -m "chore: bootstrap Knowledge OS (corpus, skills, CLAUDE.md pointer, ADR)"
git push -u origin chore/knowledge-os-bootstrap   # open the PR, review, merge
```

Quick reference — what to say to trigger each skill:

- "Hand this to Code" / "Pick up the open handoff" → `tc-handoff`
- "Capture this session" → `tc-conversation-ingestion`
- "Write/update a knowledge note" → `tc-vault-note`
- "Rebuild the index / what's undocumented" → `tc-knowledge-index`
- "Where are we vs target / check for drift" → `tc-delta-register`
