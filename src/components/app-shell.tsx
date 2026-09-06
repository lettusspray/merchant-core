import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Compass,
  Eye,
  LayoutDashboard,
  LogOut,
  Settings,
  ShoppingCart,
  Store,
  Webhook,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useSessionState } from "@/hooks/use-session-state";
import { supabase } from "@/integrations/supabase/client";
import { workspaceSummaryFn } from "@/lib/api/console.functions";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/merchants", label: "Merchants", icon: Store },
  { href: "/discovery", label: "Discovery", icon: Compass },
  { href: "/happenings", label: "Happenings", icon: Webhook },
  { href: "/visibility", label: "AI Visibility", icon: Eye },
  { href: "/commerce", label: "Commerce", icon: ShoppingCart },
  { href: "/system", label: "System", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarNav() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Store className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5 leading-none">
                  <span className="font-semibold">Merchant Core</span>
                  <span className="text-xs text-muted-foreground">Operator Console</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item.href, pathname)}
                    tooltip={item.label}
                  >
                    <Link to={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <ShellFooter />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ShellFooter() {
  const session = useSessionState();
  const [workspace, setWorkspace] = useState<{ name: string; role: string } | null>(null);

  useEffect(() => {
    if (session.status !== "signed-in") {
      setWorkspace(null);
      return;
    }
    let active = true;
    void workspaceSummaryFn()
      .then((result) => {
        if (!active) return;
        setWorkspace({ name: result.tenantName, role: result.workspaceRole });
      })
      .catch(() => {
        if (!active) return;
        setWorkspace(null);
      });
    return () => {
      active = false;
    };
  }, [session.status]);

  if (session.status !== "signed-in") {
    return (
      <SidebarFooter>
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className="text-xs text-muted-foreground">Not signed in</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/signin">Sign in</Link>
          </Button>
        </div>
      </SidebarFooter>
    );
  }

  return (
    <SidebarFooter>
      <div className="space-y-2 px-2 py-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">
              {workspace?.name ?? "Loading workspace…"}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {workspace?.role ?? "…"} workspace
            </p>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0"
            aria-label="Sign out"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </div>
    </SidebarFooter>
  );
}

function AppTopbar({ title }: { title: string }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <h1 className="text-sm font-medium">{title}</h1>
    </header>
  );
}

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SidebarProvider>
      <SidebarNav />
      <SidebarInset>
        <AppTopbar title={title} />
        <div className="flex-1 space-y-6 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
