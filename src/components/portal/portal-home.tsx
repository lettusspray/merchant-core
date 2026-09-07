import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  ExternalLink,
  FilePlus2,
  Loader2,
  Lock,
  LockOpen,
  MapPin,
  Package,
  Store,
  Tag,
  Upload,
  UserRound,
  Wand2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import type { ComponentType } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  portalGenerateHomeFn,
  portalPublishFn,
  portalSetHomePageLockFn,
  portalUnpublishFn,
} from "@/lib/api/portal.functions";
import { usePortal, type PortalMerchant } from "./portal-context";
import { formatDate } from "./portal-utils";

type ThemedIcon = ComponentType<{ className?: string }>;

const QUICK_LINKS: Array<{
  href: string;
  label: string;
  icon: ThemedIcon;
  key: "locations" | "products" | "services" | "offers" | "happenings";
}> = [
  { href: "/portal/profile", label: "Details", icon: UserRound, key: "products" },
  { href: "/portal/locations", label: "Locations & hours", icon: MapPin, key: "locations" },
  { href: "/portal/services", label: "Services", icon: Wrench, key: "services" },
  { href: "/portal/products", label: "Products", icon: Package, key: "products" },
  { href: "/portal/offers", label: "Offers", icon: Tag, key: "offers" },
  { href: "/portal/happenings", label: "Announcements", icon: CalendarDays, key: "happenings" },
];

function countFor(merchant: PortalMerchant, key: string): number {
  if (key === "locations") return merchant.locations.length;
  if (key === "products") return merchant.products.length;
  if (key === "services") return merchant.services.length;
  if (key === "offers") return merchant.offers.length;
  if (key === "happenings") return merchant.happenings.length;
  return 0;
}

function WebsitePanel({ merchant }: { merchant: PortalMerchant }) {
  const { data, refresh } = usePortal();
  const website = merchant.websites?.[0] ?? null;
  const websitePages = merchant.websitePages;
  const pages = websitePages?.website_pages ?? [];
  const lifecycle = websitePages?.lifecycle;
  const publicSlug = website?.slug ?? merchant.merchant.slug ?? null;
  const [busy, setBusy] = useState<"generate" | "publish" | "unpublish" | "lock" | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function run(next: "generate" | "publish" | "unpublish" | "lock") {
    if (busy) return;
    setBusy(next);
    setNotice(null);
    try {
      if (next === "generate") {
        await portalGenerateHomeFn({ data: { merchantId: merchant.merchant.id } });
        setNotice({
          kind: "success",
          text: "A new homepage revision was generated from your latest details. Publish when you're ready to go live.",
        });
      } else if (next === "publish") {
        await portalPublishFn({ data: { merchantId: merchant.merchant.id } });
        setNotice({ kind: "success", text: "Your site is live." });
      } else if (next === "unpublish") {
        await portalUnpublishFn({ data: { merchantId: merchant.merchant.id } });
        setNotice({ kind: "success", text: "Your site is now unpublished." });
      } else {
        const locked = !(lifecycle?.currentRevisionLocked ?? false);
        await portalSetHomePageLockFn({
          data: { merchantId: merchant.merchant.id, locked },
        });
        setNotice({
          kind: "success",
          text: locked
            ? "This revision is now locked. Regenerating will create a new draft and keep this revision intact."
            : "Revision unlocked.",
        });
      }
      await refresh();
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Action failed." });
    } finally {
      setBusy(null);
    }
  }

  const canGenerate = busy === null;
  const canLock = busy === null && (lifecycle?.currentVersion ?? 0) > 0;
  const canPublish = busy === null && website?.state !== "published";
  const canUnpublish = busy === null && website?.state === "published";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Store className="size-4" /> Your website
          </CardTitle>
          <CardDescription>
            {website
              ? `${pages.length} page${pages.length === 1 ? "" : "s"} · live revision ${lifecycle?.publishedVersion ?? "—"} · current revision ${lifecycle?.currentVersion ?? "—"} · last generated ${formatDate(website.last_generated_at)}`
              : "No website yet. Generate one from your store details."}
          </CardDescription>
        </div>
        {website ? (
          <div className="flex shrink-0 items-center gap-2">
            {lifecycle?.hasUnpublishedDraft ? (
              <Badge variant="secondary">Draft awaiting publish</Badge>
            ) : null}
            <Badge variant={website.state === "published" ? "default" : "secondary"}>
              {website.state}
            </Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {notice ? (
          <p
            className={`rounded-md border px-3 py-2 text-xs ${
              notice.kind === "error"
                ? "border-destructive/40 bg-destructive/5 text-destructive"
                : "border-border bg-muted/50 text-muted-foreground"
            }`}
          >
            {notice.text}
          </p>
        ) : null}
        {lifecycle && lifecycle.currentVersion > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Current revision v{lifecycle.currentVersion}
              {lifecycle.currentRevisionLocked ? (
                <span className="ml-1 inline-flex items-center text-foreground">
                  <Lock className="mr-0.5 size-3" /> locked
                </span>
              ) : null}
            </span>
            {lifecycle.publishedVersion > 0 ? (
              <span>
                {lifecycle.publishedVersion === lifecycle.currentVersion &&
                website?.state === "published"
                  ? "publicly published"
                  : `publicly serves v${lifecycle.publishedVersion}`}
                {lifecycle.liveRevisionLocked &&
                lifecycle.publishedVersion !== lifecycle.currentVersion
                  ? " (locked)"
                  : ""}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={!canGenerate} onClick={() => void run("generate")}>
            {busy === "generate" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {busy === "generate" ? "Generating…" : "Regenerate home"}
          </Button>
          <Button size="sm" variant="outline" disabled={!canLock} onClick={() => void run("lock")}>
            {busy === "lock" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : lifecycle?.currentRevisionLocked ? (
              <LockOpen className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            {lifecycle?.currentRevisionLocked ? "Unlock revision" : "Lock revision"}
          </Button>
          <Button
            size="sm"
            variant={website?.state === "published" ? "outline" : "default"}
            disabled={!canPublish}
            onClick={() => void run("publish")}
          >
            {busy === "publish" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            Publish current revision
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!canUnpublish}
            onClick={() => void run("unpublish")}
          >
            {busy === "unpublish" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Lock className="size-4" />
            )}
            Unpublish
          </Button>
          {website?.state === "published" && publicSlug ? (
            <Button size="sm" variant="outline" asChild>
              <Link to="/p/$merchantSlug" params={{ merchantSlug: publicSlug }} target="_blank">
                <ExternalLink className="size-4" />
                Open public page
              </Link>
            </Button>
          ) : null}
          {website && data.operator ? (
            <Button size="sm" variant="ghost" asChild>
              <Link
                to="/websites/$id"
                params={{ id: website.id }}
                className="text-muted-foreground"
              >
                <FilePlus2 className="size-4" />
                Operator view
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortalHomePage() {
  const { data } = usePortal();
  const merchant = data.merchants[0];

  if (!merchant) return null;

  return (
    <div className="space-y-6">
      <WebsitePanel merchant={merchant} />
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Manage your store</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} to={link.href} className="group">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                      <link.icon className="size-4" />
                    </div>
                    <span className="text-sm font-medium">{link.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {countFor(merchant, link.key)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
