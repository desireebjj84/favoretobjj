ALTER TABLE public.students ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;
UPDATE public.students SET approved = true;

CREATE OR REPLACE FUNCTION public.guard_student_approval()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF public.is_staff(auth.uid()) OR auth.uid() IS NULL THEN
    IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN NEW.approved := true; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.approved := false;
  ELSE NEW.approved := OLD.approved; END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_student_approval() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_students_approval ON public.students;
CREATE TRIGGER trg_students_approval BEFORE INSERT OR UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.guard_student_approval();

CREATE OR REPLACE FUNCTION public.check_booking_capacity()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE cap int; cnt int; sdate date; ok boolean;
BEGIN
  SELECT approved INTO ok FROM students WHERE id = NEW.student_id;
  IF NOT coalesce(ok,false) AND NOT is_staff(auth.uid()) THEN RAISE EXCEPTION 'Student awaiting approval'; END IF;
  SELECT c.capacity, s.session_date INTO cap, sdate FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = NEW.session_id;
  IF sdate < current_date THEN RAISE EXCEPTION 'Class already happened'; END IF;
  SELECT count(*) INTO cnt FROM bookings WHERE session_id = NEW.session_id;
  IF cnt >= cap THEN RAISE EXCEPTION 'Class is full'; END IF;
  NEW.booked_by := auth.uid();
  RETURN NEW;
END $function$;