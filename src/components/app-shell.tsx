import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Utensils, TrendingUp, FlaskConical, User, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/diet-plan", label: "Diet", icon: Utensils },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/blood-reports", label: "Reports", icon: FlaskConical },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "text-primary" : ""}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppHeader({ title }: { title: string }) {
  const { signOut, clientProfile } = useAuth();
  const firstName = clientProfile?.name?.split(" ")[0] ?? "Client";

  return (
    <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
        </div>
        <button
          onClick={signOut}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20">
      <AppHeader title={title} />
      <main className="mx-auto max-w-lg px-4 py-5">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
