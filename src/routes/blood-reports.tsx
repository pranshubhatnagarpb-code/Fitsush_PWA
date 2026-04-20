import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientBloodReport } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { FlaskConical, Plus, X, FileText, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export const Route = createFileRoute("/blood-reports")({
  component: BloodReportsPage,
});

// Numeric extracted_data fields we know how to chart.
// Backend extraction is not yet wired, so this list is what the client
// can manually fill until the PMS auto-extraction lands.
const TRACKED_KEYS = [
  { key: "hemoglobin", label: "Hemoglobin", unit: "g/dL" },
  { key: "vitamin_d", label: "Vitamin D", unit: "ng/mL" },
  { key: "vitamin_b12", label: "Vitamin B12", unit: "pg/mL" },
  { key: "fasting_glucose", label: "Fasting Glucose", unit: "mg/dL" },
  { key: "hba1c", label: "HbA1c", unit: "%" },
  { key: "total_cholesterol", label: "Total Cholesterol", unit: "mg/dL" },
  { key: "ldl", label: "LDL", unit: "mg/dL" },
  { key: "hdl", label: "HDL", unit: "mg/dL" },
  { key: "triglycerides", label: "Triglycerides", unit: "mg/dL" },
  { key: "tsh", label: "TSH", unit: "mIU/L" },
] as const;

type TrackedKey = (typeof TRACKED_KEYS)[number]["key"];

function getNumeric(data: Record<string, unknown> | null, k: string): number | null {
  if (!data) return null;
  const v = data[k];
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function BloodReportsPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<ClientBloodReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    if (!clientProfile) return;
    const { data } = await supabase
      .from("client_blood_reports")
      .select("*")
      .eq("client_id", clientProfile.id)
      .order("report_date", { ascending: true });
    setReports((data ?? []) as ClientBloodReport[]);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (clientProfile) load();
  }, [clientProfile, load]);

  const trends = useMemo(() => {
    return TRACKED_KEYS.map((t) => {
      const series = reports
        .map((r) => {
          const v = getNumeric(r.extracted_data, t.key);
          if (v === null || !r.report_date) return null;
          return {
            date: new Date(r.report_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            }),
            value: v,
          };
        })
        .filter((p): p is { date: string; value: number } => p !== null);
      return { ...t, series };
    }).filter((t) => t.series.length > 0);
  }, [reports]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  return (
    <PageShell title="Blood Reports">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Log your blood test results and track key markers over time.
        </p>
        {clientProfile && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-900 dark:text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          PDF upload and auto-extraction will be enabled once the backend storage
          fields are added. For now you can log key values manually.
        </p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-10 w-10" />}
          title="No blood reports yet"
          description='Tap "Add" to log a blood test, or your nutritionist will add one for you.'
        />
      ) : (
        <div className="space-y-6">
          {trends.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-sm font-semibold text-foreground">Trends</h3>
              {trends.map((t) => (
                <div key={t.key} className="rounded-2xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold text-foreground">
                      {t.label} ({t.unit})
                    </h4>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={t.series}>
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
              ))}
            </div>
          )}

          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              Report History
            </h3>
            <div className="space-y-2">
              {[...reports].reverse().map((r) => {
                const filled = TRACKED_KEYS.map((t) => ({
                  ...t,
                  value: getNumeric(r.extracted_data, t.key),
                })).filter((x) => x.value !== null);
                return (
                  <div key={r.id} className="rounded-2xl border bg-card p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {r.report_date
                            ? new Date(r.report_date).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })
                            : "Undated report"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Logged {new Date(r.created_at).toLocaleDateString("en-IN")}
                        </p>
                      </div>
                    </div>
                    {filled.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                        {filled.map((m) => (
                          <div key={m.key}>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {m.label}
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              {m.value}
                              <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                {m.unit}
                              </span>
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.notes && (
                      <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                        {r.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showForm && clientProfile && (
        <BloodReportForm
          clientId={clientProfile.id}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setLoading(true);
            load();
          }}
        />
      )}
    </PageShell>
  );
}

interface FormProps {
  clientId: string;
  onClose: () => void;
  onSaved: () => void;
}

function BloodReportForm({ clientId, onClose, onSaved }: FormProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVal = (k: TrackedKey, v: string) =>
    setValues((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const extracted: Record<string, number> = {};
    for (const t of TRACKED_KEYS) {
      const raw = values[t.key]?.trim();
      if (!raw) continue;
      const n = Number(raw);
      if (Number.isNaN(n) || n < 0 || n > 100000) {
        setError(`Invalid ${t.label}`);
        return;
      }
      extracted[t.key] = n;
    }

    if (Object.keys(extracted).length === 0 && !notes.trim()) {
      setError("Enter at least one value or a note");
      return;
    }

    setSaving(true);
    const { error: insErr } = await supabase.from("client_blood_reports").insert({
      client_id: clientId,
      report_date: date,
      extracted_data: extracted,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            Add Blood Report
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Report Date
            </label>
            <input
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {TRACKED_KEYS.map((t) => (
              <div key={t.key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t.label} <span className="lowercase">({t.unit})</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={values[t.key] ?? ""}
                  onChange={(e) => setVal(t.key, e.target.value)}
                  placeholder="—"
                  className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Lab name, doctor, observations…"
              className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}