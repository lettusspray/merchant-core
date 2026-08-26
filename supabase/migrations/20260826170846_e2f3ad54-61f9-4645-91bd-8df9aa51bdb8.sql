-- ENUMS
CREATE TYPE public.tenant_role AS ENUM ('owner','admin','editor','viewer');
CREATE TYPE public.vertical AS ENUM ('restaurant','home_service','beauty','pet_service','automotive','local_retail','other');
CREATE TYPE public.merchant_status AS ENUM ('prospect','onboarding','active','paused','archived');
CREATE TYPE public.observation_status AS ENUM ('pending','accepted','rejected','superseded');
CREATE TYPE public.happening_kind AS ENUM ('event','promotion','announcement','menu_change','hours_change');
CREATE TYPE public.happening_status AS ENUM ('draft','in_review','approved','published','rejected');
CREATE TYPE public.connector_status AS ENUM ('not_configured','configured','syncing','error');
CREATE TYPE public.order_status AS ENUM ('pending','paid','fulfilled','cancelled','refunded');
CREATE TYPE public.subscription_status AS ENUM ('trialing','active','past_due','cancelled');
CREATE TYPE public.workflow_status AS ENUM ('queued','running','succeeded','failed');
CREATE TYPE public.discovery_status AS ENUM ('new','reviewing','claimed','dismissed');
CREATE TYPE public.publish_state AS ENUM ('draft','published','archived');

-- CORE
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.tenant_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_tenant_member(_tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id uuid, _roles public.tenant_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.memberships m WHERE m.tenant_id = _tenant_id AND m.user_id = auth.uid() AND m.role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- MERCHANT GRAPH
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  vertical public.vertical NOT NULL DEFAULT 'other',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
CREATE TABLE public.merchants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  vertical public.vertical NOT NULL DEFAULT 'other',
  status public.merchant_status NOT NULL DEFAULT 'onboarding',
  tagline text,
  description text,
  primary_category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  brand_color text,
  logo_url text,
  data_quality numeric(5,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);
CREATE TABLE public.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  label text NOT NULL,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postal_code text,
  country text DEFAULT 'US',
  latitude numeric(9,6),
  longitude numeric(9,6),
  phone text,
  timezone text DEFAULT 'America/New_York',
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.business_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at time,
  closes_at time,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_id, day_of_week)
);
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer,
  currency text NOT NULL DEFAULT 'USD',
  sku text,
  state public.publish_state NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer,
  duration_minutes integer,
  state public.publish_state NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  discount_label text,
  starts_at timestamptz,
  ends_at timestamptz,
  state public.publish_state NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.websites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  domain text NOT NULL,
  theme text NOT NULL DEFAULT 'classic',
  state public.publish_state NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  website_id uuid NOT NULL REFERENCES public.websites(id) ON DELETE CASCADE,
  path text NOT NULL,
  title text NOT NULL,
  body text,
  meta_description text,
  state public.publish_state NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (website_id, path)
);

-- SOURCES & PROVENANCE
CREATE TABLE public.source_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  name text NOT NULL,
  status public.connector_status NOT NULL DEFAULT 'not_configured',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  connector_id uuid NOT NULL REFERENCES public.source_connectors(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  field_path text NOT NULL,
  observed_value text,
  current_value text,
  confidence numeric(4,3) NOT NULL DEFAULT 0.5,
  status public.observation_status NOT NULL DEFAULT 'pending',
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- DISCOVERY
CREATE TABLE public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  vertical public.vertical NOT NULL DEFAULT 'other',
  city text,
  region text,
  website text,
  phone text,
  score numeric(5,2) NOT NULL DEFAULT 0,
  status public.discovery_status NOT NULL DEFAULT 'new',
  provider text NOT NULL DEFAULT 'mock_discovery',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- HAPPENINGS
CREATE TABLE public.happenings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  kind public.happening_kind NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text,
  status public.happening_status NOT NULL DEFAULT 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  published_at timestamptz,
  source_record_id uuid REFERENCES public.source_records(id) ON DELETE SET NULL,
  ai_confidence numeric(4,3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.happening_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  happening_id uuid NOT NULL REFERENCES public.happenings(id) ON DELETE CASCADE,
  reviewer_id uuid,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI VISIBILITY
CREATE TABLE public.visibility_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  intent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.visibility_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  query_id uuid REFERENCES public.visibility_queries(id) ON DELETE SET NULL,
  engine text NOT NULL,
  score numeric(5,2) NOT NULL DEFAULT 0,
  rank integer,
  mentioned boolean NOT NULL DEFAULT false,
  sentiment text,
  citations jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text NOT NULL DEFAULT 'mercercroft_mock',
  captured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- COMMERCE
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  reference text NOT NULL,
  customer_name text,
  customer_email text,
  status public.order_status NOT NULL DEFAULT 'pending',
  total_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL DEFAULT 'mock_payments',
  placed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  plan text NOT NULL,
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  price_cents integer NOT NULL DEFAULT 0,
  interval text NOT NULL DEFAULT 'month',
  current_period_end timestamptz,
  provider text NOT NULL DEFAULT 'mock_payments',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PLATFORM
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id uuid,
  actor_label text,
  kind text NOT NULL,
  subject_type text,
  subject_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workflow text NOT NULL,
  status public.workflow_status NOT NULL DEFAULT 'queued',
  engine text NOT NULL DEFAULT 'local',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  output jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  category text NOT NULL,
  mode text NOT NULL DEFAULT 'mock',
  status public.connector_status NOT NULL DEFAULT 'not_configured',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, provider)
);

