import type { ReactNode } from "react";

interface SummaryCardProps {
  icon: ReactNode;
  label: string;
  value: string | number | null;
  subtitle?: string;
  variant?: "default" | "primary" | "accent";
}

export function SummaryCard({ icon, label, value, subtitle, variant = "default" }: SummaryCardProps) {
  const bg =
    variant === "primary"
      ? "bg-primary/10 border-primary/20"
      : variant === "accent"
        ? "bg-accent border-accent"
        : "bg-card border-border";

  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-foreground">
        {value ?? "—"}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 px-6 py-12 text-center">
      <div className="mb-3 text-muted-foreground">{icon}</div>
      <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
