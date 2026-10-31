import { Link, useLocation } from "@tanstack/react-router";
import { Home, Utensils, TrendingUp, FlaskConical, User, LogOut, UserX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { BUTTON_PRIMARY } from "@/components/ui-cards";

const navItems = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/diet-plan", label: "Diet", icon: Utensils },
  { to: "/progress", label: "Progress", icon: TrendingUp },
  { to: "/blood-reports", label: "Reports", icon: FlaskConical },
  { to: "/profile", label: "Profile", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 bg-card/90 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_-4px_24px_-8px_rgb(0_0_0/0.12)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5 pb-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                  active ? "bg-primary/10" : ""
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              </span>
              <span className={`text-[11px] ${active ? "font-semibold" : "font-medium"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppHeader({ title }: { title: string }) {
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] py-3">
        <h1 className="font-display text-lg font-bold text-foreground">{title}</h1>
        <button
          onClick={signOut}
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-transform hover:bg-muted hover:text-foreground active:scale-95"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

// Signed in, but this login isn't linked to a client record (no
// client_portal_users row), so there's nothing to load.
function AccountNotLinked() {
  const { signOut, user } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-warning/15 text-warning-foreground">
        <UserX className="h-7 w-7" />
      </div>
      <h2 className="font-display text-xl font-bold text-foreground">Account not linked</h2>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">
        {user?.email || user?.phone ? (
          <>
            You're signed in as <b className="text-foreground">{user.email || user.phone}</b>, but this login
            isn't connected to a client profile yet.
          </>
        ) : (
          "This login isn't connected to a client profile yet."
        )}{" "}
        Please ask your nutritionist to enable portal access for you.
      </p>
      <button onClick={signOut} className={`mt-6 ${BUTTON_PRIMARY}`}>
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}

export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  const { isLoading, isAuthenticated, clientProfile } = useAuth();
  const notLinked = !isLoading && isAuthenticated && !clientProfile;

  return (
    <div className="min-h-screen bg-background pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <AppHeader title={title} />
      <main className="mx-auto max-w-lg py-5 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        {notLinked ? <AccountNotLinked /> : children}
      </main>
      <BottomNav />
    </div>
  );
}
