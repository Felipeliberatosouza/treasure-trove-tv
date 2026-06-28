CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cpf text;
  v_accepts_marketing boolean;
  v_areas text[];
BEGIN
  v_cpf := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data ->> 'cpf', ''), '\D', '', 'g'), '');
  v_accepts_marketing := COALESCE((NEW.raw_user_meta_data ->> 'accepts_marketing')::boolean, false);
  BEGIN
    v_areas := ARRAY(SELECT jsonb_array_elements_text(COALESCE((NEW.raw_user_meta_data -> 'areas'), '[]'::jsonb)));
  EXCEPTION WHEN OTHERS THEN
    v_areas := NULL;
  END;

  INSERT INTO public.profiles (user_id, name, email, birth_date, phone, cpf, accepts_marketing, areas)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.email, ''),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::date
      ELSE NULL
    END,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    v_cpf,
    v_accepts_marketing,
    v_areas
  );

  IF NEW.raw_user_meta_data ->> 'role' = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
    IF (NEW.raw_user_meta_data ->> 'also_student')::boolean = true THEN
      INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
    END IF;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;

  RETURN NEW;
END;
$function$;