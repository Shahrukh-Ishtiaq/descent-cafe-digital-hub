import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Tag, ArrowRight } from "lucide-react";
import { sb } from "@/lib/db";
import type { Promotion } from "@/lib/types";

// Only show offers that are active and currently within their date window.
function isLive(p: Promotion) {
  const now = Date.now();
  if (!p.is_active) return false;
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return false;
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return false;
  return true;
}

export function PromoBanner() {
  const { data: promos = [] } = useQuery({
    queryKey: ["promos", "active"],
    staleTime: 60_000,
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await sb
        .from("promotions")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as Promotion[]).filter(isLive);
    },
  });

  if (promos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-10">
      <div className="space-y-3">
        {promos.slice(0, 3).map((p) => (
          <Link
            key={p.id}
            to="/menu"
            className="group flex flex-col gap-3 rounded-2xl bg-gradient-warm p-5 shadow-warm sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/20 text-primary-foreground">
                <Tag className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold text-primary-foreground">
                  {p.title}
                  {p.discount_percent > 0 && (
                    <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">
                      {p.discount_percent}% OFF
                    </span>
                  )}
                </p>
                {p.description && (
                  <p className="text-sm text-primary-foreground/85">
                    {p.description}
                  </p>
                )}
                {p.promo_code && (
                  <p className="mt-1 text-xs text-primary-foreground/85">
                    Use code{" "}
                    <span className="rounded bg-background/25 px-1.5 py-0.5 font-mono font-semibold">
                      {p.promo_code}
                    </span>
                  </p>
                )}
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-background/20 px-4 py-2 text-sm font-semibold text-primary-foreground transition-transform group-hover:translate-x-0.5">
              Order now <ArrowRight className="size-4" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}