-- Add per-resource price columns to lessons and exam_solutions so teachers
-- can set individual prices per resource (revisão, resumo, simulado, top_questoes, colinha)
ALTER TABLE public.lessons
  ADD COLUMN IF NOT EXISTS price_revisoes numeric,
  ADD COLUMN IF NOT EXISTS price_resumos numeric,
  ADD COLUMN IF NOT EXISTS price_simulados numeric,
  ADD COLUMN IF NOT EXISTS price_top_questoes numeric,
  ADD COLUMN IF NOT EXISTS price_colinhas numeric;

ALTER TABLE public.exam_solutions
  ADD COLUMN IF NOT EXISTS price_revisoes numeric,
  ADD COLUMN IF NOT EXISTS price_resumos numeric,
  ADD COLUMN IF NOT EXISTS price_simulados numeric,
  ADD COLUMN IF NOT EXISTS price_top_questoes numeric,
  ADD COLUMN IF NOT EXISTS price_colinhas numeric;