CREATE TABLE public.work_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  titulo text NOT NULL,
  tema text NOT NULL,
  tipo text NOT NULL DEFAULT 'ambos',
  disciplina text,
  curso text,
  instituicao text,
  content jsonb NOT NULL,
  status text NOT NULL DEFAULT 'ready',
  credits_spent integer NOT NULL DEFAULT 0,
  provider_cost numeric(10,4) NOT NULL DEFAULT 0,
  reused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_documents_cache_key ON public.work_documents (cache_key);
CREATE INDEX idx_work_documents_user ON public.work_documents (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_documents TO authenticated;
GRANT ALL ON public.work_documents TO service_role;

ALTER TABLE public.work_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own work documents"
ON public.work_documents FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner updates own work documents"
ON public.work_documents FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner deletes own work documents"
ON public.work_documents FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.work_document_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.work_documents(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  credits_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_work_document_messages_doc ON public.work_document_messages (document_id, created_at);

GRANT SELECT, INSERT, DELETE ON public.work_document_messages TO authenticated;
GRANT ALL ON public.work_document_messages TO service_role;

ALTER TABLE public.work_document_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own work messages"
ON public.work_document_messages FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.work_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
);

CREATE POLICY "Owner deletes own work messages"
ON public.work_document_messages FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.work_documents d WHERE d.id = document_id AND d.user_id = auth.uid())
);

INSERT INTO public.platform_settings (key, value)
VALUES ('work_documents_pricing', '{"credits_generation":2,"credits_interaction":1,"provider_cost_generation":0.35,"provider_cost_interaction":0.12,"price_generation":4.90,"price_interaction":1.90}'::jsonb)
ON CONFLICT (key) DO NOTHING;