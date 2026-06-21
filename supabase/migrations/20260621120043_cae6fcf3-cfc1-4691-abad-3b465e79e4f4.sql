DROP POLICY IF EXISTS "Authenticated can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated can subscribe to own topics"
  ON realtime.messages FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE 'user:' || auth.uid()::text || ':%'
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );