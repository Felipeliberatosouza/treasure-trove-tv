
-- Add slug column
ALTER TABLE public.profiles ADD COLUMN slug text DEFAULT '';

-- Create unique index (only for non-empty slugs)
CREATE UNIQUE INDEX idx_profiles_slug_unique ON public.profiles (slug) WHERE slug != '';

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_profile_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 0;
  name_parts text[];
BEGIN
  -- Only generate if slug is empty and name is provided
  IF (NEW.slug IS NULL OR NEW.slug = '') AND NEW.name IS NOT NULL AND NEW.name != '' THEN
    -- Normalize: lowercase, trim, replace accents
    base_slug := lower(trim(NEW.name));
    base_slug := translate(base_slug, 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn');
    
    -- Split into parts and take first + last
    name_parts := string_to_array(base_slug, ' ');
    IF array_length(name_parts, 1) >= 2 THEN
      base_slug := name_parts[1] || '.' || name_parts[array_length(name_parts, 1)];
    ELSE
      base_slug := name_parts[1];
    END IF;
    
    -- Remove non-alphanumeric chars except dots
    base_slug := regexp_replace(base_slug, '[^a-z0-9.]', '', 'g');
    
    final_slug := base_slug;
    -- Handle uniqueness
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE slug = final_slug AND id != NEW.id) LOOP
      counter := counter + 1;
      final_slug := base_slug || counter::text;
    END LOOP;
    
    NEW.slug := final_slug;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on insert
CREATE TRIGGER generate_slug_on_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.generate_profile_slug();

-- Trigger on update (only if name changed and slug is still empty)
CREATE TRIGGER generate_slug_on_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.generate_profile_slug();

-- Backfill existing profiles
UPDATE public.profiles SET slug = '' WHERE slug IS NULL OR slug = '';
