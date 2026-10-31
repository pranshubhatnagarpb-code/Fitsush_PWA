import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, type ReactNode } from "react";
import { PageShell } from "@/components/app-shell";
import {
  LoadingSpinner,
  PageHero,
  HeroStat,
  SectionCard,
  BUTTON_PRIMARY,
  CHIP_TINT,
  MICRO_LABEL,
} from "@/components/ui-cards";
import { useInstall } from "@/components/install-prompt";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Heart,
  Target,
  Calendar,
  Smartphone,
  Download,
  Share,
  SquarePlus,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={MICRO_LABEL}>{label}</p>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-foreground">{String(value)}</p>
      </div>
    </div>
  );
}

function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function InstallCard() {
  const { mode, install } = useInstall();
  const [showIosSteps, setShowIosSteps] = useState(false);

  return (
    <SectionCard
      icon={<Smartphone className="h-4 w-4" />}
      iconClassName={CHIP_TINT.info}
      title="Install the app"
      subtitle={
        mode === "installed"
          ? "You're using the installed app"
          : "One-tap access to your plan, progress and reminders"
      }
    >
      {mode === "installed" ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Installed on this device
        </p>
      ) : mode === "native" ? (
        <button type="button" onClick={install} className={BUTTON_PRIMARY}>
          <Download className="h-4 w-4" />
          Install Fitsush
        </button>
      ) : mode === "ios" ? (
        showIosSteps ? (
          <ol className="space-y-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Tap the <b>Share</b> button in Safari's toolbar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="h-5 w-5 shrink-0 text-primary" />
              <span>
                Choose <b>Add to Home Screen</b>, then tap <b>Add</b>
              </span>
            </li>
          </ol>
        ) : (
          <button type="button" onClick={() => setShowIosSteps(true)} className={BUTTON_PRIMARY}>
            <Download className="h-4 w-4" />
            Show me how
          </button>
        )
      ) : (
        <p className="text-sm text-muted-foreground">
          Open this page in Chrome (Android) or Safari (iPhone) and use the browser menu's
          <b className="text-foreground"> Install app</b> / <b className="text-foreground">Add to Home Screen</b> option.
        </p>
      )}
    </SectionCard>
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

  if (authLoading || !isAuthenticated) return <LoadingSpinner fullScreen />;

  const p = clientProfile;

  const age = p?.date_of_birth
    ? Math.floor(
        (Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
    : null;

  return (
    <PageShell title="Profile">
      <div className="space-y-4">
        <PageHero
          eyebrow="My profile"
          title={
            <span className="flex items-center gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 font-display text-xl font-bold ring-1 ring-white/25">
                {initials(p?.name)}
              </span>
              <span className="min-w-0 break-words">{p?.name ?? "Client"}</span>
            </span>
          }
          subtitle={p?.email ?? undefined}
        >
          <div className="grid grid-cols-3 gap-2">
            <HeroStat label="Height" value={p?.height ?? "—"} hint={p?.height ? "cm" : undefined} />
            <HeroStat label="Weight" value={p?.weight ?? "—"} hint={p?.weight ? "kg" : undefined} />
            <HeroStat label="Age" value={age ?? "—"} hint={age ? "years" : undefined} />
          </div>
        </PageHero>

        <SectionCard icon={<User className="h-4 w-4" />} title="Personal details">
          <div className="divide-y divide-border">
            <ProfileRow icon={<Mail className="h-4 w-4" />} label="Email" value={p?.email} />
            <ProfileRow icon={<Phone className="h-4 w-4" />} label="Phone" value={p?.phone} />
            <ProfileRow
              icon={<Calendar className="h-4 w-4" />}
              label="Date of birth"
              value={
                p?.date_of_birth
                  ? new Date(p.date_of_birth).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : null
              }
            />
            <ProfileRow icon={<User className="h-4 w-4" />} label="Gender" value={p?.gender} />
            <ProfileRow icon={<MapPin className="h-4 w-4" />} label="Address" value={p?.address} />
          </div>
        </SectionCard>

        {(p?.goal || p?.health_conditions) && (
          <SectionCard
            icon={<Heart className="h-4 w-4" />}
            iconClassName={CHIP_TINT.health}
            title="Health"
          >
            <div className="divide-y divide-border">
              <ProfileRow icon={<Target className="h-4 w-4" />} label="Goal" value={p?.goal} />
              <ProfileRow icon={<Heart className="h-4 w-4" />} label="Health conditions" value={p?.health_conditions} />
            </div>
          </SectionCard>
        )}

        <InstallCard />
      </div>
    </PageShell>
  );
}
