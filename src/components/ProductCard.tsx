import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/constants";
import { categoryImage } from "@/lib/categories";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const img = categoryImage(product.category, product.image_url);
  const soldOut = !product.is_available || product.stock_quantity <= 0;
  const lowStock = !soldOut && product.stock_quantity <= 5;

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-shadow hover:shadow-warm">
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={img}
          alt={product.name}
          loading="lazy"
          width={800}
          height={600}
          className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {soldOut && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm font-semibold text-foreground">
            Sold out
          </span>
        )}
        {lowStock && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            Only {product.stock_quantity} left
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-semibold leading-tight text-foreground">{product.name}</h3>
          <span className="shrink-0 font-semibold text-accent">{formatPrice(product.price)}</span>
        </div>
        {product.description && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.description}</p>
        )}
        <Button
          className="mt-4"
          disabled={soldOut}
          onClick={() => {
            add({ id: product.id, name: product.name, price: product.price, image: img });
            toast.success(`${product.name} added to cart`);
          }}
        >
          <Plus /> {soldOut ? "Sold out" : "Add to cart"}
        </Button>
      </div>
    </div>
  );
}