import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Store,
  Tag,
  UserRound,
  Wrench,
} from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSessionState } from "@/hooks/use-session-state";
import { supabase } from "@/integrations/supabase/client";
import { VERTICAL_LABELS } from "./portal-utils";
import { usePortal } from "./portal-context";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/portal", label: "My site", icon: LayoutDashboard },
  { href: "/portal/profile", label: "Details", icon: UserRound },
  { href: "/portal/locations", label: "Locations & hours", icon: MapPin },
  { href: "/portal/services", label: "Services", icon: Wrench },
  { href: "/portal/products", label: "Products", icon: Package },
  { href: "/portal/offers", label: "Offers", icon: Tag },
  { href: "/portal/happenings", label: "Announcements", icon: CalendarDays },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NoAccess() {
  const session = useSessionState();
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-4">
      <div className="flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Store className="size-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold">Merchant Core</span>
          <span className="text-xs text-muted-foreground">Store Portal</span>
        </div>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">No store linked to this account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Ask the operator of your store to invite the email you signed in with. As soon as an
            invite is added, you will be able to manage your store here.
          </p>
          {session.status === "signed-out" ? (
            <Button asChild className="w-full">
              <Link to="/signin">Sign in</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => void supabase.auth.signOut()}
            >
              Sign out
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PortalShell() {
  const { data } = usePortal();
  const { pathname } = useLocation();
  const merchant = data.merchants[0];

  if (!merchant) return <NoAccess />;

  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/portal" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Store className="size-4" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold">{merchant.merchant.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {VERTICAL_LABELS[merchant.merchant.vertical] ?? merchant.merchant.vertical}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {data.operator ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/">Operator console</Link>
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              aria-label="Sign out"
              onClick={() => void supabase.auth.signOut()}
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <div className="mx-auto max-w-5xl overflow-x-auto px-4">
          <nav className="flex gap-1 pb-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(item.href, pathname)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-4">
        <Outlet />
      </main>
    </div>
  );
}
