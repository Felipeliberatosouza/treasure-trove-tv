-- Restrict INSERT on public.security_notifications to service_role only.
-- The client-side EmailSecurityNotification page now goes through the
-- `report-security-notification` edge function, which uses the service role
-- to validate input and write the row server-side. Removing the anon/auth
-- INSERT policy prevents abuse of the queue.
DROP POLICY IF EXISTS "Anyone can create security notifications" ON public.security_notifications;
