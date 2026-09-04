-- =============== WEBSITE FACTORY ===============
ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS nav jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_generated_at timestamptz;

UPDATE public.websites w SET slug = m.slug FROM public.merchants m WHERE m.id = w.merchant_id AND w.slug IS NULL;
UPDATE public.websites SET published_at = COALESCE(published_at, now()), published_version = GREATEST(published_version, 1) WHERE state = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS websites_tenant_slug_key ON public.websites (tenant_id, slug);
CREATE INDEX IF NOT EXISTS websites_merchant_idx ON public.websites (merchant_id);

ALTER TABLE public.website_pages
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS generated boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.website_pages p SET merchant_id = w.merchant_id FROM public.websites w WHERE w.id = p.website_id AND p.merchant_id IS NULL;
UPDATE public.website_pages SET published_at = COALESCE(published_at, now()) WHERE state = 'published';
UPDATE public.website_pages SET kind = CASE WHEN path = '/' THEN 'home' WHEN path LIKE '/about%' THEN 'about' WHEN path LIKE '/contact%' THEN 'contact' WHEN path LIKE '/menu%' OR path LIKE '/products%' THEN 'catalog' WHEN path LIKE '/services%' THEN 'services' WHEN path LIKE '/offers%' THEN 'offers' WHEN path LIKE '/faq%' THEN 'faq' WHEN path LIKE '/updates%' THEN 'updates' ELSE 'custom' END WHERE kind = 'custom';
CREATE UNIQUE INDEX IF NOT EXISTS website_pages_site_path_key ON public.website_pages (website_id, path);

CREATE TABLE IF NOT EXISTS public.website_page_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES public.website_pages(id) ON DELETE CASCADE,
  version integer NOT NULL,
  title text NOT NULL,
  body text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  meta_description text,
  generated boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_page_versions TO authenticated;
GRANT ALL ON public.website_page_versions TO service_role;
ALTER TABLE public.website_page_versions ENABLE ROW LEVEL SECURITY;

-- =============== DISCOVERY ===============
CREATE TABLE IF NOT EXISTS public.discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  query text NOT NULL,
  vertical public.vertical,
  city text,
  status public.workflow_status NOT NULL DEFAULT 'queued',
  requested_by uuid,
  found_count integer NOT NULL DEFAULT 0,
  created_count integer NOT NULL DEFAULT 0,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_jobs TO authenticated;
GRANT ALL ON public.discovery_jobs TO service_role;
ALTER TABLE public.discovery_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.discovery_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS observed_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS dedupe_key text;

UPDATE public.discovery_candidates SET dedupe_key = lower(regexp_replace(name || '|' || COALESCE(city,''), '[^a-z0-9|]+', '-', 'gi')) WHERE dedupe_key IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS discovery_candidates_dedupe_key ON public.discovery_candidates (tenant_id, dedupe_key);

-- =============== AI VISIBILITY ===============
CREATE TABLE IF NOT EXISTS public.visibility_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  mode text NOT NULL DEFAULT 'mock',
  status public.workflow_status NOT NULL DEFAULT 'queued',
  idempotency_key text,
  external_id text,
  engines jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  cost_usd numeric,
  system_version text,
  error text,
  raw jsonb,
  requested_by uuid,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.visibility_runs TO authenticated;
GRANT ALL ON public.visibility_runs TO service_role;
ALTER TABLE public.visibility_runs ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS visibility_runs_idem_key ON public.visibility_runs (tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.visibility_snapshots
  ADD COLUMN IF NOT EXISTS run_id uuid REFERENCES public.visibility_runs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS answer_excerpt text,
  ADD COLUMN IF NOT EXISTS recommended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS factual_accuracy numeric,
  ADD COLUMN IF NOT EXISTS mentioned_entities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cost_usd numeric,
  ADD COLUMN IF NOT EXISTS raw jsonb;

-- =============== COMMERCE ===============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS commission_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS payout_reference text,
  ADD COLUMN IF NOT EXISTS refunded_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispute_status text,
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_reference_key ON public.orders (tenant_id, reference);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_reference text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS reconciled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  external_id text NOT NULL,
  event_type text,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'received',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, external_id)
);
GRANT ALL ON public.webhook_events TO service_role;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- =============== HAPPENINGS / EVIDENCE ===============
ALTER TABLE public.happenings
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_observed_at timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_excerpt text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'operator',
  ADD COLUMN IF NOT EXISTS ai_provider text,
  ADD COLUMN IF NOT EXISTS ai_model text;

