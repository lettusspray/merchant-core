-- =============================================================
-- Website Factory v0: explicit revision lifecycle
--
-- Makes homepage revisions authoritative and trustworthy:
--   * website_pages  = the current (latest) working revision.
--   * website_page_versions = immutable history of every revision.
--   * websites.published_version = the exact revision that is live.
--
-- The public renderer serves the persisted revision (version record)
-- identified by websites.published_version — never live merchant graph
-- data and never the un-published draft on the website_pages row.
--
-- Changes here:
--   * website_page_versions gains website_id (direct lookups by site +
--     published version) and locked (per-revision manual lock marker).
--   * Every existing website_pages row is backfilled as its own version
--     record so no published website loses its history.
--   * website_page_versions becomes a true immutable history: content is
--     frozen by trigger (only the `locked` flag may be toggled; DELETE is
--     rejected).
--   * RLS: anon may read exactly the published revision of a published
--     website (never drafts); owners get read/insert/update scoped to the
--     owned merchant's website pages.
-- =============================================================

-- -----------------------------------------------------------------
-- website_id on the version record
-- -----------------------------------------------------------------
ALTER TABLE public.website_page_versions
  ADD COLUMN IF NOT EXISTS website_id uuid REFERENCES public.websites(id) ON DELETE CASCADE;

UPDATE public.website_page_versions v
SET website_id = p.website_id
FROM public.website_pages p
WHERE p.id = v.page_id AND v.website_id IS NULL;

ALTER TABLE public.website_page_versions ALTER COLUMN website_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS website_page_versions_site_version_idx
  ON public.website_page_versions (website_id, version);

-- -----------------------------------------------------------------
-- locked: a revision is locked only when an operator says so
-- -----------------------------------------------------------------
ALTER TABLE public.website_page_versions
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

UPDATE public.website_page_versions v SET locked = p.locked
FROM public.website_pages p
WHERE p.id = v.page_id AND p.version = v.version;

-- -----------------------------------------------------------------
-- Backfill: legacy website_pages rows (created before the version table
-- was written) become immutable version records. This guarantees every
-- published website has a persisted revision the public route can serve.
-- -----------------------------------------------------------------
INSERT INTO public.website_page_versions
  (tenant_id, website_id, page_id, version, title, body, blocks, seo_title,
   meta_description, generated, created_by, created_at)
SELECT p.tenant_id, p.website_id, p.id, p.version, p.title, p.body, p.blocks,
       p.seo_title, p.meta_description, p.generated, NULL, p.updated_at
FROM public.website_pages p
WHERE NOT EXISTS (
  SELECT 1 FROM public.website_page_versions v
  WHERE v.page_id = p.id AND v.version = p.version
);

UPDATE public.website_page_versions v SET locked = p.locked
FROM public.website_pages p
WHERE p.id = v.page_id AND p.version = v.version AND v.locked IS DISTINCT FROM p.locked;

-- -----------------------------------------------------------------
-- Immutable history enforced in the database. Only the `locked` marker
-- of a version may ever change; the persisted representation is frozen
-- for the lifetime of the record and DELETE is rejected outright.
-- -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_website_page_version() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'website_page_versions is an immutable history and cannot be deleted';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.website_id IS DISTINCT FROM OLD.website_id
     OR NEW.page_id IS DISTINCT FROM OLD.page_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.blocks IS DISTINCT FROM OLD.blocks
     OR NEW.seo_title IS DISTINCT FROM OLD.seo_title
     OR NEW.meta_description IS DISTINCT FROM OLD.meta_description
     OR NEW.generated IS DISTINCT FROM OLD.generated
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'website_page_versions is immutable; only the locked flag may be toggled';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_website_page_version() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS website_page_versions_immutable ON public.website_page_versions;
CREATE TRIGGER website_page_versions_immutable
BEFORE UPDATE OR DELETE ON public.website_page_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_website_page_version();

-- -----------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------
-- Owners (merchant portal) read and append the version history of pages
-- that belong to a merchant they own in the same tenant. Members keep the
-- existing tenant-scoped "member all" policy from the factory migration.
DROP POLICY IF EXISTS "owner read website_page_versions" ON public.website_page_versions;
CREATE POLICY "owner read website_page_versions" ON public.website_page_versions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.website_pages p
      JOIN public.websites w ON w.id = p.website_id
      WHERE p.id = website_page_versions.page_id
        AND public.is_owner_merchant_in_tenant(w.merchant_id, website_page_versions.tenant_id)
    )
  );

DROP POLICY IF EXISTS "owner insert website_page_versions" ON public.website_page_versions;
CREATE POLICY "owner insert website_page_versions" ON public.website_page_versions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.website_pages p
      JOIN public.websites w ON w.id = p.website_id
      WHERE p.id = website_page_versions.page_id
        AND public.is_owner_merchant_in_tenant(w.merchant_id, website_page_versions.tenant_id)
    )
  );

DROP POLICY IF EXISTS "owner update website_page_versions" ON public.website_page_versions;
CREATE POLICY "owner update website_page_versions" ON public.website_page_versions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.website_pages p
      JOIN public.websites w ON w.id = p.website_id
      WHERE p.id = website_page_versions.page_id
        AND public.is_owner_merchant_in_tenant(w.merchant_id, website_page_versions.tenant_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.website_pages p
      JOIN public.websites w ON w.id = p.website_id
      WHERE p.id = website_page_versions.page_id
        AND public.is_owner_merchant_in_tenant(w.merchant_id, website_page_versions.tenant_id)
    )
  );

-- Public (anon): read exactly the published revision of a published
-- website. A version record is visible only when the site's published
-- version equals this record's version — drafts are never exposed.
GRANT SELECT ON public.website_page_versions TO anon;

DROP POLICY IF EXISTS website_page_versions_public_read ON public.website_page_versions;
CREATE POLICY website_page_versions_public_read ON public.website_page_versions FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.websites w
      WHERE w.id = website_page_versions.website_id
        AND w.state = 'published'
        AND w.published_version = website_page_versions.version
    )
  );