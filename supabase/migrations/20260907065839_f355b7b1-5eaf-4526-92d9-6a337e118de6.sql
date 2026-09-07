CREATE TABLE IF NOT EXISTS public.merchant_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id uuid,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'owner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS merchant_owners_merchant_email_key
  ON public.merchant_owners (merchant_id, lower(email));
CREATE INDEX IF NOT EXISTS merchant_owners_user_idx ON public.merchant_owners (user_id);
CREATE INDEX IF NOT EXISTS merchant_owners_tenant_idx ON public.merchant_owners (tenant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_owners TO authenticated;
GRANT ALL ON public.merchant_owners TO service_role;

ALTER TABLE public.merchant_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators manage merchant owners in their workspace"
  ON public.merchant_owners FOR ALL TO authenticated
  USING (public.is_tenant_member(tenant_id))
  WITH CHECK (public.is_tenant_member(tenant_id));

CREATE POLICY "Owners can read their own link"
  ON public.merchant_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE POLICY "Owners can claim their own invite"
  ON public.merchant_owners FOR UPDATE TO authenticated
  USING (user_id IS NULL AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  WITH CHECK (user_id = auth.uid() AND lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.merchant_owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();