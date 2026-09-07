import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ExternalLink, Globe, TriangleAlert } from "lucide-react";
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
import { websitesListFn } from "@/lib/api/console.functions";

type WebsitesPayload = Awaited<ReturnType<typeof websitesListFn>>;
type Website = WebsitesPayload["websites"][number];

const VERTICAL_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  home_service: "Home service",
  beauty: "Beauty",
  pet_service: "Pet service",
  automotive: "Automotive",
  local_retail: "Local retail",
  other: "Other",
};

function stateVariant(
  state: Website["state"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (state) {
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "archived":
      return "outline";
  }
}

const STATE_LABELS: Record<Website["state"], string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

function formatDate(value: string | null): string {
  return value ? format(new Date(value), "MMM d, yyyy h:mm a") : "—";
}

function WebsitesTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function WebsitesEmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <Card className="border-dashed">
      <CardHeader className="items-center text-center">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Globe className="size-5" />
        </div>
        <CardTitle className="text-base">No websites yet</CardTitle>
        <CardDescription>
          Public pages are generated from the merchant graph. Ensure a website from any merchant,
          then generate and publish its home page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-6">
        <Button size="sm" variant="outline" onClick={onRetry}>
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

function WebsitesErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load websites</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but the websites workspace could not be loaded.
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

export function WebsitesPage() {
  const session = useSessionState();
  const [websites, setWebsites] = useState<Website[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await websitesListFn();
      setWebsites(result.websites);
    } catch (err) {
      setWebsites(null);
      setError(err instanceof Error ? err.message : "Could not load websites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

  if (session.status === "checking") {
    return <WebsitesTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view websites</CardTitle>
          </div>
          <CardDescription>
            Public pages are scoped to your workspace. Sign in to load them.
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
    return <WebsitesErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && websites === null) {
    return <WebsitesTableShimmer />;
  }

  const empty = websites !== null && websites.length === 0;

  return (
    <div className="space-y-4">
      {empty ? (
        <WebsitesEmptyState onRetry={() => void load()} />
      ) : (
        <Card>
          <CardContent className="p-0">
            {websites && websites.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Public</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead>Theme</TableHead>
                    <TableHead className="text-right">Pages</TableHead>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead className="text-right">Last generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {websites.map((website) => {
                    const publicSlug = website.slug ?? website.merchant?.slug ?? null;
                    return (
                      <TableRow key={website.id}>
                        <TableCell>
                          <Link
                            to="/websites/$id"
                            params={{ id: website.id }}
                            className="font-medium text-primary hover:underline"
                          >
                            {website.merchant?.name ?? "Merchant"}
                          </Link>
                          {website.merchant?.vertical ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {VERTICAL_LABELS[website.merchant.vertical] ??
                                website.merchant.vertical}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          {website.state === "published" && publicSlug ? (
                            <Link
                              to="/p/$merchantSlug"
                              params={{ merchantSlug: publicSlug }}
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                            >
                              /p/{publicSlug}
                              <ExternalLink className="size-3" />
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not live</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stateVariant(website.state)}>
                            {STATE_LABELS[website.state]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{website.theme}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {website.pagesCount}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {website.published_version}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(website.last_generated_at)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="p-6">
                <WebsitesTableShimmer />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
