
-- Create salesmen table
CREATE TABLE public.salesmen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.salesmen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read salesmen" ON public.salesmen FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage salesmen" ON public.salesmen FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_salesmen_updated_at BEFORE UPDATE ON public.salesmen FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  qr_code_id UUID REFERENCES public.qr_codes(id),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  collected_by_role TEXT NOT NULL,
  collected_by_id UUID,
  customer_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read payments" ON public.payments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage payments" ON public.payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add assigned_salesman_id to qr_codes
ALTER TABLE public.qr_codes ADD COLUMN assigned_salesman_id UUID REFERENCES public.salesmen(id);
