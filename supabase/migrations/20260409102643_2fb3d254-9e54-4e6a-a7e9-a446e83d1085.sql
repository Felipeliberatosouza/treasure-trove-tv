CREATE POLICY "Users can view own views"
ON public.video_views
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);