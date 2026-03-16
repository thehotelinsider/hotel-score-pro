
CREATE TABLE public.shared_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_name text NOT NULL,
  hotel_address text,
  hotel_city text,
  hotel_state text,
  hotel_country text,
  hotel_rating numeric,
  hotel_review_count integer,
  hotel_image_url text,
  score_overall integer,
  score_seo integer,
  score_website integer,
  score_reviews integer,
  score_social_media integer,
  score_ota integer,
  competitors jsonb,
  rankings jsonb,
  issues jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Allow public read access for viewing shared reports
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared reports"
  ON public.shared_reports
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can insert shared reports"
  ON public.shared_reports
  FOR INSERT
  TO service_role
  WITH CHECK (true);
