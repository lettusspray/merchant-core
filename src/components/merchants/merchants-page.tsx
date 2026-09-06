import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { FilterX, MapPin, Search, Store, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useSessionState } from "@/hooks/use-session-state";
import { merchantsListFn } from "@/lib/api/console.functions";

type MerchantsPayload = Awaited<ReturnType<typeof merchantsListFn>>;
type Merchant = MerchantsPayload["merchants"][number];

const STATUS_VALUES = ["prospect", "onboarding", "active", "paused", "archived"] as const;
const VERTICAL_VALUES = [
  "restaurant",
  "home_service",
  "beauty",
  "pet_service",
  "automotive",
  "local_retail",
  "other",
] as const;

const VERTICAL_LABELS: Record<(typeof VERTICAL_VALUES)[number], string> = {
  restaurant: "Restaurant",
  home_service: "Home service",
  beauty: "Beauty",
  pet_service: "Pet service",
  automotive: "Automotive",
  local_retail: "Local retail",
  other: "Other",
};

const STATUS_LABELS: Record<(typeof STATUS_VALUES)[number], string> = {
  prospect: "Prospect",
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

function statusVariant(
  status: Merchant["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "paused":
    case "onboarding":
      return "secondary";
    case "archived":
      return "outline";
    case "prospect":
      return "outline";
  }
}

function primaryLocation(
  merchant: Merchant,
): { city: string | null; region: string | null } | null {
  const locations = merchant.locations ?? [];
  return locations.find((location) => location.is_primary) ?? locations[0] ?? null;
}

function locationLabel(location: { city: string | null; region: string | null } | null): string {
  if (!location) return "—";
  return [location.city, location.region].filter(Boolean).join(", ") || "—";
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function MerchantsTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function MerchantsEmptyState({
  hasFilters,
  onReset,
}: {
  hasFilters: boolean;
  onReset: () => void;
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Store className="size-5" />
        </div>
        <CardTitle className="text-base">
          {hasFilters ? "No matches" : "No merchants yet"}
        </CardTitle>
        <CardDescription>
          {hasFilters
            ? "No merchants match your current search and filters."
            : "Merchants will appear here as they are added, enriched, or discovered in this workspace."}
        </CardDescription>
      </CardHeader>
      {hasFilters ? (
        <CardContent className="flex justify-center pb-6">
          <Button size="sm" variant="outline" onClick={onReset}>
            <FilterX className="size-4" />
            Clear filters
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

function MerchantsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load merchants</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but the workspace data could not be loaded. This may mean no workspace
          membership exists for this account, or the console backend is not configured.
        </CardDescription>
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

export function MerchantsPage() {
  const session = useSessionState();
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [vertical, setVertical] = useState<string>("all");
  const [merchants, setMerchants] = useState<Merchant[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: { search?: string; status?: string; vertical?: string } = {};
      if (searchInput.trim()) data.search = searchInput.trim();
      if (status !== "all") data.status = status;
      if (vertical !== "all") data.vertical = vertical;
      const result = await merchantsListFn({ data });
      setMerchants(result.merchants);
    } catch (err) {
      setMerchants(null);
      setError(err instanceof Error ? err.message : "Could not load merchants.");
    } finally {
      setLoading(false);
    }
  }, [searchInput, status, vertical]);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [session.status, load]);

  const signedOut = session.status === "signed-out";
  const hasFilters = searchInput.trim() !== "" || status !== "all" || vertical !== "all";

  const resetFilters = () => {
    setSearchInput("");
    setStatus("all");
    setVertical("all");
    void load();
  };

  if (session.status === "checking") {
    return <MerchantsTableShimmer />;
  }

  if (signedOut) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view merchants</CardTitle>
          </div>
          <CardDescription>
            Your merchants, locations, and enrichment live in this workspace. Sign in to load them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return <MerchantsErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && merchants === null) {
    return <MerchantsTableShimmer />;
  }

  const empty = merchants !== null && merchants.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={status}
            onValueChange={(value) => setStatus(value === "all" ? "all" : value)}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={vertical}
            onValueChange={(value) => setVertical(value === "all" ? "all" : value)}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Vertical" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All verticals</SelectItem>
              {VERTICAL_VALUES.map((value) => (
                <SelectItem key={value} value={value}>
                  {VERTICAL_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button size="sm" variant="ghost" onClick={resetFilters}>
              <FilterX className="size-4" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      {empty ? (
        <MerchantsEmptyState hasFilters={hasFilters} onReset={resetFilters} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {merchants && merchants.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Primary location</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {merchants.map((merchant) => {
                    const location = primaryLocation(merchant);
                    return (
                      <TableRow key={merchant.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{merchant.name}</span>
                            <span className="text-xs text-muted-foreground">{merchant.slug}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {VERTICAL_LABELS[merchant.vertical] ?? merchant.vertical}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(merchant.status)}>
                            {STATUS_LABELS[merchant.status] ?? merchant.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" />
                            <span className="truncate">{locationLabel(location)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(merchant.updated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <MerchantsTableShimmer />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
