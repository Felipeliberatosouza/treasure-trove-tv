ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS preview_sprite_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_vtt_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE public.exam_solutions
  ADD COLUMN IF NOT EXISTS preview_sprite_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_vtt_url TEXT,
  ADD COLUMN IF NOT EXISTS preview_status TEXT NOT NULL DEFAULT 'pending';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lessons_preview_status_check'
  ) THEN
    ALTER TABLE public.lessons
      ADD CONSTRAINT lessons_preview_status_check
      CHECK (preview_status IN ('pending','ready','failed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exam_solutions_preview_status_check'
  ) THEN
    ALTER TABLE public.exam_solutions
      ADD CONSTRAINT exam_solutions_preview_status_check
      CHECK (preview_status IN ('pending','ready','failed'));
  END IF;
END $$;