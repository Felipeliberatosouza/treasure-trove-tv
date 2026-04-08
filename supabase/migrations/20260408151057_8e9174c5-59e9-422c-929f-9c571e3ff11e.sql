
CREATE TABLE public.free_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  trial_type TEXT NOT NULL DEFAULT 'days',
  trial_days INTEGER NOT NULL DEFAULT 7,
  trial_videos INTEGER NOT NULL DEFAULT 5,
  videos_watched INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.free_trials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trial"
  ON public.free_trials FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own trial"
  ON public.free_trials FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trial"
  ON public.free_trials FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trials"
  ON public.free_trials FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage all trials"
  ON public.free_trials FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_free_trials_updated_at
  BEFORE UPDATE ON public.free_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
