import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  Eye,
  Info,
  Play,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  merchantsListFn,
  runMockVisibilityFn,
  visibilityRunsFn,
} from "@/lib/api/console.functions";

type RunsPayload = Awaited<ReturnType<typeof visibilityRunsFn>>;
type MerchantOption = { id: string; name: string };
type Run = RunsPayload["runs"][number];

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

function runVariant(status: Run["status"]): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "succeeded":
      return "default";
    case "queued":
    case "running":
      return "secondary";
    case "failed":
      return "destructive";
  }
}

const STATUS_LABELS: Record<Run["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

function VisibilityTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function VisibilityErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load visibility runs</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but visibility runs could not be loaded. This may mean no workspace
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

const MOCK_PROVIDER_NOTE =
  "Runs a local readiness estimate computed from the merchant\u2019s own data. No external AI provider is called, and rows are persisted and labelled as mock.";

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: Run;
  expanded: boolean;
  onToggle: () => void;
}) {
  const merchant = (run as { merchants: { name: string } | null }).merchants;
  const mode = run.mode === "live" ? "Live provider" : "Local evaluation";
  const modeVariant: "default" | "secondary" | "outline" =
    run.mode === "live" ? "default" : "secondary";
  const engines = (run.engines as unknown[] | null) ?? [];
  return (
    <>
      <TableRow className="cursor-pointer" onClick={onToggle}>
        <TableCell>
          <div className="flex items-center gap-2">
            <ChevronDown
              className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "" : "-rotate-90"}`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{merchant?.name ?? "Merchant"}</span>
              <span className="text-xs text-muted-foreground">
                {engines.length > 0
                  ? engines
                      .map((e) => (e as { engine?: string }).engine ?? (e as string))
                      .join(", ")
                  : run.provider}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={runVariant(run.status)}>{STATUS_LABELS[run.status] ?? run.status}</Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Cpu className="size-3.5 shrink-0" />
            <span className="whitespace-nowrap">{mode}</span>
          </div>
        </TableCell>
        <TableCell className="text-right text-muted-foreground">
          {formatDate(run.started_at)}
        </TableCell>
      </TableRow>
      {expanded ? (
        <TableRow>
          <TableCell colSpan={4} className="bg-muted/30 p-0">
            <div className="space-y-4 p-4">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Merchant</p>
                  {merchant ? (
                    <Link
                      to="/merchants/$id"
                      params={{ id: run.merchant_id }}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {merchant.name}
                      <ExternalLink className="size-3.5" />
                    </Link>
                  ) : (
                    <p className="text-muted-foreground">—</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Mode</p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Badge variant={modeVariant}>{mode}</Badge>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Provider</p>
                  <p>{run.provider}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">System version</p>
                  <p className="break-all text-muted-foreground">{run.system_version ?? "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Cost (USD)</p>
                  <p>
                    {run.cost_usd !== null && run.cost_usd !== undefined
                      ? `$${run.cost_usd.toFixed(4)}`
                      : "—"}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Started</p>
                  <p>{formatDate(run.started_at)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Finished</p>
                  <p>{run.finished_at ? formatDate(run.finished_at) : "—"}</p>
                </div>
              </div>
              {run.error ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Error</p>
                  <p className="rounded-md bg-destructive/10 p-2.5 text-xs text-destructive break-words">
                    {run.error}
                  </p>
                </div>
              ) : null}
              {(run.warnings as unknown[] | null) && (run.warnings as unknown[]).length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Warnings</p>
                  {((run.warnings as unknown[]) ?? []).map((warn, index) => (
                    <p
                      key={index}
                      className="flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground"
                    >
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {String(warn)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function VisibilityPage() {
  const session = useSessionState();
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [merchants, setMerchants] = useState<MerchantOption[] | null>(null);
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [runResult, merchantResult] = await Promise.all([
        visibilityRunsFn({ data: {} }),
        merchantsListFn({ data: {} }),
      ]);
      setRuns(runResult.runs);
      setMerchants(merchantResult.merchants.map((m) => ({ id: m.id, name: m.name })));
    } catch (err) {
      setRuns(null);
      setMerchants(null);
      setError(err instanceof Error ? err.message : "Could not load visibility runs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

  const handleRunMock = async () => {
    if (!selectedMerchantId) return;
    setRunning(true);
    setRunError(null);
    setRunFeedback(null);
    try {
      const result = await runMockVisibilityFn({ data: { merchantId: selectedMerchantId } });
      setRunFeedback(
        `Local readiness run complete — ${result.result.snapshots} snapshot(s) recorded.`,
      );
      const fresh = await visibilityRunsFn({ data: {} });
      setRuns(fresh.runs);
      setExpandedId(result.result.runId);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Could not run local visibility.");
    } finally {
      setRunning(false);
    }
  };

  if (session.status === "checking") {
    return <VisibilityTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view visibility</CardTitle>
          </div>
          <CardDescription>
            Visibility runs and scores are scoped to your workspace. Sign in to load them.
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
    return <VisibilityErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && runs === null) {
    return <VisibilityTableShimmer />;
  }

  const empty = runs !== null && runs.length === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <Select
                value={selectedMerchantId}
                onValueChange={(value) => {
                  setSelectedMerchantId(value);
                  setRunFeedback(null);
                  setRunError(null);
                }}
              >
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Select a merchant" />
                </SelectTrigger>
                <SelectContent>
                  {merchants && merchants.length > 0 ? (
                    merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No merchants yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                disabled={!selectedMerchantId || running}
                onClick={() => void handleRunMock()}
              >
                <Play className="size-4" />
                {running ? "Running…" : "Run local visibility"}
              </Button>
            </div>
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>{MOCK_PROVIDER_NOTE}</span>
          </p>
          {runFeedback ? (
            <p className="flex items-center gap-1 text-xs text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              {runFeedback}
            </p>
          ) : null}
          {runError ? <p className="text-xs text-destructive">{runError}</p> : null}
        </CardContent>
      </Card>

      {empty ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Eye className="size-5" />
            </div>
            <CardTitle className="text-base">No visibility runs yet</CardTitle>
            <CardDescription>
              Visibility runs appear here as the pipeline evaluates merchants against AI engines.
              Scores and citations are grouped per run once a run has executed. Use “Run local
              visibility” above to generate an estimate from your own data.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            {runs && runs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="text-right">Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <RunRow
                      key={run.id}
                      run={run}
                      expanded={expandedId === run.id}
                      onToggle={() =>
                        setExpandedId((current) => (current === run.id ? null : run.id))
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <VisibilityTableShimmer />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
