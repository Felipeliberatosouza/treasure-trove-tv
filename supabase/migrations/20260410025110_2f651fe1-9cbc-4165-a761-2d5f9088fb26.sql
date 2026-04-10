
-- Force regenerate slugs by setting name to itself (triggers the slug generation)
UPDATE public.profiles SET name = name WHERE slug = '' OR slug IS NULL;
