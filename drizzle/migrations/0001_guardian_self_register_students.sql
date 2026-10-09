CREATE POLICY "guardians register own students"
ON public.students FOR INSERT TO authenticated
WITH CHECK (guardian_id = auth.uid() OR user_id = auth.uid());

CREATE POLICY "guardians update own students"
ON public.students FOR UPDATE TO authenticated
USING (guardian_id = auth.uid() OR user_id = auth.uid())
WITH CHECK (guardian_id = auth.uid() OR user_id = auth.uid());