-- INDEXES
CREATE INDEX ON public.merchants (tenant_id);
CREATE INDEX ON public.locations (merchant_id);
CREATE INDEX ON public.products (merchant_id);
CREATE INDEX ON public.services (merchant_id);
CREATE INDEX ON public.offers (merchant_id);
CREATE INDEX ON public.observations (merchant_id, status);
CREATE INDEX ON public.happenings (tenant_id, status);
CREATE INDEX ON public.visibility_snapshots (merchant_id, captured_at DESC);
CREATE INDEX ON public.events (tenant_id, created_at DESC);
CREATE INDEX ON public.orders (merchant_id, placed_at DESC);

-- GRANTS + RLS
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','profiles','memberships','categories','merchants','locations','business_hours','contacts','products','services','offers','websites','website_pages','source_connectors','source_records','observations','discovery_candidates','happenings','happening_reviews','visibility_queries','visibility_snapshots','orders','order_items','subscriptions','events','workflow_runs','integrations']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- updated_at triggers
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants','profiles','memberships','categories','merchants','locations','business_hours','contacts','products','services','offers','websites','website_pages','source_connectors','source_records','observations','discovery_candidates','happenings','visibility_queries','visibility_snapshots','orders','subscriptions','workflow_runs','integrations']
  LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;

-- tenant-scoped policies
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','merchants','locations','business_hours','contacts','products','services','offers','websites','website_pages','source_connectors','source_records','observations','discovery_candidates','happenings','happening_reviews','visibility_queries','visibility_snapshots','orders','order_items','subscriptions','workflow_runs','integrations']
  LOOP
    EXECUTE format('CREATE POLICY "members read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id))', t);
    EXECUTE format('CREATE POLICY "members write %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id))', t);
    EXECUTE format('CREATE POLICY "members update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_tenant_member(tenant_id)) WITH CHECK (public.is_tenant_member(tenant_id))', t);
    EXECUTE format('CREATE POLICY "members delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.is_tenant_member(tenant_id))', t);
  END LOOP;
END $$;

CREATE POLICY "members read tenants" ON public.tenants FOR SELECT TO authenticated USING (public.is_tenant_member(id));
CREATE POLICY "owners update tenants" ON public.tenants FOR UPDATE TO authenticated USING (public.has_tenant_role(id, ARRAY['owner','admin']::public.tenant_role[])) WITH CHECK (public.has_tenant_role(id, ARRAY['owner','admin']::public.tenant_role[]));
CREATE POLICY "members read memberships" ON public.memberships FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "admins manage memberships" ON public.memberships FOR ALL TO authenticated USING (public.has_tenant_role(tenant_id, ARRAY['owner','admin']::public.tenant_role[])) WITH CHECK (public.has_tenant_role(tenant_id, ARRAY['owner','admin']::public.tenant_role[]));
CREATE POLICY "read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- events: append-only
CREATE POLICY "members read events" ON public.events FOR SELECT TO authenticated USING (public.is_tenant_member(tenant_id));
CREATE POLICY "members append events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_tenant_member(tenant_id));

