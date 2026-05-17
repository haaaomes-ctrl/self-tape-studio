# Setup Task 4 Spec — Local Storage-download QA Lane

Admin URL: `https://tapecoach.co.uk/admin/storage-downloads`

## Parameterised local download directory
- Storage-download jobs must use an operator-configured absolute local download directory.
- The directory is supplied through `TAPECOACH_AGENT_DOWNLOAD_DIR`.
- Current operator-approved value (Beth Willars Mac example/default): `/Users/bethwillars/Documents/AI/Apps/Tape Coach/Agent`.
- This Beth Willars value is an example/default, not a universal required path.
- Future operators may set a different absolute local path.
- Implementations must read the env var and must not hardcode the Beth Willars path.

Runner labels: `self-hosted`, `macOS`, `tapecoach-agent`, `storage-download`.

## Controls
- If `TAPECOACH_AGENT_DOWNLOAD_DIR` is missing, empty, not absolute, not writable, points inside the repository, or cannot be accessed by the self-hosted runner, the lane must produce `operator-verification-required`.
- Downloaded artefacts must not be committed.
- Private runtime artefacts must not be uploaded to GitHub by default.
- Admin credentials must never be printed.
- Only review summaries may be uploaded/exposed unless explicitly approved.

## Failure handling
Authentication/path/env/download failure => `operator-verification-required`.
Storage-download review does not auto-pass Level 2/3/4, `production_safe`, public scoring, or public technique authority.

## Lane definition
- Download: scoped storage artefacts required for QA review.
- Store: operator-configured local directory from `TAPECOACH_AGENT_DOWNLOAD_DIR`.
- Cleanup/retention: local policy record (retain only as needed for QA traceability).
- Summary generation: sanitized local summary (counts/findings/outcomes), no private payload upload.
- Never commit: downloaded assets, credentials, private runtime traces.
- PR-allowed: summary conclusions + pass/fail flags + evidence references.
- Local-only: raw files, secrets, credentialed session data.
- Trigger: orchestrator enters `STORAGE_DOWNLOAD_QA_REQUIRED`, operator starts local runner.
- Failure loop: summary returned to ChatGPT for decision, Codex for follow-up changes.
