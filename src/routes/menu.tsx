import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { sb } from "@/lib/db";
import { CATEGORIES } from "@/lib/constants";
import { useCategories } from "@/lib/categories";
import type { Product } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Descent Cafe Karachi" },
      { name: "description", content: "Browse the full Descent Cafe menu: coffees, chai, parathas, snacks, beverages and desserts with prices. Order online for delivery." },
      { property: "og:title", content: "Menu — Descent Cafe" },
      { property: "og:description", content: "Coffees, chai, parathas, snacks & more — order online in Karachi." },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [active, setActive] = useState<string>("All");
  const { data: categories = [] } = useCategories();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
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

  const filtered = useMemo(
    () => (active === "All" ? products : products.filter((p) => p.category === active)),
    [products, active],
  );

  const names =
    categories.length > 0 ? categories.map((c) => c.name) : [...CATEGORIES];
  const tabs = ["All", ...names];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <p className="font-medium uppercase tracking-widest text-accent">Our Menu</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-foreground">Made fresh, every order</h1>
        </div>

        <div className="sticky top-16 z-20 -mx-4 mt-8 flex gap-2 overflow-x-auto bg-background/90 px-4 py-3 backdrop-blur">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setActive(t)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active === t
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="py-20 text-center text-muted-foreground">Loading menu…</p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}