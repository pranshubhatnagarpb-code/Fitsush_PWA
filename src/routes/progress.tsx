import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientMeasurement } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { TrendingUp } from "lucide-react";
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

function ProgressPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<ClientMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    supabase
      .from("client_measurements")
      .select("*")
      .eq("client_id", clientProfile.id)
      .order("measurement_date", { ascending: true })
      .then(({ data }) => {
        setMeasurements(data ?? []);
        setLoading(false);
      });
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  const chartData = measurements.map((m) => ({
    date: new Date(m.measurement_date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    }),
    bmi: m.bmi,
  }));

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
        <div className="space-y-5">
          {/* BMI Chart */}
          {chartData.some((d) => d.bmi !== null) && (
            <div className="rounded-2xl border bg-card p-4">
              <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
                BMI Trend
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
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
                    dataKey="bmi"
                    stroke="var(--primary)"
                    strokeWidth={2.5}
                    dot={{ fill: "var(--primary)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* History */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              Measurement History
            </h3>
            <div className="space-y-2">
              {[...measurements].reverse().map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(m.measurement_date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {m.notes && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.notes}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {m.bmi !== null && (
                      <p className="font-display text-lg font-bold text-primary">{m.bmi}</p>
                    )}
                    <p className="text-xs text-muted-foreground">BMI</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
