
-- Settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage settings" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES ('qr_price', '70');

-- Missing columns on salesmen
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS created_by_agent_id UUID REFERENCES public.agents(id);
ALTER TABLE public.salesmen ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT;

-- Missing column on agents
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS razorpay_account_id TEXT;

-- Missing columns on payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS collector_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS agent_id UUID;
