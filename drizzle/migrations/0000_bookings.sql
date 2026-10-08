CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  booked_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
GRANT SELECT, INSERT, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookings readable" ON public.bookings FOR SELECT TO authenticated USING (public.can_view_student(student_id));
CREATE POLICY "book own students" ON public.bookings FOR INSERT TO authenticated WITH CHECK (public.can_view_student(student_id));
CREATE POLICY "cancel own students" ON public.bookings FOR DELETE TO authenticated USING (public.can_view_student(student_id));

CREATE OR REPLACE FUNCTION public.session_booking_count(_session_ids uuid[])
RETURNS TABLE(session_id uuid, n bigint) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.session_id, count(*) FROM public.bookings b WHERE b.session_id = ANY(_session_ids) GROUP BY b.session_id;
$$;
REVOKE EXECUTE ON FUNCTION public.session_booking_count(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_booking_count(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_booking_capacity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap int; cnt int; sdate date;
BEGIN
  SELECT c.capacity, s.session_date INTO cap, sdate FROM class_sessions s JOIN classes c ON c.id = s.class_id WHERE s.id = NEW.session_id;
  IF sdate < current_date THEN RAISE EXCEPTION 'Class already happened'; END IF;
  SELECT count(*) INTO cnt FROM bookings WHERE session_id = NEW.session_id;
  IF cnt >= cap THEN RAISE EXCEPTION 'Class is full'; END IF;
  NEW.booked_by := auth.uid();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.check_booking_capacity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_booking_capacity BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.check_booking_capacity();