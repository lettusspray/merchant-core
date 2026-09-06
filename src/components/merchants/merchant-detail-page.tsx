import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Globe,
  MapPin,
  Package,
  Radio,
  Receipt,
  ScanSearch,
  Store,
  TableProperties,
  Tag,
  TriangleAlert,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EditIdentityDialog } from "@/components/merchants/edit-identity-dialog";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessionState } from "@/hooks/use-session-state";
import { merchantDetailFn } from "@/lib/api/console.functions";

type Detail = Awaited<ReturnType<typeof merchantDetailFn>>;

const STATUS_LABELS: Record<string, string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  home_service: "Home service",
  beauty: "Beauty",
  pet_service: "Pet service",
  automotive: "Automotive",
  local_retail: "Local retail",
  other: "Other",
};

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "paused":
    case "onboarding":
      return "secondary";
    case "archived":
      return "outline";
    default:
      return "outline";
  }
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : formatUsd(cents);
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function formatDateTime(value: string): string {
  return format(new Date(value), "MMM d, yyyy h:mm a");
}

function EmptyState({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-12 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{value}</dd>
    </div>
  );
}

function OverviewTab({ detail, onSaved }: { detail: Detail; onSaved: () => void | Promise<void> }) {
  const { merchant } = detail;
  const [saved, setSaved] = useState(false);
  const categories = merchant.categories as
    { name: string }[] | { name: string } | null | undefined;
  const categoryName = Array.isArray(categories) ? categories[0]?.name : categories?.name;
  const primary =
    (detail.locations ?? []).find((location) => location.is_primary) ?? (detail.locations ?? [])[0];
  const locationText = primary ? [primary.city, primary.region].filter(Boolean).join(", ") : null;

  const counts: { label: string; value: number }[] = [
    { label: "Locations", value: (detail.locations ?? []).length },
    { label: "Products", value: (detail.products ?? []).length },
    { label: "Services", value: (detail.services ?? []).length },
    { label: "Offers", value: (detail.offers ?? []).length },
    { label: "Observations", value: (detail.observations ?? []).length },
    { label: "Happenings", value: (detail.happenings ?? []).length },
    { label: "Orders", value: (detail.orders ?? []).length },
    { label: "Websites", value: (detail.websites ?? []).length },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base">Identity</CardTitle>
            {saved ? (
              <p className="text-xs font-medium text-muted-foreground">
                Identity saved and recorded in the event log.
              </p>
            ) : null}
          </div>
          <EditIdentityDialog
            merchant={merchant}
            categories={detail.categoryOptions ?? []}
            onSaved={async () => {
              await onSaved();
              setSaved(true);
            }}
          />
        </CardHeader>

        <CardContent>
          <dl className="divide-y">
            <InfoRow label="Name" value={merchant.name} />
            <InfoRow label="Slug" value={merchant.slug} />
            <InfoRow
              label="Vertical"
              value={VERTICAL_LABELS[merchant.vertical] ?? merchant.vertical}
            />
            <InfoRow
              label="Status"
              value={
                <Badge variant={statusVariant(merchant.status)}>
                  {STATUS_LABELS[merchant.status] ?? merchant.status}
                </Badge>
              }
            />
            <InfoRow label="Primary location" value={locationText ?? "—"} />
            <InfoRow label="Category" value={categoryName ?? "—"} />
            <InfoRow label="Data quality" value={`${merchant.data_quality.toFixed(1)} / 100`} />
            <InfoRow label="Created" value={formatDate(merchant.created_at)} />
            <InfoRow label="Updated" value={formatDate(merchant.updated_at)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Related records</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            {counts.map((count) => (
              <div key={count.label} className="rounded-lg border p-3">
                <dt className="text-xs text-muted-foreground">{count.label}</dt>
                <dd className="text-xl font-bold">{count.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function LocationsTab({ detail }: { detail: Detail }) {
  const locations = detail.locations ?? [];
  const contacts = detail.contacts ?? [];
  const hours = detail.hours ?? [];

  const locationLabel = (id: string) =>
    locations.find((location) => location.id === id)?.label ?? "Unknown location";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Locations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {locations.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={MapPin} label="No locations recorded." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>City / Region</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Primary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.label}</TableCell>
                    <TableCell>
                      {[location.address_line1, location.address_line2, location.postal_code]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>
                      {[location.city, location.region, location.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell>{location.phone ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {location.is_primary ? <Badge>Primary</Badge> : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contacts.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={MapPin} label="No contacts recorded." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.kind}</TableCell>
                    <TableCell>{contact.label ?? "—"}</TableCell>
                    <TableCell>{contact.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Business hours</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {hours.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={MapPin} label="No business hours recorded." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Location</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hours.map((hour) => (
                  <TableRow key={hour.id}>
                    <TableCell className="font-medium">{locationLabel(hour.location_id)}</TableCell>
                    <TableCell>{DAY_LABELS[hour.day_of_week] ?? hour.day_of_week}</TableCell>
                    <TableCell>
                      {hour.is_closed
                        ? "Closed"
                        : hour.opens_at && hour.closes_at
                          ? `${hour.opens_at} – ${hour.closes_at}`
                          : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductsTab({ detail }: { detail: Detail }) {
  const products = detail.products ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Products</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {products.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Package} label="No products recorded." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.description ? (
                        <span className="text-xs text-muted-foreground">{product.description}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{product.sku ?? "—"}</TableCell>
                  <TableCell>{formatPrice(product.price_cents)}</TableCell>
                  <TableCell>{product.currency || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{product.state}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ServicesTab({ detail }: { detail: Detail }) {
  const services = detail.services ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Services</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {services.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Package} label="No services recorded." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-medium">{service.name}</TableCell>
                  <TableCell>{service.description ?? "—"}</TableCell>
                  <TableCell>{formatPrice(service.price_cents)}</TableCell>
                  <TableCell>
                    {service.duration_minutes != null ? `${service.duration_minutes} min` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{service.state}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OffersTab({ detail }: { detail: Detail }) {
  const offers = detail.offers ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Offers</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {offers.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Tag} label="No offers recorded." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{offer.title}</span>
                      {offer.description ? (
                        <span className="text-xs text-muted-foreground">{offer.description}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{offer.discount_label ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{offer.state}</Badge>
                  </TableCell>
                  <TableCell>{offer.starts_at ? formatDate(offer.starts_at) : "—"}</TableCell>
                  <TableCell>{offer.ends_at ? formatDate(offer.ends_at) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ObservationsTab({ detail }: { detail: Detail }) {
  const observations = detail.observations ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Observations</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {observations.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={ScanSearch} label="No source observations recorded." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Field</TableHead>
                <TableHead>Observed value</TableHead>
                <TableHead>Current value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Observed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {observations.map((observation) => {
                const source = observation.source_records as
                  | { external_id: string | null; source_connectors: { provider: string } | null }
                  | null
                  | undefined;
                return (
                  <TableRow key={observation.id}>
                    <TableCell className="font-medium">{observation.field_path}</TableCell>
                    <TableCell>{observation.observed_value ?? "—"}</TableCell>
                    <TableCell>{observation.current_value ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{observation.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      <div className="flex flex-col items-end">
                        <span>{formatDate(observation.observed_at)}</span>
                        {source?.source_connectors?.provider ? (
                          <span className="text-xs">{source.source_connectors.provider}</span>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function WebsitesTab({ detail }: { detail: Detail }) {
  const websites = detail.websites ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Websites</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {websites.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={Globe} label="No websites generated." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Pages</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {websites.map((website) => (
                <TableRow key={website.id}>
                  <TableCell>
                    <a
                      href={`https://${website.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {website.domain}
                    </a>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{website.state}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {Array.isArray(website.website_pages) ? website.website_pages.length : 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function HappeningsTab({ detail }: { detail: Detail }) {
  const happenings = detail.happenings ?? [];
  if (happenings.length === 0) return <EmptyState icon={CalendarDays} label="No happenings yet." />;

  return (
    <div className="space-y-3">
      {happenings.map((happening) => (
        <Card key={happening.id}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">{happening.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {happening.kind}
                {happening.starts_at ? ` · ${formatDate(happening.starts_at)}` : ""}
                {happening.ends_at ? ` → ${formatDate(happening.ends_at)}` : ""}
              </p>
            </div>
            <Badge variant="outline">{happening.status}</Badge>
          </CardHeader>
          {happening.body || happening.source_url ? (
            <CardContent>
              {happening.body ? (
                <p className="text-sm text-muted-foreground">{happening.body}</p>
              ) : null}
              {happening.source_url ? (
                <a
                  href={happening.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-xs text-primary hover:underline"
                >
                  View source
                </a>
              ) : null}
            </CardContent>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

function VisibilityTab({ detail }: { detail: Detail }) {
  const visibility = detail.visibility ?? [];
  if (visibility.length === 0)
    return <EmptyState icon={Radio} label="No visibility snapshots yet." />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engine</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Mentioned</TableHead>
              <TableHead>Recommended</TableHead>
              <TableHead className="text-right">Captured</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibility.map((snapshot) => (
              <TableRow key={snapshot.id}>
                <TableCell className="font-medium">{snapshot.engine}</TableCell>
                <TableCell>{Number(snapshot.score).toFixed(1)}</TableCell>
                <TableCell>{snapshot.mentioned ? "Yes" : "No"}</TableCell>
                <TableCell>{snapshot.recommended ? "Yes" : "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDateTime(snapshot.captured_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OrdersTab({ detail }: { detail: Detail }) {
  const orders = detail.orders ?? [];
  if (orders.length === 0) return <EmptyState icon={Receipt} label="No orders yet." />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => {
              const items = (order.order_items ?? []) as {
                description: string;
                quantity: number;
              }[];
              return (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.reference}</TableCell>
                  <TableCell>{order.customer_name ?? order.customer_email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{formatUsd(order.total_cents)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    <div className="flex flex-col items-end">
                      <span>{formatDate(order.placed_at)}</span>
                      {items.length > 0 ? (
                        <span className="text-xs">{items.length} item(s)</span>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EventsTab({ detail }: { detail: Detail }) {
  const events = detail.events ?? [];
  if (events.length === 0) return <EmptyState icon={FileText} label="No events recorded." />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.kind}</TableCell>
                <TableCell>{event.actor_label ?? "—"}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDateTime(event.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DetailHeader({ detail }: { detail: Detail }) {
  const { merchant } = detail;
  const primary =
    (detail.locations ?? []).find((location) => location.is_primary) ?? (detail.locations ?? [])[0];
  const locationText = primary ? [primary.city, primary.region].filter(Boolean).join(", ") : null;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {merchant.logo_url ? (
              <img
                src={merchant.logo_url}
                alt={`${merchant.name} logo`}
                className="size-full rounded-lg object-cover"
              />
            ) : (
              <Store className="size-6" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight">{merchant.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>{merchant.slug}</span>
              <span className="text-xs">·</span>
              <span>{VERTICAL_LABELS[merchant.vertical] ?? merchant.vertical}</span>
              {locationText ? (
                <>
                  <span className="text-xs">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {locationText}
                  </span>
                </>
              ) : null}
            </div>
            {merchant.tagline ? (
              <p className="mt-1 text-sm text-muted-foreground">{merchant.tagline}</p>
            ) : null}
          </div>
        </div>
        <Badge variant={statusVariant(merchant.status)}>
          {STATUS_LABELS[merchant.status] ?? merchant.status}
        </Badge>
      </CardContent>
    </Card>
  );
}

function SignedOutView() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Sign in to view this merchant</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Merchant details are loaded from your workspace. Sign in to view them.
        </p>
        <Button asChild>
          <Link to="/signin">Sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function NotFoundView() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Merchant not found</CardTitle>
        <p className="text-sm text-muted-foreground">
          This merchant does not exist in your workspace, or you don&apos;t have access to it.
        </p>
      </CardHeader>
      <CardContent>
        <Button asChild size="sm" variant="outline">
          <Link to="/merchants">Back to merchants</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load merchant</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          You are signed in, but this merchant could not be loaded.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </CardContent>
    </Card>
  );
}

const TABS = [
  { value: "overview", label: "Overview", icon: TableProperties },
  { value: "locations", label: "Locations", icon: MapPin },
  { value: "products", label: "Products & Services", icon: Package },
  { value: "sources", label: "Sources & Observations", icon: ScanSearch },
  { value: "happenings", label: "Happenings", icon: CalendarDays },
  { value: "visibility", label: "Visibility", icon: Radio },
  { value: "orders", label: "Orders", icon: Receipt },
  { value: "events", label: "Events", icon: FileText },
] as const;

export function MerchantDetailPage({ merchantId }: { merchantId: string }) {
  const session = useSessionState();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setNotFound(false);
    setDetail(null);
    try {
      const result = await merchantDetailFn({ data: { merchantId } });
      setDetail(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load merchant.";
      if (message.toLowerCase().includes("not found")) {
        setNotFound(true);
      } else {
        setError(message);
      }
    }
  }, [merchantId]);

  useEffect(() => {
    if (session.status === "signed-in") {
      void load();
    }
  }, [session.status, load]);

  const title = notFound ? "Not found" : detail && !error ? detail.merchant.name : "Merchant";

  let content: ReactNode;

  if (session.status === "checking") {
    content = <DetailSkeleton />;
  } else if (session.status === "signed-out") {
    content = <SignedOutView />;
  } else if (notFound) {
    content = <NotFoundView />;
  } else if (error) {
    content = <ErrorView message={error} onRetry={() => void load()} />;
  } else if (!detail) {
    content = <DetailSkeleton />;
  } else {
    content = (
      <div className="space-y-4">
        <DetailHeader detail={detail} />
        <Tabs defaultValue="overview">
          <div className="overflow-x-auto pb-1">
            <TabsList className="inline-flex h-auto flex-nowrap">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="px-3">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <tab.icon className="size-3.5" />
                    {tab.label}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="overview" className="mt-4">
            <OverviewTab detail={detail} />
          </TabsContent>
          <TabsContent value="locations" className="mt-4">
            <LocationsTab detail={detail} />
          </TabsContent>
          <TabsContent value="products" className="mt-4">
            <div className="space-y-4">
              <ProductsTab detail={detail} />
              <ServicesTab detail={detail} />
              <OffersTab detail={detail} />
            </div>
          </TabsContent>
          <TabsContent value="sources" className="mt-4">
            <div className="space-y-4">
              <ObservationsTab detail={detail} />
              <WebsitesTab detail={detail} />
            </div>
          </TabsContent>
          <TabsContent value="happenings" className="mt-4">
            <HappeningsTab detail={detail} />
          </TabsContent>
          <TabsContent value="visibility" className="mt-4">
            <VisibilityTab detail={detail} />
          </TabsContent>
          <TabsContent value="orders" className="mt-4">
            <OrdersTab detail={detail} />
          </TabsContent>
          <TabsContent value="events" className="mt-4">
            <EventsTab detail={detail} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <AppShell title={title}>
      <div className="space-y-6">
        <Link
          to="/merchants"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Merchants
        </Link>
        {content}
      </div>
    </AppShell>
  );
}
