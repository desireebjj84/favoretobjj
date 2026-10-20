ALTER TABLE public.classes ADD COLUMN min_age integer;
ALTER TABLE public.classes ADD COLUMN max_age integer;
COMMENT ON COLUMN public.classes.min_age IS 'Optional minimum age for the class';
COMMENT ON COLUMN public.classes.max_age IS 'Optional maximum age for the class';

CREATE TABLE public.push_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_tokens_user_idx ON public.push_tokens(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;
GRANT ALL ON public.push_tokens TO service_role;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own push tokens" ON public.push_tokens FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());