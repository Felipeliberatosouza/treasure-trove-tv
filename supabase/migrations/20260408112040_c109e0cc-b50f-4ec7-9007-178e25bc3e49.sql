
-- Create platform_settings table
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for public pages)
CREATE POLICY "Anyone can view platform settings"
ON public.platform_settings
FOR SELECT
TO anon, authenticated
USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert platform settings"
ON public.platform_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "Admins can update platform settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete platform settings"
ON public.platform_settings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default settings
INSERT INTO public.platform_settings (key, value) VALUES
('branding', '{"platform_name": "Revisão Fácil", "slogan": "Sua plataforma de estudos online", "logo_url": "", "primary_color": "#6366f1", "secondary_color": "#8b5cf6", "accent_color": "#f59e0b"}'::jsonb),
('contact', '{"email": "contato@revisaofacil.com", "phone": "", "address": "", "instagram": "", "youtube": "", "facebook": "", "twitter": ""}'::jsonb),
('about_us', '{"content": ""}'::jsonb),
('terms_of_use', '{"content": ""}'::jsonb),
('privacy_policy', '{"content": ""}'::jsonb),
('hero_banner', '{"title": "Aprenda de forma fácil e eficiente", "subtitle": "Acesse videoaulas e resoluções de provas dos melhores professores", "cta_text": "Comece Agora", "cta_link": "/cadastro/aluno"}'::jsonb),
('featured_videos', '{"video_ids": [], "section_title": "Destaques", "section_subtitle": "Os conteúdos mais populares da plataforma"}'::jsonb),
('subscription_plans', '{"plans": [{"name": "Básico", "price": 29.90, "features": ["Acesso a aulas gratuitas", "1 resolução de prova/mês"], "highlighted": false}, {"name": "Premium", "price": 59.90, "features": ["Acesso ilimitado a aulas", "Resoluções de provas ilimitadas", "Suporte prioritário"], "highlighted": true}, {"name": "Institucional", "price": 99.90, "features": ["Tudo do Premium", "Múltiplos usuários", "Relatórios de desempenho"], "highlighted": false}]}'::jsonb),
('video_pricing', '{"default_lesson_price": 9.90, "default_exam_solution_price": 14.90, "allow_free_content": true}'::jsonb);
