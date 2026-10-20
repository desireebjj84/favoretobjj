CREATE TABLE public.stripe_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), student_id uuid NOT NULL REFERENCES public.students(id), submitted_by uuid NOT NULL, color text NOT NULL CHECK(color IN ('red','yellow','green')), version integer NOT NULL DEFAULT 1 CHECK(version=1), answers jsonb NOT NULL, student_snapshot jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')), submitted_at timestamptz NOT NULL DEFAULT now(), reviewed_by uuid, reviewed_at timestamptz, review_note text NOT NULL DEFAULT '' CHECK(length(review_note)<=1000)
);
GRANT SELECT ON public.stripe_submissions TO authenticated;
GRANT ALL ON public.stripe_submissions TO service_role;
ALTER TABLE public.stripe_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY stripe_forms_read ON public.stripe_submissions FOR SELECT TO authenticated USING(submitted_by=auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE UNIQUE INDEX stripe_forms_one_pending ON public.stripe_submissions(student_id,color) WHERE status='pending';
CREATE FUNCTION public.validate_stripe_answers(_color text,_a jsonb) RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE v jsonb; n integer;
BEGIN
 IF _color NOT IN ('red','yellow','green') OR jsonb_typeof(_a) IS DISTINCT FROM 'object' OR octet_length(_a::text)>20000 THEN RAISE EXCEPTION 'Invalid form'; END IF;
 IF jsonb_typeof(_a->'parent_name') IS DISTINCT FROM 'string' OR length(trim(_a->>'parent_name')) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Parent name required'; END IF;
 IF _color IN ('red','yellow') THEN
  n:=CASE WHEN _color='red' THEN 4 ELSE 8 END;
  IF jsonb_typeof(_a->'parent_scores') IS DISTINCT FROM 'array' OR jsonb_array_length(_a->'parent_scores')<>n THEN RAISE EXCEPTION 'Complete all scores'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(_a->'parent_scores') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v::text)::numeric NOT BETWEEN 0 AND 10 OR (v::text)::numeric<>trunc((v::text)::numeric) THEN RAISE EXCEPTION 'Scores must be integers 0-10'; END IF;
  END LOOP;
 END IF;
 IF _color='red' THEN
  IF jsonb_typeof(_a->'teacher_scores') IS DISTINCT FROM 'array' OR jsonb_array_length(_a->'teacher_scores')<>5 THEN RAISE EXCEPTION 'Complete teacher scores'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(_a->'teacher_scores') LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'number' OR (v::text)::numeric NOT BETWEEN 0 AND 10 OR (v::text)::numeric<>trunc((v::text)::numeric) THEN RAISE EXCEPTION 'Scores must be integers 0-10'; END IF;
  END LOOP;
  IF jsonb_typeof(_a->'teacher_name') IS DISTINCT FROM 'string' OR length(trim(_a->>'teacher_name')) NOT BETWEEN 1 AND 100 OR COALESCE(_a->>'teacher_date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Teacher name and date required'; END IF;
  PERFORM (_a->>'teacher_date')::date;
 END IF;
 IF _color='green' THEN
  IF jsonb_typeof(_a->'habits') IS DISTINCT FROM 'array' OR jsonb_array_length(_a->'habits')<>6 THEN RAISE EXCEPTION 'Complete habits'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(_a->'habits') LOOP IF jsonb_typeof(v) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Answer yes or no'; END IF; END LOOP;
  IF jsonb_typeof(_a->'foods') IS DISTINCT FROM 'array' OR jsonb_array_length(_a->'foods')<>5 THEN RAISE EXCEPTION 'Complete five foods'; END IF;
  FOR v IN SELECT value FROM jsonb_array_elements(_a->'foods') LOOP
   IF jsonb_typeof(v->'description') IS DISTINCT FROM 'string' OR length(trim(v->>'description')) NOT BETWEEN 1 AND 200 OR COALESCE(v->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Food description and date required'; END IF;
   PERFORM (v->>'date')::date;
  END LOOP;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.validate_stripe_answers(text,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.submit_stripe_form(_student_id uuid,_color text,_answers jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.students; result uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 SELECT * INTO s FROM public.students WHERE id=_student_id FOR UPDATE;
 IF NOT FOUND OR s.guardian_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the student guardian can submit'; END IF;
 IF NOT s.active OR NOT s.approved OR NOT (CASE WHEN s.birth_date IS NOT NULL THEN s.birth_date>(CURRENT_DATE-INTERVAL '16 years')::date ELSE s.is_minor END) THEN RAISE EXCEPTION 'Student must be approved and under 16'; END IF;
 PERFORM public.validate_stripe_answers(_color,_answers);
 INSERT INTO public.stripe_submissions(student_id,submitted_by,color,answers,student_snapshot) VALUES(s.id,auth.uid(),_color,_answers,jsonb_build_object('full_name',s.full_name,'belt',s.belt,'stripes',s.stripes,'birth_date',s.birth_date)) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_stripe_form(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_stripe_form(uuid,text,jsonb) TO authenticated;
CREATE FUNCTION public.review_stripe_form(_id uuid,_approve boolean,_note text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE f public.stripe_submissions; s public.students; p integer; t integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF _approve IS NULL OR _note IS NULL OR length(_note)>1000 THEN RAISE EXCEPTION 'Invalid review'; END IF;
 SELECT * INTO f FROM public.stripe_submissions WHERE id=_id FOR UPDATE;
 IF NOT FOUND OR f.status<>'pending' THEN RAISE EXCEPTION 'Form already reviewed or unavailable'; END IF;
 IF _approve THEN
  PERFORM public.validate_stripe_answers(f.color,f.answers);
  IF f.color IN ('red','yellow') THEN
   SELECT sum(value::text::integer) INTO p FROM jsonb_array_elements(f.answers->'parent_scores');
   IF f.color='red' THEN
    SELECT sum(value::text::integer) INTO t FROM jsonb_array_elements(f.answers->'teacher_scores');
    IF p<30 OR t<35 THEN RAISE EXCEPTION 'Red stripe requires parent 30 and teacher 35 points'; END IF;
   ELSIF p<55 THEN RAISE EXCEPTION 'Yellow stripe requires 55 points'; END IF;
  END IF;
  SELECT * INTO s FROM public.students WHERE id=f.student_id FOR UPDATE;
  IF NOT FOUND OR NOT s.active OR NOT s.approved OR NOT (CASE WHEN s.birth_date IS NOT NULL THEN s.birth_date>(CURRENT_DATE-INTERVAL '16 years')::date ELSE s.is_minor END) THEN RAISE EXCEPTION 'Student no longer eligible'; END IF;
  UPDATE public.students SET colored_stripes=array_append(colored_stripes,f.color) WHERE id=f.student_id;
 END IF;
 UPDATE public.stripe_submissions SET status=CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,reviewed_by=auth.uid(),reviewed_at=now(),review_note=trim(_note) WHERE id=f.id;
END $$;
REVOKE ALL ON FUNCTION public.review_stripe_form(uuid,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_stripe_form(uuid,boolean,text) TO authenticated;