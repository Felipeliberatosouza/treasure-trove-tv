
-- Function to add N business days to a timestamp (skipping Saturdays and Sundays)
CREATE OR REPLACE FUNCTION public.add_business_days(start_ts timestamptz, days integer)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  result timestamptz := start_ts;
  added integer := 0;
  dow integer;
BEGIN
  WHILE added < days LOOP
    result := result + interval '1 day';
    dow := EXTRACT(ISODOW FROM result); -- 1=Mon ... 7=Sun
    IF dow < 6 THEN
      added := added + 1;
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- support_tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number serial NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  user_role text NOT NULL CHECK (user_role IN ('student','teacher')),
  category text NOT NULL CHECK (category IN ('reclamacao','sugestao','duvida','problema')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('baixa','normal','alta','urgente')),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','awaiting_user','resolved','closed')),
  response_due_at timestamptz NOT NULL,
  first_responded_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  assigned_admin_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_tickets_user_id ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_tickets_created_at ON public.support_tickets(created_at DESC);

-- Trigger to auto-set response_due_at to +3 business days on insert
CREATE OR REPLACE FUNCTION public.set_support_ticket_due_date()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.response_due_at IS NULL THEN
    NEW.response_due_at := public.add_business_days(COALESCE(NEW.created_at, now()), 3);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_support_ticket_due_date
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_support_ticket_due_date();

-- updated_at trigger
CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users create own tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins view all tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update all tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete tickets"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- support_ticket_messages table
CREATE TABLE public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_type text NOT NULL CHECK (author_type IN ('user','admin')),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_ticket_messages_ticket_id ON public.support_ticket_messages(ticket_id);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view messages of own tickets"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users add messages to own tickets"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND author_type = 'user'
    AND EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = ticket_id AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all ticket messages"
  ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins add messages to any ticket"
  ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    AND author_type = 'admin'
    AND auth.uid() = author_id
  );

-- Trigger: when an admin replies for the first time, set first_responded_at
CREATE OR REPLACE FUNCTION public.mark_ticket_first_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.author_type = 'admin' THEN
    UPDATE public.support_tickets
      SET first_responded_at = COALESCE(first_responded_at, NEW.created_at),
          status = CASE WHEN status = 'open' THEN 'in_progress' ELSE status END,
          updated_at = now()
      WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mark_ticket_first_response
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.mark_ticket_first_response();
