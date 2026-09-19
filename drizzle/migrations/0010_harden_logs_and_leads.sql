-- Derive teacher_id server-side for access/watch logs (prevents attribution poisoning)
CREATE OR REPLACE FUNCTION public.enforce_log_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_teacher uuid;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;

  SELECT l.teacher_id INTO real_teacher FROM public.lessons l WHERE l.id = NEW.lesson_id;
  IF real_teacher IS NULL THEN
    RAISE EXCEPTION 'Aula inexistente';
  END IF;
  NEW.teacher_id := real_teacher;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_attribution_material_access ON public.material_access_log;
CREATE TRIGGER enforce_attribution_material_access
BEFORE INSERT ON public.material_access_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_log_attribution();

DROP TRIGGER IF EXISTS enforce_attribution_video_watch ON public.video_watch_log;
CREATE TRIGGER enforce_attribution_video_watch
BEFORE INSERT ON public.video_watch_log
FOR EACH ROW EXECUTE FUNCTION public.enforce_log_attribution();

-- Usage records: always bound to the signed-in user
CREATE OR REPLACE FUNCTION public.enforce_resource_usage_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria';
  END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_resource_usage_owner_trg ON public.resource_usage;
CREATE TRIGGER enforce_resource_usage_owner_trg
BEFORE INSERT ON public.resource_usage
FOR EACH ROW EXECUTE FUNCTION public.enforce_resource_usage_owner();

-- WhatsApp leads: validate shape and bind user_id server-side
CREATE OR REPLACE FUNCTION public.sanitize_whatsapp_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := auth.uid();
  NEW.name := btrim(NEW.name);
  NEW.email := lower(btrim(NEW.email));
  NEW.phone := regexp_replace(coalesce(NEW.phone, ''), '\D', '', 'g');
  NEW.notes := left(coalesce(NEW.notes, ''), 500);

  IF length(NEW.name) < 2 OR length(NEW.name) > 120 THEN
    RAISE EXCEPTION 'Nome invalido';
  END IF;
  IF NEW.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(NEW.email) > 160 THEN
    RAISE EXCEPTION 'E-mail invalido';
  END IF;
  IF length(NEW.phone) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Celular invalido';
  END IF;
  IF NEW.source IS NULL OR NEW.source NOT IN ('whatsapp_flutuante', 'rodape', 'contato') THEN
    RAISE EXCEPTION 'Origem invalida';
  END IF;
  NEW.page_url := left(coalesce(NEW.page_url, ''), 300);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sanitize_whatsapp_lead_trg ON public.whatsapp_leads;
CREATE TRIGGER sanitize_whatsapp_lead_trg
BEFORE INSERT ON public.whatsapp_leads
FOR EACH ROW EXECUTE FUNCTION public.sanitize_whatsapp_lead();