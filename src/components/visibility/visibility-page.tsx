import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ChevronDown, Cpu, ExternalLink, Eye, Info, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { visibilityRunsFn } from "@/lib/api/console.functions";

type RunsPayload = Awaited<ReturnType<typeof visibilityRunsFn>>;
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
              <div className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
                Run command is not wired in this build. Runs shown here are persisted by the
                visibility pipeline; the local readiness estimator is labelled as such and never
                presented as an external AI provider answer.
              </div>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await visibilityRunsFn({ data: {} });
      setRuns(result.runs);
    } catch (err) {
      setRuns(null);
      setError(err instanceof Error ? err.message : "Could not load visibility runs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

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
      {empty ? (
        <Card className="border-dashed">
          <CardHeader className="items-center text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Eye className="size-5" />
            </div>
            <CardTitle className="text-base">No visibility runs yet</CardTitle>
            <CardDescription>
              Visibility runs appear here as the pipeline evaluates merchants against AI engines.
              Scores and citations are grouped per run once a run has executed.
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
