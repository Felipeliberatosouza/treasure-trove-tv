
-- Add CPF to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cpf text DEFAULT '';

-- Create teacher_contracts table
CREATE TABLE public.teacher_contracts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL,
  contract_text text NOT NULL,
  signature_name text NOT NULL,
  signature_cpf text NOT NULL,
  ip_address text DEFAULT '',
  device_info text DEFAULT '',
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '1 year'),
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teacher_contracts ENABLE ROW LEVEL SECURITY;

-- Teachers can view own contracts
CREATE POLICY "Teachers can view own contracts"
ON public.teacher_contracts
FOR SELECT
TO authenticated
USING (auth.uid() = teacher_id);

-- Teachers can create own contracts
CREATE POLICY "Teachers can create own contracts"
ON public.teacher_contracts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = teacher_id AND has_role(auth.uid(), 'teacher'::app_role));

-- Admins can view all contracts
CREATE POLICY "Admins can view all contracts"
ON public.teacher_contracts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update contracts
CREATE POLICY "Admins can update all contracts"
ON public.teacher_contracts
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_teacher_contracts_updated_at
BEFORE UPDATE ON public.teacher_contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
