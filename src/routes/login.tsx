import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import fitsushLogo from "@/assets/fitsush-logo.webp";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    window.location.href = "/dashboard";
    return null;
  }

  const normalizePhone = (raw: string) => {
    const trimmed = raw.trim().replace(/[\s-]/g, "");
    if (!trimmed) return "";
    // Ensure E.164: must start with + and country code
    return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const id = identifier.trim();
    if (!id) {
      setError(mode === "email" ? "Enter your email" : "Enter your phone number");
      return;
    }
    if (mode === "phone") {
      const normalized = normalizePhone(id);
      if (!/^\+\d{8,15}$/.test(normalized)) {
        setError("Enter phone with country code, e.g. +911234567890");
        return;
      }
    }
    setLoading(true);
    const payload =
      mode === "email"
        ? { email: id, password }
        : { phone: normalizePhone(id), password };
    const result = await signIn(payload);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.href = "/dashboard";
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm">
          <img src={fitsushLogo} alt="Fitsush" className="h-10 w-10 object-contain" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">Fitsush</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your nutrition journey, simplified</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          {(["email", "phone"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setIdentifier("");
                setError("");
              }}
              className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                mode === m
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {m === "email" ? "Email" : "Phone"}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-foreground">
            {mode === "email" ? "Email" : "Phone"}
          </label>
          <input
            id="identifier"
            type={mode === "email" ? "email" : "tel"}
            inputMode={mode === "email" ? "email" : "tel"}
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={mode === "email" ? "you@example.com" : "+911234567890"}
            autoComplete={mode === "email" ? "email" : "tel"}
          />
          {mode === "phone" && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Include country code (e.g. +91 for India).
            </p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="mt-8 text-xs text-muted-foreground">
        Contact your nutritionist if you don't have an account
      </p>
    </div>
  );
}
