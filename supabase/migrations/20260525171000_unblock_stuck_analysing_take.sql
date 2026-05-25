-- One-off live recovery for the S10.P2e waitUntil fallback failure observed
-- on 2026-05-25. The runtime fix prevents future rows from remaining in this
-- state; this migration only clears the already-stuck live take if it still
-- matches the exact non-terminal state.
UPDATE public.takes
SET status = 'error',
    processing_phase = 'error',
    error_message = '[failure_code:analysing_orphan] We couldn''t finish your report this time. Please try again.'
WHERE id = 'fce09a52-f266-4053-9421-ced2d892bc9a'
  AND status = 'processing'
  AND processing_phase = 'analysing';
