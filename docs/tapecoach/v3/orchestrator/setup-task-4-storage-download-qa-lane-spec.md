# Setup Task 4 Spec — Local Storage-download QA Lane

Admin URL: `https://tapecoach.co.uk/admin/storage-downloads`

## Parameterised local download directory contract
- `TAPECOACH_AGENT_DOWNLOAD_DIR` is required at runtime.
- Storage-download jobs must use an operator-configured absolute local download directory supplied through `TAPECOACH_AGENT_DOWNLOAD_DIR`.
- For Beth Willars’ self-hosted Mac runner, the expected/default configured value is `/Users/bethwillars/Documents/AI/Apps/Tape Coach/Agent`.
- That Beth Willars path is the current operator-approved default configuration value for Beth Willars’ Mac runner.
- That Beth Willars path is not a universal operator path.
- That Beth Willars path is not a hidden runtime fallback.
- Implementations must read `TAPECOACH_AGENT_DOWNLOAD_DIR`.
- Implementations must not silently hardcode the Beth path.
- Implementations must not silently fall back to the Beth path when `TAPECOACH_AGENT_DOWNLOAD_DIR` is missing.

Runner labels: `self-hosted`, `macOS`, `tapecoach-agent`, `storage-download`.

## Controls
- If `TAPECOACH_AGENT_DOWNLOAD_DIR` is missing, empty, not absolute, inaccessible, not writable, points inside the repository, or cannot be used by the self-hosted runner, the lane must produce `operator-verification-required`.
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
