ALTER TABLE public.beta_bug_reports
  ADD COLUMN IF NOT EXISTS triage_category text,
  ADD COLUMN IF NOT EXISTS triage_summary text,
  ADD COLUMN IF NOT EXISTS triage_decision text,
  ADD COLUMN IF NOT EXISTS lovable_prompt text,
  ADD COLUMN IF NOT EXISTS triaged_at timestamptz;

CREATE OR REPLACE FUNCTION public.auto_triage_bug_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.origin = 'automatico' AND coalesce(NEW.error_message,'') ILIKE '404 Error:%' THEN
    NEW.status := 'resolvido';
    NEW.triage_category := 'auto_resolvido';
    NEW.triage_summary := 'Endereço antigo ou inexistente. O visitante é levado automaticamente para a página inicial.';
    NEW.triaged_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_auto_triage_bug_report ON public.beta_bug_reports;
CREATE TRIGGER trg_auto_triage_bug_report BEFORE INSERT ON public.beta_bug_reports
FOR EACH ROW EXECUTE FUNCTION public.auto_triage_bug_report();

UPDATE public.beta_bug_reports SET status='resolvido', triage_category='auto_resolvido',
  triage_summary='Endereço antigo ou inexistente. O visitante é levado automaticamente para a página inicial.', triaged_at=now()
WHERE origin='automatico' AND error_message ILIKE '404 Error:%' AND status='pendente';