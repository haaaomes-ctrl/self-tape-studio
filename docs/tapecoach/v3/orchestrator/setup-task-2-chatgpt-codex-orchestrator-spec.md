# Setup Task 2 Spec — ChatGPT ↔ Codex Orchestrator

Design target only (no implementation in Task 0).

## Flow
1. Read source hierarchy and release state from README + setup docs.
2. Ask ChatGPT for Codex prompt.
3. Store prompt in orchestrator decision history record.
4. Operator manually runs Codex task where required.
5. Ingest Codex implementation summary + evidence refs.
6. Ask ChatGPT: continue fixes or create PR.
7. Record operator-required “Create PR” action.
8. Detect PR link/number.
9. Request Codex PR review against repo/PR context.
10. Ingest Codex review summary/bugs.
11. Send bugs to ChatGPT and request fix-or-merge decision.
12. Generate fix prompt if required.
13. Monitor GitHub checks + gatekeeper result.
14. Loop on failures until P0/P1 cleared and checks pass.
15. Block merge unless ChatGPT approves, Codex review clear, GitHub checks pass, gatekeeper pass.

## Design targets
- `npm run orchestrator:test`
- `npm run test:contracts`
- `npm run build`

Outputs are design targets only (decision log entries, prompt history, review summaries, blocked-state records).

## Mandatory constraints
- No automatic merge without operator action.
- No automatic Lovable publish without operator action.
- Record ambiguity/contradiction as `operator-verification-required`.
- Track P0/P1/P2/P3 explicitly.
- Prevent scope expansion during review without operator approval.
