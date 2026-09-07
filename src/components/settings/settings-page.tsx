import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, CircleAlert, Plug, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionState } from "@/hooks/use-session-state";
import { discoveryRuntimeHealthFn, providerStatusesFn } from "@/lib/api/console.functions";

type ProviderConfigStatus = {
  provider: string;
  category: string;
  label: string;
  configured: boolean;
  requires: string[];
  present: string[];
  detail: string;
};

type RuntimeSource = {
  provider: string;
  status: "not_configured" | "configured" | "syncing" | "error" | "never_run";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  totalRuns: number;
  recordsReceived: number | null;
  recordsIngested: number | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  visibility: "AI Visibility",
  ai: "AI",
  payments: "Payments",
  discovery: "Discovery",
  storage: "Storage",
  cache: "Cache",
  observability: "Observability",
  workflow: "Workflow",
};

function runtimeBadge(source: RuntimeSource): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  icon?: boolean;
} {
  switch (source.status) {
    case "syncing":
      return { label: "Syncing", variant: "secondary" };
    case "error":
      return { label: "Error", variant: "destructive" };
    case "never_run":
      return { label: "Never ran", variant: "outline" };
    case "not_configured":
      return { label: "Not configured", variant: "outline" };
    case "configured":
      return { label: "Configured", variant: "default" };
  }
}

function formatWhen(value: string | null): string {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return format(new Date(value), "MMM d, yyyy");
}

function DiscoveryHealthBlock({ source }: { source: RuntimeSource }) {
  const badge = runtimeBadge(source);

  return (
    <Card className="border-muted">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{source.provider}</CardTitle>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-2 text-xs text-muted-foreground">
        {source.status === "not_configured" ? (
          <p className="flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-2 text-amber-700">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            This source reflects the real state of its connector — no results exist until it is
            configured and run.
          </p>
        ) : null}
        {source.status === "error" && source.lastError ? (
          <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">
            <CircleAlert className="mt-0.5 size-3.5 shrink-0" />
            {source.lastError}
          </p>
        ) : null}
        {source.status === "never_run" ? (
          <p className="rounded-md border border-dashed p-2">
            This source has never run for this workspace. Run a discovery pass to create its health
            record.
          </p>
        ) : null}
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-foreground">
            {source.totalRuns} run{source.totalRuns === 1 ? "" : "s"}
          </span>
          <span>·</span>
          <span>{source.recordsReceived ?? "—"} received</span>
          <span>·</span>
          <span>{source.recordsIngested ?? "—"} ingested</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <span>
            Last run:{" "}
            <span className="font-medium text-foreground">{formatWhen(source.lastRunAt)}</span>
          </span>
          <span>
            Last success:{" "}
            <span className="font-medium text-foreground">{formatWhen(source.lastSuccessAt)}</span>
          </span>
          <span>
            Last failure:{" "}
            <span className="font-medium text-foreground">{formatWhen(source.lastFailureAt)}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function ProviderCard({ status }: { status: ProviderConfigStatus }) {
  const missing = status.requires.filter((key) => !status.present.includes(key));
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{status.label}</CardTitle>
          <CardDescription>{status.provider}</CardDescription>
        </div>
        {status.configured ? (
          <Badge className="shrink-0">
            <Check className="mr-1 size-3" />
            Configured
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">
            <X className="mr-1 size-3" />
            Not configured
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className={status.configured ? "text-foreground" : "text-muted-foreground"}>
          {status.detail}
        </p>
        {!status.configured && missing.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Required env variables</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((key) => (
                <code
                  key={key}
                  className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  {key}
                </code>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const session = useSessionState();
  const [statuses, setStatuses] = useState<ProviderConfigStatus[]>([]);
  const [runtimeSources, setRuntimeSources] = useState<RuntimeSource[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, runtime] = await Promise.all([
        providerStatusesFn(),
        session.status === "signed-in"
          ? discoveryRuntimeHealthFn().catch(() => ({ sources: [] as RuntimeSource[] }))
          : Promise.resolve({ sources: [] as RuntimeSource[] }),
      ]);
      setStatuses(config.statuses);
      setRuntimeSources(runtime.sources);
    } catch {
      setStatuses([]);
      setRuntimeSources([]);
    } finally {
      setLoading(false);
    }
  }, [session.status]);

  useEffect(() => {
    void load();
  }, [load]);

  const configuredCount = statuses.filter((status) => status.configured).length;

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view settings</CardTitle>
          </div>
          <CardDescription>
            Integration and workspace configuration is scoped to your account. Sign in to load it.
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

  if (loading && statuses.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const CATEGORY_ORDER = [
    "visibility",
    "ai",
    "payments",
    "discovery",
    "storage",
    "cache",
    "observability",
    "workflow",
  ];
  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    items: statuses.filter((status) => status.category === category),
  })).filter((group) => group.items.length > 0);
  const remaining = statuses.filter((status) => !CATEGORY_ORDER.includes(status.category));
  if (remaining.length > 0) {
    grouped.push({ category: "other", items: remaining });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <Plug className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Read-only integration readiness. {configuredCount} of {statuses.length} providers are
          configured. Env variables are shown by name only — never their values — and nothing here
          writes secrets.
        </span>
      </div>
      {grouped.map((group) => (
        <section key={group.category} className="space-y-3">
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {CATEGORY_LABELS[group.category] ?? group.category}
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            {group.items.map((status) => {
              if (group.category === "discovery") {
                const runtime =
                  runtimeSources.find((source) => source.provider === status.provider) ?? null;
                return runtime ? (
                  <div key={status.provider} className="contents">
                    <ProviderCard status={status} />
                    <DiscoveryHealthBlock source={runtime} />
                  </div>
                ) : (
                  <ProviderCard key={status.provider} status={status} />
                );
              }
              return <ProviderCard key={status.provider} status={status} />;
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
