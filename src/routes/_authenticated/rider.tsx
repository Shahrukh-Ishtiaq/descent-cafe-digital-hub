import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  Phone,
  CheckCircle2,
  Truck,
  Bell,
  BellOff,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { sb } from "@/lib/db";
import { formatPrice, mapsNavLink, CAFE } from "@/lib/constants";
import { useRepeatingAlarm, primeAlarm } from "@/lib/alarm";
import type { Order } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => ({ meta: [{ title: "Rider Deliveries — Descent Cafe" }] }),
  component: RiderPage,
});

function RiderPage() {
  const { isRider, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(true);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["rider-orders", user?.id],
    enabled: !!user && isRider,
    refetchInterval: 20000,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await sb
        .from("orders")
        .select("*, order_items(*)")
        .eq("assigned_rider_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("rider-orders-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as { assigned_rider_id?: string };
          if (row?.assigned_rider_id === user.id) {
            toast.success("🛵 New delivery assigned to you!");
            qc.invalidateQueries({ queryKey: ["rider-orders", user.id] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const grouped = useMemo(() => {
    // Active = any assigned order still in progress, no matter when it was
    // placed. Only delivered/cancelled orders move to history.
    const todays = orders.filter(
      (o) => o.status !== "delivered" && o.status !== "cancelled",
    );
    const history = orders.filter((o) => !todays.includes(o));
    const byDate: Record<string, Order[]> = {};
    history.forEach((o) => {
      const d = new Date(o.created_at).toLocaleDateString();
      byDate[d] = byDate[d] || [];
      byDate[d].push(o);
    });
    return { todays, byDate };
  }, [orders]);

  // Ring continuously while there are new deliveries the rider hasn't picked up.
  const pendingPickup = grouped.todays.filter(
    (o) => o.status !== "out_for_delivery",
  ).length;
  useRepeatingAlarm(pendingPickup > 0, "rider", soundOn);

  const markDelivered = async (id: string) => {
    const { error } = await sb
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", id);
    if (error) toast.error("Could not update");
    else {
      toast.success("Marked as delivered");
      qc.invalidateQueries({ queryKey: ["rider-orders", user?.id] });
    }
  };

  const setOutForDelivery = async (id: string) => {
    const { error } = await sb
      .from("orders")
      .update({ status: "out_for_delivery" })
      .eq("id", id);
    if (error) toast.error("Could not update");
    else {
      toast.success("Out for delivery");
      qc.invalidateQueries({ queryKey: ["rider-orders", user?.id] });
    }
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (!isRider) {
    return (
      <RiderShell onSignOut={signOut}>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Truck className="mx-auto size-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            Riders only
          </h1>
          <p className="mt-2 text-muted-foreground">
            This dashboard is for delivery riders. If you should have access, ask
            the cafe admin to assign you the rider role.
          </p>
        </div>
      </RiderShell>
    );
  }

  return (
    <RiderShell
      onSignOut={signOut}
      soundOn={soundOn}
      onToggleSound={() => {
        primeAlarm();
        setSoundOn((v) => !v);
      }}
    >
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="flex items-center gap-2">
          <Truck className="size-7 text-accent" />
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            My Deliveries
          </h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {pendingPickup > 0 ? (
            <span className="font-semibold text-accent">
              {pendingPickup} new delivery waiting — alarm rings until you tap
              “Picked up”.
            </span>
          ) : (
            "You’ll be alerted the moment a new order is assigned to you."
          )}
        </p>

        <h2 className="mt-8 font-display text-xl font-bold text-foreground">
          Active deliveries ({grouped.todays.length})
        </h2>
        {isLoading ? (
          <p className="py-8 text-center text-muted-foreground">Loading…</p>
        ) : grouped.todays.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
            No active deliveries right now.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {grouped.todays.map((o) => (
              <RiderCard
                key={o.id}
                order={o}
                onDelivered={() => markDelivered(o.id)}
                onOut={() => setOutForDelivery(o.id)}
              />
            ))}
          </div>
        )}

        {Object.keys(grouped.byDate).length > 0 && (
          <>
            <h2 className="mt-10 font-display text-xl font-bold text-foreground">
              Delivery history
            </h2>
            {Object.entries(grouped.byDate).map(([date, list]) => (
              <div key={date} className="mt-4">
                <p className="text-sm font-semibold text-muted-foreground">
                  {date}
                </p>
                <div className="mt-2 space-y-3">
                  {list.map((o) => (
                    <RiderCard key={o.id} order={o} history />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </RiderShell>
  );
}

// Minimal, delivery-only shell — no site nav, menu or marketing for riders.
function RiderShell({
  children,
  onSignOut,
  soundOn,
  onToggleSound,
}: {
  children: React.ReactNode;
  onSignOut: () => void;
  soundOn?: boolean;
  onToggleSound?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Truck className="size-5" />
            </span>
            <span className="truncate font-display text-lg font-bold text-foreground">
              {CAFE.name} <span className="text-accent">Rider</span>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleSound && (
              <Button variant="outline" size="sm" onClick={onToggleSound}>
                {soundOn ? (
                  <Bell className="size-4" />
                ) : (
                  <BellOff className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {soundOn ? "Alerts on" : "Alerts off"}
                </span>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

function RiderCard({
  order: o,
  onDelivered,
  onOut,
  history,
}: {
  order: Order;
  onDelivered?: () => void;
  onOut?: () => void;
  history?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{o.customer_name}</p>
          <p className="text-sm text-muted-foreground">{o.address}</p>
          {o.notes && (
            <p className="mt-1 text-sm italic text-muted-foreground">
              “{o.notes}”
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleTimeString()}
          </p>
        </div>
        <StatusBadge status={o.status} />
      </div>

      <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
        {o.order_items?.map((it) => (
          <li key={it.id} className="flex justify-between">
            <span>
              {it.quantity} × {it.name}
            </span>
            <span>{formatPrice(it.price * it.quantity)}</span>
          </li>
        ))}
        <li className="flex justify-between pt-1 font-semibold text-foreground">
          <span>Collect (COD)</span>
          <span>{formatPrice(o.total)}</span>
        </li>
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1">
          <a href={`tel:${o.phone}`}>
            <Phone className="size-4" /> Call
          </a>
        </Button>
        <Button asChild size="sm" className="flex-1">
          <a
            href={mapsNavLink({
              lat: o.latitude,
              lng: o.longitude,
              address: o.address,
            })}
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin className="size-4" /> Navigate
          </a>
        </Button>
        {!history && o.status !== "out_for_delivery" && (
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={onOut}
          >
            <Truck className="size-4" /> Picked up
          </Button>
        )}
        {!history && (
          <Button size="sm" className="flex-1" onClick={onDelivered}>
            <CheckCircle2 className="size-4" /> Delivered
          </Button>
        )}
      </div>
    </div>
  );
}