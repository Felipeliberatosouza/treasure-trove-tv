
DO $$
DECLARE
  r RECORD;
  base_slug text;
  final_slug text;
  counter integer;
  name_parts text[];
BEGIN
  FOR r IN SELECT id, name FROM public.profiles WHERE (slug IS NULL OR slug = '') AND name IS NOT NULL AND name != '' ORDER BY created_at LOOP
    base_slug := lower(trim(r.name));
    base_slug := translate(base_slug, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn');
    name_parts := string_to_array(base_slug, ' ');
    IF array_length(name_parts, 1) >= 2 THEN
      base_slug := name_parts[1] || '.' || name_parts[array_length(name_parts, 1)];
    ELSE
      base_slug := name_parts[1];
    END IF;
    base_slug := regexp_replace(base_slug, '[^a-z0-9.]', '', 'g');
    
    final_slug := base_slug;
    counter := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug AND id != r.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || counter::text;
    END LOOP;
    
    UPDATE public.profiles SET slug = final_slug WHERE id = r.id;
  END LOOP;
END;
$$;