-- new users join demo workspace
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.memberships (tenant_id, user_id, role)
  VALUES ('00000000-0000-0000-0000-0000000000d1', NEW.id, 'owner')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SEED ============
INSERT INTO public.tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-0000000000d1','Merchant Core Demo','demo');

INSERT INTO public.categories (id, tenant_id, name, slug, vertical) VALUES
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000d1','Restaurants','restaurants','restaurant'),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000d1','Home Services','home-services','home_service'),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000d1','Beauty & Wellness','beauty-wellness','beauty'),
  ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000d1','Pet Services','pet-services','pet_service'),
  ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000d1','Automotive','automotive','automotive'),
  ('00000000-0000-0000-0000-0000000000c6','00000000-0000-0000-0000-0000000000d1','Local Retail','local-retail','local_retail');

INSERT INTO public.merchants (id, tenant_id, name, slug, vertical, status, tagline, description, primary_category_id, brand_color, data_quality) VALUES
  ('00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','Bella Nonna Trattoria','bella-nonna','restaurant','active','Handmade pasta, Portland roots','Family-run trattoria serving Northern Italian classics with Oregon produce.','00000000-0000-0000-0000-0000000000c1','#8c2f1f',92.5),
  ('00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000d1','Summit Home Services','summit-home','home_service','active','HVAC, plumbing and electrical','Full-service residential trades company covering the Denver metro area.','00000000-0000-0000-0000-0000000000c2','#1f4f8c',78.0),
  ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000d1','Lumen Beauty Studio','lumen-beauty','beauty','active','Colour, cuts and skin','Boutique salon and skincare studio in East Austin.','00000000-0000-0000-0000-0000000000c3','#a4507d',85.0),
  ('00000000-0000-0000-0000-0000000000a4','00000000-0000-0000-0000-0000000000d1','Happy Tails Pet Care','happy-tails','pet_service','onboarding','Daycare, grooming, boarding','Neighbourhood pet care with webcam daycare and certified groomers.','00000000-0000-0000-0000-0000000000c4','#2f7d5f',61.0),
  ('00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-0000000000d1','Redline Auto Works','redline-auto','automotive','active','Independent European specialists','Diagnostics, maintenance and performance work for European vehicles.','00000000-0000-0000-0000-0000000000c5','#b03030',74.5),
  ('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000d1','Northfield General Store','northfield-general','local_retail','paused','Pantry, gifts and goods','Independent general store stocking Vermont makers and pantry staples.','00000000-0000-0000-0000-0000000000c6','#4a5a3a',55.0);

INSERT INTO public.locations (id, tenant_id, merchant_id, label, address_line1, city, region, postal_code, latitude, longitude, phone, timezone, is_primary) VALUES
  ('00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Alberta Arts','2418 NE Alberta St','Portland','OR','97211',45.559000,-122.643000,'+1-503-555-0114','America/Los_Angeles',true),
  ('00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Denver Yard','1180 S Broadway','Denver','CO','80210',39.688000,-104.987000,'+1-303-555-0192','America/Denver',true),
  ('00000000-0000-0000-0000-0000000000b3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','East Austin','1105 E 6th St','Austin','TX','78702',30.267000,-97.727000,'+1-512-555-0143','America/Chicago',true),
  ('00000000-0000-0000-0000-0000000000b4','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Ballard','5412 Leary Ave NW','Seattle','WA','98107',47.665000,-122.382000,'+1-206-555-0177','America/Los_Angeles',true),
  ('00000000-0000-0000-0000-0000000000b5','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','Midtown Phoenix','3402 N 7th Ave','Phoenix','AZ','85013',33.487000,-112.083000,'+1-602-555-0158','America/Phoenix',true),
  ('00000000-0000-0000-0000-0000000000b6','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','Church Street','88 Church St','Burlington','VT','05401',44.477000,-73.212000,'+1-802-555-0136','America/New_York',true);

INSERT INTO public.business_hours (tenant_id, location_id, day_of_week, opens_at, closes_at, is_closed)
SELECT l.tenant_id, l.id, d,
       CASE WHEN d = 0 THEN '10:00'::time ELSE '09:00'::time END,
       CASE WHEN d IN (5,6) THEN '22:00'::time ELSE '18:00'::time END,
       (d = 1)
FROM public.locations l CROSS JOIN generate_series(0,6) AS d;

