CREATE OR REPLACE FUNCTION public.can_manage_student_photo(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NOT NULL AND public.is_staff(auth.uid()) THEN true
    ELSE public.can_view_student(substring(_name from '^students/([0-9a-fA-F-]{36})')::uuid)
  END
$$;

CREATE POLICY "authenticated manage student photos"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'profile-photos' AND public.can_manage_student_photo(name))
WITH CHECK (bucket_id = 'profile-photos' AND public.can_manage_student_photo(name));