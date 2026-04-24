-- Remove a coluna access_day (com seu DEFAULT não-imutável implícito) e
-- substitui o índice único diário por um índice expression-based imutável
-- em cima de accessed_at, evitando dependência de to_char/timezone runtime.

DROP INDEX IF EXISTS public.uq_mal_unique_day;

ALTER TABLE public.material_access_log
  DROP COLUMN IF EXISTS access_day;

-- Cast com literal de timezone é IMMUTABLE -> pode ser usado em índice único
CREATE UNIQUE INDEX IF NOT EXISTS uq_mal_unique_day
  ON public.material_access_log (
    user_id,
    lesson_id,
    material_type,
    ((accessed_at AT TIME ZONE 'UTC')::date)
  );