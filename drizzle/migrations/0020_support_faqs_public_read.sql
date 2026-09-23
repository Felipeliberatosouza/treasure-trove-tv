GRANT SELECT ON public.support_faqs TO anon;
CREATE POLICY "Anyone reads active support faqs" ON public.support_faqs FOR SELECT TO anon, authenticated USING (status = 'active');