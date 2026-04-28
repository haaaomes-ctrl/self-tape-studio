
ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS mux_upload_id TEXT,
  ADD COLUMN IF NOT EXISTS mux_asset_id TEXT,
  ADD COLUMN IF NOT EXISTS mux_playback_id TEXT,
  ADD COLUMN IF NOT EXISTS mux_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS mux_mp4_standard_url TEXT,
  ADD COLUMN IF NOT EXISTS mux_mp4_high_url TEXT,
  ADD COLUMN IF NOT EXISTS analysis_tier TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS takes_mux_upload_id_idx ON public.takes (mux_upload_id);
CREATE INDEX IF NOT EXISTS takes_mux_asset_id_idx ON public.takes (mux_asset_id);
