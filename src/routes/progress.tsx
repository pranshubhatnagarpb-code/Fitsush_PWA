import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientMeasurement } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { TrendingUp, Scale, Activity, Ruler, Percent, Plus } from "lucide-react";
import { MeasurementForm } from "@/components/measurement-form";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/progress")({
  component: ProgressPage,
});

type MetricKey =
  | "weight"
  | "bmi"
  | "body_fat_percentage"
  | "waist"
  | "hip"
  | "chest"
  | "thigh"
  | "arm"
  | "neck";

const METRIC_LABEL: Record<MetricKey, string> = {
  weight: "Weight",
  bmi: "BMI",
  body_fat_percentage: "Body Fat",
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
  body_fat_percentage: "%",
  waist: "cm",
  hip: "cm",
  chest: "cm",
  thigh: "cm",
  arm: "cm",
  neck: "cm",
};

const SUMMARY_METRICS: MetricKey[] = ["weight", "bmi", "waist", "hip", "body_fat_percentage"];
const CHART_METRICS: MetricKey[] = ["weight", "bmi", "waist"];
const HISTORY_METRICS: MetricKey[] = [
  "weight",
  "bmi",
  "body_fat_percentage",
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
  if (k === "body_fat_percentage") return <Percent className="h-4 w-4" />;
  return <Ruler className="h-4 w-4" />;
}

function ProgressPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<ClientMeasurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadMeasurements = useCallback(async () => {
    if (!clientProfile) return;
    const { data } = await supabase
      .from("client_measurements")
      .select("*")
      .eq("client_id", clientProfile.id)
      .order("measurement_date", { ascending: true });
    setMeasurements((data ?? []) as ClientMeasurement[]);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (!clientProfile) return;
    loadMeasurements();
  }, [clientProfile, loadMeasurements]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  // latest measurement (last in asc order)
  const latest = measurements.length > 0 ? measurements[measurements.length - 1] : null;
  const previous = measurements.length > 1 ? measurements[measurements.length - 2] : null;

  // which metrics actually have any data?
  const hasData = (k: MetricKey) =>
    measurements.some((m) => m[k] !== null && m[k] !== undefined);

  const summaryAvailable = SUMMARY_METRICS.filter(hasData);
  const chartsAvailable = CHART_METRICS.filter(hasData);

  return (
    <PageShell title="My Progress">
      {loading ? (
        <LoadingSpinner />
      ) : measurements.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-10 w-10" />}
          title="No measurements yet"
          description="Your progress will appear here after your first assessment."
        />
      ) : (
        <div className="space-y-6">
          {/* Latest summary */}
          {latest && summaryAvailable.length > 0 && (
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Latest Summary
                </h3>
                <span className="text-xs text-muted-foreground">
                  {new Date(latest.measurement_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {summaryAvailable.map((k) => {
                  const val = latest[k];
                  const prev = previous?.[k];
                  const delta =
                    typeof val === "number" && typeof prev === "number" ? val - prev : null;
                  return (
                    <div
                      key={k}
                      className="rounded-2xl border bg-card p-4"
                    >
                      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                        <MetricIcon k={k} />
                        <span className="text-xs font-medium uppercase tracking-wide">
                          {METRIC_LABEL[k]}
                        </span>
                      </div>
                      <p className="font-display text-2xl font-bold text-foreground">
                        {val ?? "—"}
                        {val !== null && METRIC_UNIT[k] && (
                          <span className="ml-1 text-sm font-medium text-muted-foreground">
                            {METRIC_UNIT[k]}
                          </span>
                        )}
                      </p>
                      {delta !== null && (
                        <p
                          className={`mt-0.5 text-xs ${
                            delta < 0
                              ? "text-success"
                              : delta > 0
                                ? "text-destructive"
                                : "text-muted-foreground"
                          }`}
                        >
                          {delta > 0 ? "+" : ""}
                          {delta.toFixed(1)} {METRIC_UNIT[k]} vs last
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Charts */}
          {chartsAvailable.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm font-semibold text-foreground">Trends</h3>
              {chartsAvailable.map((k) => {
                const data = measurements
                  .filter((m) => m[k] !== null && m[k] !== undefined)
                  .map((m) => ({
                    date: new Date(m.measurement_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    }),
                    value: m[k],
                  }));
                if (data.length === 0) return null;
                return (
                  <div key={k} className="rounded-2xl border bg-card p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <MetricIcon k={k} />
                      <h4 className="text-sm font-semibold text-foreground">
                        {METRIC_LABEL[k]} {METRIC_UNIT[k] && `(${METRIC_UNIT[k]})`}
                      </h4>
                    </div>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                          axisLine={false}
                          tickLine={false}
                          domain={["auto", "auto"]}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "var(--card)",
                            border: "1px solid var(--border)",
                            borderRadius: "0.75rem",
                            fontSize: 12,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          dot={{ fill: "var(--primary)", r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </div>
          )}

          {/* History */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              Measurement History
            </h3>
            <div className="space-y-2">
              {[...measurements].reverse().map((m) => {
                const visibleMetrics = HISTORY_METRICS.filter(
                  (k) => m[k] !== null && m[k] !== undefined
                );
                const note = m.measurement_notes ?? m.notes ?? null;
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border bg-card p-4"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        {new Date(m.measurement_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    {visibleMetrics.length > 0 && (
                      <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                        {visibleMetrics.map((k) => (
                          <div key={k}>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {METRIC_LABEL[k]}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {m[k]}
                              {METRIC_UNIT[k] && (
                                <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                  {METRIC_UNIT[k]}
                                </span>
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {note && (
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        {note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
