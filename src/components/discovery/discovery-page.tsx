import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Compass,
  Database,
  ExternalLink,
  FilterX,
  Globe,
  MapPin,
  Phone,
  Play,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

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
  claimCandidateFn,
  discoveryCandidateDetailFn,
  discoveryWorkspaceFn,
  dismissCandidateFn,
  promoteCandidateFn,
  refreshCandidateFn,
  runDiscoveryFn,
} from "@/lib/api/console.functions";

type Workspace = Awaited<ReturnType<typeof discoveryWorkspaceFn>>;
type Candidate = Workspace["candidates"][number];
type SourceHealth = Workspace["sourceMeta"][number];
type Run = Workspace["runs"][number];
type CandidateDetail = Awaited<ReturnType<typeof discoveryCandidateDetailFn>>;

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

function runStatusVariant(
  status: Run["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "succeeded":
      return "default";
    case "running":
    case "queued":
      return "secondary";
    case "failed":
      return "destructive";
  }
}

function formatDate(value: string | null): string {
  return value ? format(new Date(value), "MMM d, yyyy") : "—";
}

function formatDateTime(value: string | null): string {
  return value ? format(new Date(value), "MMM d, yyyy HH:mm") : "—";
}

function formatRelative(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

function locationLabel(candidate: Candidate): string {
  return [candidate.city, candidate.region].filter(Boolean).join(", ") || "—";
}

function verticalLabel(value: string | null): string {
  if (!value) return "—";
  return VERTICAL_LABELS[value as keyof typeof VERTICAL_LABELS] ?? value;
}

function jobLocationLabel(run: Run): string {
  return [run.city, run.region].filter(Boolean).join(", ") || "—";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

type ScoreComponent = { key: string; label: string; score: number; weight?: number; note?: string };

function asScoreComponents(value: unknown): ScoreComponent[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is ScoreComponent =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as { key?: unknown }).key === "string",
  );
}

function asWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
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

function SignalsChips({ signals }: { signals: unknown }) {
  const values = asStringArray(signals);
  if (values.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((signal) => (
        <Badge key={signal} variant="secondary" className="font-mono text-[11px]">
          {signal}
        </Badge>
      ))}
    </div>
  );
}

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const tone =
    score >= 60 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-muted-foreground";
  return (
    <div className="flex items-center justify-end gap-2">
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${score >= 60 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-muted-foreground/40"}`}
          style={{ width: `${Math.max(4, Math.min(100, score))}%` }}
        />
      </div>
      <span className={`tabular-nums ${tone}`}>{score}</span>
    </div>
  );
}

// =============== SOURCES / RUN FORM ===============

