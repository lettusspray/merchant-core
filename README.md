# Merchant Core

Build the first production-shaped development version of the business platform described below in ONE coherent implementation. Treat this specification as design intent, not a list of literal constraints: when any requirement conflicts, derive the cleanest architecture from first principles and do not patch around contradictions. Prefer the simplest elegant design that can grow to large scale without premature microservices.

PRODUCT PURPOSE
Build a multi-tenant merchant infrastructure platform for US businesses. The platform turns a business into a machine-readable, discoverable, continuously updated, orderable digital entity. It must support many business verticals in parallel; do not hard-code restaurants or home services as the architecture. The initial app is an internal/admin product for operating the platform, not the public merchant websites themselves.

CORE CONCEPT
Canonical Merchant Graph / Merchant Data model is the system of record. Sources feed observations into the canonical model. The platform can generate public merchant sites and structured data from the model, monitor AI/search visibility, ingest current happenings and publish merchant updates/blog material, and eventually support commerce and agent interfaces. Keep facts, observations, provenance, confidence, generated content, and predictions distinct.

STACK BASELINE
- TanStack Start + React.
- TypeScript-centered throughout.
- Modular monolith. No microservices.
- PostgreSQL as the primary relational system of record.
- Supabase-backed PostgreSQL/Auth in development.
- Supabase Auth with row-level tenant isolation.
- pgvector in PostgreSQL; do not require a dedicated vector DB initially.
- Cloudflare as edge/runtime/CDN layer where appropriate.
- S3-compatible object storage for assets/raw artifacts.
- Redis for caching, short-lived state, rate limiting and queues where useful.
- Temporal for durable workflows.
- Stripe and Paystack adapters for payments/marketplace flows.
- Sentry for application error/performance observability.
- Headless CMS abstraction; keep content model owned by our merchant graph/domain model, not vendor-specific.
- AI provider abstraction supporting OpenAI, Anthropic, Google and lower-cost/mass providers such as OpenRouter/Cloudflare where practical, with Chinese model providers included through the same abstraction. Never make business logic provider-specific.
- Hosting is intentionally out of scope for this development environment.

IMPORTANT ARCHITECTURAL RULES
1. Start as one modular monolith with explicit domain modules and internal APIs.
2. Do not introduce microservices, Kubernetes, Kafka, event buses, or multiple databases unless truly necessary.
3. Use adapters for external providers/integrations.
4. Merchant Graph is canonical; external systems are sources, not schema masters.
5. Use durable workflows for long-running/retriable processes.
6. Design tenant boundaries from the start.
7. Every important external observation should have source/provenance and observed_at/freshness metadata.
8. Avoid overengineering for hypothetical scale; build clean boundaries that can later split.

INITIAL APPLICATION UX
Build a polished internal SaaS dashboard with:
- Sign in / auth.
- Tenant/workspace switcher.
- Overview dashboard.
- Merchants list and merchant detail page.
- Merchant detail tabs: Overview, Identity & Locations, Products/Services, Sources & Observations, Website/Content, AI Visibility, Activity/Updates, Orders/Commerce, Subscriptions, Events/Learning, Integrations.
- Prospect/business discovery workspace.
- Source management for discovery inputs.
- Content/update review queue.
- AI visibility results dashboard.
- Integrations/settings.
- System health/activity page.

MERCHANT DOMAIN MODEL
Implement clean relational tables/entities for at minimum:
- tenants
- users/memberships
- merchants
- locations
- categories/tags
- products
- services
- offers/pricing
- business_hours / availability
- contacts
- websites/domains
- source_connectors
- source_records / observations
- provenance records
- content_items
- content_sources
- content_publications
- visibility_runs
- visibility_queries
- visibility_results
- integrations
- integration_credentials references (never raw secrets)
- subscriptions
- orders
- order_items
- payments / payment references
- business_events
- workflow_runs
- audit_log
Use UUIDs. Add created_at/updated_at and relevant status fields. Use foreign keys and indexes sensibly.

PROSPECT/BUSINESS DISCOVERY
Do NOT rely only on Google Places. Build a provider-neutral discovery interface with multiple source adapters. The UI should support source types such as:
- Google/Maps-like place search
- US business/company registry datasets where legally/API-accessibly available
- state/local licensing and permit data
- new-business/opening announcements
- public social/business profile signals
- local news/public announcements
- directories/public business listings
- merchant-submitted/imported prospect lists
Create a discovery source abstraction so providers can be added without changing the merchant model. For now implement a mock/demo source adapter and clean interfaces for future live adapters. Discovery should produce normalized prospect observations, not directly mutate canonical merchant facts without provenance.

MERCHANT UPDATE / HAPPENINGS ENGINE
Build a vertical-neutral “Happenings & Updates” module. It ingests current business-relevant material from sources such as:
- social posts/links
- image references
- public announcements/news
- short texts
- merchant-provided notes
- website changes
It creates candidate content items with source links, dates, evidence, confidence, and suggested publishing angle. It can propose a blog/update article for merchant review. The product value proposition is both: (a) keeping the merchant site fresh with useful current material, and (b) keeping the merchant informed about what is happening around/within their business. Clearly separate source facts from generated prose. Include review/approve/reject workflow before publication.

