-- resource_prices: leitura publica apenas de precos ativos, sem campos internos para visitantes
DROP POLICY IF EXISTS "Anyone can view resource prices" ON public.resource_prices;

CREATE POLICY "Active resource prices are public"
ON public.resource_prices
FOR SELECT
TO anon, authenticated
USING (active = true);

REVOKE SELECT ON public.resource_prices FROM anon;
GRANT SELECT (id, resource_type, price, active, updated_at) ON public.resource_prices TO anon;
GRANT SELECT ON public.resource_prices TO authenticated;

-- whatsapp_leads: insercao aberta, porem validada (espelha o trigger sanitize_whatsapp_lead)
DROP POLICY IF EXISTS "Anyone can create whatsapp leads" ON public.whatsapp_leads;

CREATE POLICY "Valid whatsapp leads can be submitted"
ON public.whatsapp_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND length(btrim(name)) BETWEEN 2 AND 120
  AND length(email) <= 160
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) BETWEEN 10 AND 13
  AND source IN ('whatsapp_flutuante', 'rodape', 'contato')
  AND coalesce(length(page_url), 0) <= 300
  AND coalesce(length(notes), 0) <= 500
);