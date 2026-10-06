ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
UPDATE public.profiles p SET terms_accepted_at = p.created_at
FROM auth.users u
WHERE u.id = p.user_id AND p.terms_accepted_at IS NULL
  AND coalesce(u.raw_app_meta_data->>'provider','email') = 'email';