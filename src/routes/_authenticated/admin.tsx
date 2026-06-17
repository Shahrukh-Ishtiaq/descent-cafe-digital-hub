import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { sb } from "@/lib/db";
import { claimAdmin } from "@/lib/admin.functions";
import { formatPrice, CATEGORIES, STATUS_META } from "@/lib/constants";
import type { Order, Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — Descent Cafe" }] }),
  component: AdminPage,
});

function playBell() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    [880, 1320].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  } catch {
    /* audio not available */
  }
}

function AdminPage() {
  const { isStaff, isAdmin, refreshProfile, user } = useAuth();
  const claim = useServerFn(claimAdmin);

  if (!isStaff) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-2xl font-bold text-foreground">Staff access only</h1>
          <p className="mt-2 text-muted-foreground">
            This area is for Descent Cafe staff. If you’re the owner setting up for the first time, claim admin access below.
          </p>
          <Button
            className="mt-6"
            onClick={async () => {
              try {
                await claim({});
                await refreshProfile();
                toast.success("You're now an admin!");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not grant access");
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
        <h1 className="font-display text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-muted-foreground">Manage live orders and your menu.</p>
        <Tabs defaultValue="orders" className="mt-6">
          <TabsList>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            {isAdmin && <TabsTrigger value="products">Products</TabsTrigger>}
          </TabsList>
          <TabsContent value="orders"><OrdersTab /></TabsContent>
          {isAdmin && <TabsContent value="products"><ProductsTab /></TabsContent>}
        </Tabs>
      </div>
      {/* keep referenced to avoid unused warning */}
      <span className="hidden">{user?.id}</span>
    </SiteLayout>
  );
}

function OrdersTab() {
  const qc = useQueryClient();
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);
  soundRef.current = soundOn;

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

  useEffect(() => {
    const channel = supabase
      .channel("admin-orders-rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        if (soundRef.current) playBell();
        toast.success("🔔 New order received!");
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await sb.from("orders").update({ status }).eq("id", id);
    if (error) toast.error("Update failed");
    else {
      toast.success("Order updated");
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} order(s)</p>
        <Button variant="outline" size="sm" onClick={() => setSoundOn((v) => !v)}>
          {soundOn ? <Bell /> : <BellOff />} {soundOn ? "Alerts on" : "Alerts off"}
        </Button>
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-muted-foreground">Loading orders…</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{o.customer_name} · {o.phone}</p>
                  <p className="text-sm text-muted-foreground">{o.address}</p>
                  {o.notes && <p className="mt-1 text-sm italic text-muted-foreground">“{o.notes}”</p>}
                  <p className="mt-1 text-xs text-muted-foreground">#{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={o.status} />
                  <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_META).map(([k, m]) => (
                        <SelectItem key={k} value={k}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
                {o.order_items?.map((it) => (
                  <li key={it.id} className="flex justify-between"><span>{it.quantity} × {it.name}</span><span>{formatPrice(it.price * it.quantity)}</span></li>
                ))}
                <li className="flex justify-between pt-1 font-semibold text-foreground"><span>Total</span><span>{formatPrice(o.total)}</span></li>
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const EMPTY = { name: "", description: "", price: "", category: CATEGORIES[0] };

function ProductsTab() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await sb.from("products").select("*").order("category").order("sort_order");
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
    });
    setSaving(false);
    if (error) toast.error("Could not add product");
    else { toast.success("Product added"); setForm({ ...EMPTY }); refresh(); }
  };

  const updatePrice = async (id: string, price: number) => {
    const { error } = await sb.from("products").update({ price }).eq("id", id);
    if (error) toast.error("Update failed"); else refresh();
  };
  const toggle = async (id: string, val: boolean) => {
    const { error } = await sb.from("products").update({ is_available: val }).eq("id", id);
    if (error) toast.error("Update failed"); else refresh();
  };
  const del = async (id: string) => {
    const { error } = await sb.from("products").delete().eq("id", id);
    if (error) toast.error("Delete failed"); else { toast.success("Deleted"); refresh(); }
  };

  return (
    <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={addProduct} className="h-fit space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h3 className="font-display text-lg font-bold text-foreground">Add product</h3>
        <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required maxLength={80} />
        <Textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
        <Input type="number" min="0" step="1" placeholder="Price (Rs.)" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
        <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="submit" className="w-full" disabled={saving}><Plus /> Add product</Button>
      </form>

      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{p.name}</p>
              <p className="text-xs text-muted-foreground">{p.category}</p>
            </div>
            <Input
              type="number"
              defaultValue={p.price}
              className="w-24"
              onBlur={(e) => { const v = Number(e.target.value); if (v !== p.price) updatePrice(p.id, v); }}
            />
            <Button
              variant={p.is_available ? "outline" : "secondary"}
              size="sm"
              className={cn(!p.is_available && "text-destructive")}
              onClick={() => toggle(p.id, !p.is_available)}
            >
              {p.is_available ? "Available" : "Hidden"}
            </Button>
            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="size-4" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}