-- ARCH-Δ3: evidence-binding gate kill-switch.
--
-- Default TRUE: the deterministic gate between Step 1 evidence and the
-- Step 2 brief verdict is ON. FALSE = emergency lever only (disables the
-- R4 verdict-coherence collapse + breakdown cap; per-row grounding in
-- normaliseBriefAchievementMatrix is unaffected). Flip via the
-- secret-gated /api/public/admin-config endpoint or direct SQL; no deploy.
--
-- Read by a narrow FAIL-OPEN-TO-ON query
-- (src/server/evidence-binding-gate-config.server.ts), NOT by
-- getResolvedConfig() — a deploy/migration race must not drop the quota
-- config to SAFE_DEFAULTS, and a config read failure must not silently
-- disable a truthfulness gate.

ALTER TABLE public.app_config
  ADD COLUMN IF NOT EXISTS evidence_binding_gate_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.app_config.evidence_binding_gate_enabled IS
  'ARCH-Δ3 evidence-binding gate (default true). FALSE = emergency disable of the deterministic Step1→Step2 verdict-coherence gate. Read by a narrow fail-open-to-ON query, not getResolvedConfig().';
