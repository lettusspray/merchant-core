import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { workspaceSummaryFn } from "@/lib/api/console.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/signin", search: { redirect: location.href } });
    }
  },
  component: AdminLayout,
});

type Access =
  | { status: "checking" }
  | { status: "operator" }
  | { status: "denied"; message: string };

function AdminLayout() {
  const [access, setAccess] = useState<Access>({ status: "checking" });

  useEffect(() => {
    let active = true;
    void workspaceSummaryFn()
      .then(() => {
        if (active) setAccess({ status: "operator" });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAccess({
          status: "denied",
          message:
            error instanceof Error
              ? error.message
              : "This account does not have operator access to a workspace.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

  if (access.status === "checking") {
    return (
      <div className="min-h-svh space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (access.status === "denied") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-lg">Operator access required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{access.message}</p>
            <p>
              The operator console is limited to accounts with a workspace membership. If you manage
              a single business, use the store portal instead.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link to="/portal">Go to store portal</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/">Public site</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void supabase.auth.signOut()}
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}
