import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ChevronDown,
  Compass,
  ExternalLink,
  FilterX,
  Globe,
  MapPin,
  Phone,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSessionState } from "@/hooks/use-session-state";
import { discoveryCandidatesFn } from "@/lib/api/console.functions";

type DiscoveryPayload = Awaited<ReturnType<typeof discoveryCandidatesFn>>;
type Candidate = DiscoveryPayload["candidates"][number];

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

const STATUS_VALUES = ["new", "reviewing", "claimed", "dismissed"] as const;

const STATUS_LABELS: Record<(typeof STATUS_VALUES)[number], string> = {
  new: "New",
  reviewing: "Reviewing",
  claimed: "Claimed",
  dismissed: "Dismissed",
};

function statusVariant(
  status: Candidate["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "new":
      return "default";
    case "reviewing":
    case "claimed":
      return "secondary";
    case "dismissed":
      return "outline";
  }
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function renderJson(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

function JsonPreview({ title, value }: { title: string; value: unknown }) {
  const text = renderJson(value);
  const isEmpty = text === "null" || text === "[]" || text === "{}";
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
          {text}
        </pre>
      )}
    </div>
  );
}

function DiscoveryTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function DiscoveryEmptyState({ hasSearch, onReset }: { hasSearch: boolean; onReset: () => void }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Compass className="size-5" />
        </div>
        <CardTitle className="text-base">
          {hasSearch ? "No matches" : "No discovery candidates"}
        </CardTitle>
        <CardDescription>
          {hasSearch
            ? "No candidates match your current search."
            : "Candidates surface here as the discovery connectors find local businesses from registries, licensing data, and announcements."}
        </CardDescription>
      </CardHeader>
      {hasSearch ? (
        <CardContent className="flex justify-center pb-6">
          <Button size="sm" variant="outline" onClick={onReset}>
            <FilterX className="size-4" />
            Clear search
          </Button>
        </CardContent>
      ) : null}
    </Card>
  );
}

function DiscoveryErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load discovery candidates</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but the discovery workspace could not be loaded. This may mean no
          workspace membership exists for this account, or the console backend is not configured.
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

function locationLabel(candidate: Candidate): string {
  return [candidate.city, candidate.region].filter(Boolean).join(", ") || "—";
}

function CandidateRow({
  candidate,
  expanded,
  onToggle,
}: {
  candidate: Candidate;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{candidate.name}</span>
              {candidate.provider ? (
                <span className="text-xs text-muted-foreground">via {candidate.provider}</span>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell className="whitespace-nowrap">
          {candidate.vertical ? (VERTICAL_LABELS[candidate.vertical] ?? candidate.vertical) : "—"}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{locationLabel(candidate)}</span>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {typeof candidate.score === "number" ? candidate.score : "—"}
        </TableCell>
        <TableCell>
          <Badge variant={statusVariant(candidate.status)}>
            {STATUS_LABELS[candidate.status] ?? candidate.status}
          </Badge>
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatDate(candidate.updated_at)}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <div className="space-y-4 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Observed</p>
                  <p>{formatDate(candidate.observed_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Website</p>
                  {candidate.website ? (
                    <a
                      href={candidate.website}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                    >
                      {candidate.website}
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="size-3.5" />
                    {candidate.phone ?? "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Dedupe key</p>
                  <p className="break-all text-muted-foreground">{candidate.dedupe_key ?? "—"}</p>
                </div>
                {candidate.merchant_id ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Linked merchant</p>
                    <Link
                      to="/merchants/$id"
                      params={{ id: candidate.merchant_id }}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      Open merchant
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Linked merchant</p>
                    <p className="flex items-center gap-1.5 text-muted-foreground">
                      <Globe className="size-3.5" />
                      Not claimed
                    </p>
                  </div>
                )}
              </div>
              <div className="grid gap-4 lg:grid-cols-3">
                <JsonPreview title="Signals" value={candidate.signals} />
                <JsonPreview title="Evidence" value={candidate.evidence} />
                <JsonPreview title="Payload" value={candidate.payload} />
              </div>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function DiscoveryPage() {
  const session = useSessionState();
  const [searchInput, setSearchInput] = useState("");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: { q?: string } = {};
      if (searchInput.trim()) data.q = searchInput.trim();
      const result = await discoveryCandidatesFn({ data });
      setCandidates(result.candidates);
    } catch (err) {
      setCandidates(null);
      setError(err instanceof Error ? err.message : "Could not load discovery candidates.");
    } finally {
      setLoading(false);
    }
  }, [searchInput]);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [session.status, load]);

  const hasSearch = searchInput.trim() !== "";

  const resetSearch = () => {
    setSearchInput("");
    void load();
  };

  if (session.status === "checking") {
    return <DiscoveryTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view discovery</CardTitle>
          </div>
          <CardDescription>
            Discovery candidates are scoped to your workspace. Sign in to load them.
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
    return <DiscoveryErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && candidates === null) {
    return <DiscoveryTableShimmer />;
  }

  const empty = candidates !== null && candidates.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search candidates…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
        {hasSearch ? (
          <Button size="sm" variant="ghost" onClick={resetSearch}>
            <FilterX className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>

      {empty ? (
        <DiscoveryEmptyState hasSearch={hasSearch} onReset={resetSearch} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {candidates && candidates.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Vertical</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.id}
                      candidate={candidate}
                      expanded={expandedId === candidate.id}
                      onToggle={() =>
                        setExpandedId((current) => (current === candidate.id ? null : candidate.id))
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <DiscoveryTableShimmer />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
