
CREATE TABLE public.contact_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  hotel_name text NOT NULL,
  current_score integer
);

ALTER TABLE public.contact_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" ON public.contact_leads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated inserts" ON public.contact_leads
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role full access" ON public.contact_leads
  FOR ALL TO service_role USING (true) WITH CHECK (true);
