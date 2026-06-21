import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAFE } from "@/lib/constants";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Login or Sign Up — Descent Cafe" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, roles, isRider, isStaff } = useAuth();

  useEffect(() => {
    if (!user) return;
    // Send each role to the right home: riders to deliveries, staff to admin.
    if (isRider && !isStaff) navigate({ to: "/rider", replace: true });
    else if (isStaff) navigate({ to: "/admin", replace: true });
    else navigate({ to: "/menu", replace: true });
  }, [user, roles, isRider, isStaff, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email exists, a reset link is on its way.");
        setMode("login");
        return;
      }
      if (mode === "register") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name, phone },
          },
        });
        if (error) throw error;
        toast.success("Account created! You're signed in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      }
      navigate({ to: "/menu" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Friendlier message for the common duplicate-email signup case.
      if (/already registered|already exists|user already/i.test(msg)) {
        toast.error("That email is already registered. Try signing in instead.");
        setMode("login");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  };

  return (
    <SiteLayout>
      <div className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <h1 className="font-display text-2xl font-bold text-foreground">
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : "Reset your password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "login"
              ? `Sign in to order from ${CAFE.name}.`
              : mode === "register"
                ? `Join ${CAFE.name}.`
                : "Enter your email and we'll send you a secure reset link."}
          </p>

          {mode !== "forgot" && (
            <>
              <Button variant="outline" className="mt-6 w-full" onClick={google} type="button">
                Continue with Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "register" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required maxLength={20} placeholder="03xx-xxxxxxx" />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            )}
            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm font-medium text-accent hover:underline"
                  onClick={() => setMode("forgot")}
                >
                  Forgot password?
                </button>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? "Please wait…"
                : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>

          {mode === "forgot" ? (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              Remembered it?{" "}
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => setMode("login")}
              >
                Back to sign in
              </button>
            </p>
          ) : (
            <p className="mt-5 text-center text-sm text-muted-foreground">
              {mode === "login" ? "New here? " : "Already have an account? "}
              <button
                className="font-semibold text-accent hover:underline"
                onClick={() => setMode(mode === "login" ? "register" : "login")}
              >
                {mode === "login" ? "Create an account" : "Sign in"}
              </button>
            </p>
          )}
        </div>
        <Link to="/menu" className="mt-4 text-center text-sm text-muted-foreground hover:text-foreground">
          ← Back to menu
        </Link>
      </div>
    </SiteLayout>
  );
}