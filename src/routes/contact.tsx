import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock, Mail, MessageCircle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { CAFE, whatsappLink } from "@/lib/constants";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact & Location — Descent Cafe Karachi" },
      { name: "description", content: "Find Descent Cafe at Buffer Zone, Sector 15-A, Karachi. Call us, message on WhatsApp or get directions on Google Maps." },
      { property: "og:title", content: "Contact Descent Cafe" },
      { property: "og:description", content: "Visit, call or WhatsApp Descent Cafe in Buffer Zone, Sector 15-A, Karachi." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const info = [
    { icon: MapPin, label: "Address", value: CAFE.address },
    { icon: Phone, label: "Phone", value: CAFE.phone, href: CAFE.phoneHref },
    { icon: Mail, label: "Email", value: CAFE.email, href: `mailto:${CAFE.email}` },
    { icon: Clock, label: "Hours", value: CAFE.hours },
  ];
  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="text-center">
          <p className="font-medium uppercase tracking-widest text-accent">Get in touch</p>
          <h1 className="mt-1 font-display text-4xl font-bold text-foreground">Visit Descent Cafe</h1>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            {info.map((i) => (
              <div key={i.label} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 shadow-card">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><i.icon className="size-5" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-muted-foreground">{i.label}</p>
                  {i.href ? (
                    <a href={i.href} className="font-semibold text-foreground hover:text-accent">{i.value}</a>
                  ) : (
                    <p className="font-semibold text-foreground">{i.value}</p>
                  )}
                </div>
              </div>
            ))}
            <Button asChild size="lg" className="w-full bg-[oklch(0.62_0.17_150)] text-white hover:opacity-90">
              <a href={whatsappLink(`Hi ${CAFE.name}!`)} target="_blank" rel="noopener noreferrer">
                <MessageCircle /> Chat on WhatsApp
              </a>
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border shadow-card">
            <iframe
              title="Descent Cafe location"
              src={`https://www.google.com/maps?q=${encodeURIComponent(CAFE.mapQuery)}&output=embed`}
              className="h-full min-h-80 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}