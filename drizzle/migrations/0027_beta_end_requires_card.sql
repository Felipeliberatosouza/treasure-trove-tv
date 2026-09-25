CREATE OR REPLACE FUNCTION public.handle_beta_mode_toggle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE was boolean; now_on boolean;
BEGIN
  IF NEW.key <> 'beta_mode' THEN RETURN NEW; END IF;
  was := CASE WHEN TG_OP = 'UPDATE' THEN coalesce((OLD.value->>'enabled')::boolean, false) ELSE false END;
  now_on := coalesce((NEW.value->>'enabled')::boolean, false);
  IF was AND NOT now_on THEN
    UPDATE public.student_subscriptions SET status = 'beta_ended', updated_at = now()
      WHERE status = 'active' AND stripe_subscription_id LIKE 'beta\_%';
    UPDATE public.video_purchases SET payment_status = 'beta_ended', updated_at = now()
      WHERE payment_status = 'completed' AND stripe_payment_id LIKE 'beta\_%';
  ELSIF now_on AND NOT was THEN
    UPDATE public.student_subscriptions s SET status = 'active', updated_at = now()
      WHERE s.status = 'beta_ended' AND (s.expires_at IS NULL OR s.expires_at > now())
        AND NOT EXISTS (SELECT 1 FROM public.student_subscriptions o WHERE o.user_id = s.user_id AND o.status = 'active');
    UPDATE public.video_purchases SET payment_status = 'completed', updated_at = now()
      WHERE payment_status = 'beta_ended';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_beta_mode_toggle ON public.platform_settings;
CREATE TRIGGER trg_beta_mode_toggle AFTER INSERT OR UPDATE ON public.platform_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_beta_mode_toggle();

DO $$ BEGIN
  IF NOT coalesce((SELECT (value->>'enabled')::boolean FROM public.platform_settings WHERE key='beta_mode'), false) THEN
    UPDATE public.student_subscriptions SET status='beta_ended', updated_at=now() WHERE status='active' AND stripe_subscription_id LIKE 'beta\_%';
    UPDATE public.video_purchases SET payment_status='beta_ended', updated_at=now() WHERE payment_status='completed' AND stripe_payment_id LIKE 'beta\_%';
  END IF;
END $$;