INSERT INTO public.contacts (tenant_id, merchant_id, kind, label, value)
SELECT m.tenant_id, m.id, 'email', 'General enquiries', m.slug || '@example.com' FROM public.merchants m
UNION ALL
SELECT l.tenant_id, l.merchant_id, 'phone', 'Main line', l.phone FROM public.locations l;

INSERT INTO public.products (tenant_id, merchant_id, name, description, price_cents, sku) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Tagliatelle al Ragù','Slow-braised beef and pork ragù with hand-cut tagliatelle.',2400,'BN-PASTA-01'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Burrata & Peaches','Oregon peaches, burrata, basil oil, sourdough toast.',1600,'BN-ANTI-02'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Tiramisù','Espresso-soaked savoiardi, mascarpone cream.',1100,'BN-DOLCE-03'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','Vermont Maple Syrup 500ml','Grade A amber syrup from a Franklin County sugarhouse.',1800,'NG-PANTRY-01'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','Stoneware Mug','Hand-thrown mug from a Burlington ceramicist.',3200,'NG-GIFT-02'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','Cheddar Sampler Box','Four Vermont cheddars, aged 1 to 5 years.',4200,'NG-FOOD-03'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','Bond-Building Treatment','Take-home bond repair kit.',4800,'LB-RETAIL-01'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Grain-Free Training Treats','Single-ingredient treats, 12oz bag.',1400,'HT-RETAIL-01');

INSERT INTO public.services (tenant_id, merchant_id, name, description, price_cents, duration_minutes) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Furnace Tune-Up','23-point inspection and filter replacement.',14900,90),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Drain Clearing','Camera inspection plus mechanical clearing.',22500,120),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Panel Upgrade Estimate','On-site electrical load assessment.',0,60),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','Balayage','Freehand colour with gloss and blow-dry.',26000,180),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','Signature Facial','Deep-cleanse facial with enzyme peel.',13500,75),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Full-Day Daycare','Supervised play with webcam access.',5500,480),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Full Groom','Bath, cut, nails and ears.',8500,120),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','Diagnostic Scan','Factory-level fault diagnosis.',18000,60),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','Major Service','Fluids, filters and full inspection.',89000,300),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Private Dining Buyout','Back room for up to 24 guests.',150000,240);

INSERT INTO public.offers (tenant_id, merchant_id, title, description, discount_label, starts_at, ends_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Pasta Wednesdays','Half-price primi all evening.','50% off', now() - interval '10 days', now() + interval '40 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Pre-Season Furnace Check','Book before October and save.','$40 off', now() - interval '5 days', now() + interval '25 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','New Guest Colour','First balayage appointment discount.','20% off', now() - interval '30 days', now() + interval '60 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Daycare 10-Pack','Bundle of ten full days.','Save $60', now() - interval '2 days', now() + interval '90 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','Summer AC Service','Refrigerant check included.','$25 off', now() - interval '20 days', now() + interval '10 days');

INSERT INTO public.websites (id, tenant_id, merchant_id, domain, theme) VALUES
  ('00000000-0000-0000-0000-0000000000e1','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','bellanonna.example.com','editorial'),
  ('00000000-0000-0000-0000-0000000000e2','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','summithome.example.com','trades'),
  ('00000000-0000-0000-0000-0000000000e3','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','lumenbeauty.example.com','studio'),
  ('00000000-0000-0000-0000-0000000000e4','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','happytails.example.com','playful'),
  ('00000000-0000-0000-0000-0000000000e5','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','redlineauto.example.com','garage'),
  ('00000000-0000-0000-0000-0000000000e6','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','northfieldgeneral.example.com','classic');

INSERT INTO public.website_pages (tenant_id, website_id, path, title, body, meta_description, state)
SELECT w.tenant_id, w.id, '/', m.name, m.description, m.tagline, 'published'::public.publish_state
FROM public.websites w JOIN public.merchants m ON m.id = w.merchant_id
UNION ALL
SELECT w.tenant_id, w.id, '/about', 'About ' || m.name, 'Our story, our team, and how to reach us.', 'About ' || m.name, 'published'::public.publish_state
FROM public.websites w JOIN public.merchants m ON m.id = w.merchant_id
UNION ALL
SELECT w.tenant_id, w.id, '/contact', 'Contact', 'Call, email, or visit us in person.', 'Contact ' || m.name, 'draft'::public.publish_state
FROM public.websites w JOIN public.merchants m ON m.id = w.merchant_id;

INSERT INTO public.source_connectors (id, tenant_id, provider, name, status, config, last_synced_at) VALUES
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000d1','mock_directory','Local Directory Crawl','configured','{"region":"US","cadence":"daily"}', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000d1','mock_social','Social Posts Watcher','configured','{"networks":["instagram","facebook"]}', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000d1','mock_website','Merchant Site Crawler','configured','{"depth":2}', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-0000000000f4','00000000-0000-0000-0000-0000000000d1','google_business_profile','Google Business Profile','not_configured','{}', NULL);

