
-- Direct-to-Mux refactor: video_path becomes optional, add idempotency + phase tracking.
ALTER TABLE public.takes
  ALTER COLUMN video_path DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS mux_duration_seconds NUMERIC,
  ADD COLUMN IF NOT EXISTS processing_phase TEXT NOT NULL DEFAULT 'idle';

-- Unique mux_asset_id so duplicate webhooks can't double-process the same asset.
CREATE UNIQUE INDEX IF NOT EXISTS takes_mux_asset_id_unique
  ON public.takes (mux_asset_id)
  WHERE mux_asset_id IS NOT NULL;

-- Index for daily-cap counting per user.
CREATE INDEX IF NOT EXISTS takes_user_created_idx
  ON public.takes (user_id, created_at DESC);
