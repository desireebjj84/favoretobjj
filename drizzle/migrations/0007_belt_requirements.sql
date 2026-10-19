CREATE TABLE public.belt_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  belt public.belt_color NOT NULL,
  is_kids boolean NOT NULL DEFAULT false,
  classes_per_stripe integer NOT NULL CHECK (classes_per_stripe > 0),
  UNIQUE (belt, is_kids)
);
GRANT SELECT ON public.belt_requirements TO authenticated;
GRANT ALL ON public.belt_requirements TO service_role;
ALTER TABLE public.belt_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read belt requirements"
  ON public.belt_requirements FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can manage belt requirements"
  ON public.belt_requirements FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));