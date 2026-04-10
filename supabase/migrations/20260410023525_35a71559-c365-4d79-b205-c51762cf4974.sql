
ALTER TABLE public.lessons
  ADD COLUMN resumo_url text DEFAULT '',
  ADD COLUMN simulado_url text DEFAULT '',
  ADD COLUMN top_questoes_url text DEFAULT '',
  ADD COLUMN colinha_url text DEFAULT '',
  ADD COLUMN duvidas_url text DEFAULT '',
  ADD COLUMN aula_particular_url text DEFAULT '';

ALTER TABLE public.exam_solutions
  ADD COLUMN resumo_url text DEFAULT '',
  ADD COLUMN simulado_url text DEFAULT '',
  ADD COLUMN top_questoes_url text DEFAULT '',
  ADD COLUMN colinha_url text DEFAULT '',
  ADD COLUMN duvidas_url text DEFAULT '',
  ADD COLUMN aula_particular_url text DEFAULT '';
