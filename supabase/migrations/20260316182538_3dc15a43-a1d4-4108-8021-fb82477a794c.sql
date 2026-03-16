CREATE TABLE public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email text NOT NULL,
  hotel_name text NOT NULL,
  download_url text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage report shares"
  ON public.report_shares FOR ALL
  TO public
  USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);