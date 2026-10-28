DROP POLICY IF EXISTS "Produtos visíveis a todos" ON public.products;
CREATE POLICY "Produtos visíveis a todos" ON public.products FOR SELECT TO anon, authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Todos leem eventos" ON public.seasonal_events;
CREATE POLICY "Todos leem eventos" ON public.seasonal_events FOR SELECT TO anon, authenticated
USING (active = true OR public.has_role(auth.uid(), 'admin'::public.app_role));