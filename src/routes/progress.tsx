import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { BodyMeasurement, ProgressEntry } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import {
  EmptyState,
  LoadingSpinner,
  PageHero,
  HeroStat,
  SectionCard,
  TrendChart,
  HERO_BUTTON_PRIMARY,
  HERO_BUTTON_GHOST,
  BUTTON_OUTLINE,
  CHIP_TINT,
  MICRO_LABEL,
  formatShortDate,
  formatLongDate,
} from "@/components/ui-cards";
import { TrendingUp, Scale, Activity, Ruler, Percent, Plus, HeartPulse, Download, Loader2, Bell, BellOff, ChevronDown, History, BarChart3 } from "lucide-react";
import { MeasurementForm } from "@/components/measurement-form";
import { HealthCheckinForm } from "@/components/health-checkin-form";
import { downloadProgressSummaryPdf } from "@/lib/progressSummaryPdf";
import {
  isPushSupported,
  getNotificationPermission,
  isSubscribedToWeeklyReminders,
  subscribeToWeeklyReminders,
} from "@/lib/pushNotifications";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

type MetricKey =
  | "weight"
  | "bmi"
  | "body_fat_percent"
  | "waist"
  | "hip"
  | "chest"
  | "thigh"
  | "arm"
  | "neck";

const METRIC_LABEL: Record<MetricKey, string> = {
  weight: "Weight",
  bmi: "BMI",
  body_fat_percent: "Body Fat",
  waist: "Waist",
  hip: "Hip",
  chest: "Chest",
  thigh: "Thigh",
  arm: "Arm",
  neck: "Neck",
};

const METRIC_UNIT: Record<MetricKey, string> = {
  weight: "kg",
  bmi: "",
  body_fat_percent: "%",
  waist: "cm",
  hip: "cm",
  chest: "cm",
  thigh: "cm",
  arm: "cm",
  neck: "cm",
};

const SUMMARY_METRICS: MetricKey[] = ["weight", "bmi", "waist", "hip", "body_fat_percent"];
const CHART_METRICS: MetricKey[] = ["weight", "bmi", "waist"];

// Lower is better for these metrics
const LOWER_IS_BETTER: MetricKey[] = [
  "weight", "bmi", "body_fat_percent", "waist", "hip", "chest", "thigh", "arm", "neck",
];

interface MetricTrend {
  key: MetricKey;
  first: number;
  latest: number;
  change: number;
  pct: number;
  positive: boolean; // true = improvement
}

function buildTrends(measurements: BodyMeasurement[]): MetricTrend[] {
  if (measurements.length < 2) return [];
  const first = measurements[0];
  const last = measurements[measurements.length - 1];
  const trends: MetricTrend[] = [];
  for (const key of HISTORY_METRICS) {
    const f = first[key];
    const l = last[key];
    if (typeof f !== "number" || typeof l !== "number") continue;
    const change = l - f;
    const pct = f !== 0 ? (change / f) * 100 : 0;
    const positive = LOWER_IS_BETTER.includes(key) ? change < 0 : change > 0;
    trends.push({ key, first: f, latest: l, change, pct, positive });
  }
  return trends;
}

