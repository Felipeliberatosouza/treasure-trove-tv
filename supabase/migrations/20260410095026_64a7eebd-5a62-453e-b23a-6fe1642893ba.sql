CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, email, birth_date, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.email, ''),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'birth_date')::date 
      ELSE NULL 
    END,
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '')
  );
  
  IF NEW.raw_user_meta_data ->> 'role' = 'teacher' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'teacher');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  END IF;
  
  RETURN NEW;
END;
$function$;