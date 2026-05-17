# PR #49 Lessons Learned

- Implementation before threat-model freeze created a review loop.
- PR-controlled validator code cannot fully protect its own bootstrap PR.
- Broad shell/YAML parser support expands scope and review surface.
- P2 parser flexibility should be deferred unless acceptance-blocking.
- Generated artefact churn should be removed from bootstrap scope.
- Global exception env in every PR is unsafe.
- Local fail-closed behaviour must be reported accurately.
- GitHub PR-context validation differs from local checks.
- Codex completion is evidence, not acceptance.
- Task 0 design freeze prevents recurrence via fixed boundaries, authority model, stop rules, and deferred hardening posture.
