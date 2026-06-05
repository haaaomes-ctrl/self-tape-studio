-- WS5 commit 3: per-object size limits for the private storage buckets
-- (both previously NULL = unlimited).
--
-- Sizing evidence (live, 2026-06-05):
--   - qa-artifacts: 56 objects, largest 351 kB (JSON/text QA artefacts).
--     25 MB is a ~70x headroom cap that still blocks runaway/abusive writes.
--   - audition-videos: ZERO objects. Mux Direct Upload is the media path —
--     nothing in the codebase uploads to this bucket (only a delete path in
--     src/server-fns/delete.functions.ts and the cutover-health existence
--     check). With no writer, the cap is kept deliberately TIGHT (50 MB,
--     operator review 2026-06-05); bump it deliberately if a direct-video
--     fallback is ever built.
--
-- Deliberately NO retention/deletion jobs in this migration: retention is
-- held pending operator sign-off (audition-videos retention is a
-- data-protection decision because the product involves minors).

UPDATE storage.buckets
SET file_size_limit = 26214400        -- 25 MB
WHERE id = 'qa-artifacts';

UPDATE storage.buckets
SET file_size_limit = 52428800        -- 50 MB
WHERE id = 'audition-videos';
