-- 1. Harden fraud-prone revenue tracking inserts
DROP POLICY IF EXISTS "Users insert their own watch" ON public.video_watch_log;
CREATE POLICY "Users insert their own watch"
ON public.video_watch_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND seconds_watched >= 0
  AND seconds_watched <= 21600
  AND EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = video_watch_log.lesson_id
      AND l.teacher_id = video_watch_log.teacher_id
  )
);

DROP POLICY IF EXISTS "Users insert their own access" ON public.material_access_log;
CREATE POLICY "Users insert their own access"
ON public.material_access_log
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND material_type IN ('resumo','simulado','top_questoes','colinha','duvida','revisao','aula_particular')
  AND EXISTS (
    SELECT 1 FROM public.lessons l
    WHERE l.id = material_access_log.lesson_id
      AND l.teacher_id = material_access_log.teacher_id
  )
  AND public.can_access_lesson_material(material_access_log.lesson_id, material_access_log.material_type)
);

-- 2. Admin-granted content/AI credits
CREATE OR REPLACE FUNCTION public.admin_grant_content_credits(_user_id uuid, _grants jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
  raw text;
  v int;
  bal int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem conceder créditos';
  END IF;

  FOR k, raw IN SELECT key, value FROM jsonb_each_text(_grants) LOOP
    v := GREATEST(0, COALESCE(NULLIF(raw, '')::int, 0));
    CONTINUE WHEN v = 0;

    IF k = 'ai_credits' THEN
      UPDATE public.ai_revision_credits
        SET balance = balance + v, updated_at = now()
        WHERE user_id = _user_id
        RETURNING balance INTO bal;
      IF NOT FOUND THEN
        INSERT INTO public.ai_revision_credits (user_id, balance)
        VALUES (_user_id, v)
        RETURNING balance INTO bal;
      END IF;
      INSERT INTO public.ai_revision_credit_ledger (user_id, delta, reason, balance_after)
      VALUES (_user_id, v, 'admin_grant', bal);
    ELSIF k IN ('revisao','resumo','simulado','top_questoes','colinha','duvida','aula_particular') THEN
      UPDATE public.referral_content_credits
        SET granted = granted + v, updated_at = now()
        WHERE user_id = _user_id AND resource_type = k;
      IF NOT FOUND THEN
        INSERT INTO public.referral_content_credits (user_id, resource_type, granted, used)
        VALUES (_user_id, k, v, 0);
      END IF;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_content_credits(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_content_credits(uuid, jsonb) TO authenticated;