
CREATE POLICY "Service role can delete suppressed emails"
ON public.suppressed_emails
FOR DELETE
USING (auth.role() = 'service_role'::text);

CREATE POLICY "Service role can delete unsubscribe tokens"
ON public.email_unsubscribe_tokens
FOR DELETE
USING (auth.role() = 'service_role'::text);
