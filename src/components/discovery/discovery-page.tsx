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
  Play,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { useSessionState } from "@/hooks/use-session-state";
import {
  discoveryCandidatesFn,
  promoteCandidateFn,
  runDiscoveryFn,
} from "@/lib/api/console.functions";

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
  onPromoted,
}: {
  candidate: Candidate;
  expanded: boolean;
  onToggle: () => void;
  onPromoted: () => void;
}) {
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const canPromote = candidate.status !== "claimed" && !candidate.merchant_id;

  const handlePromote = async () => {
    setPromoting(true);
    setPromoteError(null);
    try {
      await promoteCandidateFn({ data: { candidateId: candidate.id } });
      onPromoted();
    } catch (err) {
      setPromoteError(err instanceof Error ? err.message : "Promote failed.");
    } finally {
      setPromoting(false);
    }
  };

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
              {canPromote ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Actions</p>
                  <Button
                    size="sm"
                    disabled={promoting}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handlePromote();
                    }}
                  >
                    {promoting ? "Promoting…" : "Promote to merchant"}
                  </Button>
                  {promoteError ? <p className="text-xs text-destructive">{promoteError}</p> : null}
                </div>
              ) : candidate.merchant_id ? (
                <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                  Already linked to a merchant.
                </div>
              ) : null}
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
  const [status, setStatus] = useState<string>("all");
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  const handleRunDiscovery = async () => {
    if (running) return;
    setRunning(true);
    setRunNotice(null);
    try {
      const { result } = await runDiscoveryFn({ data: {} });
      setRunNotice(
        `Run complete: ${result.foundCount} found · ${result.createdCount} created · ${result.updatedCount} updated (mock).`,
      );
      await load();
    } catch (err) {
      setRunNotice(`Run failed: ${err instanceof Error ? err.message : "Discovery run failed."}`);
      await load();
    } finally {
      setRunning(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: { q?: string; status?: string } = {};
      if (searchInput.trim()) data.q = searchInput.trim();
      if (status !== "all") data.status = status;
      const result = await discoveryCandidatesFn({ data });
      setCandidates(result.candidates);
    } catch (err) {
      setCandidates(null);
      setError(err instanceof Error ? err.message : "Could not load discovery candidates.");
    } finally {
      setLoading(false);
    }
  }, [searchInput, status]);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [session.status, load]);

  const hasFilters = searchInput.trim() !== "" || status !== "all";

  const resetFilters = () => {
    setSearchInput("");
    setStatus("all");
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Mock discovery source</p>
          <p className="text-xs text-muted-foreground">
            Runs generate local-business prospects from a local mock registry and refresh them on
            follow-up runs. Promotion to a merchant stays manual.
          </p>
        </div>
        <Button onClick={handleRunDiscovery} disabled={running} className="sm:w-auto">
          {running ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run discovery
            </>
          )}
        </Button>
      </div>
      {runNotice ? (
        <div
          className={`rounded-md border p-2.5 text-xs ${
            runNotice.startsWith("Run failed")
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border bg-muted/50 text-muted-foreground"
          }`}
        >
          {runNotice}
        </div>
      ) : null}
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
        {hasFilters ? (
          <Button size="sm" variant="ghost" onClick={resetFilters}>
            <FilterX className="size-4" />
            Clear
          </Button>
        ) : null}
      </div>

      {empty ? (
        <DiscoveryEmptyState hasSearch={hasFilters} onReset={resetFilters} />
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
                      onPromoted={() => void load()}
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
