import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Plus,
  Trash2,
  Package,
  Users,
  Tag,
  BarChart3,
  ShoppingCart,
  ShieldCheck,
  MapPin,
  AlertTriangle,
  Upload,
  Layers,
  Truck,
  Download,
  Pencil,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sb } from "@/lib/db";
import {
  claimAdmin,
  setUserRole,
  createRider,
  listTeam,
  type TeamMember,
} from "@/lib/admin.functions";
import {
  formatPrice,
  CATEGORIES,
  STATUS_META,
  ROLE_LABELS,
  mapsNavLink,
} from "@/lib/constants";
import type { Order, Product, Promotion, Profile } from "@/lib/types";
import { useCategories, type Category } from "@/lib/categories";
import { cn } from "@/lib/utils";
import {
  useRepeatingAlarm,
  primeAlarm,
  useAdminAlarmOn,
  setAdminAlarmOn,
} from "@/lib/alarm";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Descent Cafe" }] }),
  component: AdminPage,
});

// Upload an image to the product-images bucket and return a long-lived signed URL.
async function uploadProductImage(file: File): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
  const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
  const { data, error: sErr } = await supabase.storage
    .from("product-images")
    .createSignedUrl(path, TEN_YEARS);
  if (sErr || !data?.signedUrl) throw sErr || new Error("Could not create URL");
  return data.signedUrl;
}

