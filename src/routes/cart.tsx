import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, MapPin, LocateFixed } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { formatPrice, CAFE } from "@/lib/constants";
import { useDeliveryFee } from "@/lib/settings";
import { placeOrder } from "@/lib/orders.functions";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your Cart — Descent Cafe" }] }),
  component: CartPage,
});

function CartPage() {
  const { items, setQty, remove, total, clear } = useCart();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const DELIVERY_FEE = useDeliveryFee();
  const submitOrder = useServerFn(placeOrder);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (profile) {
      setName((v) => v || profile.full_name || "");
      setPhone((v) => v || profile.phone || "");
      setAddress((v) => v || profile.address || "");
    }
  }, [profile]);

  const detectLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Location is not supported on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast.success("Location captured — your rider can navigate to you.");
      },
      () => {
        setLocating(false);
        toast.error("Could not get location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const placeOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to place your order.");
      navigate({ to: "/auth" });
      return;
    }
    if (items.length === 0) return;
    setPlacing(true);
    try {
      // The server recomputes item prices, delivery fee and the grand total
      // from the database, so clients cannot tamper with what they pay.
      await submitOrder({
        data: {
          items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
          customer_name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          notes: notes.trim() || null,
          latitude: coords?.lat ?? null,
          longitude: coords?.lng ?? null,
        },
      });

      clear();
      toast.success("Order placed! We'll start preparing it right away.");
      navigate({ to: "/orders" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
          <ShoppingBag className="size-12 text-muted-foreground" />
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">Your cart is empty</h1>
          <p className="mt-2 text-muted-foreground">Add some delicious items to get started.</p>
          <Button asChild className="mt-6"><Link to="/menu">Browse the menu</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold text-foreground">Your Order</h1>
          <Button asChild variant="outline" size="sm">
            <Link to="/menu">← Continue Shopping</Link>
          </Button>
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-4 rounded-2xl border border-border bg-card p-3 shadow-card">
                {i.image && <img src={i.image} alt={i.name} className="size-16 shrink-0 rounded-xl object-cover" width={64} height={64} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-foreground">{i.name}</p>
                  <p className="text-sm text-accent">{formatPrice(i.price)}</p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border">
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setQty(i.id, i.quantity - 1)}><Minus className="size-3.5" /></Button>
                  <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                  <Button size="icon" variant="ghost" className="size-8" onClick={() => setQty(i.id, i.quantity + 1)}><Plus className="size-3.5" /></Button>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(i.id)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>

          <form onSubmit={placeOrder} className="h-fit space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card">
            <h2 className="font-display text-xl font-bold text-foreground">Delivery details</h2>
            <div className="space-y-1.5">
              <Label htmlFor="cname">Full name</Label>
              <Input id="cname" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Phone number</Label>
              <Input id="cphone" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} placeholder="03xx-xxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="caddr">Delivery address</Label>
              <Textarea id="caddr" value={address} onChange={(e) => setAddress(e.target.value)} required maxLength={300} placeholder="House #, street, area, Karachi" />
              <Button
                type="button"
                variant={coords ? "secondary" : "outline"}
                size="sm"
                className="w-full"
                onClick={detectLocation}
                disabled={locating}
              >
                {coords ? (
                  <>
                    <MapPin className="size-4" /> Location captured ✓
                  </>
                ) : (
                  <>
                    <LocateFixed className="size-4" />
                    {locating ? "Detecting…" : "Use my current location"}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Sharing your GPS location helps the rider find you faster.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cnotes">Order notes (optional)</Label>
              <Textarea id="cnotes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} placeholder="Less spicy, extra raita…" />
            </div>
            <div className="space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPrice(total)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Delivery fee</span><span>{formatPrice(DELIVERY_FEE)}</span></div>
              <div className="flex justify-between pt-1 text-base font-bold text-foreground"><span>Total</span><span>{formatPrice(total + DELIVERY_FEE)}</span></div>
            </div>
            <p className="text-xs text-muted-foreground">Payment: Cash on Delivery</p>
            <Button type="submit" className="w-full" size="lg" disabled={placing}>
              {placing ? "Placing order…" : user ? "Place Order" : "Sign in to order"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Questions? WhatsApp us at {CAFE.phone}</p>
          </form>
        </div>
      </div>
    </SiteLayout>
  );
}