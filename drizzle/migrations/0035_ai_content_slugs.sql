ALTER TABLE public.ai_canonical_contents ADD COLUMN IF NOT EXISTS slug text;
CREATE UNIQUE INDEX IF NOT EXISTS ai_canonical_contents_slug_key ON public.ai_canonical_contents(slug);

CREATE OR REPLACE FUNCTION public.make_content_slug(_txt text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(both '_' from regexp_replace(lower(translate(coalesce(_txt,''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')), '[^a-z0-9]+', '_', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.set_content_slug()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE base text; cand text; n int := 1;
BEGIN
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN RETURN NEW; END IF;
  base := left(public.make_content_slug(NEW.assunto), 60);
  IF base = '' THEN base := 'revisao'; END IF;
  cand := base;
  WHILE EXISTS (SELECT 1 FROM public.ai_canonical_contents WHERE slug = cand AND id <> NEW.id) LOOP
    n := n + 1; cand := base || '_' || n;
  END LOOP;
  NEW.slug := cand;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_content_slug ON public.ai_canonical_contents;
CREATE TRIGGER trg_set_content_slug BEFORE INSERT OR UPDATE OF assunto ON public.ai_canonical_contents
FOR EACH ROW EXECUTE FUNCTION public.set_content_slug();

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT id FROM public.ai_canonical_contents WHERE slug IS NULL ORDER BY created_at LOOP
    UPDATE public.ai_canonical_contents SET slug = NULL WHERE id = r.id;
  END LOOP;
END $$;