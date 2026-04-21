-- Private bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Attachments table
CREATE TABLE IF NOT EXISTS public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.support_ticket_messages(id) ON DELETE SET NULL,
  uploader_id uuid NOT NULL,
  uploader_type text NOT NULL CHECK (uploader_type IN ('user', 'admin')),
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON public.support_ticket_attachments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_attachments_message ON public.support_ticket_attachments(message_id);

ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Owner of the ticket can view their attachments
CREATE POLICY "Ticket owners view own attachments"
ON public.support_ticket_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Admins can view all attachments
CREATE POLICY "Admins view all attachments"
ON public.support_ticket_attachments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Owner of the ticket can insert attachments tagged as 'user'
CREATE POLICY "Ticket owners insert own attachments"
ON public.support_ticket_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploader_type = 'user'
  AND uploader_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = ticket_id AND t.user_id = auth.uid()
  )
);

-- Admins can insert attachments tagged as 'admin'
CREATE POLICY "Admins insert attachments"
ON public.support_ticket_attachments
FOR INSERT
TO authenticated
WITH CHECK (
  uploader_type = 'admin'
  AND uploader_id = auth.uid()
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Uploader or admin can delete
CREATE POLICY "Uploader or admin delete attachment"
ON public.support_ticket_attachments
FOR DELETE
TO authenticated
USING (
  uploader_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Storage policies for the support-attachments bucket
-- Path convention: <ticket_id>/<random>-<filename>

-- Upload: ticket owner (authenticated) can upload to ticket folders they own
CREATE POLICY "Users upload to own ticket folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
  )
);

-- Upload: admins can upload to any ticket folder
CREATE POLICY "Admins upload to any ticket folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Read: ticket owner can read their own ticket files (used to create signed URLs)
CREATE POLICY "Users read own ticket attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
  )
);

-- Read: admins can read all ticket attachments
CREATE POLICY "Admins read all ticket attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Delete: uploader (folder owner) or admin
CREATE POLICY "Users delete own ticket attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id::text = (storage.foldername(name))[1]
      AND t.user_id = auth.uid()
  )
);

CREATE POLICY "Admins delete any ticket attachment"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'support-attachments'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);