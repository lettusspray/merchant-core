import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  ArrowLeft,
  ExternalLink,
  FilePlus2,
  Globe,
  History,
  Loader2,
  Lock,
  LockOpen,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AppShell } from "@/components/app-shell";
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
import {
  generateHomePageFn,
  publishPageFn,
  setHomePageLockFn,
  unpublishPageFn,
  websiteDetailFn,
} from "@/lib/api/console.functions";

type Detail = Awaited<ReturnType<typeof websiteDetailFn>>["website"];

function stateVariant(state: Detail["state"]): "default" | "secondary" | "outline" | "destructive" {
  switch (state) {
    case "published":
      return "default";
    case "draft":
      return "secondary";
    case "archived":
      return "outline";
  }
}

const STATE_LABELS: Record<Detail["state"], string> = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

function formatDate(value: string | null): string {
  return value ? format(new Date(value), "MMM d, yyyy h:mm a") : "—";
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function WebsiteDetailPage({ websiteId }: { websiteId: string }) {
  const session = useSessionState();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { website } = await websiteDetailFn({ data: { websiteId } });
      setDetail(website);
    } catch (err) {
      setDetail(null);
      setError(err instanceof Error ? err.message : "Could not load website.");
    } finally {
      setLoading(false);
    }
  }, [websiteId]);

  useEffect(() => {
    if (session.status === "signed-in") {
      void load();
    }
  }, [session.status, load]);

  const run = async (name: string, task: () => Promise<void>) => {
    if (action) return;
    setAction(name);
    setNotice(null);
    try {
      await task();
      setNotice({ kind: "success", text: `${name} done and recorded in the event log.` });
      await load();
    } catch (err) {
      setNotice({
        kind: "error",
        text: `${name} failed: ${err instanceof Error ? err.message : "Unknown error."}`,
      });
    } finally {
      setAction(null);
    }
  };

  const canPublish = detail?.state !== "published";
  const canUnpublish = detail?.state === "published";

  let content;
  if (session.status === "checking") {
    content = <DetailSkeleton />;
  } else if (session.status === "signed-out") {
    content = (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">Sign in to manage this website</CardTitle>
          <CardDescription>Website lifecycle actions are scoped to your workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to="/signin">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  } else if (error) {
    content = (
      <Card className="border-destructive/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-5 text-destructive" />
            <CardTitle className="text-base">Could not load website</CardTitle>
          </div>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  } else if (!detail) {
    content = <DetailSkeleton />;
  } else {
    const merchant = detail.merchant;
    const publicSlug = detail.slug ?? merchant?.slug ?? null;
    const lifecycle = detail.lifecycle;
    content = (
      <div className="space-y-4">
        <div>
          <Link
            to="/admin/websites"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            All websites
          </Link>
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{merchant?.name ?? "Website"}</CardTitle>
                <Badge variant={stateVariant(detail.state)}>{STATE_LABELS[detail.state]}</Badge>
              </div>
              <CardDescription>
                {merchant?.vertical ?? "—"} · {publicSlug ? `/p/${publicSlug}` : "no public slug"}
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={action !== null}
                onClick={() =>
                  void run("Generate home", () =>
                    generateHomePageFn({ data: { websiteId: detail.id } }).then(() => undefined),
                  )
                }
              >
                {action === "Generate home" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FilePlus2 className="size-4" />
                )}
                Generate home
              </Button>
              <Button
                size="sm"
                variant={lifecycle.currentRevisionLocked ? "secondary" : "outline"}
                disabled={action !== null || lifecycle.currentVersion === 0}
                onClick={() =>
                  void run(
                    lifecycle.currentRevisionLocked ? "Unlock revision" : "Lock revision",
                    () =>
                      setHomePageLockFn({
                        data: {
                          websiteId: detail.id,
                          locked: !lifecycle.currentRevisionLocked,
                        },
                      }).then(() => undefined),
                  )
                }
              >
                {action === "Lock revision" || action === "Unlock revision" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : lifecycle.currentRevisionLocked ? (
                  <LockOpen className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {lifecycle.currentRevisionLocked ? "Unlock revision" : "Lock revision"}
              </Button>
              <Button
                size="sm"
                disabled={!canPublish || action !== null}
                onClick={() =>
                  void run("Publish", () =>
                    publishPageFn({ data: { websiteId: detail.id } }).then(() => undefined),
                  )
                }
              >
                {action === "Publish" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!canUnpublish || action !== null}
                onClick={() =>
                  void run("Unpublish", () =>
                    unpublishPageFn({ data: { websiteId: detail.id } }).then(() => undefined),
                  )
                }
              >
                {action === "Unpublish" ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Lock className="size-4" />
                )}
                Unpublish
              </Button>
              {detail.state === "published" && publicSlug ? (
                <Button size="sm" variant="outline" asChild>
                  <Link to="/p/$merchantSlug" params={{ merchantSlug: publicSlug }} target="_blank">
                    <ExternalLink className="size-4" />
                    Open public
                  </Link>
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {notice ? (
              <div
                className={`rounded-md border p-2.5 text-xs ${
                  notice.kind === "error"
                    ? "border-destructive/40 bg-destructive/5 text-destructive"
                    : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                {notice.text}
              </div>
            ) : null}
            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Published version</p>
                <p className="tabular-nums">
                  {lifecycle.publishedVersion > 0 ? `v${lifecycle.publishedVersion}` : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Current revision</p>
                <p className="tabular-nums">
                  {lifecycle.currentVersion > 0
                    ? `v${lifecycle.currentVersion} (${detail.website_pages.find((p) => p.path === "/")?.state ?? "draft"})`
                    : "—"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Draft awaiting publish</p>
                <p>
                  {lifecycle.hasUnpublishedDraft ? (
                    <Badge variant="secondary">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground">No</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Revision lock</p>
                <p>
                  {lifecycle.currentVersion > 0 ? (
                    lifecycle.currentRevisionLocked ? (
                      <Badge variant="secondary">
                        <Lock className="mr-1 size-3" /> Current locked
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Unlocked</span>
                    )
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Last generated</p>
                <p>{formatDate(detail.last_generated_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Published at</p>
                <p>{formatDate(detail.published_at)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Live revision locked</p>
                <p>
                  {lifecycle.liveRevisionLocked ? (
                    <Badge variant="secondary">
                      <Lock className="mr-1 size-3" /> v{lifecycle.publishedVersion} locked
                    </Badge>
                  ) : lifecycle.publishedVersion > 0 ? (
                    <span className="text-muted-foreground">No</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Merchant</p>
                {merchant ? (
                  <Link
                    to="/admin/merchants/$id"
                    params={{ id: merchant.id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {merchant.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pages</CardTitle>
            <CardDescription>
              Generate creates a new draft revision from the current merchant graph. Publish
              promotes it to the live revision; the public page renders exactly the published
              revision.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {detail.website_pages.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No pages yet. Generate home.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Path</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.website_pages.map((page) => (
                    <TableRow key={page.id}>
                      <TableCell className="font-medium">{page.path}</TableCell>
                      <TableCell>{page.title}</TableCell>
                      <TableCell>{page.kind}</TableCell>
                      <TableCell>
                        <Badge variant={page.state === "published" ? "default" : "secondary"}>
                          {page.state}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{page.version}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(page.updated_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Revision history</CardTitle>
            </div>
            <CardDescription>
              Every generated revision is stored immutably in website_page_versions. Locked
              revisions are protected and never overwritten by a later regeneration.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {detail.website_page_versions.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">No revisions yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">Version</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.website_page_versions.map((version) => (
                    <TableRow key={version.id}>
                      <TableCell className="text-right tabular-nums">
                        v{version.version}
                        {version.version === lifecycle.publishedVersion &&
                        detail.state === "published" ? (
                          <span className="ml-1.5 text-xs text-muted-foreground">(live)</span>
                        ) : null}
                      </TableCell>
                      <TableCell>{version.title}</TableCell>
                      <TableCell>
                        {version.locked ? (
                          <Badge variant="secondary">
                            <Lock className="mr-1 size-3" /> Locked
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Unlocked</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatDate(version.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Globe className="size-3.5" />
          <span>
            The public page renders the persisted published revision, never live merchant data.
            Revisions are immutable; regenerating produces a new draft on top of the published
            revision.
          </span>
        </div>
      </div>
    );
  }

  const title = detail?.merchant?.name ? `${detail.merchant.name} · Website` : "Website";

  return (
    <AppShell title={title}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Website</h2>
          <p className="text-sm text-muted-foreground">
            Generate, publish, and keep the public page in sync with the merchant graph.
          </p>
        </div>
        {content}
      </div>
    </AppShell>
  );
}