function OverallAnalysisCard({ measurements }: { measurements: BodyMeasurement[] }) {
  const trends = buildTrends(measurements);

  if (trends.length === 0) {
    return (
      <SectionCard icon={<BarChart3 className="h-4 w-4" />} title="Overall analysis">
        <p className="text-sm text-muted-foreground">
          Log at least 2 measurements to see your trend analysis.
        </p>
      </SectionCard>
    );
  }

  const improved = trends.filter((t) => t.positive);
  const worsened = trends.filter((t) => !t.positive && Math.abs(t.change) > 0.01);

  const spanDays = Math.round(
    (new Date(measurements[measurements.length - 1].measurement_date).getTime() -
      new Date(measurements[0].measurement_date).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  let headline = "";
  if (improved.length > worsened.length) {
    headline = "Overall progress is looking positive!";
  } else if (worsened.length > improved.length) {
    headline = "Some metrics need attention — keep going!";
  } else {
    headline = "Mixed progress — consistency is key.";
  }

  // Bar chart data: % change, positive = improvement (flipped sign for "lower is better" metrics)
  const chartData = trends.map((t) => ({
    name: METRIC_LABEL[t.key],
    pct: parseFloat((t.positive ? Math.abs(t.pct) : -Math.abs(t.pct)).toFixed(1)),
    positive: t.positive,
  }));

  return (
    <SectionCard
      icon={<BarChart3 className="h-4 w-4" />}
      title="Overall analysis"
      subtitle={spanDays > 0 ? `${headline} Over ${spanDays} day${spanDays !== 1 ? "s" : ""}.` : headline}
    >

      {/* Bar chart: % change per metric */}
      <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 32)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 4, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <ReferenceLine x={0} stroke="var(--border)" />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "0.75rem",
              fontSize: 12,
            }}
            formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${v}%`, "Change"]}
          />
          <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
            {chartData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.positive ? "var(--color-success)" : "var(--color-destructive)"}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          {improved.length} improving
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
          {worsened.length} to work on
        </span>
      </div>
    </SectionCard>
  );
}
const HISTORY_METRICS: MetricKey[] = [
  "weight",
  "bmi",
  "body_fat_percent",
  "waist",
  "hip",
  "chest",
  "thigh",
  "arm",
  "neck",
];

function MetricIcon({ k }: { k: MetricKey }): ReactNode {
  if (k === "weight") return <Scale className="h-4 w-4" />;
  if (k === "bmi") return <Activity className="h-4 w-4" />;
  if (k === "body_fat_percent") return <Percent className="h-4 w-4" />;
  return <Ruler className="h-4 w-4" />;
}

function ProgressPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [progressEntries, setProgressEntries] = useState<ProgressEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [isReminderSubscribed, setIsReminderSubscribed] = useState(false);
  const [isEnablingReminders, setIsEnablingReminders] = useState(false);
  const [reminderError, setReminderError] = useState<string | null>(null);

  const handleDownloadSummary = async () => {
    if (!clientProfile) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadProgressSummaryPdf(clientProfile.id);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : "Failed to generate your progress summary.");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    setNotifPermission(getNotificationPermission());
    isSubscribedToWeeklyReminders().then(setIsReminderSubscribed);
  }, []);

  const handleEnableReminders = async () => {
    if (!clientProfile) return;
    setIsEnablingReminders(true);
    setReminderError(null);
    const { error } = await subscribeToWeeklyReminders(clientProfile.id);
    setIsEnablingReminders(false);
    setNotifPermission(getNotificationPermission());
    if (error) {
      setReminderError(error);
      return;
    }
    setIsReminderSubscribed(true);
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadMeasurements = useCallback(async () => {
    if (!clientProfile) return;
    const [measRes, entriesRes] = await Promise.all([
      supabase
        .from("body_measurements")
        .select("*")
        .eq("client_id", clientProfile.id)
        .order("measurement_date", { ascending: true }),
      supabase
        .from("client_progress_entries")
        .select("*")
        .eq("client_id", clientProfile.id)
        .order("entry_date", { ascending: false }),
    ]);
    setMeasurements((measRes.data ?? []) as BodyMeasurement[]);
    setProgressEntries((entriesRes.data ?? []) as ProgressEntry[]);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (!clientProfile) return;
    loadMeasurements();
  }, [clientProfile, loadMeasurements]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner fullScreen />;

  // latest measurement (last in asc order)
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;

  // which metrics actually have any data?
  const hasData = (k: MetricKey) =>
    measurements.some((m) => m[k] !== null && m[k] !== undefined);

  const summaryAvailable = SUMMARY_METRICS.filter(hasData);
  const chartsAvailable = CHART_METRICS.filter(hasData);

  // Hero stats: latest weight / BMI, and weight change since the first entry.
  const latestOf = (k: MetricKey) =>
    [...measurements].reverse().find((m) => typeof m[k] === "number")?.[k] as number | undefined;
  const firstWeight = measurements.find((m) => typeof m.weight === "number")?.weight ?? null;
  const latestWeight = latestOf("weight") ?? null;
  const weightChange =
    firstWeight !== null && latestWeight !== null ? Math.round((latestWeight - firstWeight) * 10) / 10 : null;
  const latestBmi = latestOf("bmi") ?? null;

  return (
    <PageShell title="Progress">
      <div className="space-y-4">
        <PageHero
          eyebrow={latest ? `Last logged ${formatLongDate(latest.measurement_date)}` : "Your progress"}
          title="Keep it going"
          subtitle="Track your measurements and how you feel"
          icon={<TrendingUp className="h-5 w-5" />}
        >
          <div className="grid grid-cols-3 gap-2">
            <HeroStat label="Weight" value={latestWeight !== null ? latestWeight : "—"} hint={latestWeight !== null ? "kg" : undefined} />
            <HeroStat
              label="Change"
              value={weightChange !== null && measurements.length > 1 ? `${weightChange > 0 ? "+" : ""}${weightChange}` : "—"}
              hint={weightChange !== null && measurements.length > 1 ? "kg since start" : undefined}
            />
            <HeroStat label="BMI" value={latestBmi !== null ? latestBmi : "—"} />
          </div>
          {clientProfile && (
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowCheckinForm(true)} className={HERO_BUTTON_PRIMARY}>
                <HeartPulse className="h-3.5 w-3.5" />
                Log check-in
              </button>
              <button type="button" onClick={() => setShowForm(true)} className={HERO_BUTTON_GHOST}>
                <Plus className="h-3.5 w-3.5" />
                Add measurement
              </button>
            </div>
          )}
        </PageHero>

        {/* Summary download + weekly reminder opt-in */}
        {clientProfile && (
          <div className="rounded-3xl border bg-card p-4 shadow-sm">
            <button
              type="button"
              onClick={handleDownloadSummary}
              disabled={isDownloading}
              className={`w-full ${BUTTON_OUTLINE} py-2.5`}
            >
              {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isDownloading ? "Generating your summary…" : "Download progress summary"}
            </button>
            {downloadError && <p className="mt-2 text-xs text-destructive">{downloadError}</p>}

            {notifPermission !== "unsupported" && (
              <div className="mt-3 border-t pt-3">
                {isReminderSubscribed ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${CHIP_TINT.success}`}>
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    Weekly reminders to log your progress are on.
                  </p>
                ) : notifPermission === "denied" ? (
                  <p className="flex items-start gap-2 text-xs text-muted-foreground">
                    <BellOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Notifications are blocked for this site in your browser/device settings — enable them there to get weekly reminders.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleEnableReminders}
                    disabled={isEnablingReminders}
                    className="flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-primary/40 px-3 py-2.5 text-xs font-semibold text-primary transition-transform hover:bg-primary/5 active:scale-95 disabled:opacity-50"
                  >
                    {isEnablingReminders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
                    {isEnablingReminders ? "Enabling…" : "Get a weekly reminder to log your measurements"}
                  </button>
                )}
                {reminderError && <p className="mt-2 text-xs text-destructive">{reminderError}</p>}
              </div>
            )}
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : measurements.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-6 w-6" />}
            title="No measurements yet"
            description='Tap "Add measurement" to log your first one, or wait for your nutritionist to record one.'
          />
        ) : (
          <>
            {/* Latest summary tiles */}
            {latest && summaryAvailable.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {summaryAvailable.map((k) => {
                  const val = latest[k];
                  const prev = previous?.[k];
                  const delta = typeof val === "number" && typeof prev === "number" ? val - prev : null;
                  const better = delta !== null && delta !== 0 && (LOWER_IS_BETTER.includes(k) ? delta < 0 : delta > 0);
                  return (
                    <div key={k} className="rounded-3xl border bg-card p-4 shadow-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MetricIcon k={k} />
                        <span className={MICRO_LABEL}>{METRIC_LABEL[k]}</span>
                      </div>
                      <p className="mt-2 font-display text-2xl font-bold text-foreground">
                        {val ?? "—"}
                        {val !== null && METRIC_UNIT[k] && (
                          <span className="ml-1 text-sm font-medium text-muted-foreground">{METRIC_UNIT[k]}</span>
                        )}
                      </p>
                      {delta !== null && (
                        <span
                          className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            delta === 0
                              ? "bg-muted text-muted-foreground"
                              : better
                                ? "bg-success/15 text-success"
                                : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)} {METRIC_UNIT[k]} vs last
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <OverallAnalysisCard measurements={measurements} />

            {chartsAvailable.map((k) => {
              const data = measurements
                .filter((m) => m[k] !== null && m[k] !== undefined)
                .map((m) => ({ date: formatShortDate(m.measurement_date), value: m[k] as number }));
              if (data.length === 0) return null;
              return (
                <SectionCard
                  key={k}
                  icon={<MetricIcon k={k} />}
                  title={METRIC_LABEL[k]}
                  subtitle={`${data.length} reading${data.length === 1 ? "" : "s"}${METRIC_UNIT[k] ? ` · ${METRIC_UNIT[k]}` : ""}`}
                >
                  <TrendChart id={k} data={data} unit={METRIC_UNIT[k]} />
                </SectionCard>
              );
            })}
          </>
        )}

        {/* Health check-ins */}
        <SectionCard
          icon={<HeartPulse className="h-4 w-4" />}
          iconClassName={CHIP_TINT.health}
          title="Health check-ins"
          subtitle="Log how you're feeling periodically"
        >
          {progressEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No check-ins yet — tap "Log check-in" above to record your first one.
            </p>
          ) : (
            <div className="space-y-2">
              {progressEntries.map((entry) => {
                const isOpen = expandedEntry === entry.id;
                const ratings = [
                  ["Sleep", entry.sleep_quality_rating], ["Digestion", entry.digestion_rating],
                  ["Energy", entry.energy_rating], ["Skin", entry.skin_rating],
                  ["Hair", entry.hair_rating],
                ].filter(([, v]) => v != null) as [string, number][];
                return (
                  <div key={entry.id} className="rounded-2xl bg-muted/50">
                    <button
                      onClick={() => setExpandedEntry(isOpen ? null : entry.id)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{formatLongDate(entry.entry_date)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            entry.weight_kg ? `${entry.weight_kg} kg` : null,
                            ...ratings.slice(0, 3).map(([label, val]) => `${label} ${val}/5`),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {isOpen && (
                      <div className="space-y-2 border-t px-4 pb-4 pt-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {entry.weight_kg != null && <div><span className="text-muted-foreground">Weight </span><span className="font-medium">{entry.weight_kg} kg</span></div>}
                          {entry.sleep_hours != null && <div><span className="text-muted-foreground">Sleep </span><span className="font-medium">{entry.sleep_hours} hrs</span></div>}
                          {entry.water_intake && <div><span className="text-muted-foreground">Water </span><span className="font-medium">{entry.water_intake}</span></div>}
                          {entry.activity_level && <div><span className="text-muted-foreground">Activity </span><span className="font-medium capitalize">{entry.activity_level.replace("_", " ")}</span></div>}
                          {entry.screen_time_hrs != null && <div><span className="text-muted-foreground">Screen </span><span className="font-medium">{entry.screen_time_hrs} hrs</span></div>}
                          {entry.stress_rating != null && <div><span className="text-muted-foreground">Stress </span><span className="font-medium">{entry.stress_rating}/5</span></div>}
                        </div>
                        {ratings.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 border-t pt-2 text-xs">
                            {([
                              ["Sleep quality", entry.sleep_quality_rating], ["Digestion", entry.digestion_rating],
                              ["Energy", entry.energy_rating], ["Fatigue", entry.fatigue_rating],
                              ["Skin", entry.skin_rating], ["Hair", entry.hair_rating],
                              ["Acidity", entry.acidity_rating], ["Bloating", entry.bloating_rating],
                            ] as [string, number | null][]).filter(([, v]) => v != null).map(([label, val]) => (
                              <div key={label}><span className="text-muted-foreground">{label} </span><span className="font-medium">{val}/5</span></div>
                            ))}
                          </div>
                        )}
                        {entry.blood_parameters?.length ? (
                          <p className="border-t pt-2 text-xs text-muted-foreground">Blood markers: {entry.blood_parameters.join(", ")}</p>
                        ) : null}
                        {entry.notes && <p className="border-t pt-2 text-xs text-muted-foreground">{entry.notes}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* History */}
        {!loading && measurements.length > 0 && (
          <SectionCard
            icon={<History className="h-4 w-4" />}
            iconClassName={CHIP_TINT.info}
            title="Measurement history"
            subtitle={`${measurements.length} entr${measurements.length === 1 ? "y" : "ies"}`}
          >
            <div className="space-y-2">
              {[...measurements].reverse().map((m) => {
                const visibleMetrics = HISTORY_METRICS.filter((k) => m[k] !== null && m[k] !== undefined);
                const note = m.notes ?? null;
                return (
                  <div key={m.id} className="rounded-2xl bg-muted/50 p-4">
                    <p className="mb-2 text-sm font-semibold text-foreground">{formatLongDate(m.measurement_date)}</p>
                    {visibleMetrics.length > 0 && (
                      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                        {visibleMetrics.map((k) => (
                          <div key={k}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {METRIC_LABEL[k]}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {m[k]}
                              {METRIC_UNIT[k] && (
                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">{METRIC_UNIT[k]}</span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {note && <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{note}</p>}
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}
      </div>

      {showCheckinForm && clientProfile && (
        <HealthCheckinForm
          clientProfile={clientProfile}
          onClose={() => setShowCheckinForm(false)}
          onSaved={() => {
            setShowCheckinForm(false);
            setLoading(true);
            loadMeasurements();
          }}
        />
      )}

      {showForm && clientProfile && (
        <MeasurementForm
          clientId={clientProfile.id}
          heightCm={clientProfile.height ?? null}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setLoading(true);
            loadMeasurements();
          }}
        />
      )}
    </PageShell>
  );
}
