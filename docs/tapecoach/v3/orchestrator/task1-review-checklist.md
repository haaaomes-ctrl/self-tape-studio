# Setup Task 1 Review Checklist

- [ ] Scope is Setup Task 1 bootstrap only.
- [ ] Task 0 design docs were followed.
- [ ] No public output changes.
- [ ] No upload/Mux/webhook implementation changes.
- [ ] Blocked states remain blocked.
- [ ] `.github/workflows/contracts.yml` and `.github/workflows/build.yml` exist.
- [ ] No `pull_request_target` introduced in Task 1 bootstrap.
- [ ] `gate:v3` validates exported source contract values only (not live runtime state).
- [ ] `gate:storage` validates exported source contract by default; emitted-bundle validation runs only with explicit bundle path.
- [ ] `gate:release` fail-closed behaviour is documented while trusted-base gatekeeper is deferred.
- [ ] `npm run test:contracts` passes.
- [ ] `npm run build` passes.
- [ ] `src/routeTree.gen.ts` unchanged.
