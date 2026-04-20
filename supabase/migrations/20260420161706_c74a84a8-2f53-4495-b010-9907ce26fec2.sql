-- Aprovação independente por material (resumo, simulado, top questões, colinha)
ALTER TABLE public.lesson_material_meta
  ADD COLUMN IF NOT EXISTS admin_approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS submitted_for_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_material_meta_lesson_type_unique
  ON public.lesson_material_meta (lesson_id, material_type);

-- Trigger: ao alterar conteúdo de qualquer material, marca o meta correspondente como pendente novamente
CREATE OR REPLACE FUNCTION public.mark_material_pending_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mtype text;
  lid uuid;
BEGIN
  IF TG_TABLE_NAME = 'lesson_summaries' THEN
    mtype := 'resumo';
  ELSIF TG_TABLE_NAME = 'lesson_quiz_questions' THEN
    mtype := 'simulado';
  ELSIF TG_TABLE_NAME = 'lesson_top_questions' THEN
    mtype := 'top_questoes';
  ELSIF TG_TABLE_NAME = 'lesson_cheatsheet_items' THEN
    mtype := 'colinhas';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  lid := COALESCE(NEW.lesson_id, OLD.lesson_id);

  UPDATE public.lesson_material_meta
    SET admin_approved = false,
        submitted_for_review = true,
        rejection_reason = NULL,
        updated_at = now()
    WHERE lesson_id = lid AND material_type = mtype;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_summary_mark_pending ON public.lesson_summaries;
CREATE TRIGGER trg_summary_mark_pending
AFTER INSERT OR UPDATE OR DELETE ON public.lesson_summaries
FOR EACH ROW EXECUTE FUNCTION public.mark_material_pending_on_change();

DROP TRIGGER IF EXISTS trg_quiz_mark_pending ON public.lesson_quiz_questions;
CREATE TRIGGER trg_quiz_mark_pending
AFTER INSERT OR UPDATE OR DELETE ON public.lesson_quiz_questions
FOR EACH ROW EXECUTE FUNCTION public.mark_material_pending_on_change();

DROP TRIGGER IF EXISTS trg_topq_mark_pending ON public.lesson_top_questions;
CREATE TRIGGER trg_topq_mark_pending
AFTER INSERT OR UPDATE OR DELETE ON public.lesson_top_questions
FOR EACH ROW EXECUTE FUNCTION public.mark_material_pending_on_change();

DROP TRIGGER IF EXISTS trg_cheat_mark_pending ON public.lesson_cheatsheet_items;
CREATE TRIGGER trg_cheat_mark_pending
AFTER INSERT OR UPDATE OR DELETE ON public.lesson_cheatsheet_items
FOR EACH ROW EXECUTE FUNCTION public.mark_material_pending_on_change();