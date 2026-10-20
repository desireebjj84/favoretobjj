-- Black belt degrees are time-based: 3 years on the belt per degree.
ALTER TABLE public.belt_requirements ADD COLUMN IF NOT EXISTS years_per_degree numeric;

INSERT INTO public.belt_requirements (belt, is_kids, classes_per_stripe, years_per_degree)
SELECT 'black', false, 1, 3
WHERE NOT EXISTS (SELECT 1 FROM public.belt_requirements WHERE belt = 'black' AND is_kids = false);

INSERT INTO public.belt_requirements (belt, is_kids, classes_per_stripe, years_per_degree)
SELECT 'black', true, 1, 3
WHERE NOT EXISTS (SELECT 1 FROM public.belt_requirements WHERE belt = 'black' AND is_kids = true);

COMMENT ON COLUMN public.belt_requirements.years_per_degree IS 'Time-based rule: years on the belt required per degree (black belt = 3); NULL means classes-based.';