INSERT INTO public.source_records (id, tenant_id, connector_id, merchant_id, external_id, payload, fetched_at) VALUES
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','dir-bella-1','{"hours":"Mon closed, Tue-Sun 17:00-22:00","phone":"+1-503-555-0114"}', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','post-bella-88','{"caption":"Truffle tasting menu returns Friday, 6 seats only."}', now() - interval '40 minutes'),
  ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a2','dir-summit-4','{"phone":"+1-303-555-0192","service_area":"Denver metro + Boulder"}', now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000104','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a3','post-lumen-12','{"caption":"Bond-building treatment now included with all colour services."}', now() - interval '5 hours'),
  ('00000000-0000-0000-0000-000000000105','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a5','crawl-redline-1','{"title":"Redline Auto Works | European Specialists","h1":"Independent European service"}', now() - interval '9 hours'),
  ('00000000-0000-0000-0000-000000000106','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a6','post-northfield-3','{"caption":"Closed for inventory the first week of September."}', now() - interval '1 day');

INSERT INTO public.observations (tenant_id, merchant_id, source_record_id, field_path, observed_value, current_value, confidence, status) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','locations.0.phone','+1-503-555-0114','+1-503-555-0114',0.980,'accepted'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000101','hours.monday','closed','09:00-18:00',0.870,'pending'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000103','service_area','Denver metro + Boulder','Denver metro',0.720,'pending'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000104','services.balayage.description','Includes bond-building treatment','Freehand colour with gloss and blow-dry.',0.640,'pending'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-000000000105','tagline','Independent European service','Independent European specialists',0.550,'rejected'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-000000000106','status','temporarily_closed','paused',0.480,'pending');

INSERT INTO public.discovery_candidates (tenant_id, name, vertical, city, region, website, phone, score, status, payload) VALUES
  ('00000000-0000-0000-0000-0000000000d1','Ridgeline Coffee Roasters','restaurant','Portland','OR','ridgelinecoffee.example.com','+1-503-555-0201',88.5,'new','{"signals":["high review velocity","no structured hours"]}'),
  ('00000000-0000-0000-0000-0000000000d1','Front Range Gutter Co','home_service','Boulder','CO','frontrangegutter.example.com','+1-303-555-0233',76.0,'reviewing','{"signals":["service area overlap"]}'),
  ('00000000-0000-0000-0000-0000000000d1','Marigold Nail Bar','beauty','Austin','TX',NULL,'+1-512-555-0288',69.5,'new','{"signals":["no website detected"]}'),
  ('00000000-0000-0000-0000-0000000000d1','Puget Paws Walking','pet_service','Seattle','WA','pugetpaws.example.com',NULL,64.0,'new','{"signals":["social-only presence"]}'),
  ('00000000-0000-0000-0000-0000000000d1','Desert Tire & Alignment','automotive','Phoenix','AZ','deserttire.example.com','+1-602-555-0219',71.5,'dismissed','{"signals":["franchise-owned"]}'),
  ('00000000-0000-0000-0000-0000000000d1','Green Mountain Bookshop','local_retail','Burlington','VT','gmbooks.example.com','+1-802-555-0277',58.0,'new','{"signals":["stale hours"]}');

