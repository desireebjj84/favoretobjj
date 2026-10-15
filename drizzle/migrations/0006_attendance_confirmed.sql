ALTER TABLE public.attendance ADD COLUMN confirmed boolean NOT NULL DEFAULT false;
ALTER TABLE public.attendance ADD COLUMN confirmed_at timestamptz;
UPDATE public.attendance SET confirmed = true, confirmed_at = now() WHERE checked_in_at < current_date;