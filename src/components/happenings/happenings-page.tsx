import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FilterX,
  ListFilter,
  Search,
  TriangleAlert,
  Webhook,
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
import { happeningsListFn, updateHappeningStatusFn } from "@/lib/api/console.functions";

type HappeningsPayload = Awaited<ReturnType<typeof happeningsListFn>>;
type Happening = HappeningsPayload["happenings"][number];

const KIND_VALUES = ["event", "promotion", "announcement", "menu_change", "hours_change"] as const;
const STATUS_VALUES = ["draft", "in_review", "approved", "published", "rejected"] as const;

const KIND_LABELS: Record<(typeof KIND_VALUES)[number], string> = {
  event: "Event",
  promotion: "Promotion",
  announcement: "Announcement",
  menu_change: "Menu change",
  hours_change: "Hours change",
};

const STATUS_LABELS: Record<(typeof STATUS_VALUES)[number], string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  rejected: "Rejected",
};

const ALLOWED_TRANSITIONS: Record<Happening["status"], { status: string; label: string }[]> = {
  draft: [
    { status: "in_review", label: "Submit for review" },
    { status: "rejected", label: "Reject" },
  ],
  in_review: [
    { status: "approved", label: "Approve" },
    { status: "rejected", label: "Reject" },
  ],
  approved: [{ status: "published", label: "Publish" }],
  published: [],
  rejected: [{ status: "draft", label: "Reopen as draft" }],
};

function statusVariant(
  status: Happening["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "published":
      return "default";
    case "approved":
    case "in_review":
      return "secondary";
    case "draft":
      return "outline";
    case "rejected":
      return "destructive";
  }
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

function HappeningsTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function HappeningsEmptyState({
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
          <Webhook className="size-5" />
        </div>
        <CardTitle className="text-base">
          {hasFilters ? "No matches" : "No happenings yet"}
        </CardTitle>
        <CardDescription>
          {hasFilters
            ? "No happenings match your current search and filters."
            : "Happenings appear here as events, promotions, and announcements are ingested for your merchants."}
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

function HappeningsErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load happenings</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but happenings could not be loaded. This may mean no workspace
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

function HappeningRow({
  happening,
  expanded,
  onToggle,
  onStatusChanged,
}: {
  happening: Happening;
  expanded: boolean;
  onToggle: () => void;
  onStatusChanged: () => void;
}) {
  const merchant = happening.merchants;
  const transitions = ALLOWED_TRANSITIONS[happening.status] ?? [];
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    setUpdateError(null);
    setUpdateSuccess(null);
    try {
      await updateHappeningStatusFn({
        data: {
          happeningId: happening.id,
          status: newStatus as Happening["status"],
        },
      });
      setUpdateSuccess(`Status changed to ${STATUS_LABELS[newStatus as Happening["status"]]}.`);
      onStatusChanged();
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setUpdating(false);
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
              <span className="truncate font-medium">{happening.title}</span>
              <span className="text-xs text-muted-foreground">
                {KIND_LABELS[happening.kind] ?? happening.kind}
                {happening.origin ? ` · ${happening.origin}` : ""}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>
          {merchant ? (
            <Link
              to="/merchants/$id"
              params={{ id: happening.merchant_id }}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              {merchant.name}
              <ExternalLink className="size-3.5" />
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant={statusVariant(happening.status)}>
            {STATUS_LABELS[happening.status] ?? happening.status}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">{formatDate(happening.updated_at)}</span>
          </div>
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-0">
            <div className="space-y-4 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Created</p>
                  <p>{formatDate(happening.created_at)}</p>
                </div>
                {happening.published_at ? (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Published</p>
                    <p>{formatDate(happening.published_at)}</p>
                  </div>
                ) : null}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Verified</p>
                  <p>{happening.verified ? "Yes" : "No"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Source</p>
                  <p className="break-all text-muted-foreground">
                    {happening.source_url ?? happening.source_kind ?? "—"}
                  </p>
                </div>
              </div>
              {happening.body ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Suggested content</p>
                  <p className="rounded-md bg-muted/60 p-2.5 text-sm whitespace-pre-wrap break-words">
                    {happening.body}
                  </p>
                </div>
              ) : null}
              {happening.evidence_excerpt ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Evidence excerpt</p>
                  <p className="rounded-md bg-muted/60 p-2.5 text-sm text-muted-foreground italic">
                    {happening.evidence_excerpt}
                  </p>
                </div>
              ) : null}
              {happening.ai_confidence !== null && happening.ai_confidence !== undefined ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">AI confidence</p>
                  <p>
                    {Math.round(happening.ai_confidence * 100)}%
                    {happening.ai_model ? ` · ${happening.ai_model}` : ""}
                  </p>
                </div>
              ) : null}
              {transitions.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {transitions.map((t) => (
                      <Button
                        key={t.status}
                        size="sm"
                        variant={
                          t.status === "rejected"
                            ? "destructive"
                            : t.status === "published"
                              ? "default"
                              : "outline"
                        }
                        disabled={updating}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleStatusChange(t.status);
                        }}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  {updateError ? (
                    <p className="text-xs text-destructive">{updateError}</p>
                  ) : updateSuccess ? (
                    <p className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="size-3.5" />
                      {updateSuccess}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                  No further status transitions available from this state.
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function HappeningsPage() {
  const session = useSessionState();
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [kind, setKind] = useState<string>("all");
  const [happenings, setHappenings] = useState<Happening[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data: { q?: string; status?: string; kind?: string } = {};
      if (searchInput.trim()) data.q = searchInput.trim();
      if (status !== "all") data.status = status;
      if (kind !== "all") data.kind = kind;
      const result = await happeningsListFn({ data });
      setHappenings(result.happenings);
    } catch (err) {
      setHappenings(null);
      setError(err instanceof Error ? err.message : "Could not load happenings.");
    } finally {
      setLoading(false);
    }
  }, [searchInput, status, kind]);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    const timer = setTimeout(() => void load(), 300);
    return () => clearTimeout(timer);
  }, [session.status, load]);

  const hasFilters = searchInput.trim() !== "" || status !== "all" || kind !== "all";

  const resetFilters = () => {
    setSearchInput("");
    setStatus("all");
    setKind("all");
    void load();
  };

  if (session.status === "checking") {
    return <HappeningsTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view happenings</CardTitle>
          </div>
          <CardDescription>
            Happenings are scoped to your workspace. Sign in to load them.
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
    return <HappeningsErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && happenings === null) {
    return <HappeningsTableShimmer />;
  }

  const empty = happenings !== null && happenings.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by title…"
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

        <Select value={kind} onValueChange={(value) => setKind(value === "all" ? "all" : value)}>
          <SelectTrigger className="w-full sm:w-44">
            <div className="flex items-center gap-1.5">
              <ListFilter className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Kind" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {KIND_VALUES.map((value) => (
              <SelectItem key={value} value={value}>
                {KIND_LABELS[value]}
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
        <HappeningsEmptyState hasFilters={hasFilters} onReset={resetFilters} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {happenings && happenings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Happening</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {happenings.map((happening) => (
                    <HappeningRow
                      key={happening.id}
                      happening={happening}
                      expanded={expandedId === happening.id}
                      onToggle={() =>
                        setExpandedId((current) => (current === happening.id ? null : happening.id))
                      }
                      onStatusChanged={() => void load()}
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <HappeningsTableShimmer />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
