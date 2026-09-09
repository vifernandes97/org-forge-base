DELETE FROM public.contacts c WHERE NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id = c.lead_id);

ALTER TABLE public.contacts
  ADD CONSTRAINT contacts_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;