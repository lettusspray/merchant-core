import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ExternalLink, Receipt, ShoppingCart, TriangleAlert, Repeat } from "lucide-react";
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
import { ordersListFn } from "@/lib/api/console.functions";

type CommercePayload = Awaited<ReturnType<typeof ordersListFn>>;
type Order = CommercePayload["orders"][number];
type Subscription = CommercePayload["subscriptions"][number];

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(cents / 100);
}

function formatDate(value: string): string {
  return format(new Date(value), "MMM d, yyyy");
}

const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pending",
  paid: "Paid",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

function orderVariant(
  status: Order["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "paid":
    case "fulfilled":
      return "default";
    case "pending":
      return "secondary";
    case "cancelled":
    case "refunded":
      return "destructive";
  }
}

function subVariant(
  status: Subscription["status"],
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "trialing":
    case "past_due":
      return "secondary";
    case "cancelled":
      return "outline";
  }
}

function CommerceTableShimmer() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function CommerceErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TriangleAlert className="size-5 text-destructive" />
          <CardTitle className="text-base">Could not load commerce data</CardTitle>
        </div>
        <CardDescription>
          You are signed in, but orders and subscriptions could not be loaded. This may mean no
          workspace membership exists for this account, or the console backend is not configured.
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

function MerchantNameLink({ merchantId, name }: { merchantId: string; name: string | null }) {
  if (!name) {
    return (
      <Link
        to="/merchants/$id"
        params={{ id: merchantId }}
        className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
      >
        View merchant
        <ExternalLink className="size-3.5" />
      </Link>
    );
  }
  return (
    <Link
      to="/merchants/$id"
      params={{ id: merchantId }}
      className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
    >
      {name}
      <ExternalLink className="size-3.5" />
    </Link>
  );
}

export function CommercePage() {
  const session = useSessionState();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await ordersListFn();
      setOrders(result.orders);
      setSubscriptions(result.subscriptions);
    } catch (err) {
      setOrders(null);
      setSubscriptions(null);
      setError(err instanceof Error ? err.message : "Could not load commerce data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session.status !== "signed-in") return;
    void load();
  }, [session.status, load]);

  if (session.status === "checking") {
    return <CommerceTableShimmer />;
  }

  if (session.status === "signed-out") {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Sign in to view commerce</CardTitle>
          </div>
          <CardDescription>
            Orders and subscriptions are scoped to your workspace. Sign in to load them.
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
    return <CommerceErrorState message={error} onRetry={() => void load()} />;
  }

  if (loading && orders === null) {
    return <CommerceTableShimmer />;
  }

  const ordersEmpty = orders !== null && orders.length === 0;
  const subsEmpty = subscriptions !== null && subscriptions.length === 0;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Orders</h3>
        </div>
        {ordersEmpty ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-base">No orders</CardTitle>
              <CardDescription>
                Orders placed through merchant storefronts appear here. There are no rows yet in
                this workspace.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {orders && orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reference</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.reference}</TableCell>
                        <TableCell>
                          <MerchantNameLink
                            merchantId={order.merchant_id}
                            name={order.merchants?.name ?? null}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={orderVariant(order.status)}>
                            {ORDER_STATUS_LABELS[order.status] ?? order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCents(order.total_cents, order.currency)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatDate(order.placed_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <CommerceTableShimmer />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="size-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Subscriptions</h3>
        </div>
        {subsEmpty ? (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-base">No subscriptions</CardTitle>
              <CardDescription>
                Merchant subscriptions appear here. There are no rows yet in this workspace.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              {subscriptions && subscriptions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Interval</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscriptions.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.plan}</TableCell>
                        <TableCell>
                          <MerchantNameLink
                            merchantId={sub.merchant_id}
                            name={sub.merchants?.name ?? null}
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant={subVariant(sub.status)}>{sub.status}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCents(sub.price_cents, "USD")}
                        </TableCell>
                        <TableCell>{sub.interval}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-6">
                  <CommerceTableShimmer />
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
        <ShoppingCart className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Read-only display of local order and subscription rows from this workspace. No live Stripe
          or Paystack charges are made from this screen.
        </span>
      </div>
    </div>
  );
}
