import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { sb } from "@/lib/db";
import { formatPrice, STATUS_FLOW } from "@/lib/constants";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [{ title: "My Orders — Descent Cafe" }] }),
  component: OrdersPage,
});

function Tracker({ status }: { status: string }) {
  if (status === "cancelled") return <p className="text-sm font-medium text-destructive">Order cancelled</p>;
  const idx = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  return (
    <div className="flex items-center gap-1">
      {STATUS_FLOW.map((s, i) => (
        <div key={s} className="flex flex-1 items-center gap-1">
          <span className={cn("size-2.5 rounded-full", i <= idx ? "bg-accent" : "bg-border")} />
          {i < STATUS_FLOW.length - 1 && <span className={cn("h-0.5 flex-1", i < idx ? "bg-accent" : "bg-border")} />}
        </div>
      ))}
    </div>
  );
}

function OrdersPage() {
  const { user } = useAuth();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await sb
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  return (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-3xl font-bold text-foreground">My Orders</h1>
        {isLoading ? (
          <p className="py-16 text-center text-muted-foreground">Loading…</p>
        ) : orders.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center shadow-card">
            <p className="text-muted-foreground">You haven’t placed any orders yet.</p>
            <Button asChild className="mt-4"><Link to="/menu">Order something tasty</Link></Button>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-foreground">Order #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <StatusBadge status={o.status} />
                </div>
                <div className="my-4"><Tracker status={o.status} /></div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {o.order_items?.map((it) => (
                    <li key={it.id} className="flex justify-between">
                      <span>{it.quantity} × {it.name}</span>
                      <span>{formatPrice(it.price * it.quantity)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-border pt-3 font-semibold text-foreground">
                  <span>Total</span><span>{formatPrice(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}