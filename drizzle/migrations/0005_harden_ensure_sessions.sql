CREATE OR REPLACE FUNCTION public.ensure_sessions(_from date, _to date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _from IS NULL OR _to IS NULL OR _to < _from THEN RAISE EXCEPTION 'Invalid range'; END IF;
  IF NOT public.is_staff(auth.uid()) THEN
    IF (_to - _from) > 42 OR _from < current_date - 45 OR _to > current_date + 60 THEN
      RAISE EXCEPTION 'Range not allowed';
    END IF;
  ELSIF (_to - _from) > 400 THEN
    RAISE EXCEPTION 'Range too large';
  END IF;
  INSERT INTO public.class_sessions (class_id, session_date)
  SELECT c.id, d::date
  FROM public.classes c
  CROSS JOIN generate_series(_from, _to, interval '1 day') d
  WHERE c.active AND EXTRACT(DOW FROM d)::int = c.weekday
  ON CONFLICT (class_id, session_date) DO NOTHING;
END; $function$;
REVOKE EXECUTE ON FUNCTION public.ensure_sessions(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_sessions(date, date) TO authenticated;