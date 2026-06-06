-- ARCH-Δ2: user-selected audition discipline.
--
-- Mandatory pre-upload selection for NEW auditions (enforced at the app
-- layer + the DISCIPLINE_REQUIRED upload gate + the analysis-entry guard).
-- NULLABLE at the DB level ONLY for legacy rows created before ARCH-Δ2
-- (the live DB has 4 auditions / 5 takes predating this column). There is
-- deliberately NO backfill: a discipline is never guessed — legacy
-- auditions are repaired by the one-time add-take backfill prompt, or stay
-- blocked for NEW takes only (existing reports untouched).
--
-- One discipline per submission; all takes of an audition inherit it.
-- musical_theatre is a SINGLE composite discipline (singing + acting +
-- integration), not two.

ALTER TABLE public.auditions
  ADD COLUMN IF NOT EXISTS discipline TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'auditions_discipline_check'
  ) THEN
    ALTER TABLE public.auditions
      ADD CONSTRAINT auditions_discipline_check
      CHECK (
        discipline IS NULL
        OR discipline IN (
          'acting',
          'musical_theatre',
          'singing_voice',
          'dance',
          'commercial'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN public.auditions.discipline IS
  'User-selected audition discipline (mandatory for new auditions at the app layer; NULL only on pre-ARCH-Δ2 legacy rows — never backfilled/guessed). Drives the analysis AuditionType: acting→acting_scene, musical_theatre→musical_theatre (single composite), singing_voice→song, dance→dance, commercial→commercial.';
