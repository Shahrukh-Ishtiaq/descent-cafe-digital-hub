import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import logo from "@/assets/logo.png";
import { CAFE } from "@/lib/constants";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/contact", label: "Contact" },
];

export function Header() {
  const { count } = useCart();
  const { user, isStaff } = useAuth();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt={CAFE.name} className="h-9 w-9 object-contain" width={36} height={36} />
          <span className="font-display text-xl font-bold tracking-tight text-foreground">
            Descent <span className="text-accent">Cafe</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname === n.to && "text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
          {isStaff && (
            <Link to="/admin" className="rounded-md px-3 py-2 text-sm font-medium text-accent hover:text-accent/80">
              Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon" className="relative">
            <Link to="/cart" aria-label="Cart">
              <ShoppingBag />
              {count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground">
                  {count}
                </span>
              )}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Link to={user ? "/orders" : "/auth"} aria-label="Account">
              <User />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 py-2 md:hidden">
          {[...NAV, { to: user ? "/orders" : "/auth", label: user ? "My Orders" : "Login" }].map((n) => (
            <Link
              key={n.label}
              to={n.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-secondary"
            >
              {n.label}
            </Link>
          ))}
          {isStaff && (
            <Link to="/admin" onClick={() => setOpen(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium text-accent hover:bg-secondary">
              Dashboard
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}