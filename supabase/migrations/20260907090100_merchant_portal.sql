-- Merchant portal: link store owners to merchants and let them manage their
-- own graph (identity, locations/hours, catalog, offers, happenings) and
-- publish their website. Operators keep full tenant-level access.

CREATE TABLE public.merchant_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, user_id)
);
CREATE UNIQUE INDEX merchant_owners_pending_email_unique ON public.merchant_owners (merchant_id, lower(email)) WHERE user_id IS NULL;
CREATE INDEX merchant_owners_user_id_idx ON public.merchant_owners (user_id);
CREATE INDEX merchant_owners_email_idx ON public.merchant_owners (email);

ALTER TABLE public.merchant_owners ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_owners TO authenticated;
GRANT ALL ON public.merchant_owners TO service_role;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.merchant_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_merchant_owner(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_owners mo
    WHERE mo.merchant_id = _merchant_id AND mo.user_id = auth.uid()
  );
$$;

-- =============== merchant_owners policies ===============
-- Member (operator) read; owner reads their own link.
CREATE POLICY "owner read merchant_owners" ON public.merchant_owners FOR SELECT TO authenticated
  USING (is_tenant_member(tenant_id) OR is_merchant_owner(merchant_id));
-- Operators invite owners; admins manage the link table.
CREATE POLICY "member insert merchant_owners" ON public.merchant_owners FOR INSERT TO authenticated
  WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "member update merchant_owners" ON public.merchant_owners FOR UPDATE TO authenticated
  USING (is_tenant_member(tenant_id)) WITH CHECK (is_tenant_member(tenant_id));
CREATE POLICY "member delete merchant_owners" ON public.merchant_owners FOR DELETE TO authenticated
  USING (is_tenant_member(tenant_id));
-- Self-service claim: the invite is bound to the email the merchant signs in with.
CREATE POLICY "owner claim merchant_owners" ON public.merchant_owners FOR UPDATE TO authenticated
  USING (user_id IS NULL AND lower(email) = lower(auth.jwt() ->> 'email'))
  WITH CHECK (user_id = auth.uid());

-- =============== merchant graph: owner access ===============
CREATE POLICY "owner read merchants" ON public.merchants FOR SELECT TO authenticated
  USING (is_merchant_owner(id));
CREATE POLICY "owner update merchants" ON public.merchants FOR UPDATE TO authenticated
  USING (is_merchant_owner(id)) WITH CHECK (is_merchant_owner(id));

CREATE POLICY "owner manage locations" ON public.locations FOR ALL TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner manage business_hours" ON public.business_hours FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.locations l WHERE l.id = location_id AND is_merchant_owner(l.merchant_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.locations l WHERE l.id = location_id AND is_merchant_owner(l.merchant_id)));
CREATE POLICY "owner manage products" ON public.products FOR ALL TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner manage services" ON public.services FOR ALL TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner manage offers" ON public.offers FOR ALL TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner manage happenings" ON public.happenings FOR ALL TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));

-- =============== websites: owner read/write (generate + publish loop) ===============
CREATE POLICY "owner read websites" ON public.websites FOR SELECT TO authenticated
  USING (is_merchant_owner(merchant_id));
CREATE POLICY "owner insert websites" ON public.websites FOR INSERT TO authenticated
  WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner update websites" ON public.websites FOR UPDATE TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner read website_pages" ON public.website_pages FOR SELECT TO authenticated
  USING (is_merchant_owner(merchant_id));
CREATE POLICY "owner insert website_pages" ON public.website_pages FOR INSERT TO authenticated
  WITH CHECK (is_merchant_owner(merchant_id));
CREATE POLICY "owner update website_pages" ON public.website_pages FOR UPDATE TO authenticated
  USING (is_merchant_owner(merchant_id)) WITH CHECK (is_merchant_owner(merchant_id));

-- =============== events: owners append to their tenant's log ===============
CREATE POLICY "owner append events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.merchant_owners mo
    WHERE mo.tenant_id = events.tenant_id AND mo.user_id = auth.uid()
  ));