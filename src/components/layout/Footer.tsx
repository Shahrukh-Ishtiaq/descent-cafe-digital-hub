import { Link } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { CAFE } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-border bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <h3 className="font-display text-lg font-bold">Descent Cafe</h3>
          <p className="mt-2 max-w-xs text-sm text-sidebar-foreground/70">{CAFE.tagline}</p>
        </div>
        <div className="space-y-2 text-sm text-sidebar-foreground/80">
          <p className="flex items-start gap-2"><MapPin className="mt-0.5 size-4 shrink-0 text-sidebar-primary" />{CAFE.address}</p>
          <p className="flex items-center gap-2"><Phone className="size-4 shrink-0 text-sidebar-primary" />{CAFE.phone}</p>
          <p className="flex items-center gap-2"><Mail className="size-4 shrink-0 text-sidebar-primary" />{CAFE.email}</p>
          <p className="flex items-center gap-2"><Clock className="size-4 shrink-0 text-sidebar-primary" />{CAFE.hours}</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Explore</p>
          <Link to="/menu" className="block text-sidebar-foreground/80 hover:text-sidebar-primary">Menu</Link>
          <Link to="/cart" className="block text-sidebar-foreground/80 hover:text-sidebar-primary">Order Online</Link>
          <Link to="/contact" className="block text-sidebar-foreground/80 hover:text-sidebar-primary">Contact & Location</Link>
          <Link to="/orders" className="block text-sidebar-foreground/80 hover:text-sidebar-primary">Track Order</Link>
        </div>
      </div>
      <div className="border-t border-sidebar-border py-4 text-center text-xs text-sidebar-foreground/60">
        © {new Date().getFullYear()} Descent Cafe · Karachi, Pakistan
      </div>
    </footer>
  );
}