import { format } from "date-fns";

import { getPublishedPublicPageFn } from "@/lib/api/public-functions";

type PublicPage = NonNullable<Awaited<ReturnType<typeof getPublishedPublicPageFn>>>;
type Block = PublicPage["revision"]["blocks"][number];
type AnyRecord = Record<string, unknown>;

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

function asRecord(value: unknown): AnyRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as AnyRecord;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

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

function blockHero(blocks: Block[]): {
  name: string;
  tagline: string | null;
  description: string | null;
  vertical: string | null;
  logoUrl: string | null;
} | null {
  const hero = blocks.map(asRecord).find((block) => block?.["type"] === "hero");
  if (!hero) return null;
  return {
    name: str(hero["name"]) ?? "Unnamed business",
    tagline: str(hero["tagline"]),
    description: str(hero["description"]),
    vertical: str(hero["vertical"]),
    logoUrl: str(hero["logoUrl"]),
  };
}

function blockLocations(blocks: Block[]): AnyRecord[] {
  return blocks.flatMap((block) => {
    const record = asRecord(block);
    return record?.["type"] === "locations" ? [record] : [];
  });
}

function blockItems(
  blocks: Block[],
  type: string,
): Array<{ name?: string; description?: string } & AnyRecord> {
  const block = blocks.map(asRecord).find((candidate) => candidate?.["type"] === type);
  if (!block) return [];
  const items = block["items"];
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    const record = asRecord(item);
    return record ? [record as { name?: string; description?: string } & AnyRecord] : [];
  });
}

function blockLocationItems(blocks: AnyRecord[]): LocationItem[] {
  return blocks.flatMap((block) => {
    const items = block["items"];
    if (!Array.isArray(items)) return [];
    return items.flatMap((item) => {
      const record = asRecord(item);
      return record ? [record as unknown as LocationItem] : [];
    });
  });
}

type LocationItem = {
  label?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
  hours?: Array<{
    dayOfWeek?: number;
    opensAt?: string | null;
    closesAt?: string | null;
    isClosed?: boolean;
  }>;
};

function HoursTable({ hours }: { hours: NonNullable<LocationItem["hours"]> }) {
  if (hours.length === 0) return <p className="text-sm text-muted-foreground">—</p>;
  const rows = Array.from({ length: 7 }).map((_, day) =>
    hours.find((entry) => entry.dayOfWeek === day),
  );
  return (
    <dl className="space-y-1 text-sm">
      {rows.map((entry, day) => (
        <div key={day} className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground">{DAY_NAMES[day]}</dt>
          <dd className="tabular-nums">
            {entry && !entry.isClosed
              ? `${formatTime(entry.opensAt ?? null) ?? "—"}–${formatTime(entry.closesAt ?? null) ?? "—"}`
              : "Closed"}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function AddressBlock({ location }: { location: LocationItem }) {
  const lines = [
    location.addressLine1,
    location.addressLine2,
    [location.city, location.region].filter(Boolean).join(", "),
    [location.postalCode, location.country].filter(Boolean).join(" "),
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

function UnavailableState() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="max-w-md space-y-3">
        <p className="text-4xl">🏗️</p>
        <h1 className="text-xl font-semibold">This page isn’t published yet</h1>
        <p className="text-sm text-muted-foreground">
          The business owner has not published a homepage for this site. Check back soon.
        </p>
      </div>
    </main>
  );
}

export function PublicMerchantPage({ page }: { page: PublicPage | null }) {
  if (!page) return <UnavailableState />;

  const { website, revision } = page;
  const blocks = revision.blocks;

  // Empty or malformed representation: show a clear fallback state rather than
  // silently reconstructing a different homepage from live merchant data.
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return <UnavailableState />;
  }

  const hero = blockHero(blocks);
  const name = hero?.name ?? `v${website.publishedVersion}`;
  const verticalLabel = hero?.vertical ? (VERTICAL_LABELS[hero.vertical] ?? hero.vertical) : null;
  const hasHero = hero !== null;
  const services = blockItems(blocks, "services");
  const products = blockItems(blocks, "products");
  const offers = blockItems(blocks, "offers");
  const hasCatalog = services.length > 0 || products.length > 0;
  const hasOffers = offers.length > 0;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {hero?.logoUrl ? (
              <img src={hero.logoUrl} alt={name} className="size-10 rounded-full object-cover" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-lg font-semibold text-primary">
                {name.charAt(0)}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold">{name}</p>
              {verticalLabel ? (
                <p className="truncate text-xs text-muted-foreground">{verticalLabel}</p>
              ) : null}
            </div>
          </div>
          <span className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
            v{website.publishedVersion}
          </span>
        </div>
      </header>

      {hasHero ? (
        <section className="border-b">
          <div className="mx-auto max-w-3xl space-y-2 px-4 py-10">
            <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
            {hero?.tagline ? <p className="text-lg text-muted-foreground">{hero.tagline}</p> : null}
            {hero?.description ? (
              <p className="max-w-2xl text-foreground/80">{hero.description}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-12 px-4 py-10">
        {blockLocations(blocks).map((block, blockIndex) => {
          const locationItems = blockLocationItems([block]);
          const primaryLocation =
            locationItems.find((location) => location.isPrimary) ?? locationItems[0] ?? null;
          return (
            <section key={blockIndex} className="space-y-4">
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
                    <HoursTable hours={primaryLocation.hours ?? []} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No hours listed.</p>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        {services.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Services</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((service, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{str(service["name"]) ?? "—"}</p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(num(service["priceCents"])) ?? "—"}
                    </p>
                  </div>
                  {num(service["durationMinutes"]) != null ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {num(service["durationMinutes"])} min
                    </p>
                  ) : null}
                  {str(service["description"]) ? (
                    <p className="mt-1.5 text-sm text-foreground/70">
                      {str(service["description"])}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {products.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Products</SectionLabel>
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((product, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium">{str(product["name"]) ?? "—"}</p>
                    <p className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(num(product["priceCents"])) ?? "—"}
                    </p>
                  </div>
                  {str(product["description"]) ? (
                    <p className="mt-1.5 text-sm text-foreground/70">
                      {str(product["description"])}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {offers.length > 0 ? (
          <section className="space-y-4">
            <SectionLabel>Offers</SectionLabel>
            <div className="space-y-3">
              {offers.map((offer, index) => (
                <div key={index} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{str(offer["title"]) ?? "—"}</p>
                    {str(offer["discountLabel"]) ? (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {str(offer["discountLabel"])}
                      </span>
                    ) : null}
                  </div>
                  {str(offer["description"]) ? (
                    <p className="mt-1 text-sm text-foreground/70">{str(offer["description"])}</p>
                  ) : null}
                  {str(offer["endsAt"]) ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valid through{" "}
                      {format(new Date(str(offer["endsAt"]) as string), "MMM d, yyyy")}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {!hasHero && !hasCatalog && !hasOffers ? (
          <section className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            The catalog for this business is being built. Check back soon.
          </section>
        ) : null}
      </div>

      <footer className="border-t">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-6">
          <p className="text-sm text-muted-foreground">{name}</p>
          <p className="text-xs text-muted-foreground/70">
            Homepage revision {revision.version} · published{" "}
            {website.publishedAt
              ? format(new Date(website.publishedAt), "MMM d, yyyy")
              : `v${website.publishedVersion}`}
          </p>
        </div>
      </footer>
    </main>
  );
}