function AdminPage() {
  const { isAdmin, refreshProfile } = useAuth();
  const claim = useServerFn(claimAdmin);

  if (!isAdmin) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Admin access only
          </h1>
          <p className="mt-2 text-muted-foreground">
            This area is for Descent Cafe admins. If you’re the owner setting up
            for the first time, claim admin access below.
          </p>
          <Button
            className="mt-6"
            onClick={async () => {
              try {
                await claim({});
                await refreshProfile();
                toast.success("You're now an admin!");
              } catch (err) {
                toast.error(
                  err instanceof Error ? err.message : "Could not grant access",
                );
              }
            }}
          >
            Claim admin access (first-time setup)
          </Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-3xl font-bold text-foreground">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground">
          Full control of your menu, orders, riders and business.
        </p>
        {isAdmin && <StockAlerts />}
        <Tabs defaultValue="orders" className="mt-6">
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="orders" className="gap-1.5">
              <ShoppingCart className="size-4" /> Orders
            </TabsTrigger>
            {isAdmin && (
              <>
                <TabsTrigger value="analytics" className="gap-1.5">
                  <BarChart3 className="size-4" /> Analytics
                </TabsTrigger>
                <TabsTrigger value="products" className="gap-1.5">
                  <Package className="size-4" /> Products
                </TabsTrigger>
                <TabsTrigger value="categories" className="gap-1.5">
                  <Layers className="size-4" /> Categories
                </TabsTrigger>
                <TabsTrigger value="promotions" className="gap-1.5">
                  <Tag className="size-4" /> Promotions
                </TabsTrigger>
                <TabsTrigger value="delivery" className="gap-1.5">
                  <Truck className="size-4" /> Delivery
                </TabsTrigger>
                <TabsTrigger value="customers" className="gap-1.5">
                  <Users className="size-4" /> Customers
                </TabsTrigger>
                <TabsTrigger value="team" className="gap-1.5">
                  <ShieldCheck className="size-4" /> Team & Roles
                </TabsTrigger>
              </>
            )}
          </TabsList>
          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>
          {isAdmin && (
            <>
              <TabsContent value="analytics">
                <AnalyticsTab />
              </TabsContent>
              <TabsContent value="products">
                <ProductsTab />
              </TabsContent>
              <TabsContent value="categories">
                <CategoriesTab />
              </TabsContent>
              <TabsContent value="promotions">
                <PromotionsTab />
              </TabsContent>
              <TabsContent value="delivery">
                <DeliveryTab />
              </TabsContent>
              <TabsContent value="customers">
                <CustomersTab />
              </TabsContent>
              <TabsContent value="team">
                <TeamTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </SiteLayout>
  );
}

/* ----------------------------- Orders ----------------------------- */
function OrdersTab() {
  const qc = useQueryClient();
  const [soundOn, setSoundOn] = useState(true);
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await sb
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const { data: riders = [] } = useQuery({
    queryKey: ["riders"],
    queryFn: async () => {
      const { data: roleRows } = await sb
        .from("user_roles")
        .select("user_id")
        .eq("role", "rider");
      const ids = (roleRows ?? []).map((r: { user_id: string }) => r.user_id);
      if (ids.length === 0) return [] as Profile[];
      const { data: profs } = await sb
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);
      return (profs ?? []) as Profile[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => {
          toast.success("🔔 New order received!");
          qc.invalidateQueries({ queryKey: ["admin-orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  // Keep ringing until every new order is acknowledged (moved off "pending").
  const pendingCount = orders.filter((o) => o.status === "pending").length;
  useRepeatingAlarm(pendingCount > 0, "admin", soundOn);

  const q = search.trim().toLowerCase();
  const visibleOrders = q
    ? orders.filter(
        (o) =>
          o.customer_name.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          (o.address || "").toLowerCase().includes(q),
      )
    : orders;

  const updateStatus = async (id: string, status: string) => {
    const { error } = await sb.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("Update failed");
    else {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  const assignRider = async (id: string, riderId: string) => {
    const value = riderId === "none" ? null : riderId;
    const { error } = await sb
      .from("orders")
      .update({ assigned_rider_id: value })
      .eq("id", id);
    if (error) toast.error("Could not assign rider");
    else {
      toast.success(value ? "Rider assigned" : "Rider unassigned");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {orders.length} order(s)
          {pendingCount > 0 && (
            <span className="ml-2 font-semibold text-accent">
              · {pendingCount} new — move to “Preparing” to silence the alarm
            </span>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            primeAlarm();
            setSoundOn((v) => !v);
          }}
        >
          {soundOn ? <Bell /> : <BellOff />}{" "}
          {soundOn ? "Alerts on" : "Alerts off"}
        </Button>
      </div>
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name, phone, address or order number…"
        className="mb-4 h-9"
      />
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">
          Loading orders…
        </p>
      ) : visibleOrders.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {o.customer_name} · {o.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">{o.address}</p>
                  {o.notes && (
                    <p className="mt-1 text-sm italic text-muted-foreground">
                      “{o.notes}”
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      #{o.id.slice(0, 8)} ·{" "}
                      {new Date(o.created_at).toLocaleString()}
                    </p>
                    <a
                      href={mapsNavLink({
                        lat: o.latitude,
                        lng: o.longitude,
                        address: o.address,
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                    >
                      <MapPin className="size-3" /> Open in Maps
                    </a>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={o.status} />
                  <Select
                    value={o.status}
                    onValueChange={(v) => updateStatus(o.id, v)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_META).map(([k, m]) => (
                        <SelectItem key={k} value={k}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={o.assigned_rider_id ?? "none"}
                    onValueChange={(v) => assignRider(o.id, v)}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue placeholder="Assign rider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No rider</SelectItem>
                      {riders.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.full_name || r.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                  <span>Total</span>
                  <span>{formatPrice(o.total)}</span>
                </li>
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Stock alerts ----------------------------- */
const LOW_STOCK_THRESHOLD = 5;

function StockAlerts() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data as Product[];
    },
  });

  const outOfStock = products.filter(
    (p) => p.stock_quantity <= 0 || !p.is_available,
  );
  const lowStock = products.filter(
    (p) =>
      p.is_available &&
      p.stock_quantity > 0 &&
      p.stock_quantity <= LOW_STOCK_THRESHOLD,
  );

  const restock = async (id: string) => {
    const { error } = await sb
      .from("products")
      .update({ stock_quantity: 50, is_available: true })
      .eq("id", id);
    if (error) toast.error("Could not restock");
    else {
      toast.success("Restocked to 50 and back on the menu");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    }
  };

  if (outOfStock.length === 0 && lowStock.length === 0) return null;

  return (
    <div className="mt-5 space-y-3">
      {outOfStock.length > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {outOfStock.length} item(s) out of stock — customers can’t order these
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {outOfStock.map((p) => (
              <button
                key={p.id}
                onClick={() => restock(p.id)}
                className="rounded-full border border-destructive/40 bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-destructive/10"
                title="Click to restock to 50"
              >
                {p.name} · Restock
              </button>
            ))}
          </div>
        </div>
      )}
      {lowStock.length > 0 && (
        <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <AlertTriangle className="size-4 text-gold" />
            {lowStock.length} item(s) running low
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
            {lowStock.map((p) => (
              <span
                key={p.id}
                className="rounded-full border border-border bg-background px-3 py-1"
              >
                {p.name} · {p.stock_quantity} left
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Analytics ----------------------------- */
function AnalyticsTab() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthAgoStr = new Date(Date.now() - 29 * 86400000)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(monthAgoStr);
  const [to, setTo] = useState(todayStr);

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await sb
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
  });

  const isDelivered = (o: Order) => o.status === "delivered";

  // All-time totals (not affected by the date filter).
  const allTime = useMemo(() => {
    const delivered = orders.filter(isDelivered);
    return {
      revenue: delivered.reduce((s, o) => s + Number(o.total), 0),
      orders: orders.length,
      delivered: delivered.length,
    };
  }, [orders]);

  // Everything below respects the selected date range.
  const range = useMemo(() => {
    const start = new Date(from + "T00:00:00").getTime();
    const end = new Date(to + "T23:59:59").getTime();
    const inRange = orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= start && t <= end;
    });
    const delivered = inRange.filter(isDelivered);
    const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    const active = inRange.filter((o) =>
      ["pending", "preparing", "out_for_delivery"].includes(o.status),
    ).length;

    // Build a continuous daily series across the range.
    const days: { date: string; revenue: number; orders: number }[] = [];
    const map: Record<string, { revenue: number; orders: number }> = {};
    inRange.forEach((o) => {
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      map[d] = map[d] || { revenue: 0, orders: 0 };
      map[d].orders += 1;
      if (isDelivered(o)) map[d].revenue += Number(o.total);
    });
    for (
      let t = new Date(from + "T00:00:00").getTime();
      t <= new Date(to + "T00:00:00").getTime();
      t += 86400000
    ) {
      const d = new Date(t).toISOString().slice(0, 10);
      days.push({ date: d, ...(map[d] || { revenue: 0, orders: 0 }) });
    }

    const itemCounts: Record<string, number> = {};
    inRange.forEach((o) =>
      o.order_items?.forEach((it) => {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + it.quantity;
      }),
    );
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      revenue,
      orders: inRange.length,
      delivered: delivered.length,
      active,
      avg: delivered.length ? revenue / delivered.length : 0,
      days,
      topItems,
    };
  }, [orders, from, to]);

  const maxRevenue = Math.max(1, ...range.days.map((d) => d.revenue));

  const exportCsv = () => {
    const header = "Date,Orders,Revenue (delivered)";
    const rows = range.days.map(
      (d) => `${d.date},${d.orders},${d.revenue}`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `descent-cafe-report_${from}_to_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  const cards = [
    { label: "Revenue (all-time)", value: formatPrice(allTime.revenue) },
    { label: "Revenue (in range)", value: formatPrice(range.revenue) },
    { label: "Orders (in range)", value: String(range.orders) },
    { label: "Delivered (in range)", value: String(range.delivered) },
    { label: "Active orders", value: String(range.active) },
    { label: "Avg. order value", value: formatPrice(Math.round(range.avg)) },
  ];

  return (
    <div className="mt-4 space-y-6">
      {/* Date filter + export */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Input
            type="date"
            value={to}
            min={from}
            max={todayStr}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div className="flex gap-1.5">
          {[
            { label: "7d", days: 7 },
            { label: "30d", days: 30 },
            { label: "90d", days: 90 },
          ].map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setFrom(
                  new Date(Date.now() - (p.days - 1) * 86400000)
                    .toISOString()
                    .slice(0, 10),
                );
                setTo(todayStr);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <Button size="sm" className="ml-auto" onClick={exportCsv}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-foreground">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      {/* Daily revenue trend */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground">
          Daily revenue & orders
        </h3>
        {range.days.every((d) => d.orders === 0) ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No orders in this range.
          </p>
        ) : (
          <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto">
            {range.days.map((d) => (
              <div
                key={d.date}
                className="group flex min-w-[10px] flex-1 flex-col items-center justify-end"
                title={`${d.date}\n${formatPrice(d.revenue)} · ${d.orders} order(s)`}
              >
                <div
                  className="w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
                  style={{
                    height: `${Math.max(2, (d.revenue / maxRevenue) * 100)}%`,
                  }}
                />
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{from}</span>
          <span>{to}</span>
        </div>
      </div>

      {/* Best sellers */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground">
          Best sellers (in range)
        </h3>
        {range.topItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {range.topItems.map(([name, qty]) => (
              <li
                key={name}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">{name}</span>
                <span className="font-semibold text-accent">{qty} sold</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Products ----------------------------- */
const EMPTY_PRODUCT = {
  name: "",
  description: "",
  price: "",
  category: CATEGORIES[0] as string,
  image_url: "",
  stock_quantity: "100",
};

function ProductsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_PRODUCT });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { data: categoryRows = [] } = useCategories();
  const categoryNames =
    categoryRows.length > 0 ? categoryRows.map((c) => c.name) : [...CATEGORIES];

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await sb
        .from("products")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data as Product[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };

  const handleUpload = async (file: File, onDone: (url: string) => void) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose an image under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      onDone(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await sb.from("products").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      category: form.category,
      image_url: form.image_url.trim() || null,
      stock_quantity: Number(form.stock_quantity) || 0,
    });
    setSaving(false);
    if (error) toast.error("Could not add product");
    else {
      toast.success("Product added");
      setForm({ ...EMPTY_PRODUCT });
      refresh();
    }
  };

  const patch = async (id: string, fields: Record<string, unknown>) => {
    const { error } = await sb.from("products").update(fields).eq("id", id);
    if (error) toast.error("Update failed");
    else refresh();
  };
  const del = async (id: string) => {
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Deleted");
      refresh();
    }
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <form
        onSubmit={addProduct}
        className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <h3 className="font-display text-lg font-bold text-foreground">
          Add product
        </h3>
        <Input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          maxLength={80}
        />
        <Textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={300}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Price (Rs.)"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <Input
            type="number"
            min="0"
            step="1"
            placeholder="Stock"
            value={form.stock_quantity}
            onChange={(e) =>
              setForm({ ...form, stock_quantity: e.target.value })
            }
          />
        </div>
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Product photo
          </p>
          {form.image_url && (
            <img
              src={form.image_url}
              alt="Preview"
              className="h-24 w-full rounded-lg object-cover"
            />
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80">
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "Upload from gallery / camera"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  handleUpload(file, (url) =>
                    setForm((f) => ({ ...f, image_url: url })),
                  );
                e.target.value = "";
              }}
            />
          </label>
          <Input
            placeholder="…or paste an image URL"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
        </div>
        <Select
          value={form.category}
          onValueChange={(v) => setForm({ ...form, category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryNames.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="w-full" disabled={saving}>
          <Plus /> Add product
        </Button>
      </form>

      <div className="space-y-2">
        {products.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-border bg-card p-3 shadow-card"
          >
            <div className="flex items-center gap-3">
              {p.image_url && (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="size-12 shrink-0 rounded-lg object-cover"
                  width={48}
                  height={48}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">
                  {p.name}
                </p>
                <p className="text-xs text-muted-foreground">{p.category}</p>
              </div>
              <label className="flex cursor-pointer items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Upload className="size-3.5" />
                <span className="hidden sm:inline">Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      handleUpload(file, (url) =>
                        patch(p.id, { image_url: url }),
                      );
                    e.target.value = "";
                  }}
                />
              </label>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => del(p.id)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground">Price</label>
              <Input
                type="number"
                defaultValue={p.price}
                className="h-8 w-24"
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== p.price) patch(p.id, { price: v });
                }}
              />
              <label className="text-xs text-muted-foreground">Stock</label>
              <Input
                type="number"
                defaultValue={p.stock_quantity}
                className="h-8 w-20"
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== p.stock_quantity)
                    patch(p.id, { stock_quantity: v });
                }}
              />
              <div className="ml-auto flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Available</span>
                <Switch
                  checked={p.is_available}
                  onCheckedChange={(v) => patch(p.id, { is_available: v })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Promotions ----------------------------- */
const EMPTY_PROMO = {
  title: "",
  description: "",
  discount_percent: "",
  promo_code: "",
};

function PromotionsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY_PROMO });

  const { data: promos = [] } = useQuery({
    queryKey: ["admin-promos"],
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await sb
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Promotion[];
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-promos"] });
    qc.invalidateQueries({ queryKey: ["promos"] });
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await sb.from("promotions").insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      discount_percent: Number(form.discount_percent) || 0,
      promo_code: form.promo_code.trim().toUpperCase() || null,
    });
    if (error) toast.error("Could not create promotion");
    else {
      toast.success("Promotion created");
      setForm({ ...EMPTY_PROMO });
      refresh();
    }
  };

  const toggle = async (id: string, val: boolean) => {
    const { error } = await sb
      .from("promotions")
      .update({ is_active: val })
      .eq("id", id);
    if (error) toast.error("Update failed");
    else refresh();
  };
  const del = async (id: string) => {
    const { error } = await sb.from("promotions").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Deleted");
      refresh();
    }
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form
        onSubmit={add}
        className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <h3 className="font-display text-lg font-bold text-foreground">
          New promotion
        </h3>
        <Input
          placeholder="Title (e.g. Weekend Special)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
          maxLength={80}
        />
        <Textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          maxLength={300}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min="0"
            max="100"
            placeholder="Discount %"
            value={form.discount_percent}
            onChange={(e) =>
              setForm({ ...form, discount_percent: e.target.value })
            }
          />
          <Input
            placeholder="Promo code"
            value={form.promo_code}
            onChange={(e) => setForm({ ...form, promo_code: e.target.value })}
          />
        </div>
        <Button type="submit" className="w-full">
          <Plus /> Create promotion
        </Button>
      </form>

      <div className="space-y-2">
        {promos.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No promotions yet.
          </p>
        )}
        {promos.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {p.title}{" "}
                {p.discount_percent > 0 && (
                  <span className="text-accent">−{p.discount_percent}%</span>
                )}
              </p>
              {p.description && (
                <p className="truncate text-xs text-muted-foreground">
                  {p.description}
                </p>
              )}
              {p.promo_code && (
                <span className="mt-1 inline-block rounded bg-secondary px-2 py-0.5 text-xs font-mono">
                  {p.promo_code}
                </span>
              )}
            </div>
            <Switch
              checked={p.is_active}
              onCheckedChange={(v) => toggle(p.id, v)}
            />
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => del(p.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------- Customers ----------------------------- */
function CustomersTab() {
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<
      (Profile & { orders: number; lastOrder: string | null; spent: number })[]
    > => {
      const { data: profs } = await sb
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: orderRows } = await sb
        .from("orders")
        .select("user_id, total, status, created_at");
      const counts: Record<string, number> = {};
      const last: Record<string, string> = {};
      const spent: Record<string, number> = {};
      (orderRows ?? []).forEach(
        (o: {
          user_id: string | null;
          total: number;
          status: string;
          created_at: string;
        }) => {
          if (!o.user_id) return;
          counts[o.user_id] = (counts[o.user_id] || 0) + 1;
          if (!last[o.user_id] || o.created_at > last[o.user_id])
            last[o.user_id] = o.created_at;
          if (o.status === "delivered")
            spent[o.user_id] = (spent[o.user_id] || 0) + Number(o.total);
        },
      );
      return ((profs ?? []) as Profile[]).map((p) => ({
        ...p,
        orders: counts[p.id] || 0,
        lastOrder: last[p.id] || null,
        spent: spent[p.id] || 0,
      }));
    },
  });

  const q = search.trim().toLowerCase();
  const filtered = q
    ? customers.filter(
        (c) =>
          (c.full_name || "").toLowerCase().includes(q) ||
          (c.phone || "").toLowerCase().includes(q) ||
          (c.address || "").toLowerCase().includes(q),
      )
    : customers;

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {customers.length} customer(s) · {filtered.length} shown
        </p>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone or address…"
          className="h-9 w-full sm:w-72"
        />
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">Phone</th>
                <th className="p-3 font-medium">Address</th>
                <th className="p-3 font-medium">Orders</th>
                <th className="p-3 font-medium">Spent</th>
                <th className="p-3 font-medium">Last order</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="p-3 font-medium text-foreground">
                    {c.full_name || "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="max-w-xs truncate p-3 text-muted-foreground">
                    {c.address || "—"}
                  </td>
                  <td className="p-3 text-accent">{c.orders}</td>
                  <td className="p-3 text-muted-foreground">
                    {formatPrice(c.spent)}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {c.lastOrder
                      ? new Date(c.lastOrder).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ----------------------------- Team & Roles ----------------------------- */
function TeamTab() {
  const qc = useQueryClient();
  const setRole = useServerFn(setUserRole);
  const createUser = useServerFn(createRider);

  const [roleForm, setRoleForm] = useState({
    email: "",
    role: "rider" as "admin" | "rider" | "customer",
  });
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
  });
  const [busy, setBusy] = useState(false);

  const { data: team = [] } = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data: roleRows } = await sb
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "rider"]);
      const ids = [
        ...new Set((roleRows ?? []).map((r: { user_id: string }) => r.user_id)),
      ];
      const { data: profs } = ids.length
        ? await sb.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] };
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p: Profile) => (map[p.id] = p));
      const grouped: Record<string, { profile?: Profile; roles: string[] }> = {};
      (roleRows ?? []).forEach((r: { user_id: string; role: string }) => {
        grouped[r.user_id] = grouped[r.user_id] || {
          profile: map[r.user_id],
          roles: [],
        };
        grouped[r.user_id].roles.push(r.role);
      });
      return Object.entries(grouped).map(([id, v]) => ({ id, ...v }));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-team"] });
    qc.invalidateQueries({ queryKey: ["riders"] });
  };

  const grant = async (action: "add" | "remove") => {
    setBusy(true);
    try {
      await setRole({
        data: { email: roleForm.email, role: roleForm.role, action },
      });
      toast.success(action === "add" ? "Role granted" : "Role removed");
      setRoleForm({ ...roleForm, email: "" });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await createUser({ data: newUser });
      toast.success("Rider account created");
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
      });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <form
          onSubmit={create}
          className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <h3 className="font-display text-lg font-bold text-foreground">
            Create Rider Account
          </h3>
          <p className="text-xs text-muted-foreground">
            Riders sign in with these credentials and only see their assigned
            deliveries.
          </p>
          <Input
            placeholder="Full name"
            value={newUser.full_name}
            onChange={(e) =>
              setNewUser({ ...newUser, full_name: e.target.value })
            }
            required
          />
          <Input
            placeholder="Phone (03xx-xxxxxxx)"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
            required
          />
          <Input
            type="email"
            placeholder="Email"
            value={newUser.email}
            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
            required
          />
          <Input
            type="text"
            placeholder="Temporary password (6+ chars)"
            value={newUser.password}
            onChange={(e) =>
              setNewUser({ ...newUser, password: e.target.value })
            }
            required
            minLength={6}
          />
          <Button type="submit" className="w-full" disabled={busy}>
            <Plus /> Create Rider Account
          </Button>
        </form>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-bold text-foreground">
            Grant / revoke role by email
          </h3>
          <p className="text-xs text-muted-foreground">
            The person must already have an account.
          </p>
          <Input
            type="email"
            placeholder="user@email.com"
            value={roleForm.email}
            onChange={(e) =>
              setRoleForm({ ...roleForm, email: e.target.value })
            }
          />
          <Select
            value={roleForm.role}
            onValueChange={(v) =>
              setRoleForm({ ...roleForm, role: v as typeof roleForm.role })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="rider">Rider</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => grant("add")}
              disabled={busy || !roleForm.email}
            >
              Grant
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => grant("remove")}
              disabled={busy || !roleForm.email}
            >
              Revoke
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground">
          Current team
        </h3>
        <ul className="mt-3 space-y-2">
          {team.length === 0 && (
            <p className="text-sm text-muted-foreground">No team members yet.</p>
          )}
          {team.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-border/60 p-3"
            >
              <div>
                <p className="font-medium text-foreground">
                  {t.profile?.full_name || t.id.slice(0, 8)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.profile?.phone || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {t.roles.map((r) => (
                  <span
                    key={r}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      r === "admin"
                        ? "bg-primary text-primary-foreground"
                        : r === "rider"
                          ? "bg-accent/25 text-accent-foreground"
                          : "bg-secondary text-foreground",
                    )}
                  >
                    {ROLE_LABELS[r] || r}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ----------------------------- Categories ----------------------------- */
function CategoriesTab() {
  const qc = useQueryClient();
  const { data: categories = [] } = useCategories();
  const [form, setForm] = useState({ name: "", blurb: "", image_url: "" });
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Record<string, Partial<Category>>>({});

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["categories"] });
  };

  const handleUpload = async (file: File, onDone: (url: string) => void) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Please choose an image under 5MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      onDone(url);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return;
    const sort_order =
      (categories.reduce((m, c) => Math.max(m, c.sort_order), 0) || 0) + 1;
    const { error } = await sb.from("categories").insert({
      name,
      blurb: form.blurb.trim() || null,
      image_url: form.image_url.trim() || null,
      sort_order,
    });
    if (error)
      toast.error(
        error.message?.includes("duplicate")
          ? "A category with that name already exists."
          : "Could not add category",
      );
    else {
      toast.success("Category added");
      setForm({ name: "", blurb: "", image_url: "" });
      refresh();
    }
  };

  const saveEdit = async (id: string) => {
    const fields = editing[id];
    if (!fields) return;
    const { error } = await sb.from("categories").update(fields).eq("id", id);
    if (error) toast.error("Update failed");
    else {
      toast.success("Category updated");
      setEditing((e) => {
        const next = { ...e };
        delete next[id];
        return next;
      });
      refresh();
    }
  };

  const del = async (id: string) => {
    const { error } = await sb.from("categories").delete().eq("id", id);
    if (error) toast.error("Delete failed");
    else {
      toast.success("Category deleted");
      refresh();
    }
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <form
        onSubmit={add}
        className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card"
      >
        <h3 className="font-display text-lg font-bold text-foreground">
          Add category
        </h3>
        <Input
          placeholder="Name (e.g. Wraps)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
          maxLength={40}
        />
        <Textarea
          placeholder="Short blurb (optional)"
          value={form.blurb}
          onChange={(e) => setForm({ ...form, blurb: e.target.value })}
          maxLength={140}
        />
        <div className="space-y-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Category photo (optional)
          </p>
          {form.image_url && (
            <img
              src={form.image_url}
              alt="Preview"
              className="h-24 w-full rounded-lg object-cover"
            />
          )}
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80">
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "Upload image"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file)
                  handleUpload(file, (url) =>
                    setForm((f) => ({ ...f, image_url: url })),
                  );
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <Button type="submit" className="w-full">
          <Plus /> Add category
        </Button>
      </form>

      <div className="space-y-2">
        {categories.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No categories yet.
          </p>
        )}
        {categories.map((c) => {
          const draft = editing[c.id];
          const isEditing = !!draft;
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-3 shadow-card"
            >
              <div className="flex items-center gap-3">
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="size-12 shrink-0 rounded-lg object-cover"
                    width={48}
                    height={48}
                  />
                )}
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <Input
                      value={draft.name ?? c.name}
                      onChange={(e) =>
                        setEditing((s) => ({
                          ...s,
                          [c.id]: { ...s[c.id], name: e.target.value },
                        }))
                      }
                      className="h-8"
                      maxLength={40}
                    />
                  ) : (
                    <p className="truncate font-semibold text-foreground">
                      {c.name}
                    </p>
                  )}
                  {!isEditing && c.blurb && (
                    <p className="truncate text-xs text-muted-foreground">
                      {c.blurb}
                    </p>
                  )}
                </div>
                {isEditing ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-accent"
                    onClick={() => saveEdit(c.id)}
                  >
                    <Save className="size-4" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      setEditing((s) => ({
                        ...s,
                        [c.id]: { name: c.name, blurb: c.blurb },
                      }))
                    }
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  onClick={() => del(c.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {isEditing && (
                <Textarea
                  placeholder="Short blurb"
                  value={draft.blurb ?? c.blurb ?? ""}
                  onChange={(e) =>
                    setEditing((s) => ({
                      ...s,
                      [c.id]: { ...s[c.id], blurb: e.target.value },
                    }))
                  }
                  className="mt-2"
                  maxLength={140}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------- Delivery charge ----------------------------- */
function DeliveryTab() {
  const qc = useQueryClient();
  const [fee, setFee] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const { data: current } = useQuery({
    queryKey: ["settings", "delivery_fee"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await sb
        .from("app_settings")
        .select("value")
        .eq("key", "delivery_fee")
        .maybeSingle();
      if (error) throw error;
      const amount = data?.value?.amount;
      return typeof amount === "number" ? amount : 100;
    },
  });

  useEffect(() => {
    if (current != null) setFee(String(current));
  }, [current]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(fee);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    setSaving(true);
    const { error } = await sb
      .from("app_settings")
      .upsert(
        { key: "delivery_fee", value: { amount } },
        { onConflict: "key" },
      );
    setSaving(false);
    if (error) toast.error("Could not save delivery charge");
    else {
      toast.success("Delivery charge updated for all orders");
      qc.invalidateQueries({ queryKey: ["settings", "delivery_fee"] });
    }
  };

  return (
    <div className="mt-4 max-w-md">
      <form
        onSubmit={save}
        className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
      >
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Truck className="size-5" /> Global delivery charge
        </h3>
        <p className="text-sm text-muted-foreground">
          This fee is automatically added to every order at checkout. Current:{" "}
          <span className="font-semibold text-foreground">
            {current != null ? formatPrice(current) : "…"}
          </span>
        </p>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Delivery charge (Rs.)
          </label>
          <Input
            type="number"
            min="0"
            step="1"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Saving…" : "Save delivery charge"}
        </Button>
      </form>
    </div>
  );
}
