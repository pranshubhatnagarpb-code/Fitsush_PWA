import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import fitsushLogo from "@/assets/fitsush-logo.webp";
import { Mail, Lock, Loader2 } from "lucide-react";
import { HERO_GRADIENT, INPUT, MICRO_LABEL, ErrorNote } from "@/components/ui-cards";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    window.location.href = "/dashboard";
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const id = identifier.trim();
    if (!id) {
      setError("Enter your email");
      return;
    }
    setLoading(true);
    const payload = { email: id, password };
    const result = await signIn(payload);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header
        className={`relative overflow-hidden px-6 pt-[calc(3rem+env(safe-area-inset-top))] pb-24 text-center text-white ${HERO_GRADIENT}`}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-12 h-48 w-48 rounded-full bg-hero-glow/25 blur-2xl" />
        <div className="relative flex flex-col items-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/10">
            <img src={fitsushLogo} alt="Fitsush" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="font-display text-3xl font-bold">Fitsush</h1>
          <p className="mt-1 text-sm text-white/85">Your nutrition journey, simplified</p>
        </div>
      </header>

      <div className="relative mx-auto -mt-16 w-full max-w-sm px-4 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-3xl border bg-card p-6 shadow-xl shadow-foreground/5">
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Welcome back</h2>
            <p className="text-sm text-muted-foreground">Sign in to see your plan and progress</p>
          </div>

          {error && <ErrorNote>{error}</ErrorNote>}

          <div>
            <label htmlFor="identifier" className={`mb-1.5 block ${MICRO_LABEL}`}>
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="identifier"
                type="email"
                inputMode="email"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className={`${INPUT} pl-11`}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className={`mb-1.5 block ${MICRO_LABEL}`}>
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${INPUT} pl-11`}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-transform hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Contact your nutritionist if you don't have an account
        </p>
      </div>
    </div>
  );
}