AI VISIBILITY
There must be a clean internal API contract for an external MercerCroft AI Visibility service. Build the integration layer around these requirements:
- POST /v1/visibility/runs
  accepts tenant/merchant id, query set id or inline queries, target models/providers, locale/location, crawl context, requested metrics.
- Async run semantics; return run_id and status.
- GET /v1/visibility/runs/:id
- GET /v1/visibility/runs/:id/results
- GET /v1/visibility/history?merchant_id=...
- POST /v1/visibility/query-sets
- GET /v1/visibility/query-sets/:id
- Webhook/callback endpoint for run completion, idempotent.
Each result must preserve:
  query, provider, model, timestamp, answer/excerpt, cited URLs, mentioned merchants/entities, merchant rank/position when measurable, factual assertions about merchant, factual accuracy checks when available, recommendation status, visibility/citation metrics, raw/evidence payload reference, cost/usage metadata, errors/warnings, system version.
Need API key/auth configuration, retries, timeout, idempotency key, correlation id, webhook signature verification, pagination, versioning (/v1), and backward-compatible schema strategy.
If MercerCroft is unavailable in development, implement a mock adapter conforming to the contract and make the UI work end-to-end.

CONTENT/WEBSITE MODEL
Do not build a separate hard-coded CMS schema that duplicates merchant data. Build a headless content abstraction where pages/content reference canonical merchant entities and generated blocks. Include:
- page drafts
- publication status
- SEO metadata
- structured data payloads
- slug management
- content provenance
- generated vs source-authored distinction
- content version history
The public website generation layer should be represented in the domain/API design even if the Lovable development app is primarily the internal dashboard.

COMMERCE
Implement clean domain placeholders/interfaces for:
- cart
- order
- order item
- payment intent/reference
- merchant payout reference
- platform commission
- refund/dispute state
Support Stripe and Paystack through adapters, but do not require live keys in this development build. Keep payment credentials out of our DB; store only provider references and safe metadata.

EVENTS / LEARNING
Implement an append-only business event model for lifecycle events such as:
lead.created, lead.contacted, opportunity.created, deal.won, merchant.activated, value.proven, subscription.started, subscription.renewed, subscription.churned, order.created, order.completed, order.refunded, merchant.expanded, merchant.referred, visibility.run_completed, content.published.
The app should display these events and use them as the foundation for future commercial learning. Keep current state tables separate from historical events.

TEMPORAL / WORKFLOW DESIGN
Create clean workflow interfaces/use-cases for:
- merchant onboarding/import
- source sync
- website/content refresh
- happenings collection
- content generation/review
- AI visibility run
- subscription/payment reconciliation
- order lifecycle processing
Provide local/mock implementations if actual Temporal infrastructure is not available in Lovable.

SECURITY
- Supabase Auth.
- Tenant isolation at DB/query policy level where practical in dev.
- No secrets in source control.
- Server-side secret handling only.
- Audit logs for privileged changes.
- Validate all external webhook signatures conceptually.
- Permission-aware routes/components.

DESIGN
Create a restrained, high-quality B2B SaaS interface. Dense enough for operations, but clear. Good typography, strong information hierarchy, responsive layout, accessible components, no decorative fluff. Use shadcn/ui-style components where useful. Favor tables, status badges, timelines, tabs, cards, filters, and clear empty/loading/error states.

SEED DATA
Create realistic demo tenants and merchants across several broad business segments (for example restaurant, home service, beauty, pet service, automotive, local retail) specifically to demonstrate that the architecture is vertical-neutral. Seed sources, observations, content candidates, visibility runs/results, subscriptions, orders, and events so every major screen has meaningful data.

DELIVERABLE
Build the working application end-to-end in one pass. Include database schema/migrations, RLS/tenant boundaries, seed data, server routes/API handlers, UI, adapter interfaces, mock integrations, and error/loading/empty states. Keep the code clean and internally modular. Do not create fake buttons that do nothing; every visible major action should either work against local/mock data or clearly show a real not-configured state.

DOCUMENT IN-PROJECT
Add a concise developer-facing README and architecture notes describing modules, domain model, setup, environment variables, integration boundaries, and where future live provider adapters plug in. Do not over-document beyond what is useful to maintain the build.

Do NOT deploy. This Lovable project is the development/prototyping environment only.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/08283170-c906-4a47-be98-ba9e41dd3b38).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Demo data

There is no separate seed script — demo rows live in the migrations and load when migrations apply (e.g. `supabase db push` or via your hosted Supabase migration runner):

- `supabase/migrations/20260826170846_*sql` — under `-- ============ SEED ============`. It creates the **Merchant Core Demo** tenant (`...0d1`) plus 6 merchants (restaurant, home service, beauty, pet, automotive, local retail), each with locations, business hours, contacts, products/services/offers, websites + pages, observations, orders/order items, a subscription, and related events.
- Sign-up: the `on_auth_user_created` trigger auto-joins every new user to the demo tenant as **owner** — create any account via the Sign in → *Create account* flow and you instantly see all demo data.
- Discovery: `discovery_candidates` and `happenings` + `happening_reviews` rows are seeded so the queue and review pages have data on first load.
- Sample AI-visibility: `visibility_queries` and `visibility_snapshots` are seeded; the **Visibility** page can also run the local readiness estimator (no MercerCroft credentials required — results are labelled as local, never as live AI answers).