INSERT INTO public.happenings (id, tenant_id, merchant_id, kind, title, body, status, starts_at, ends_at, published_at, source_record_id, ai_confidence) VALUES
  ('00000000-0000-0000-0000-000000000111','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','event','Truffle Tasting Menu','Six-course truffle menu returning Friday. Limited to six seats per service.','in_review', now() + interval '3 days', now() + interval '10 days', NULL,'00000000-0000-0000-0000-000000000102',0.910),
  ('00000000-0000-0000-0000-000000000112','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','promotion','Pasta Wednesdays','Half-price primi every Wednesday evening.','published', now() - interval '10 days', now() + interval '40 days', now() - interval '10 days', NULL,NULL),
  ('00000000-0000-0000-0000-000000000113','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','announcement','Now serving Boulder','Service area extended to Boulder and Louisville.','draft', now(), NULL, NULL,'00000000-0000-0000-0000-000000000103',0.720),
  ('00000000-0000-0000-0000-000000000114','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','menu_change','Bond treatment included','All colour services now include a bond-building treatment.','in_review', now(), NULL, NULL,'00000000-0000-0000-0000-000000000104',0.640),
  ('00000000-0000-0000-0000-000000000115','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','announcement','Webcam daycare live','Guardians can now watch daycare rooms from any browser.','approved', now() - interval '1 day', NULL, NULL,NULL,NULL),
  ('00000000-0000-0000-0000-000000000116','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','promotion','Summer AC Service','Refrigerant check included with any AC service this month.','published', now() - interval '20 days', now() + interval '10 days', now() - interval '20 days',NULL,NULL),
  ('00000000-0000-0000-0000-000000000117','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','hours_change','Closed for inventory','Store closed the first week of September for annual inventory.','in_review', now() + interval '7 days', now() + interval '14 days', NULL,'00000000-0000-0000-0000-000000000106',0.830),
  ('00000000-0000-0000-0000-000000000118','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','announcement','Unverified relocation rumour','Third-party post claimed a move to Winooski. Could not be confirmed.','rejected', NULL, NULL, NULL,NULL,0.310);

INSERT INTO public.happening_reviews (tenant_id, happening_id, action, notes) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000112','published','Verified against merchant calendar.'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000115','approved','Awaiting scheduled publish window.'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000118','rejected','No corroborating source; low confidence.');

INSERT INTO public.visibility_queries (id, tenant_id, merchant_id, prompt, intent) VALUES
  ('00000000-0000-0000-0000-000000000121','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','best handmade pasta in Portland','discovery'),
  ('00000000-0000-0000-0000-000000000122','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','emergency furnace repair Denver','urgent_service'),
  ('00000000-0000-0000-0000-000000000123','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','balayage specialist east Austin','discovery'),
  ('00000000-0000-0000-0000-000000000124','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','independent BMW mechanic Phoenix','comparison');

INSERT INTO public.visibility_snapshots (tenant_id, merchant_id, query_id, engine, score, rank, mentioned, sentiment, citations, captured_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','chatgpt',81.5,2,true,'positive','[{"url":"https://bellanonna.example.com","title":"Bella Nonna Trattoria"}]', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','perplexity',74.0,4,true,'positive','[{"url":"https://directory.example.com/bella-nonna","title":"Directory listing"}]', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-000000000121','gemini',68.0,6,true,'neutral','[]', now() - interval '8 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000122','chatgpt',56.5,7,true,'neutral','[{"url":"https://summithome.example.com","title":"Summit Home Services"}]', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-000000000122','perplexity',44.0,NULL,false,NULL,'[]', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000123','chatgpt',88.0,1,true,'positive','[{"url":"https://lumenbeauty.example.com","title":"Lumen Beauty Studio"}]', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-000000000123','gemini',79.5,3,true,'positive','[]', now() - interval '6 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-000000000124','chatgpt',62.0,5,true,'neutral','[{"url":"https://redlineauto.example.com","title":"Redline Auto Works"}]', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','00000000-0000-0000-0000-000000000124','perplexity',58.5,8,true,'neutral','[]', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4',NULL,'chatgpt',31.0,NULL,false,NULL,'[]', now() - interval '4 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6',NULL,'chatgpt',24.5,NULL,false,NULL,'[]', now() - interval '5 days');

INSERT INTO public.orders (id, tenant_id, merchant_id, reference, customer_name, customer_email, status, total_cents, placed_at) VALUES
  ('00000000-0000-0000-0000-000000000131','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','BN-1042','Dana Whitfield','dana@example.com','paid',5100, now() - interval '2 days'),
  ('00000000-0000-0000-0000-000000000132','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','NG-2210','Owen Pratt','owen@example.com','fulfilled',7400, now() - interval '6 days'),
  ('00000000-0000-0000-0000-000000000133','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','LB-0318','Priya Raman','priya@example.com','pending',4800, now() - interval '4 hours'),
  ('00000000-0000-0000-0000-000000000134','00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','HT-0091','Marcus Lee','marcus@example.com','refunded',1400, now() - interval '12 days');

