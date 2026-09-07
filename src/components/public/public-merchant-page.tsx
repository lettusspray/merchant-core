import { format } from "date-fns";

import { getPublishedPublicPageFn } from "@/lib/api/public-functions";

type PublicPage = NonNullable<Awaited<ReturnType<typeof getPublishedPublicPageFn>>>;

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  home_service: "Home service",
  beauty: "Beauty",
  pet_service: "Pet service",
  automotive: "Automotive",
  local_retail: "Local retail",
  other: "Local business",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatMoney(cents: number | null): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatTime(value: string | null): string | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (typeof hours !== "number" || Number.isNaN(hours)) return null;
  const period = hours >= 12 ? "PM" : "AM";
  const display = ((hours + 11) % 12) + 1;
  const minute =
    typeof minutes === "number" && !Number.isNaN(minutes)
      ? `:${String(minutes).padStart(2, "0")}`
      : "";
  return `${display}${minute} ${period}`;
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function HoursTable({ hours }: { hours: PublicPage["locations"][number]["business_hours"] }) {
  if (hours.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  const rows = Array.from({ length: 7 }).map((_, day) =>
    hours.find((entry) => entry.day_of_week === day),
  );
  return (
    <dl className="space-y-1 text-sm">
      {rows.map((entry, day) => (
        <div key={day} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{DAY_NAMES[day]}</dt>
          <dd className="tabular-nums">
            {entry && !entry.is_closed
              ? `${formatTime(entry.opens_at) ?? "—"}–${formatTime(entry.closes_at) ?? "—"}`
              : "Closed"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AddressBlock({ location }: { location: PublicPage["locations"][number] }) {
  const lines = [
    location.address_line1,
    location.address_line2,
    [location.city, location.region].filter(Boolean).join(", "),
    [location.postal_code, location.country].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <div className="text-sm">
      {lines.length > 0 ? (
        <p>{lines.join("\n")}</p>
      ) : (
        <p className="text-muted-foreground">Address coming soon.</p>
      )}
      {location.phone ? <p className="mt-1 tabular-nums">{location.phone}</p> : null}
    </div>
  );
}

export function PublicMerchantPage({ page }: { page: PublicPage }) {
  const { merchant } = page;
  const primaryLocation =
    page.locations.find((location) => location.is_primary) ?? page.locations[0] ?? null;
  const hasCatalog = page.services.length > 0 || page.products.length > 0;
  const hasOffers = page.offers.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {merchant.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={merchant.name}
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                {merchant.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{merchant.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {VERTICAL_LABELS[merchant.vertical] ?? merchant.vertical}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            v{page.website.publishedVersion}
          </span>
        </div>
      </header>

      <section className="border-b">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-10">
          <h1 className="text-3xl font-bold tracking-tight">{merchant.name}</h1>
          {merchant.tagline ? (
            <p className="text-lg text-muted-foreground">{merchant.tagline}</p>
          ) : null}
          {merchant.description ? (
            <p className="max-w-2xl text-foreground/80">{merchant.description}</p>
          ) : null}
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        <section className="space-y-4">
          <SectionLabel>Location & hours</SectionLabel>
          <div className="grid gap-6 rounded-lg border p-4 sm:grid-cols-2">
            <div className="space-y-1">
              <SectionLabel>Address</SectionLabel>
              {primaryLocation ? (
                <div className="whitespace-pre-line">
                  <AddressBlock location={primaryLocation} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No address listed.</p>
              )}
            </div>
            <div className="space-y-1">
              <SectionLabel>Hours</SectionLabel>
              {primaryLocation ? (
                <HoursTable hours={primaryLocation.business_hours} />
              ) : (
                <p className="text-sm text-muted-foreground">No hours listed.</p>
              )}
            </div>
          </div>
        </section>

        {page.services.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Services</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {page.services.map((service) => (
                <div key={service.id} className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{service.name}</p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(service.price_cents) ?? "—"}
                    </p>
                  </div>
                  {service.duration_minutes ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {service.duration_minutes} min
                    </p>
                  ) : null}
                  {service.description ? (
                    <p className="mt-1.5 text-sm text-foreground/70">{service.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {page.products.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Products</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {page.products.map((product) => (
                <div key={product.id} className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{product.name}</p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(product.price_cents) ?? "—"}
                    </p>
                  </div>
                  {product.description ? (
                    <p className="mt-1.5 text-sm text-foreground/70">{product.description}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {page.offers.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Offers</SectionLabel>
            <div className="space-y-3">
              {page.offers.map((offer) => (
                <div key={offer.id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{offer.title}</p>
                    {offer.discount_label ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {offer.discount_label}
                      </span>
                    ) : null}
                  </div>
                  {offer.description ? (
                    <p className="mt-1 text-sm text-foreground/70">{offer.description}</p>
                  ) : null}
                  {offer.ends_at ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valid through {format(new Date(offer.ends_at), "MMM d, yyyy")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!hasCatalog && !hasOffers ? (
          <section className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            The catalog for this business is being built. Check back soon.
          </section>
        ) : null}
      </div>

      <footer className="border-t">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-6">
          <p className="text-sm text-muted-foreground">{merchant.name}</p>
          <p className="text-xs text-muted-foreground/70">
            Generated from the Merchant Core graph · published{" "}
            {page.website.publishedAt
              ? format(new Date(page.website.publishedAt), "MMM d, yyyy")
              : `v${page.website.publishedVersion}`}
          </p>
        </div>
      </footer>
    </main>
  );
}