-- =============== ASSETS ===============
CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'image',
  storage_provider text NOT NULL DEFAULT 's3',
  storage_key text NOT NULL,
  public_url text,
  content_type text,
  byte_size integer,
  alt_text text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- =============== LEARNING ===============
CREATE TABLE IF NOT EXISTS public.value_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  stage text NOT NULL,
  signal text NOT NULL,
  value_cents integer,
  confidence numeric,
  decided_at timestamptz NOT NULL DEFAULT now(),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.value_signals TO authenticated;
GRANT ALL ON public.value_signals TO service_role;
ALTER TABLE public.value_signals ENABLE ROW LEVEL SECURITY;

-- =============== POLICIES (tenant-scoped, idempotent) ===============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['website_page_versions','discovery_jobs','visibility_runs','assets']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_member_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id))', t || '_member_all', t);
  END LOOP;

  DROP POLICY IF EXISTS value_signals_member_select ON public.value_signals;
  CREATE POLICY value_signals_member_select ON public.value_signals FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
  DROP POLICY IF EXISTS value_signals_member_insert ON public.value_signals;
  CREATE POLICY value_signals_member_insert ON public.value_signals FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));
END $$;

-- =============== PUBLIC (anon) READ: published sites only ===============
GRANT SELECT ON public.websites, public.website_pages, public.merchants, public.locations, public.business_hours, public.products, public.services, public.offers, public.happenings, public.categories TO anon;

DROP POLICY IF EXISTS websites_public_read ON public.websites;
CREATE POLICY websites_public_read ON public.websites FOR SELECT TO anon USING (state = 'published');

DROP POLICY IF EXISTS website_pages_public_read ON public.website_pages;
CREATE POLICY website_pages_public_read ON public.website_pages FOR SELECT TO anon
  USING (state = 'published' AND EXISTS (SELECT 1 FROM public.websites w WHERE w.id = website_id AND w.state = 'published'));

DROP POLICY IF EXISTS merchants_public_read ON public.merchants;
CREATE POLICY merchants_public_read ON public.merchants FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = id AND w.state = 'published'));

DROP POLICY IF EXISTS locations_public_read ON public.locations;
CREATE POLICY locations_public_read ON public.locations FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = merchant_id AND w.state = 'published'));

DROP POLICY IF EXISTS business_hours_public_read ON public.business_hours;
CREATE POLICY business_hours_public_read ON public.business_hours FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.locations l JOIN public.websites w ON w.merchant_id = l.merchant_id WHERE l.id = location_id AND w.state = 'published'));

DROP POLICY IF EXISTS products_public_read ON public.products;
CREATE POLICY products_public_read ON public.products FOR SELECT TO anon
  USING (state = 'published' AND EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = merchant_id AND w.state = 'published'));

DROP POLICY IF EXISTS services_public_read ON public.services;
CREATE POLICY services_public_read ON public.services FOR SELECT TO anon
  USING (state = 'published' AND EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = merchant_id AND w.state = 'published'));

DROP POLICY IF EXISTS offers_public_read ON public.offers;
CREATE POLICY offers_public_read ON public.offers FOR SELECT TO anon
  USING (state = 'published' AND EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = merchant_id AND w.state = 'published'));

DROP POLICY IF EXISTS happenings_public_read ON public.happenings;
CREATE POLICY happenings_public_read ON public.happenings FOR SELECT TO anon
  USING (status = 'published' AND EXISTS (SELECT 1 FROM public.websites w WHERE w.merchant_id = merchant_id AND w.state = 'published'));

DROP POLICY IF EXISTS categories_public_read ON public.categories;
CREATE POLICY categories_public_read ON public.categories FOR SELECT TO anon USING (true);

-- =============== TRIGGERS ===============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['discovery_jobs','visibility_runs','assets']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;