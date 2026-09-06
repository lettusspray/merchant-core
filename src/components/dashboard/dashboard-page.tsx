import { Link } from "@tanstack/react-router";
import { Compass, Eye, ShoppingCart, Store, TriangleAlert, Webhook } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { consoleOverviewFn } from "@/lib/api/console.functions";
import { useSessionState } from "@/hooks/use-session-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type Overview = Awaited<ReturnType<typeof consoleOverviewFn>>;
type Snapshot = Overview["snapshot"];

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const QUICK_ACTIONS = [
  {
    to: "/merchants",
    label: "Merchants",
    description: "Browse and manage merchant records",
    icon: Store,
  },
  {
    to: "/discovery",
    label: "Discovery",
    description: "Find and source new prospects",
    icon: Compass,
  },
  {
    to: "/happenings",
    label: "Happenings",
    description: "Review the content & update queue",
    icon: Webhook,
  },
  {
    to: "/visibility",
    label: "AI Visibility",
    description: "Track visibility runs and results",
    icon: Eye,
  },
  {
    to: "/commerce",
    label: "Commerce",
    description: "Orders, subscriptions and payments",
    icon: ShoppingCart,
  },
] as const;

function AwaitingSessionView() {
  return (
    <div className="space-y-6">
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to load the dashboard</CardTitle>
            <Badge variant="secondary">awaiting session</Badge>
          </div>
          <CardDescription>
            Sign in with a workspace membership to load real dashboards. Until then this is the
            healthy, navigable scaffold of the operator console.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.to} to={action.to} className="group">
            <Card className="h-full transition-colors hover:border-primary/50">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{action.label}</CardTitle>
                <action.icon className="size-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load dashboard data</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but the workspace could not be loaded. This may mean no workspace
          membership exists for this account, or the Supabase environment is not configured.
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

function DashboardLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DashboardReady({ snapshot }: { snapshot: Snapshot }) {
  const { counts, avgVisibility, gmvCents, mrrCents, events } = snapshot;
  const metrics = [
    {
      label: "Merchants",
      value: String(counts.merchants),
      hint: `${counts.activeMerchants} active`,
    },
    { label: "Prospects", value: String(counts.prospects), hint: "discovery candidates" },
    { label: "Pending content", value: String(counts.pendingContent), hint: "draft / in review" },
    {
      label: "Avg visibility",
      value: avgVisibility == null ? "—" : avgVisibility.toFixed(1),
      hint: "visibility score",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <MetricCard key={m.label} label={m.label} value={m.value} hint={m.hint} />
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gross merchandise value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(gmvCents)}</div>
            <p className="text-xs text-muted-foreground">Lifetime, non-cancelled orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly recurring revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUsd(mrrCents)}</div>
            <p className="text-xs text-muted-foreground">Active and trialing subscriptions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent events</CardTitle>
          <CardDescription>Latest business lifecycle activity</CardDescription>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{event.kind}</span>
                  <span className="text-xs text-muted-foreground">{event.actor_label}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function DashboardPage() {
  const session = useSessionState();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await consoleOverviewFn();
      setSnapshot(result.snapshot);
    } catch (err) {
      setSnapshot(null);
      setError(err instanceof Error ? err.message : "Could not load dashboard data.");
    }
  }, []);

  useEffect(() => {
    if (session.status === "signed-in") {
      void load();
    }
  }, [session.status, load]);

  if (session.status === "checking") {
    return <DashboardLoading />;
  }

  if (session.status === "signed-out") {
    return <AwaitingSessionView />;
  }

  if (error) {
    return <DashboardError message={error} onRetry={() => void load()} />;
  }

  if (!snapshot) {
    return <DashboardLoading />;
  }

  return <DashboardReady snapshot={snapshot} />;
}
