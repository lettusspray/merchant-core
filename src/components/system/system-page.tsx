import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Activity, TriangleAlert, Workflow } from "lucide-react";
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
import { providerStatuses, type ProviderConfigStatus } from "@/lib/config.server";
import { systemActivityFn } from "@/lib/api/console.functions";

type SystemPayload = Awaited<ReturnType<typeof systemActivityFn>>;
type EventRow = SystemPayload["events"][number];
type WorkflowRun = SystemPayload["workflows"][number];

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy HH:mm");
}

function workflowVariant(
  status: WorkflowRun["status"],
): "default" | "secondary" | "outline" | "destructive" {
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

const WORKFLOW_LABELS: Record<WorkflowRun["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
};

function SystemTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function SystemErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load system activity</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but system activity could not be loaded. This may mean no workspace
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

function IntegrationsHealthStrip({ statuses }: { statuses: ProviderConfigStatus[] }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {statuses.map((status) => (
        <div
          key={status.provider}
          className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{status.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {status.category} · {status.provider}
            </p>
          </div>
          <Badge variant={status.configured ? "default" : "outline"}>
            {status.configured ? "Configured" : "Not configured"}
          </Badge>
        </div>
      ))}
    </div>
  );
}

export function SystemPage() {
  const session = useSessionState();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowRun[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statuses] = useState<ProviderConfigStatus[]>(() => providerStatuses());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await systemActivityFn();
      setEvents(result.events);
      setWorkflows(result.workflows);
    } catch (err) {
      setEvents(null);
      setWorkflows(null);
      setError(err instanceof Error ? err.message : "Could not load system activity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

  if (session.status === "checking") {
    return <SystemTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view system activity</CardTitle>
          </div>
          <CardDescription>
            System events and workflows are scoped to your workspace. Sign in to load them.
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
    return <SystemErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && events === null) {
    return <SystemTableShimmer />;
  }

  const eventsEmpty = events !== null && events.length === 0;
  const workflowsEmpty = workflows !== null && workflows.length === 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Integration health</h3>
        </div>
        <IntegrationsHealthStrip statuses={statuses} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Recent events</h3>
        </div>
        {eventsEmpty ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-base">No events yet</CardTitle>
              <CardDescription>
                The append-only audit trail shows here. No events recorded yet in this workspace.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {events && events.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kind</TableHead>
                      <TableHead>Actor</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">{event.kind}</TableCell>
                        <TableCell>{event.actor_label ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {event.subject_type ?? "—"}
                          {event.subject_id ? ` · ${event.subject_id.slice(0, 8)}` : ""}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(event.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <SystemTableShimmer />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="size-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Workflow runs</h3>
        </div>
        {workflowsEmpty ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-base">No workflow runs</CardTitle>
              <CardDescription>
                Background workflow runs appear here. Nothing has run yet in this workspace.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {workflows && workflows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Workflow</TableHead>
                      <TableHead>Engine</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Started</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflows.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-medium">{run.workflow}</TableCell>
                        <TableCell>{run.engine}</TableCell>
                        <TableCell>
                          <Badge variant={workflowVariant(run.status)}>
                            {WORKFLOW_LABELS[run.status] ?? run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(run.started_at)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-destructive">
                          {run.error ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <SystemTableShimmer />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
