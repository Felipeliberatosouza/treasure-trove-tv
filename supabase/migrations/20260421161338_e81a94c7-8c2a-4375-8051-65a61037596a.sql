-- User-level reminder preferences for scheduled lessons
CREATE TABLE public.lesson_reminder_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'whatsapp_sms_fallback',
  alternate_phone TEXT,
  preferred_windows_hours INTEGER[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT lesson_reminder_preferences_channel_check
    CHECK (channel IN ('whatsapp_sms_fallback', 'whatsapp_only', 'sms_only', 'disabled'))
);

ALTER TABLE public.lesson_reminder_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reminder prefs"
  ON public.lesson_reminder_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reminder prefs"
  ON public.lesson_reminder_preferences
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert own reminder prefs"
  ON public.lesson_reminder_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reminder prefs"
  ON public.lesson_reminder_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reminder prefs"
  ON public.lesson_reminder_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_lesson_reminder_preferences_updated_at
  BEFORE UPDATE ON public.lesson_reminder_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();