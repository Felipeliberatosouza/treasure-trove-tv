CREATE TABLE public.seasonal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_md text NOT NULL,
  end_md text NOT NULL,
  icon text NOT NULL DEFAULT '🎉',
  effect text NOT NULL DEFAULT 'confetti',
  primary_color text NOT NULL DEFAULT '#f59e0b',
  dark_mode boolean NOT NULL DEFAULT false,
  message text,
  priority int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.seasonal_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seasonal_events TO authenticated;
GRANT ALL ON public.seasonal_events TO service_role;
ALTER TABLE public.seasonal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem eventos" ON public.seasonal_events FOR SELECT USING (true);
CREATE POLICY "Admin gerencia eventos" ON public.seasonal_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.seasonal_events (name,start_md,end_md,icon,effect,primary_color,dark_mode,message,active) VALUES
('Halloween','10-25','10-31','🎃','spider','#f97316',true,'Feliz Halloween! Estude sem medo.',true),
('Natal','12-01','12-31','🎄','snow','#dc2626',false,'Feliz Natal! Boas revisões.',true),
('Carnaval','02-10','02-18','🎭','confetti','#a855f7',false,'Bom Carnaval!',false);