CREATE TABLE public.products (
  key text PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'GraduationCap',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  cta text NOT NULL DEFAULT 'Começar',
  page_intro text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Produtos visíveis a todos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin gerencia produtos" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.subscription_plans ADD COLUMN IF NOT EXISTS product_key text NOT NULL DEFAULT 'provas';
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS product_keys text[] NOT NULL DEFAULT ARRAY['provas'];
ALTER TABLE public.exam_solutions ADD COLUMN IF NOT EXISTS product_keys text[] NOT NULL DEFAULT ARRAY['provas'];
ALTER TABLE public.ai_canonical_contents ADD COLUMN IF NOT EXISTS product_keys text[] NOT NULL DEFAULT ARRAY['provas'];
ALTER TABLE public.work_documents ADD COLUMN IF NOT EXISTS product_keys text[] NOT NULL DEFAULT ARRAY['trabalhos'];