
-- Add birth_date to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- Update handle_new_user to save birth_date from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, birth_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.email, ''),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::date 
      ELSE NULL 
    END
  );
  
  IF NEW.raw_user_meta_data ->> 'role' = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Insert birthday email template
INSERT INTO public.email_templates (template_key, subject, body_html)
VALUES (
  'birthday',
  'Feliz Aniversário, {{name}}! 🎂',
  '<h1 style="text-align:center;">🎉 Feliz Aniversário, {{name}}! 🎂</h1><p style="text-align:center;font-size:16px;">A equipe da plataforma deseja a você um dia muito especial, cheio de alegria e realizações!</p><p style="text-align:center;font-size:14px;">Continue estudando e evoluindo. Estamos aqui para apoiar você nessa jornada!</p><p style="text-align:center;margin-top:24px;"><a href="{{login_link}}" style="background-color:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Acessar a Plataforma</a></p>'
)
ON CONFLICT (template_key) DO NOTHING;
