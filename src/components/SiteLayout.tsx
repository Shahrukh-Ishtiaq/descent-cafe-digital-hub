import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Header } from "./layout/Header";
import { Footer } from "./layout/Footer";
import { WhatsAppButton } from "./WhatsAppButton";
import { useAuth } from "@/lib/auth";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { isRider, isStaff, loading } = useAuth();
  const navigate = useNavigate();

  // Riders get a dedicated delivery-only app — keep them out of the customer site.
  const riderOnly = !loading && isRider && !isStaff;
  useEffect(() => {
    if (riderOnly) navigate({ to: "/rider", replace: true });
  }, [riderOnly, navigate]);

  if (riderOnly) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}