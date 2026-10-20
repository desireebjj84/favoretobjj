ALTER TABLE public.students ADD COLUMN colored_stripes text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.students ADD CONSTRAINT students_colored_stripes_colors CHECK (colored_stripes <@ ARRAY['red','blue','yellow','green']::text[] AND array_position(colored_stripes, NULL) IS NULL);
CREATE OR REPLACE FUNCTION public.guard_colored_stripes() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.is_staff(auth.uid()) THEN
  IF TG_OP = 'INSERT' THEN NEW.colored_stripes := '{}'; ELSE NEW.colored_stripes := OLD.colored_stripes; END IF;
 END IF;
 IF (TG_OP = 'INSERT' AND cardinality(NEW.colored_stripes) > 0) OR (TG_OP = 'UPDATE' AND NEW.colored_stripes IS DISTINCT FROM OLD.colored_stripes) THEN
  IF cardinality(NEW.colored_stripes) > 0 AND NOT (CASE WHEN NEW.birth_date IS NOT NULL THEN NEW.birth_date > (CURRENT_DATE - INTERVAL '16 years')::date ELSE NEW.is_minor END) THEN
   RAISE EXCEPTION 'Colored stripes are only available for students under 16';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER protect_colored_stripes BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.guard_colored_stripes();