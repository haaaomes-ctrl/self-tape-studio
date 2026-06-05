-- WS5 commit 3: per-object size limits for the private storage buckets
-- (both previously NULL = unlimited).
--
-- Sizing evidence (live, 2026-06-05):
--   - qa-artifacts: 56 objects, largest 351 kB (JSON/text QA artefacts).
--     25 MB is a ~70x headroom cap that still blocks runaway/abusive writes.
--   - audition-videos: ZERO objects. Mux Direct Upload is the media path —
--     nothing in the codebase uploads to this bucket (only a delete path in
--     src/server-fns/delete.functions.ts and the cutover-health existence
--     check). 750 MB is a purely defensive ceiling sized for a possible
--     future direct-video fallback (~10 min 1080p); it can be lowered once
--     a real writer exists.
--
-- Deliberately NO retention/deletion jobs in this migration: retention is
-- held pending operator sign-off (audition-videos retention is a
-- data-protection decision because the product involves minors).

UPDATE storage.buckets
SET file_size_limit = 26214400        -- 25 MB
WHERE id = 'qa-artifacts';

UPDATE storage.buckets
SET file_size_limit = 786432000       -- 750 MB
WHERE id = 'audition-videos';
