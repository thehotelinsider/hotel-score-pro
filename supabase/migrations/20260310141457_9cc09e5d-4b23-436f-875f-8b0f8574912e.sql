
-- Create subscriptions table to store subscription requests
CREATE TABLE public.subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (subscription form doesn't require auth)
CREATE POLICY "Allow anonymous inserts" ON public.subscriptions
  FOR INSERT TO anon WITH CHECK (true);

-- Allow authenticated users to read (for admin purposes)
CREATE POLICY "Allow authenticated reads" ON public.subscriptions
  FOR SELECT TO authenticated USING (true);
