import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import { PageShell } from "@/components/app-shell";
import { LoadingSpinner } from "@/components/ui-cards";
import { User, Mail, Phone, MapPin, Heart, Ruler, Scale, Target, Calendar } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfileField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{String(value)}</p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  const p = clientProfile;

  const age = p?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <PageShell title="My Profile">
      {/* Avatar header */}
      <div className="mb-5 flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <User className="h-10 w-10 text-primary" />
        </div>
        <h2 className="mt-3 font-display text-xl font-bold text-foreground">
          {p?.name ?? "Client"}
        </h2>
        {p?.email && <p className="text-sm text-muted-foreground">{p.email}</p>}
      </div>

      {/* Personal info */}
      <div className="rounded-2xl border bg-card px-4 divide-y divide-border">
        <ProfileField icon={<Mail className="h-4 w-4" />} label="Email" value={p?.email} />
        <ProfileField icon={<Phone className="h-4 w-4" />} label="Phone" value={p?.phone} />
        <ProfileField
          icon={<Calendar className="h-4 w-4" />}
          label="Date of Birth"
          value={
            p?.date_of_birth
              ? `${new Date(p.date_of_birth).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}${age ? ` (${age} yrs)` : ""}`
              : null
          }
        />
        <ProfileField icon={<User className="h-4 w-4" />} label="Gender" value={p?.gender} />
        <ProfileField icon={<MapPin className="h-4 w-4" />} label="Address" value={p?.address} />
      </div>

      {/* Health info */}
      <h3 className="mb-2 mt-5 font-display text-sm font-semibold text-foreground">
        Health Summary
      </h3>
      <div className="rounded-2xl border bg-card px-4 divide-y divide-border">
        <ProfileField
          icon={<Ruler className="h-4 w-4" />}
          label="Height"
          value={p?.height ? `${p.height} cm` : null}
        />
        <ProfileField
          icon={<Scale className="h-4 w-4" />}
          label="Weight"
          value={p?.weight ? `${p.weight} kg` : null}
        />
        <ProfileField icon={<Target className="h-4 w-4" />} label="Goal" value={p?.goal} />
        <ProfileField
          icon={<Heart className="h-4 w-4" />}
          label="Health Conditions"
          value={p?.health_conditions}
        />
      </div>
    </PageShell>
  );
}
