import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Shared building blocks for every portal page. Colours come only from the
// theme tokens in styles.css (primary, hero-*, success, warning, …).

export const HERO_GRADIENT = "bg-gradient-to-br from-hero-from via-hero-via to-hero-to";

// Pill buttons that sit on the hero gradient.
export const HERO_BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-primary shadow-sm transition-transform active:scale-95 disabled:opacity-60";
export const HERO_BUTTON_GHOST =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition-transform active:scale-95 disabled:opacity-60";

// Pill buttons on regular (card / background) surfaces.
export const BUTTON_PRIMARY =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-50";
export const BUTTON_GHOST =
  "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium text-muted-foreground transition-transform hover:bg-muted active:scale-95 disabled:opacity-40";
export const BUTTON_OUTLINE =
  "inline-flex items-center justify-center gap-1.5 rounded-full border bg-card px-4 py-2 text-xs font-semibold text-foreground transition-transform hover:bg-muted active:scale-95 disabled:opacity-50";

export const MICRO_LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground";

export const INPUT =
  "w-full rounded-2xl border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-shadow focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";

// Hides the scrollbar on horizontal chip scrollers.
export const NO_SCROLLBAR = "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

// Icon chip tints, one per kind of section.
export const CHIP_TINT = {
  primary: "bg-primary/10 text-primary",
  notes: "bg-warning/15 text-warning-foreground",
  success: "bg-success/15 text-success",
  info: "bg-chart-2/15 text-chart-2",
  health: "bg-destructive/10 text-destructive",
} as const;

export function PageHero({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary/20 ${HERO_GRADIENT}`}
    >
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-hero-glow/25 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/75">{eyebrow}</p>
            )}
            <h2 className="mt-1 font-display text-2xl font-bold leading-tight">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-white/85">{subtitle}</p>}
          </div>
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
              {icon}
            </div>
          )}
        </div>
        {children && <div className="mt-4">{children}</div>}
      </div>
    </section>
  );
}

export function HeroStat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/10 px-3 py-2.5 ring-1 ring-white/15 backdrop-blur-sm">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">{label}</p>
      <p className="mt-0.5 truncate font-display text-lg font-bold">{value}</p>
      {hint && <p className="truncate text-[11px] text-white/75">{hint}</p>}
    </div>
  );
}

// Progress bar on the hero. `pct` is 0–100.
export function HeroProgress({ pct }: { pct: number }) {
  const width = Math.max(3, Math.min(100, pct));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
      <div
        className="h-full rounded-full bg-gradient-to-r from-hero-glow to-white transition-all"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export function SectionCard({
  icon,
  iconClassName = CHIP_TINT.primary,
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  icon?: ReactNode;
  iconClassName?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border bg-card p-5 shadow-sm ${className}`}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed bg-card/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingSpinner({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${fullScreen ? "min-h-screen bg-background" : "py-12"}`}>
      <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-primary/15 border-t-primary" />
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{children}</div>;
}

// Bottom sheet on phones, centred dialog from sm up.
export function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/30 backdrop-blur-sm animate-in fade-in sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-background px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom-8 sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-transform hover:bg-muted active:scale-95"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const CHART_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

// Trend area chart. `id` must be unique on the page (it names the gradient).
export function TrendChart({
  id,
  data,
  unit,
}: {
  id: string;
  data: { date: string; value: number | null }[];
  unit?: string;
}) {
  const gradientId = `trend-fill-${id}`;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="date" tick={CHART_TICK} axisLine={false} tickLine={false} />
        <YAxis tick={CHART_TICK} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={44} />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.75rem",
            fontSize: 12,
          }}
          formatter={(v) => [`${v}${unit ? ` ${unit}` : ""}`, "Value"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--primary)"
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ fill: "var(--card)", stroke: "var(--primary)", strokeWidth: 2, r: 3.5 }}
          activeDot={{ r: 5, fill: "var(--primary)", stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export const formatShortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const formatLongDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
