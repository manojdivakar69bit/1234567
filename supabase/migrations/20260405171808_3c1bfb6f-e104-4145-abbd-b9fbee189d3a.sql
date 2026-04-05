
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.agents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read agents" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage agents" ON public.agents FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.qr_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available',
  assigned_agent_id UUID REFERENCES public.agents(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read qr_codes" ON public.qr_codes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage qr_codes" ON public.qr_codes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id),
  name TEXT NOT NULL,
  vehicle_number TEXT,
  blood_group TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read customers" ON public.customers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage customers" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id UUID NOT NULL REFERENCES public.qr_codes(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  relationship TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read emergency_contacts" ON public.emergency_contacts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage emergency_contacts" ON public.emergency_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.call_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code TEXT NOT NULL,
  contact_phone TEXT,
  contact_name TEXT,
  status TEXT NOT NULL DEFAULT 'initiated',
  caller_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert call_logs" ON public.call_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can read call_logs" ON public.call_logs FOR SELECT TO authenticated USING (true);

CREATE TABLE public.print_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  printed_by TEXT,
  count INTEGER,
  code_from TEXT,
  code_to TEXT,
  printed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.print_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage print_history" ON public.print_history FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_qr_codes_updated_at BEFORE UPDATE ON public.qr_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_emergency_contacts_updated_at BEFORE UPDATE ON public.emergency_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
