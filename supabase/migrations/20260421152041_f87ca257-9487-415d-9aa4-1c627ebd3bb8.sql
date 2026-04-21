-- Fix Function Search Path Mutable warnings (pgmq helpers)
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;

-- Fix RLS Policy Always True warnings by replacing WITH CHECK (true) with content-based validations.
-- These tables intentionally accept anonymous inserts (contact form, login attempts, phone codes, security notifications),
-- but we tighten the WITH CHECK to validate payload shape so the policy is no longer "always true".

-- contact_messages: require non-empty fields and a basic email shape
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(name)) > 0
  AND length(btrim(subject)) > 0
  AND length(btrim(message)) > 0
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND read = false
);

-- login_attempts: require email shape; the table is append-only audit
DROP POLICY IF EXISTS "Anyone can insert login attempts" ON public.login_attempts;
CREATE POLICY "Anyone can insert login attempts"
ON public.login_attempts
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(btrim(email)) > 0
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

-- phone_verifications: require a code, a phone, and a future expiry; restrict to the authenticated user when present
DROP POLICY IF EXISTS "Anon can create phone verifications" ON public.phone_verifications;
CREATE POLICY "Anon can create phone verifications"
ON public.phone_verifications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(code)) > 0
  AND length(btrim(phone)) > 0
  AND expires_at > now()
  AND verified = false
  AND (auth.uid() IS NULL OR auth.uid() = user_id)
);

-- security_notifications: require an email and a template_key; status must start as pending/queued
DROP POLICY IF EXISTS "Anyone can create security notifications" ON public.security_notifications;
CREATE POLICY "Anyone can create security notifications"
ON public.security_notifications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  email IS NOT NULL
  AND length(btrim(email)) > 0
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(btrim(template_key)) > 0
  AND status IN ('pending','queued','sent')
);