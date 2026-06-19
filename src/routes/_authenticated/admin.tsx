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
import { claimAdmin, setUserRole, createStaffUser } from "@/lib/admin.functions";
import {
  formatPrice,
  CATEGORIES,
  STATUS_META,
  ROLE_LABELS,
  mapsNavLink,
} from "@/lib/constants";
import type { Order, Product, Promotion, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useRepeatingAlarm, primeAlarm } from "@/lib/alarm";

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
  const { isStaff, isAdmin, refreshProfile } = useAuth();
  const claim = useServerFn(claimAdmin);

  if (!isStaff) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Staff access only
          </h1>
          <p className="mt-2 text-muted-foreground">
            This area is for Descent Cafe staff. If you’re the owner setting up
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
                <TabsTrigger value="promotions" className="gap-1.5">
                  <Tag className="size-4" /> Promotions
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
              <TabsContent value="promotions">
                <PromotionsTab />
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
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">
          Loading orders…
        </p>
      ) : orders.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No orders yet.</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
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

  const stats = useMemo(() => {
    const delivered = orders.filter((o) => o.status === "delivered");
    const revenue = delivered.reduce((s, o) => s + Number(o.total), 0);
    const pending = orders.filter((o) =>
      ["pending", "preparing", "out_for_delivery"].includes(o.status),
    ).length;
    const today = new Date().toDateString();
    const todayCount = orders.filter(
      (o) => new Date(o.created_at).toDateString() === today,
    ).length;
    const itemCounts: Record<string, number> = {};
    orders.forEach((o) =>
      o.order_items?.forEach((it) => {
        itemCounts[it.name] = (itemCounts[it.name] || 0) + it.quantity;
      }),
    );
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return {
      revenue,
      delivered: delivered.length,
      pending,
      todayCount,
      total: orders.length,
      avg: delivered.length ? revenue / delivered.length : 0,
      topItems,
    };
  }, [orders]);

  const cards = [
    { label: "Revenue (delivered)", value: formatPrice(stats.revenue) },
    { label: "Total orders", value: String(stats.total) },
    { label: "Orders today", value: String(stats.todayCount) },
    { label: "Active orders", value: String(stats.pending) },
    { label: "Delivered", value: String(stats.delivered) },
    { label: "Avg. order value", value: formatPrice(Math.round(stats.avg)) },
  ];

  return (
    <div className="mt-4 space-y-6">
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
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground">
          Best sellers
        </h3>
        {stats.topItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {stats.topItems.map(([name, qty]) => (
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
        <Input
          placeholder="Image URL (optional)"
          value={form.image_url}
          onChange={(e) => setForm({ ...form, image_url: e.target.value })}
        />
        <Select
          value={form.category}
          onValueChange={(v) => setForm({ ...form, category: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
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
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["admin-customers"],
    queryFn: async (): Promise<(Profile & { orders: number })[]> => {
      const { data: profs } = await sb
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: orderRows } = await sb.from("orders").select("user_id");
      const counts: Record<string, number> = {};
      (orderRows ?? []).forEach((o: { user_id: string | null }) => {
        if (o.user_id) counts[o.user_id] = (counts[o.user_id] || 0) + 1;
      });
      return ((profs ?? []) as Profile[]).map((p) => ({
        ...p,
        orders: counts[p.id] || 0,
      }));
    },
  });

  return (
    <div className="mt-4">
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
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="p-3 font-medium text-foreground">
                    {c.full_name || "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="max-w-xs truncate p-3 text-muted-foreground">
                    {c.address || "—"}
                  </td>
                  <td className="p-3 text-accent">{c.orders}</td>
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
  const createUser = useServerFn(createStaffUser);

  const [roleForm, setRoleForm] = useState({
    email: "",
    role: "rider" as "admin" | "staff" | "rider" | "customer",
  });
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    role: "rider" as "staff" | "rider",
  });
  const [busy, setBusy] = useState(false);

  const { data: team = [] } = useQuery({
    queryKey: ["admin-team"],
    queryFn: async () => {
      const { data: roleRows } = await sb
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "staff", "rider"]);
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
      toast.success(`${ROLE_LABELS[newUser.role]} account created`);
      setNewUser({
        email: "",
        password: "",
        full_name: "",
        phone: "",
        role: "rider",
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
            Create staff / rider account
          </h3>
          <Input
            placeholder="Full name"
            value={newUser.full_name}
            onChange={(e) =>
              setNewUser({ ...newUser, full_name: e.target.value })
            }
            required
          />
          <Input
            placeholder="Phone"
            value={newUser.phone}
            onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
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
          <Select
            value={newUser.role}
            onValueChange={(v) =>
              setNewUser({ ...newUser, role: v as "staff" | "rider" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rider">Rider</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" className="w-full" disabled={busy}>
            <Plus /> Create account
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
              <SelectItem value="staff">Staff</SelectItem>
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
