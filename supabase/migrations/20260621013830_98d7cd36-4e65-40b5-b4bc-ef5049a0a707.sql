CREATE POLICY "Users read their own watch logs"
ON public.video_watch_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);