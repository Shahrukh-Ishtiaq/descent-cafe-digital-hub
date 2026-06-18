import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { sb } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My Profile — Descent Cafe" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refreshProfile, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
    }
  }, [profile]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await sb
      .from("profiles")
      .update({
        full_name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Could not save");
    else {
      toast.success("Profile updated");
      refreshProfile();
    }
  };

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="font-display text-3xl font-bold text-foreground">
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>

        <form
          onSubmit={save}
          className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6 shadow-card"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={20}
              placeholder="03xx-xxxxxxx"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Default delivery address</Label>
            <Textarea
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>

        {roles.length > 0 && (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Account roles: {roles.join(", ")}
          </p>
        )}

        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={signOut}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </SiteLayout>
  );
}
