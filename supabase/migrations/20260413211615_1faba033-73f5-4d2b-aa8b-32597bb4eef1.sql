-- Add phone_verified to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;

-- Allow service role full access on phone_verifications for edge functions
CREATE POLICY "Service role can manage phone verifications"
ON public.phone_verifications
FOR ALL
TO public
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);

-- Allow anon to insert phone verifications (for pre-signup verification)
CREATE POLICY "Anon can create phone verifications"
ON public.phone_verifications
FOR INSERT
TO anon
WITH CHECK (true);