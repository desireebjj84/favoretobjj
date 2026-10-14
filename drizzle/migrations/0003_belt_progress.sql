ALTER TABLE public.students ADD COLUMN stripes integer NOT NULL DEFAULT 0 CHECK (stripes BETWEEN 0 AND 4);
ALTER TABLE public.students ADD COLUMN rank_since timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.org_settings ADD COLUMN classes_per_stripe integer NOT NULL DEFAULT 20;
CREATE OR REPLACE FUNCTION public.guard_student_approval()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN NEW.approved := true; END IF;
    IF TG_OP = 'UPDATE' AND (NEW.belt IS DISTINCT FROM OLD.belt OR NEW.stripes IS DISTINCT FROM OLD.stripes) THEN
      NEW.rank_since := now();
    END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.approved := false; NEW.stripes := 0; NEW.rank_since := now();
  ELSE NEW.approved := OLD.approved; NEW.belt := OLD.belt; NEW.stripes := OLD.stripes; NEW.rank_since := OLD.rank_since; END IF;
  RETURN NEW;
END $$;