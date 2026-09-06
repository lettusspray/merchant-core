import { Link } from "@tanstack/react-router";
import { Check, Plug, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSessionState } from "@/hooks/use-session-state";
import { providerStatusesFn } from "@/lib/api/console.functions";

type ProviderConfigStatus = {
  provider: string;
  category: string;
  label: string;
  configured: boolean;
  requires: string[];
  present: string[];
  detail: string;
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
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await providerStatusesFn();
      setStatuses(result.statuses);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

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
            {group.items.map((status) => (
              <ProviderCard key={status.provider} status={status} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
