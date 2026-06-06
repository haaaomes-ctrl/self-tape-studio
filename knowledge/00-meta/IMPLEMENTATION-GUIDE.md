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

# Part C — Your daily habit (the five-minute one)

This is the single habit that makes the whole thing pay off: at the end of a working session, capture what mattered.

1. At the end of a session (in Claude Code, or a Claude.ai Project chat with the skills enabled):

> **Say to Claude Code:**
>
> ```text
> Capture this session. Review what we did and propose a small number of well-formed notes for the knowledge vault — decisions, useful research, and open questions — using the tc-vault-note schema. Show them to me to edit and approve before saving. Keep it to a few sharp notes, not everything.
> ```

2. **Read the proposed notes, tweak anything, and approve.** This quick review is your "what did we decide / what's still open" debrief.
3. The approved notes are saved under `knowledge/` and synced to GitHub (Obsidian Git does this, or say "commit the new notes").

Keep the bar high: a few sharp notes beat a transcript dump. If you ever want to keep a full raw chat, tell Claude Code to put it in `knowledge/90-archive/` — that keeps it without cluttering your real notes.

---

# Part D — Build your cockpit (dashboards)

Dashboards turn your notes into at-a-glance views. They use Obsidian's built-in **Bases** feature (no plugin needed). In Obsidian: open the **Command Palette** (Cmd/Ctrl-P) → type "Bases" → **Bases: Create new base**, and make these five (you can ask Claude Code to give you the exact filter settings for each):

- **Status board** — every note grouped by `status` (exploratory / current / superseded / decided).
- **Capture log** — notes by date, newest first; plus a view that surfaces open questions.
- **Handoff board** — work items grouped by status (requested / in progress / done).
- **Research queue** — exploratory research notes, sorted by confidence.
- **Supersession history** — notes that have been replaced, and why.

> **Say to Claude Code (if you'd like the settings spelled out):**
>
> ```text
> Give me the exact field names and filter settings to create each of these five Obsidian Bases from my note schema: status board, capture log, handoff board, research queue, supersession history.
> ```

✓ **You should see:** live tables that update as your notes grow. This is the "review outcomes" half of your job as the operator.

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
