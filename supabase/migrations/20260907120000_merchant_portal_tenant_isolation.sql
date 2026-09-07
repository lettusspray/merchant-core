-- =============================================================
-- Merchant portal: tenant-isolation hardening
--
-- The initial portal migration authorized owner access with
-- `is_merchant_owner(merchant_id)` only. That lets an owner write
-- rows whose tenant_id (or merchant_id) does not match the owned
-- merchant's real tenant, move graph rows across tenants, retarget
-- a merchant's tenant_id, and rebind merchant_owners rows during
-- the email self-claim. This migration makes every owner-accessible
-- policy prove BOTH relationships: the caller owns the merchant AND
-- the row's tenant_id equals that merchant's actual tenant.
--
-- All tenant/ownership checks are centralized in SECURITY DEFINER
-- helpers that read merchant_owners + merchants directly, so a
-- caller-supplied tenant_id is never trusted: every condition is
-- derived from the merchants row itself.
-- =============================================================

-- -----------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------

-- The tenant of the merchant the FK points at (null when missing).
-- SECURITY DEFINER so member/owner policies may look up the true
-- tenant without being filtered by RLS themselves.
CREATE OR REPLACE FUNCTION public.merchant_tenant(_merchant_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.merchants.tenant_id FROM public.merchants WHERE public.merchants.id = _merchant_id;
$$;

-- Strengthened: ownership now also requires the merchant_owners row
-- and the merchant row to agree on the tenant. A stale or forged link
-- whose tenant_id differs from the merchant's real tenant grants
-- nothing. Signature is unchanged so existing callers keep working.
CREATE OR REPLACE FUNCTION public.is_merchant_owner(_merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchant_owners mo
    JOIN public.merchants m ON m.id = mo.merchant_id
    WHERE mo.merchant_id = _merchant_id
      AND mo.user_id = auth.uid()
      AND mo.tenant_id = m.tenant_id
  );
$$;

-- "This merchant belongs to this tenant and is owned by this user."
-- The tenant is verified against the merchant row, never the caller.
CREATE OR REPLACE FUNCTION public.is_owner_merchant_in_tenant(_merchant_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = _merchant_id
      AND m.tenant_id = _tenant_id
      AND public.is_merchant_owner(m.id)
  );
$$;

-- business_hours has no merchant_id; authorize through its location,
-- binding the hour record's tenant to the owned merchant's tenant.
CREATE OR REPLACE FUNCTION public.is_owner_location_in_tenant(_location_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.locations l
    WHERE l.id = _location_id
      AND l.tenant_id = _tenant_id
      AND public.is_owner_merchant_in_tenant(l.merchant_id, _tenant_id)
  );
$$;

-- website_pages authorize through the owned merchant AND its parent
-- website, so a page can never be attached to another merchant's
-- website or to a website in another tenant.
CREATE OR REPLACE FUNCTION public.is_owner_website_in_tenant(_website_id uuid, _tenant_id uuid, _merchant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.websites w
    WHERE w.id = _website_id
      AND w.merchant_id = _merchant_id
      AND w.tenant_id = _tenant_id
      AND public.is_owner_merchant_in_tenant(w.merchant_id, _tenant_id)
  );
$$;

-- "This user owns at least one merchant in this tenant." Anchors the
-- append-only events workflow to the caller's real merchant tenancy.
CREATE OR REPLACE FUNCTION public.is_owner_of_tenant(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.tenant_id = _tenant_id
      AND public.is_merchant_owner(m.id)
  );
$$;

-- -----------------------------------------------------------------
-- Function privileges (polices are evaluated as the authenticated
-- role, so EXECUTE must be granted to authenticated; revoke the
-- default PUBLIC/anon grants that this project convention revokes).
-- -----------------------------------------------------------------
REVOKE ALL ON FUNCTION public.merchant_tenant(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_merchant_owner(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner_merchant_in_tenant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner_location_in_tenant(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner_website_in_tenant(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_owner_of_tenant(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_tenant(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_merchant_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_merchant_in_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_location_in_tenant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_website_in_tenant(uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_of_tenant(uuid) TO authenticated;

-- -----------------------------------------------------------------
-- merchant_owners bindings are immutable (tenant, merchant, email).
-- An RLS WITH CHECK cannot compare old and new values, so a BEFORE
-- UPDATE trigger hard-blocks rebinding during the email self-claim
-- (only user_id may be set) and during member management (operators
-- create a fresh invite rather than retarget an existing one).
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_merchant_owner_binding() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'merchant_owners tenant, merchant and email bindings are immutable';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_merchant_owner_binding() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS merchant_owners_immutable_bind ON public.merchant_owners;
CREATE TRIGGER merchant_owners_immutable_bind
BEFORE UPDATE ON public.merchant_owners
FOR EACH ROW EXECUTE FUNCTION public.ensure_merchant_owner_binding();

-- -----------------------------------------------------------------
-- merchant_owners policies
-- -----------------------------------------------------------------
-- Operators may only invite email addresses for merchants that really
-- belong to their own tenant (merchant_tenant is authoritative).
DROP POLICY IF EXISTS "member insert merchant_owners" ON public.merchant_owners;
CREATE POLICY "member insert merchant_owners" ON public.merchant_owners FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id) AND public.merchant_tenant(merchant_id) = tenant_id);

-- The prior broad member UPDATE policy (USING is_tenant_member(tenant_id)
-- with no email/user binding) let any tenant member bind their account to
-- ANY pending invite in the tenant, bypassing the email self-claim. Invites
-- are created via member INSERT and removed via member DELETE; updating a
-- binding is exclusively the email-bound self-claim below.
DROP POLICY IF EXISTS "member update merchant_owners" ON public.merchant_owners;

-- Self-claim: only pending (unclaimed) invites whose email matches the
-- signed-in account may be bound to that account. USING covers the OLD
-- row (pending) and also the NEW row (Postgres re-checks USING against
-- the post-update tuple), so a claimed row with user_id = auth.uid()
-- must remain satisfiable. WITH CHECK keeps the binding email fixed,
-- and the immutability trigger keeps tenant_id / merchant_id / email
-- unchanged, so the claimed row stays on its original merchant/tenant.
DROP POLICY IF EXISTS "owner claim merchant_owners" ON public.merchant_owners;
CREATE POLICY "owner claim merchant_owners" ON public.merchant_owners FOR UPDATE TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email') AND (user_id IS NULL OR user_id = auth.uid()))
  WITH CHECK (user_id = auth.uid() AND lower(email) = lower(auth.jwt() ->> 'email'));

-- -----------------------------------------------------------------
-- merchants
-- -----------------------------------------------------------------
-- Reads unchanged; updates must leave the merchant owned by the caller
-- and must keep tenant_id pinned to the merchant's own tenant.
DROP POLICY IF EXISTS "owner update merchants" ON public.merchants;
CREATE POLICY "owner update merchants" ON public.merchants FOR UPDATE TO authenticated
  USING (public.is_merchant_owner(id))
  WITH CHECK (public.is_owner_merchant_in_tenant(id, tenant_id));

-- -----------------------------------------------------------------
-- merchant graph (child rows): tenant_id and merchant_id must both
-- trace to an owned merchant in the row's tenant.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "owner manage locations" ON public.locations;
CREATE POLICY "owner manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner manage business_hours" ON public.business_hours;
CREATE POLICY "owner manage business_hours" ON public.business_hours FOR ALL TO authenticated
  USING (public.is_owner_location_in_tenant(location_id, tenant_id))
  WITH CHECK (public.is_owner_location_in_tenant(location_id, tenant_id));

DROP POLICY IF EXISTS "owner manage products" ON public.products;
CREATE POLICY "owner manage products" ON public.products FOR ALL TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner manage services" ON public.services;
CREATE POLICY "owner manage services" ON public.services FOR ALL TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner manage offers" ON public.offers;
CREATE POLICY "owner manage offers" ON public.offers FOR ALL TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner manage happenings" ON public.happenings;
CREATE POLICY "owner manage happenings" ON public.happenings FOR ALL TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

-- -----------------------------------------------------------------
-- websites / website_pages: same tenant binding, plus pages must stay
-- attached to an owned website of the same merchant in the same tenant.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "owner read websites" ON public.websites;
CREATE POLICY "owner read websites" ON public.websites FOR SELECT TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner insert websites" ON public.websites;
CREATE POLICY "owner insert websites" ON public.websites FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner update websites" ON public.websites;
CREATE POLICY "owner update websites" ON public.websites FOR UPDATE TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner read website_pages" ON public.website_pages;
CREATE POLICY "owner read website_pages" ON public.website_pages FOR SELECT TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id));

DROP POLICY IF EXISTS "owner insert website_pages" ON public.website_pages;
CREATE POLICY "owner insert website_pages" ON public.website_pages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_owner_merchant_in_tenant(merchant_id, tenant_id)
    AND public.is_owner_website_in_tenant(website_id, tenant_id, merchant_id)
  );

DROP POLICY IF EXISTS "owner update website_pages" ON public.website_pages;
CREATE POLICY "owner update website_pages" ON public.website_pages FOR UPDATE TO authenticated
  USING (public.is_owner_merchant_in_tenant(merchant_id, tenant_id))
  WITH CHECK (
    public.is_owner_merchant_in_tenant(merchant_id, tenant_id)
    AND public.is_owner_website_in_tenant(website_id, tenant_id, merchant_id)
  );

-- -----------------------------------------------------------------
-- events (append-only for owners): the event tenant must be the tenant
-- of a merchant the caller actually owns. The caller cannot point a
-- crafted event at an unrelated tenant.
-- -----------------------------------------------------------------
DROP POLICY IF EXISTS "owner append events" ON public.events;
CREATE POLICY "owner append events" ON public.events FOR INSERT TO authenticated
  WITH CHECK (public.is_owner_of_tenant(tenant_id));