## Tenant isolation (merchant portal)

`supabase/migrations/20260907120000_merchant_portal_tenant_isolation.sql` hardens every
owner-accessible policy in the merchant portal. Owner authorization now proves **two**
facts: the caller owns the merchant **and** the row's `tenant_id` equals that merchant's
real tenant. Tenant identity is always derived from the `merchants` row via
`SECURITY DEFINER` helpers (`merchant_tenant`, `is_merchant_owner`,
`is_owner_merchant_in_tenant`, `is_owner_location_in_tenant`,
`is_owner_website_in_tenant`, `is_owner_of_tenant`) — a caller-supplied `tenant_id` is
never trusted for authorization. `merchant_owners` bindings (tenant/merchant/email) are
immutable via trigger; the email self-claim may only set `user_id`. Business hours
authorize through their `location`; `website_pages` authorize through their parent
`website` + `merchant` + `tenant`; `events` remain append-only with the event tenant
anchored to an owned merchant. Server-side, `merchantDetail` now loads business hours via
`locations!inner(merchant_id)` instead of a nonexistent `location_id` predicate.

RLS policies were verified by reasoned audit (the Supabase CLI is not available in this
environment). Note that `supabase db push` on empty demo tables would report all policies
gracefully with zero rows — that scan is benign and not evidence of correctness. The
case-by-case reasoning (all `TO authenticated`, owner = authenticated user with a
`merchant_owners` row whose `tenant_id` matches the linked merchant, member = any
`tenant_members` row) is:

1. Owner reads their own merchant M — `owner read merchants` passes `is_merchant_owner(id)`.
2. Owner edits non-tenant fields of M — `owner update merchants` passes `USING` and new row keeps tenant.
3. Owner tries to edit another operator's merchant with no owner link — no `merchant_owners` row → `is_merchant_owner` false → denied.
4. Owner tries to set M's `tenant_id` to any other tenant — new-row `WITH CHECK is_owner_merchant_in_tenant(id, tenant_id)` compares against M's real tenant → false → denied; they cannot retarget M.
5. Locations: owner inserts a location with matching `tenant_id`/owned `merchant_id` — `WITH CHECK is_owner_merchant_in_tenant` true → allowed.
6. Locations: owner inserts/updates a location whose `tenant_id` differs from the owned merchant's real tenant — `merchant_tenant(merchant_id) = tenant_id` fails (the `tenants` check is the merchant's actual tenant) → denied.
7. Locations: owner deletes another owner's location, or moves a location's `tenant_id` to a third tenant — `USING`/`WITH CHECK` on the OLD and NEW rows prove ownership + tenant consistency → denied.
8. Products/services/offers/happenings — same owner-merchant-in-tenant predicate for `USING` + `WITH CHECK` on insert/update/delete → only tenant-consistent rows of owned merchants.
9. Business hours — `is_owner_location_in_tenant` joins the location to the owned merchant and requires `location.tenant_id = hour.tenant_id`; a forged `location_id` or `tenant_id` fails → insert/update/delete denied.
10. Websites — owner read/insert/update require `is_owner_merchant_in_tenant(merchant_id, tenant_id)`; a website pointing at an unowned merchant or another tenant is invisible and unmodifiable.
11. Website pages — read/insert/update also require `is_owner_website_in_tenant(website_id, tenant_id, merchant_id)`: the page's `website_id` must belong to the same owned merchant in the same tenant, so a page can't be attached to another merchant's website.
12. Events — owner `INSERT` only; `WITH CHECK is_owner_of_tenant(tenant_id)` means the event tenant must be the tenant of a merchant the caller owns → crafted events cannot target an unrelated tenant.
13. Events (member/operator) — the existing member event-insert policy is untouched, so operators keep their flow.
14. Operator invites — `member insert merchant_owners` requires `is_tenant_member(tenant_id) AND merchant_tenant(merchant_id) = tenant_id`, so operators can invite emails only for merchants that actually belong to their tenant; the immutability trigger blocks retargeting an existing invite.
15. Email self-claim — the broad member `UPDATE` policy is dropped, so the only way to change a `merchant_owners` row is via `owner claim merchant_owners`: allowed only when `lower(email)` equals the signed-in JWT email and the row is pending (or already bound to that user); `WITH CHECK` pins `user_id = auth.uid()` with the email unchanged, and the trigger keeps tenant/merchant/email fixed → the claim can't be forged onto another row, another email's invite, or another merchant.
16. Non-owner authenticated user — no `merchant_owners` row for any merchant they don't own → every owner predicate is false and every owner policy returns no rows → the graph tables are closed to them.
- Empty environments: re-run migrations (or apply them to a fresh branch) to reload the demo workspace.
