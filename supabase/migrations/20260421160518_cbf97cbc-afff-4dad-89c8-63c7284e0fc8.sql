-- 1) Dedup/log table for reminders
CREATE TABLE IF NOT EXISTS public.scheduled_lesson_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.scheduled_lessons(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('student','teacher')),
  recipient_user_id uuid NOT NULL,
  reminder_hours integer NOT NULL,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp')),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  twilio_sid text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_lesson_reminders_unique
  ON public.scheduled_lesson_reminders (lesson_id, recipient_type, reminder_hours);

CREATE INDEX IF NOT EXISTS scheduled_lesson_reminders_lesson_idx
  ON public.scheduled_lesson_reminders (lesson_id);

ALTER TABLE public.scheduled_lesson_reminders ENABLE ROW LEVEL SECURITY;

-- Only admins can view. Inserts happen via service role (edge function).
CREATE POLICY "Admins can view lesson reminders"
  ON public.scheduled_lesson_reminders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 2) Cron: run send-lesson-reminders every 5 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove previous schedule if it exists (idempotent)
DO $$
DECLARE
  jid int;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'send-lesson-reminders-every-5min';
  IF jid IS NOT NULL THEN
    PERFORM cron.unschedule(jid);
  END IF;
END $$;

SELECT cron.schedule(
  'send-lesson-reminders-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uzhajthlokwglujtgmgm.supabase.co/functions/v1/send-lesson-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6aGFqdGhsb2t3Z2x1anRnbWdtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjEzNzMsImV4cCI6MjA5MDc5NzM3M30.RAK5S4-85zGcD87GaehhYyAxICqMYaCJPXNbuuEt2Dw'
    ),
    body := jsonb_build_object('source', 'cron')
  );
  $$
);