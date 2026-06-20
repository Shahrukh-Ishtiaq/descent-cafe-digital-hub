export const CAFE = {
  name: "Descent Cafe",
  tagline: "Where every cup feels like coming home.",
  address: "Buffer Zone, Sector 15-A, Karachi, Pakistan",
  phone: "+92 300 1234567",
  phoneHref: "tel:+923001234567",
  whatsapp: "923001234567",
  email: "descentcafe@gmail.com",
  hours: "Open daily · 8:00 AM – 1:00 AM",
  mapQuery: "Buffer Zone Sector 15-A Karachi Pakistan",
};

// Studio credit shown in the footer.
export const NEXORA = {
  name: "Nexora Studio",
  url: "https://nexora-studio-web.vercel.app",
};

export const CATEGORIES = [
  "Coffee",
  "Chai & Tea",
  "Parathas",
  "Snacks",
  "Beverages",
  "Desserts",
] as const;

export function formatPrice(n: number) {
  return `Rs. ${Number(n).toLocaleString("en-PK")}`;
}

export const STATUS_META: Record<
  string,
  { label: string; className: string }
> = {
  pending: { label: "Pending", className: "bg-muted text-muted-foreground" },
  preparing: { label: "Preparing", className: "bg-gold/20 text-foreground" },
  out_for_delivery: {
    label: "Out for Delivery",
    className: "bg-accent/25 text-accent-foreground",
  },
  delivered: { label: "Delivered", className: "bg-primary text-primary-foreground" },
  cancelled: { label: "Cancelled", className: "bg-destructive/15 text-destructive" },
};

export const STATUS_FLOW = [
  "pending",
  "preparing",
  "out_for_delivery",
  "delivered",
] as const;

export function whatsappLink(message?: string) {
  const base = `https://wa.me/${CAFE.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Build a Google Maps navigation link. Prefer GPS coordinates when available,
// otherwise fall back to a free-text address search.
export function mapsNavLink(opts: {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}) {
  if (opts.lat != null && opts.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${opts.lat},${opts.lng}&travelmode=driving`;
  }
  const q = encodeURIComponent(opts.address || CAFE.mapQuery);
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  staff: "Staff",
  rider: "Rider",
  customer: "Customer",
};