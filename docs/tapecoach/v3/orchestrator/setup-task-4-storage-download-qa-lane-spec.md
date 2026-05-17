# Setup Task 4 Spec — Local Storage-download QA Lane

Admin URL: `https://tapecoach.co.uk/admin/storage-downloads`

Local path: `/Users/bethwillars/Documents/AI/Apps/Tape Coach/Agent`

Env var: `TAPECOACH_AGENT_DOWNLOAD_DIR="/Users/bethwillars/Documents/AI/Apps/Tape Coach/Agent"`

Runner labels: `self-hosted`, `macOS`, `tapecoach-agent`, `storage-download`.

## Controls
- Downloaded artefacts must not be committed.
- Private runtime artefacts must not be uploaded to GitHub by default.
- Admin credentials must never be printed.
- Only review summaries may be uploaded/exposed unless explicitly approved.

## Failure handling
Authentication/path/env/download failure => `operator-verification-required`.
Storage-download review does not auto-pass Level 2/3/4, `production_safe`, public scoring, or public technique authority.

## Lane definition
- Download: scoped storage artefacts required for QA review.
- Store: local operator-controlled directory above.
- Cleanup/retention: local policy record (retain only as needed for QA traceability).
- Summary generation: sanitized local summary (counts/findings/outcomes), no private payload upload.
- Never commit: downloaded assets, credentials, private runtime traces.
- PR-allowed: summary conclusions + pass/fail flags + evidence references.
- Local-only: raw files, secrets, credentialed session data.
- Trigger: orchestrator enters `STORAGE_DOWNLOAD_QA_REQUIRED`, operator starts local runner.
- Failure loop: summary returned to ChatGPT for decision, Codex for follow-up changes.