function SourceRunForm({
  sources,
  onRun,
  running,
}: {
  sources: SourceHealth[];
  onRun: (input: {
    provider: string;
    query?: string;
    city?: string;
    region?: string;
    vertical?: string;
    limit?: number;
  }) => Promise<void>;
  running: boolean;
}) {
  const [provider, setProvider] = useState(
    sources.some((s) => s.provider === "local-demo") ? "local-demo" : (sources[0]?.provider ?? ""),
  );
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [vertical, setVertical] = useState("all");
  const [limit, setLimit] = useState("");

  const selected = sources.find((s) => s.provider === provider) ?? null;
  const capabilities = selected?.capabilities ?? [];
  const showCity = capabilities.includes("city");
  const showRegion = capabilities.includes("region") && !selected?.requiresLocation;
  const showVertical = capabilities.includes("vertical");
  const showLimit = capabilities.includes("limit");
  const needsLocation = Boolean(selected?.requiresLocation);
  const notConfigured = selected ? !selected.configured : false;

  const canRun =
    Boolean(selected) &&
    !running &&
    !notConfigured &&
    (!needsLocation || city.trim() !== "" || region.trim() !== "");

  const handleSubmit = () => {
    if (!canRun) return;
    void onRun({
      provider,
      ...(query.trim() ? { query: query.trim() } : {}),
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(region.trim() ? { region: region.trim() } : {}),
      ...(vertical !== "all" ? { vertical } : {}),
      ...(limit ? { limit: Math.max(1, Math.min(50, Number(limit))) } : {}),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Play className="size-4" />
          Run discovery
        </CardTitle>
        <CardDescription>
          Pick a source and run an acquisition pass. Every record is kept with provenance,
          deduplicated against existing candidates, and scored.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Source</label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.provider} value={source.provider}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selected ? (
              <p className="text-xs text-muted-foreground">
                {selected.kind === "demo"
                  ? "Deterministic demo data — clearly labelled."
                  : selected.description}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Query <span className="text-muted-foreground/60">(business type / name)</span>
            </label>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. bakery"
            />
          </div>
        </div>

        {(showCity || showRegion) && !needsLocation ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {showCity ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Nairobi"
                />
              </div>
            ) : null}
            {showRegion ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Region <span className="text-muted-foreground/60">(state / province)</span>
                </label>
                <Input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="e.g. Nairobi County"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {needsLocation ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">City</label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Nairobi"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Region{" "}
                <span className="text-muted-foreground/60">(geocoded into a search area)</span>
              </label>
              <Input
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Nairobi County"
              />
            </div>
          </div>
        ) : null}

        {(showVertical || showLimit) && !needsLocation ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {showVertical ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Vertical</label>
                <Select value={vertical} onValueChange={setVertical}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any vertical</SelectItem>
                    {VERTICAL_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {VERTICAL_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            {showLimit ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Max records <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="20"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        {notConfigured ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">This source is not configured</p>
              <p className="text-destructive/80">
                {selected?.requires.join(", ") || "No credentials"} is required. Configure it in the
                environment — no results from this source exist yet.
              </p>
            </div>
          </div>
        ) : null}

        {needsLocation && !notConfigured ? (
          <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/40 p-2.5 text-xs text-muted-foreground">
            <MapPin className="mt-0.5 size-4 shrink-0" />
            <p>
              This source searches by location. Provide at least a city so the run can be bounded to
              a search area.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {selected
              ? selected.neverRun
                ? "This source has never run for this workspace."
                : `Last run ${formatRelative(selected.lastJob?.started_at ?? null)} · ${selected.totalRuns} run${selected.totalRuns === 1 ? "" : "s"} total`
              : null}
          </p>
          {running ? (
            <Button disabled>
              <RefreshCw className="size-4 animate-spin" />
              Running…
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canRun}>
              <Play className="size-4" />
              Run source
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// =============== RUN HISTORY ===============

function RunRow({
  run,
  runs,
  expanded,
  candidates,
  onToggle,
}: {
  run: Run;
  runs: Run[];
  expanded: boolean;
  candidates: Candidate[];
  onToggle: () => void;
}) {
  const produced = useMemo(
    () =>
      candidates
        .filter((candidate) => candidate.job_id === run.id)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [candidates, run.id],
  );
  const warnings = asWarnings(run.warnings);
  const isLastRun = runs.findIndex((r) => r.id === run.id) === 0;

  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{run.provider}</span>
              {isLastRun ? (
                <span className="text-[11px] text-muted-foreground">latest run</span>
              ) : null}
            </div>
          </div>
        </TableCell>
        <TableCell className="max-w-40 truncate">{run.query || "—"}</TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">
          {jobLocationLabel(run)}
        </TableCell>
        <TableCell className="whitespace-nowrap">{verticalLabel(run.vertical)}</TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">{run.mode ?? "—"}</TableCell>
        <TableCell>
          <Badge variant={runStatusVariant(run.status)}>{run.status}</Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(run.started_at)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground">
          {formatDateTime(run.finished_at)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {run.received_count ?? "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums">{run.created_count ?? "—"}</TableCell>
        <TableCell className="text-right tabular-nums">{run.updated_count ?? "—"}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {run.deduped_count ?? "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">
          {run.failed_count ?? "—"}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={13} className="bg-muted/30 p-0">
            <div className="space-y-4 p-4">
              {run.error ? (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="font-medium">Run failed</p>
                    <p className="text-destructive/80">{run.error}</p>
                  </div>
                </div>
              ) : null}
              {warnings.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">Warnings</p>
                  <ul className="space-y-1">
                    {warnings.map((warning, i) => (
                      <li key={i} className="text-xs text-muted-foreground">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="grid gap-2 text-xs sm:grid-cols-4">
                <div className="space-y-1 rounded-md border p-2.5">
                  <p className="text-muted-foreground">Found</p>
                  <p className="font-medium tabular-nums">{run.created_count ?? "—"}</p>
                </div>
                <div className="space-y-1 rounded-md border p-2.5">
                  <p className="text-muted-foreground">Refreshed</p>
                  <p className="font-medium tabular-nums">{run.updated_count ?? "—"}</p>
                </div>
                <div className="space-y-1 rounded-md border p-2.5">
                  <p className="text-muted-foreground">Deduplicated</p>
                  <p className="font-medium tabular-nums">{run.deduped_count ?? "—"}</p>
                </div>
                <div className="space-y-1 rounded-md border p-2.5">
                  <p className="text-muted-foreground">Failed records</p>
                  <p className="font-medium tabular-nums">{run.failed_count ?? "—"}</p>
                </div>
              </div>
              {produced.length > 0 ? (
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Candidates produced ({produced.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {produced.map((candidate) => (
                      <Badge key={candidate.id} variant="secondary">
                        {candidate.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
              {run.query || run.city || run.region ? (
                <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                  <span className="rounded-md bg-muted px-2 py-0.5">
                    query: {run.query || "default"}
                  </span>
                  {run.city ? (
                    <span className="rounded-md bg-muted px-2 py-0.5">city: {run.city}</span>
                  ) : null}
                  {run.region ? (
                    <span className="rounded-md bg-muted px-2 py-0.5">region: {run.region}</span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function RunHistoryCard({
  runs,
  candidates,
  expandedRunId,
  onToggleRun,
}: {
  runs: Run[];
  candidates: Candidate[];
  expandedRunId: string | null;
  onToggleRun: (id: string) => void;
}) {
  if (runs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run history</CardTitle>
          <CardDescription>
            No discovery runs yet. Start one above — every record is audited through this list.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="size-4" />
          Runs will appear here with their full counters.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Run history</CardTitle>
        <CardDescription>
          What each pass found, refreshed, deduplicated, and failed — without digging through logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Query</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Vertical</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="whitespace-nowrap">Started</TableHead>
              <TableHead className="whitespace-nowrap">Finished</TableHead>
              <TableHead className="text-right">Received</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="text-right">Refreshed</TableHead>
              <TableHead className="text-right">Deduped</TableHead>
              <TableHead className="text-right">Failed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                runs={runs}
                candidates={candidates}
                expanded={expandedRunId === run.id}
                onToggle={() => onToggleRun(run.id)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// =============== CANDIDATE DETAIL ===============

function FactItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function CandidateDetailCard({
  detail,
  onOpenMerchant,
  onPromoted,
}: {
  detail: CandidateDetail;
  onOpenMerchant: (candidateId: string) => void;
  onPromoted: () => void;
}) {
  const candidate = detail.candidate;
  const [busy, setBusy] = useState<"promote" | "dismiss" | "claim" | "refresh" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const components = asScoreComponents(candidate.score_components);
  const signals = asStringArray(candidate.signals);
  const observations = detail.observations;
  const sourceRecords = detail.sourceRecords;
  const duplicates = detail.duplicates;
  const probe = detail.probe ? asRecord(detail.probe.payload) : null;
  const promoted = candidate.promoted_at != null;

  const runAction = async (
    kind: "promote" | "dismiss" | "claim" | "refresh",
    action: () => Promise<unknown>,
  ) => {
    setBusy(kind);
    setActionError(null);
    try {
      await action();
      await onPromoted();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : `${kind} failed.`);
    } finally {
      setBusy(null);
    }
  };

  const merchantLink = candidate.merchant_id ? (
    <Link
      to="/admin/merchants/$id"
      params={{ id: candidate.merchant_id }}
      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
    >
      Open merchant <ExternalLink className="size-3.5" />
    </Link>
  ) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{candidate.name}</CardTitle>
            <CardDescription className="mt-0.5 flex flex-wrap items-center gap-2">
              <span>via {candidate.provider}</span>
              {candidate.origin ? <span>· origin {candidate.origin}</span> : null}
              <span>· {formatRelative(candidate.first_seen_at)}</span>
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {promoted ? (
              <Badge>
                <CheckCircle2 className="size-3.5" />
                Promoted
              </Badge>
            ) : (
              <Badge variant={statusVariant(candidate.status)}>
                {STATUS_LABELS[candidate.status] ?? candidate.status}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <FactItem label="Vertical">{verticalLabel(candidate.vertical)}</FactItem>
            <FactItem label="Location">{locationLabel(candidate)}</FactItem>
            <FactItem label="Phone">
              {candidate.phone ? (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Phone className="size-3.5" />
                  {candidate.phone}
                </span>
              ) : (
                "—"
              )}
            </FactItem>
            <FactItem label="Website">
              {candidate.website ? (
                <a
                  href={candidate.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                >
                  {candidate.domain ?? candidate.website}
                  <ExternalLink className="size-3.5" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </FactItem>
            <FactItem label="External ID">
              <span className="font-mono text-xs text-muted-foreground">
                {candidate.external_id ?? "—"}
              </span>
            </FactItem>
            <FactItem label="Source">
              {candidate.source_url ? (
                <a
                  href={candidate.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                >
                  Open source <ExternalLink className="size-3.5" />
                </a>
              ) : (
                candidate.provider
              )}
            </FactItem>
            <FactItem label="First seen">{formatDate(candidate.first_seen_at)}</FactItem>
            <FactItem label="Last refreshed">
              {candidate.last_refreshed_at ? formatRelative(candidate.last_refreshed_at) : "—"}
            </FactItem>
            <FactItem label="Refresh count">{candidate.refresh_count ?? 0}</FactItem>
          </div>
          <div className="w-full shrink-0 md:w-44">
            <div className="rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">Acquisition score</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{candidate.score ?? "—"}</p>
              {components.length > 0 ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {components.length} contributing factors
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Scoring breakdown</p>
          {components.length > 0 ? (
            <div className="space-y-1.5">
              {components.map((component) => (
                <div key={component.key} className="flex flex-col gap-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{component.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {component.score}
                      {component.weight != null ? ` (w ${component.weight})` : ""}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full ${
                        component.score >= 60
                          ? "bg-emerald-500"
                          : component.score >= 40
                            ? "bg-amber-500"
                            : "bg-muted-foreground/40"
                      }`}
                      style={{ width: `${Math.max(4, Math.min(100, component.score))}%` }}
                    />
                  </div>
                  {component.note ? (
                    <p className="text-[11px] text-muted-foreground">{component.note}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No breakdown recorded.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Signals</p>
          <SignalsChips signals={signals} />
        </div>

        {candidate.match_reason || candidate.duplicate_of ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-600/30 bg-amber-500/5 p-2.5 text-xs">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              {candidate.duplicate_of ? (
                <p>
                  <span className="font-medium">Duplicate.</span> This candidate was merged into a
                  higher-scoring match.{" "}
                  <button
                    onClick={() => onOpenMerchant(candidate.duplicate_of!)}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    View surviving candidate →
                  </button>
                </p>
              ) : (
                <p className="font-medium">This candidate is the survivor of a duplicate merge.</p>
              )}
              {candidate.match_reason ? (
                <p className="text-muted-foreground">Matched by: {candidate.match_reason}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {duplicates.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Deduplicated into this candidate
            </p>
            <div className="flex flex-wrap gap-1.5">
              {duplicates.map((duplicate) => (
                <button
                  key={duplicate.id}
                  onClick={() => onOpenMerchant(duplicate.id)}
                  className="rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  {duplicate.name} · {duplicate.provider} · score {duplicate.score ?? "—"}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Source records</p>
            {sourceRecords.length > 0 ? (
              <div className="space-y-2">
                {sourceRecords.map((record) => (
                  <div key={record.id} className="rounded-md border p-2.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {(record.source_connectors as unknown as { name?: string } | null)?.name ??
                          record.provider}
                      </span>
                      <span className="text-muted-foreground">
                        {formatRelative(record.fetched_at)}
                      </span>
                    </div>
                    {record.kind ? (
                      <p className="text-muted-foreground">kind: {record.kind}</p>
                    ) : null}
                    {record.external_id ? (
                      <p className="break-all font-mono text-[11px] text-muted-foreground">
                        {record.external_id}
                      </p>
                    ) : null}
                    {record.source_url ? (
                      <a
                        href={record.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all text-primary underline-offset-4 hover:underline"
                      >
                        Source <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No source records stored yet.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Website probe</p>
            {probe ? (
              <div className="rounded-md border p-2.5 text-xs">
                <div className="flex items-center gap-2">
                  {probe["reachable"] ? (
                    <Badge variant="secondary">
                      <CheckCircle2 className="size-3.5" />
                      Reachable
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <CircleAlert className="size-3.5" />
                      Unreachable
                    </Badge>
                  )}
                  {probe["statusCode"] ? (
                    <span className="text-muted-foreground">
                      HTTP {String(probe["statusCode"])}
                    </span>
                  ) : null}
                  {typeof probe["latencyMs"] === "number" ? (
                    <span className="text-muted-foreground">{probe["latencyMs"]}ms</span>
                  ) : null}
                </div>
                {probe["title"] ? (
                  <p className="mt-2 font-medium">{String(probe["title"])}</p>
                ) : null}
                {probe["metaDescription"] ? (
                  <p className="mt-1 text-muted-foreground">{String(probe["metaDescription"])}</p>
                ) : null}
                {probe["error"] ? (
                  <p className="mt-2 text-destructive">{String(probe["error"])}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No website probe recorded yet. Run discovers with sites, then refresh this candidate
                to probe it.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Observations</p>
          {observations.length > 0 ? (
            <div className="max-h-48 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Field</TableHead>
                    <TableHead className="text-right">Observed</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {observations.map((observation) => (
                    <TableRow key={observation.id}>
                      <TableCell className="font-mono text-xs">{observation.field_path}</TableCell>
                      <TableCell className="max-w-40 truncate text-xs">
                        {observation.observed_value ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {observation.provider}
                      </TableCell>
                      <TableCell className="text-xs">{observation.status}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-xs">
                        {formatRelative(observation.observed_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No observations recorded.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
          <pre className="max-h-40 overflow-auto rounded-md bg-muted/60 p-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words">
            {JSON.stringify(candidate.evidence ?? {}, null, 2)}
          </pre>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          {!promoted && !candidate.merchant_id ? (
            <>
              <Button
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void runAction("promote", () =>
                    promoteCandidateFn({ data: { candidateId: candidate.id } }),
                  )
                }
              >
                <Sparkles className="size-4" />
                {busy === "promote" ? "Promoting…" : "Promote to merchant"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() =>
                  void runAction("claim", () =>
                    claimCandidateFn({ data: { candidateId: candidate.id } }),
                  )
                }
              >
                {busy === "claim" ? "Claiming…" : "Claim"}
              </Button>
            </>
          ) : merchantLink ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Linked to a merchant — {merchantLink}
            </div>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() =>
              void runAction("refresh", () =>
                refreshCandidateFn({ data: { candidateId: candidate.id } }),
              )
            }
          >
            <RefreshCw className={busy === "refresh" ? "size-4 animate-spin" : "size-4"} />
            {busy === "refresh" ? "Refreshing…" : "Refresh from source"}
          </Button>
          {!promoted && candidate.status !== "dismissed" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={busy !== null}
              onClick={() =>
                void runAction("dismiss", () =>
                  dismissCandidateFn({ data: { candidateId: candidate.id } }),
                )
              }
            >
              <X className="size-4" />
              {busy === "dismiss" ? "Dismissing…" : "Dismiss"}
            </Button>
          ) : null}
          {actionError ? <p className="w-full text-xs text-destructive">{actionError}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

// =============== CANDIDATE TABLE ===============

type Filters = {
  search: string;
  provider: string;
  origin: string;
  vertical: string;
  status: string;
  minScore: string;
  maxScore: string;
  since: string;
  promoted: string;
  duplicates: string;
  website: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  provider: "all",
  origin: "all",
  vertical: "all",
  status: "all",
  minScore: "",
  maxScore: "",
  since: "",
  promoted: "all",
  duplicates: "all",
  website: "all",
};

function CandidateRow({
  candidate,
  expanded,
  onToggle,
}: {
  candidate: Candidate;
  expanded: boolean;
  onToggle: () => void;
}) {
  const signals = asStringArray(candidate.signals);
  const isDuplicate = candidate.duplicate_of != null;
  const hasWebsite = candidate.website != null;

  return (
    <TableRow className="cursor-pointer" onClick={onToggle}>
      <TableCell>
        <div className="flex items-center gap-2">
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{candidate.name}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {hasWebsite ? <Globe className="size-3" /> : null}
              {candidate.provider}
              {candidate.origin ? ` · ${candidate.origin}` : ""}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{verticalLabel(candidate.vertical)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <span className="truncate">{locationLabel(candidate)}</span>
        </div>
      </TableCell>
      <TableCell className="max-w-36">
        <div className="flex flex-wrap gap-1">
          {signals.slice(0, 3).map((signal) => (
            <Badge key={signal} variant="outline" className="font-mono text-[11px]">
              {signal}
            </Badge>
          ))}
          {signals.length > 3 ? <Badge variant="outline">+{signals.length - 3}</Badge> : null}
          {!hasWebsite ? (
            <Badge variant="secondary" className="text-[11px]">
              no website
            </Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <ScoreCell score={candidate.score} />
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(candidate.status)}>
          {STATUS_LABELS[candidate.status] ?? candidate.status}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right text-muted-foreground">
        {formatRelative(candidate.first_seen_at)}
      </TableCell>
    </TableRow>
  );
}

export function DiscoveryPage() {
  const session = useSessionState();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runNotice, setRunNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await discoveryWorkspaceFn();
      setWorkspace(result);
    } catch (err) {
      setWorkspace(null);
      setError(err instanceof Error ? err.message : "Could not load the discovery workspace.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void loadWorkspace();
  }, [session.status, loadWorkspace]);

  const loadDetail = useCallback(async (candidateId: string) => {
    setDetailLoading(true);
    try {
      const result = await discoveryCandidateDetailFn({ data: { candidateId } });
      setSelectedId(candidateId);
      setDetail(result);
    } catch (err) {
      setDetail(null);
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const refreshAfterMutation = useCallback(async () => {
    await loadWorkspace();
    if (selectedId) await loadDetail(selectedId);
  }, [loadWorkspace, loadDetail, selectedId]);

  const handleRun = useCallback(
    async (input: {
      provider: string;
      query?: string;
      city?: string;
      region?: string;
      vertical?: string;
      limit?: number;
    }) => {
      if (running) return;
      setRunning(true);
      setRunNotice(null);
      try {
        const { result } = await runDiscoveryFn({ data: input });
        setRunNotice({
          ok: true,
          text: `${result.provider}: ${result.foundCount} found · ${result.createdCount} new · ${result.updatedCount} refreshed · ${result.dedupedCount} deduped.`,
        });
        await loadWorkspace();
      } catch (err) {
        setRunNotice({
          ok: false,
          text: `Run failed: ${err instanceof Error ? err.message : "Discovery run failed."}`,
        });
        await loadWorkspace();
      } finally {
        setRunning(false);
      }
    },
    [running, loadWorkspace],
  );

  const handleSelectCandidate = (candidateId: string) => {
    if (selectedId === candidateId && detail) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    void loadDetail(candidateId);
  };

  const openDuplicate = (candidateId: string) => {
    void loadDetail(candidateId);
  };

  const originOptions = useMemo(() => {
    const origins = new Set<string>();
    for (const candidate of workspace?.candidates ?? []) {
      if (candidate.origin) origins.add(candidate.origin);
    }
    return Array.from(origins).sort();
  }, [workspace]);

  const filteredCandidates = useMemo(() => {
    const candidates = workspace?.candidates ?? [];
    let list = [...candidates];
    if (filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(term));
    }
    if (filters.provider !== "all") list = list.filter((c) => c.provider === filters.provider);
    if (filters.origin !== "all") list = list.filter((c) => c.origin === filters.origin);
    if (filters.vertical !== "all" && filters.vertical !== "") {
      list = list.filter((c) => c.vertical === filters.vertical);
    }
    if (filters.status !== "all") list = list.filter((c) => c.status === filters.status);
    const minScore = filters.minScore ? Number(filters.minScore) : null;
    const maxScore = filters.maxScore ? Number(filters.maxScore) : null;
    if (minScore != null && !Number.isNaN(minScore))
      list = list.filter((c) => (c.score ?? 0) >= minScore);
    if (maxScore != null && !Number.isNaN(maxScore))
      list = list.filter((c) => (c.score ?? 0) <= maxScore);
    if (filters.since) {
      const since = new Date(filters.since);
      if (!Number.isNaN(since.getTime())) {
        list = list.filter((c) => (c.first_seen_at ? new Date(c.first_seen_at) >= since : false));
      }
    }
    if (filters.promoted === "promoted") list = list.filter((c) => c.promoted_at != null);
    if (filters.promoted === "not-promoted") list = list.filter((c) => c.promoted_at == null);
    if (filters.duplicates === "duplicates") list = list.filter((c) => c.duplicate_of != null);
    if (filters.duplicates === "no-duplicates") list = list.filter((c) => c.duplicate_of == null);
    if (filters.website === "with-website") list = list.filter((c) => c.website != null);
    if (filters.website === "without-website") list = list.filter((c) => c.website == null);
    return list;
  }, [workspace, filters]);

  const totalCandidates = workspace?.candidates.length ?? 0;
  const hasFilters = Object.entries(filters).some(
    ([key, value]) => key !== "search" && value !== DEFAULT_FILTERS[key as keyof Filters],
  );

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (session.status === "checking") {
    return <DiscoveryTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Sign in to view discovery</CardTitle>
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
    return (
      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive" />
            <CardTitle className="text-base">Could not load the discovery workspace</CardTitle>
          </div>
          <CardDescription>
            You are signed in, but the discovery workspace could not be loaded. This may mean no
            workspace membership exists for this account, or the console backend is not configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={() => void loadWorkspace()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (loading && workspace === null) {
    return <DiscoveryTableShimmer />;
  }

  const candidates = workspace?.candidates ?? [];
  const sources = workspace?.sourceMeta ?? [];
  const runs = workspace?.runs ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">Acquisition</p>
          <p className="text-xs text-muted-foreground">
            Discover local businesses from real sources, deduplicate them into surviving candidates,
            and promote the ones worth onboarding. Every step is kept as evidence.
          </p>
        </div>
      </div>

      {runNotice ? (
        <div
          className={`rounded-md border p-2.5 text-xs ${
            runNotice.ok
              ? "border-border bg-muted/50 text-muted-foreground"
              : "border-destructive/40 bg-destructive/5 text-destructive"
          }`}
        >
          {runNotice.text}
        </div>
      ) : null}

      <SourceRunForm sources={sources} running={running} onRun={handleRun} />

      {detailLoading ? (
        <DiscoveryTableShimmer />
      ) : detail ? (
        <CandidateDetailCard
          detail={detail}
          onOpenMerchant={openDuplicate}
          onPromoted={() => void refreshAfterMutation()}
        />
      ) : null}

      <RunHistoryCard
        runs={runs}
        candidates={candidates}
        expandedRunId={expandedRunId}
        onToggleRun={(id) => setExpandedRunId((current) => (current === id ? null : id))}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                <span className="flex items-center gap-2">
                  <Compass className="size-4" />
                  Candidates
                  <Badge variant="secondary" className="tabular-nums">
                    {filteredCandidates.length}
                    {totalCandidates > filteredCandidates.length ? ` of ${totalCandidates}` : ""}
                  </Badge>
                </span>
              </CardTitle>
              <CardDescription>
                Filter by source, origin, vertical, status, score, freshness, promotion, duplicates,
                or website presence.
              </CardDescription>
            </div>
            {hasFilters ? (
              <Button size="sm" variant="ghost" onClick={resetFilters}>
                <FilterX className="size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search candidates…"
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={filters.provider}
              onValueChange={(value) => setFilter("provider", value)}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {sources.map((source) => (
                  <SelectItem key={source.provider} value={source.provider}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {originOptions.length > 0 ? (
              <Select value={filters.origin} onValueChange={(value) => setFilter("origin", value)}>
                <SelectTrigger className="w-full lg:w-40">
                  <SelectValue placeholder="Origin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All origins</SelectItem>
                  {originOptions.map((origin) => (
                    <SelectItem key={origin} value={origin}>
                      {origin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={filters.vertical}
              onValueChange={(value) => setFilter("vertical", value)}
            >
              <SelectTrigger className="w-full lg:w-40">
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
            <Select value={filters.status} onValueChange={(value) => setFilter("status", value)}>
              <SelectTrigger className="w-full lg:w-40">
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
              value={filters.promoted}
              onValueChange={(value) => setFilter("promoted", value)}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Promotion" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All promotion</SelectItem>
                <SelectItem value="promoted">Promoted</SelectItem>
                <SelectItem value="not-promoted">Not promoted</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.duplicates}
              onValueChange={(value) => setFilter("duplicates", value)}
            >
              <SelectTrigger className="w-full lg:w-40">
                <SelectValue placeholder="Duplicates" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All duplicates</SelectItem>
                <SelectItem value="duplicates">Duplicates / conflicts only</SelectItem>
                <SelectItem value="no-duplicates">No duplicates</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.website} onValueChange={(value) => setFilter("website", value)}>
              <SelectTrigger className="w-full lg:w-44">
                <SelectValue placeholder="Website" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any website</SelectItem>
                <SelectItem value="with-website">With website</SelectItem>
                <SelectItem value="without-website">No website</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:max-w-md">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Min score</label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0"
                value={filters.minScore}
                onChange={(e) => setFilter("minScore", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Max score</label>
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="100"
                value={filters.maxScore}
                onChange={(e) => setFilter("maxScore", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">
                First seen after
              </label>
              <Input
                type="date"
                value={filters.since}
                onChange={(e) => setFilter("since", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardContent className="border-t p-0">
          {filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Compass className="size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {totalCandidates === 0
                  ? "No discovery candidates"
                  : "No candidates match your filters"}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {totalCandidates === 0
                  ? "Run a discovery pass above to surface local businesses from connected sources."
                  : "Try widening the filters, or clear them to see everything."}
              </p>
              {totalCandidates > 0 ? (
                <Button size="sm" variant="outline" onClick={resetFilters}>
                  <FilterX className="size-4" />
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidate</TableHead>
                  <TableHead>Vertical</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Signals</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">First seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((candidate) => (
                  <CandidateRow
                    key={candidate.id}
                    candidate={candidate}
                    expanded={selectedId === candidate.id}
                    onToggle={() => handleSelectCandidate(candidate.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