INSERT INTO public.order_items (tenant_id, order_id, description, quantity, unit_price_cents) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000131','Tagliatelle al Ragù',2,2400),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000131','Tiramisù',1,1100),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000132','Cheddar Sampler Box',1,4200),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000132','Stoneware Mug',1,3200),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000133','Bond-Building Treatment',1,4800),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-000000000134','Grain-Free Training Treats',1,1400);

INSERT INTO public.subscriptions (tenant_id, merchant_id, plan, status, price_cents, current_period_end) VALUES
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','Growth','active',19900, now() + interval '18 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a2','Growth','active',19900, now() + interval '4 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a3','Scale','active',49900, now() + interval '25 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a4','Starter','trialing',0, now() + interval '9 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a5','Growth','past_due',19900, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a6','Starter','cancelled',4900, now() - interval '30 days');

INSERT INTO public.workflow_runs (tenant_id, workflow, status, engine, input, output, steps, started_at, finished_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1','merchant.onboard','succeeded','local','{"merchant":"bella-nonna"}','{"created":true}','[{"name":"validate","status":"succeeded"},{"name":"enrich","status":"succeeded"},{"name":"publish","status":"succeeded"}]', now() - interval '9 days', now() - interval '9 days' + interval '42 seconds'),
  ('00000000-0000-0000-0000-0000000000d1','sources.sync','succeeded','local','{"connector":"mock_directory"}','{"records":18}','[{"name":"fetch","status":"succeeded"},{"name":"diff","status":"succeeded"}]', now() - interval '3 hours', now() - interval '3 hours' + interval '18 seconds'),
  ('00000000-0000-0000-0000-0000000000d1','visibility.sweep','succeeded','local','{"engines":["chatgpt","perplexity"]}','{"snapshots":9}','[{"name":"query","status":"succeeded"},{"name":"score","status":"succeeded"}]', now() - interval '1 day', now() - interval '1 day' + interval '96 seconds'),
  ('00000000-0000-0000-0000-0000000000d1','happenings.publish','failed','local','{"happening":"unverified relocation"}',NULL,'[{"name":"verify","status":"failed","error":"insufficient corroboration"}]', now() - interval '2 days', now() - interval '2 days' + interval '5 seconds');

INSERT INTO public.integrations (tenant_id, provider, category, mode, status, config) VALUES
  ('00000000-0000-0000-0000-0000000000d1','mercercroft','ai_visibility','mock','configured','{"base_url":"/api/v1/visibility","note":"MercerCroft-compatible mock adapter"}'),
  ('00000000-0000-0000-0000-0000000000d1','lovable_ai','ai','mock','configured','{"models":["google/gemini-2.5-flash"]}'),
  ('00000000-0000-0000-0000-0000000000d1','stripe','payments','mock','not_configured','{}'),
  ('00000000-0000-0000-0000-0000000000d1','temporal','workflow','mock','not_configured','{"fallback":"local executor"}'),
  ('00000000-0000-0000-0000-0000000000d1','google_business_profile','sources','mock','not_configured','{}'),
  ('00000000-0000-0000-0000-0000000000d1','resend','email','mock','not_configured','{}');

INSERT INTO public.events (tenant_id, actor_label, kind, subject_type, subject_id, payload, created_at) VALUES
  ('00000000-0000-0000-0000-0000000000d1','system','merchant.created','merchant','00000000-0000-0000-0000-0000000000a1','{"source":"seed"}', now() - interval '9 days'),
  ('00000000-0000-0000-0000-0000000000d1','system','sources.synced','source_connector','00000000-0000-0000-0000-0000000000f1','{"records":18}', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000d1','system','observation.accepted','observation',NULL,'{"field":"locations.0.phone"}', now() - interval '3 hours'),
  ('00000000-0000-0000-0000-0000000000d1','system','happening.published','happening','00000000-0000-0000-0000-000000000112','{"channel":"website"}', now() - interval '10 days'),
  ('00000000-0000-0000-0000-0000000000d1','system','visibility.snapshot','merchant','00000000-0000-0000-0000-0000000000a3','{"engine":"chatgpt","score":88}', now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000d1','system','workflow.failed','workflow_run',NULL,'{"workflow":"happenings.publish"}', now() - interval '2 days');