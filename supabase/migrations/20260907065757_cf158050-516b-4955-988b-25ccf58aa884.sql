-- Discovery sources / connectors ------------------------------------------
ALTER TABLE public.source_connectors
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'discovery',
  ADD COLUMN IF NOT EXISTS last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_failure_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS records_received integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS records_ingested integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS source_connectors_tenant_provider_key
  ON public.source_connectors (tenant_id, provider);

-- Discovery jobs -----------------------------------------------------------
ALTER TABLE public.discovery_jobs
  ADD COLUMN IF NOT EXISTS connector_id uuid REFERENCES public.source_connectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS received_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduped_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS discovery_jobs_tenant_started_idx
  ON public.discovery_jobs (tenant_id, started_at DESC);

-- Discovery candidates -----------------------------------------------------
ALTER TABLE public.discovery_candidates
  ADD COLUMN IF NOT EXISTS connector_id uuid REFERENCES public.source_connectors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS category_label text,
  ADD COLUMN IF NOT EXISTS normalized jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_components jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_refreshed_at timestamptz,
  ADD COLUMN IF NOT EXISTS refresh_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS match_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS discovery_candidates_tenant_dedupe_key
  ON public.discovery_candidates (tenant_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_candidates_tenant_domain_idx
  ON public.discovery_candidates (tenant_id, domain) WHERE domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_candidates_tenant_phone_idx
  ON public.discovery_candidates (tenant_id, phone_e164) WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_candidates_tenant_external_idx
  ON public.discovery_candidates (tenant_id, provider, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS discovery_candidates_tenant_score_idx
  ON public.discovery_candidates (tenant_id, score DESC);

-- Source records -----------------------------------------------------------
ALTER TABLE public.source_records
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'discovery';

CREATE UNIQUE INDEX IF NOT EXISTS source_records_tenant_connector_external_key
  ON public.source_records (tenant_id, connector_id, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS source_records_candidate_idx
  ON public.source_records (tenant_id, candidate_id, fetched_at DESC);

-- Observations -------------------------------------------------------------
ALTER TABLE public.observations
  ALTER COLUMN merchant_id DROP NOT NULL;

ALTER TABLE public.observations
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS source_url text;

CREATE INDEX IF NOT EXISTS observations_candidate_idx
  ON public.observations (tenant_id, candidate_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS observations_merchant_field_idx
  ON public.observations (tenant_id, merchant_id, field_path, observed_at DESC);