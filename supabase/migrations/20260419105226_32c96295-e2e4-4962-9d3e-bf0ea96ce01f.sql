-- Allow service role to update suppressed_emails (needed to attach feedback metadata)
CREATE POLICY "Service role can update suppressed emails"
ON public.suppressed_emails
FOR UPDATE
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');