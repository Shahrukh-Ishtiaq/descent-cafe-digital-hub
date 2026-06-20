import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Clock, MapPin, Truck } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { PromoBanner } from "@/components/PromoBanner";
import { CAFE, CATEGORIES } from "@/lib/constants";
import { CATEGORY_IMAGES, CATEGORY_BLURBS, categoryImage, useCategories } from "@/lib/categories";
import hero from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Descent Cafe — Coffee, Chai & Parathas in Karachi" },
      { name: "description", content: "Order coffee, chai, parathas and more from Descent Cafe in Buffer Zone, Sector 15-A, Karachi. Fast home delivery and online ordering." },
      { property: "og:title", content: "Descent Cafe — Karachi" },
      { property: "og:description", content: "Premium coffee, desi chai & fresh parathas delivered to your door in Karachi." },
      { property: "og:image", content: hero },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: categories = [] } = useCategories();
  const cats =
    categories.length > 0
      ? categories.map((c) => ({
          name: c.name,
          blurb: c.blurb || CATEGORY_BLURBS[c.name] || "",
          image: categoryImage(c.name, c.image_url),
        }))
      : CATEGORIES.map((c) => ({
          name: c,
          blurb: CATEGORY_BLURBS[c] || "",
          image: CATEGORY_IMAGES[c],
        }));
  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <img src={hero} alt="A freshly poured latte at Descent Cafe" width={1600} height={1100} className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-primary/30" />
        <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-4 py-16 sm:py-24 md:py-36">
          <span className="rounded-full bg-background/15 px-4 py-1.5 text-sm font-medium text-primary-foreground backdrop-blur">
            Buffer Zone, Sector 15-A · Karachi
          </span>
          <h1 className="max-w-2xl text-balance font-display text-3xl font-black leading-[1.08] text-primary-foreground sm:text-4xl md:text-6xl">
            Brewed with love, delivered to your door.
          </h1>
          <p className="max-w-xl text-base text-primary-foreground/85 sm:text-lg">
            From rich espresso and desi karak chai to flaky aloo & cheese parathas — order your favourites online and track every step to delivery.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/menu">Order Now <ArrowRight /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/contact">Visit Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Active promotions */}
      <PromoBanner />

      {/* Highlights */}
      <section className="relative z-10 mx-auto mt-8 max-w-6xl px-4 sm:-mt-10">
        <div className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-3">
          {[
            { icon: Truck, title: "Fast Delivery", text: "Hot & fresh across North Karachi." },
            { icon: Clock, title: CAFE.hours.replace("Open daily · ", ""), text: "Open every single day." },
            { icon: MapPin, title: "Dine-in & Takeaway", text: "Sector 15-A, Buffer Zone." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><f.icon className="size-5" /></span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{f.title}</p>
                <p className="text-sm text-muted-foreground">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-8 text-center">
          <p className="font-medium uppercase tracking-widest text-accent">Our Menu</p>
          <h2 className="mt-1 font-display text-3xl font-bold text-foreground md:text-4xl">Explore by category</h2>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((cat) => (
            <Link key={cat.name} to="/menu" className="group relative overflow-hidden rounded-2xl shadow-card">
              <img src={cat.image} alt={cat.name} loading="lazy" width={800} height={600} className="aspect-[5/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <h3 className="font-display text-xl font-bold text-primary-foreground">{cat.name}</h3>
                <p className="text-sm text-primary-foreground/80">{cat.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-4">
        <div className="rounded-3xl bg-gradient-warm px-6 py-12 text-center shadow-warm md:py-16">
          <h2 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">Hungry? Let’s get you sorted.</h2>
          <p className="mx-auto mt-2 max-w-md text-primary-foreground/85">Create an account, build your cart and we’ll deliver it piping hot.</p>
          <Button asChild size="lg" className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/menu">Start your order <ArrowRight /></Link>
          </Button>
        </div>
      </section>
    </SiteLayout>
  );
}
