INSERT INTO public.platform_settings (key, value)
VALUES (
  'footer',
  jsonb_build_object(
    'copyright', '© 2026 {platform_name}. Todos os direitos reservados.',
    'about_label', 'Sobre',
    'about_url', '/sobre',
    'terms_label', 'Termos',
    'terms_url', '/termos',
    'privacy_label', 'Privacidade',
    'privacy_url', '/privacidade',
    'contact_label', 'Contato',
    'contact_url', '/contato'
  )
)
ON CONFLICT (key) DO NOTHING;