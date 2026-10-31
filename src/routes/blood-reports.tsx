import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import type { ClientBloodReport } from "@/lib/types";
import {
  BLOOD_MARKERS,
  BLOOD_MARKER_MAP,
  getMarkerRange,
  getMarkerStatus,
  type BloodMarkerKey,
  type MarkerProfile,
  type MarkerStatus,
} from "@/lib/bloodMarkers";
import { PageShell } from "@/components/app-shell";
import {
  EmptyState,
  LoadingSpinner,
  PageHero,
  HeroStat,
  SectionCard,
  TrendChart,
  BottomSheet,
  ErrorNote,
  HERO_BUTTON_PRIMARY,
  BUTTON_PRIMARY,
  BUTTON_GHOST,
  CHIP_TINT,
  INPUT,
  MICRO_LABEL,
  formatLongDate,
} from "@/components/ui-cards";
import { FlaskConical, Plus, FileText, Stethoscope, History } from "lucide-react";

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

// Self-logged values use the keys above; PMS's blood_report_values columns
// (BLOOD_MARKERS) are the same except fasting glucose.
const SELF_TO_MARKER: Partial<Record<TrackedKey, BloodMarkerKey>> = {
  fasting_glucose: "fasting_blood_sugar",
};

// One report on this page: added by the clinic in PMS (blood_reports +
// blood_report_values) or logged by the client here (client_blood_reports).
interface ReportItem {
  id: string;
  source: "clinic" | "self";
  report_date: string | null;
  created_at: string;
  lab_name: string | null;
  notes: string | null;
  values: Partial<Record<BloodMarkerKey, number>>;
}

function fromSelf(r: ClientBloodReport): ReportItem {
  const values: ReportItem["values"] = {};
  for (const t of TRACKED_KEYS) {
    const v = getNumeric(r.extracted_data, t.key);
    if (v !== null) values[(SELF_TO_MARKER[t.key] ?? t.key) as BloodMarkerKey] = v;
  }
  return { id: `self:${r.id}`, source: "self", report_date: r.report_date, created_at: r.created_at, lab_name: null, notes: r.notes, values };
}

function fromClinic(r: any): ReportItem {
  const row = (Array.isArray(r.blood_report_values) ? r.blood_report_values[0] : r.blood_report_values) ?? {};
  const values: ReportItem["values"] = {};
  for (const m of BLOOD_MARKERS) {
    const v = getNumeric(row, m.key);
    if (v !== null) values[m.key] = v;
  }
  const notes = [r.notes, row.notes].filter((n: unknown) => typeof n === "string" && n.trim()).join("\n") || null;
  return { id: `clinic:${r.id}`, source: "clinic", report_date: r.report_date, created_at: r.created_at, lab_name: r.lab_name ?? null, notes, values };
}

const markerUnit = (k: BloodMarkerKey) => BLOOD_MARKER_MAP[k]?.unit ?? "";

// The clinic's range for this client (sex/age rules in bloodMarkers.ts), e.g. "82–88", "< 5", "> 30".
function rangeText(k: BloodMarkerKey, profile: MarkerProfile): string | null {
  const def = BLOOD_MARKER_MAP[k];
  if (!def) return null;
  const { low, high } = getMarkerRange(def, profile);
  if (low !== null && high !== null) return `${low}–${high}`;
  if (high !== null) return `< ${high}`;
  if (low !== null) return `> ${low}`;
  return null;
}

const STATUS_STYLE: Record<MarkerStatus, { label: string; className: string } | null> = {
  low: { label: "Low", className: "bg-warning/15 text-warning-foreground" },
  high: { label: "High", className: "bg-destructive/10 text-destructive" },
  normal: { label: "Normal", className: "bg-success/15 text-success" },
  unknown: null,
};

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}
const markerLabel = (k: BloodMarkerKey) => BLOOD_MARKER_MAP[k]?.label ?? k;

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
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  const load = useCallback(async () => {
    if (!clientProfile) return;
    const [{ data: self }, { data: clinic }] = await Promise.all([
      supabase
        .from("client_blood_reports")
        .select("*")
        .eq("client_id", clientProfile.id),
      // Reports the clinic added in PMS.
      supabase
        .from("blood_reports")
        .select("*, blood_report_values(*)")
        .eq("client_id", clientProfile.id),
    ]);
    const all = [
      ...((self ?? []) as ClientBloodReport[]).map(fromSelf),
      ...((clinic ?? []) as any[]).map(fromClinic),
    ].sort((a, b) =>
      (a.report_date ?? "").localeCompare(b.report_date ?? "") || a.created_at.localeCompare(b.created_at),
    );
    setReports(all);
    setLoading(false);
  }, [clientProfile]);

  useEffect(() => {
    if (clientProfile) load();
  }, [clientProfile, load]);

  // A trend chart for every marker with at least two dated readings.
  const profile: MarkerProfile = {
    sex: clientProfile?.gender,
    age: ageFromDob(clientProfile?.date_of_birth),
  };

  const trends = useMemo(() => {
    return BLOOD_MARKERS.map((m) => {
      const series = reports
        .map((r) => {
          const v = r.values[m.key];
          if (v === undefined || !r.report_date) return null;
          return {
            date: new Date(r.report_date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            }),
            value: v,
          };
        })
        .filter((p): p is { date: string; value: number } => p !== null);
      return { key: m.key, label: m.label, unit: m.unit, series };
    }).filter((t) => t.series.length >= 2);
  }, [reports]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner fullScreen />;

  const latestDated = [...reports].reverse().find((r) => r.report_date);
  const clinicCount = reports.filter((r) => r.source === "clinic").length;

  return (
    <PageShell title="Reports">
      <div className="space-y-4">
        <PageHero
          eyebrow="Blood reports"
          title="Your lab results"
          subtitle="Reports from your nutritionist and the ones you log, tracked over time"
          icon={<FlaskConical className="h-5 w-5" />}
        >
          <div className="grid grid-cols-3 gap-2">
            <HeroStat label="Reports" value={loading ? "—" : reports.length} />
            <HeroStat
              label="Latest"
              value={latestDated?.report_date ? new Date(latestDated.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
              hint={latestDated?.report_date ? String(new Date(latestDated.report_date).getFullYear()) : undefined}
            />
            <HeroStat label="Trends" value={loading ? "—" : trends.length} hint={trends.length ? "markers" : undefined} />
          </div>
          {clientProfile && (
            <button type="button" onClick={() => setShowForm(true)} className={`mt-4 ${HERO_BUTTON_PRIMARY}`}>
              <Plus className="h-3.5 w-3.5" />
              Log a report
            </button>
          )}
        </PageHero>

        {loading ? (
          <LoadingSpinner />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-6 w-6" />}
            title="No blood reports yet"
            description='Tap "Log a report" to add a blood test, or your nutritionist will add one for you.'
          />
        ) : (
          <>
            {trends.map((t) => (
              <SectionCard
                key={t.key}
                icon={<FlaskConical className="h-4 w-4" />}
                iconClassName={CHIP_TINT.health}
                title={t.label}
                subtitle={`${t.series.length} readings${t.unit ? ` · ${t.unit}` : ""}${rangeText(t.key, profile) ? ` · range ${rangeText(t.key, profile)}` : ""}`}
              >
                <TrendChart id={t.key} data={t.series} unit={t.unit} />
              </SectionCard>
            ))}

            <SectionCard
              icon={<History className="h-4 w-4" />}
              iconClassName={CHIP_TINT.info}
              title="Report history"
              subtitle={`${reports.length} report${reports.length === 1 ? "" : "s"}${clinicCount ? ` · ${clinicCount} from your nutritionist` : ""}`}
            >
              <div className="space-y-2">
              {[...reports].reverse().map((r) => {
                // Group the values by panel (Sugar, Lipids, Thyroid, …) in marker order.
                const groups: Array<{ group: string; items: Array<{ key: BloodMarkerKey; value: number }> }> = [];
                for (const m of BLOOD_MARKERS) {
                  const value = r.values[m.key];
                  if (value === undefined) continue;
                  let g = groups.find((x) => x.group === m.group);
                  if (!g) groups.push((g = { group: m.group, items: [] }));
                  g.items.push({ key: m.key, value });
                }
                return (
                  <div key={r.id} className="rounded-2xl bg-muted/50 p-4">
                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card">
                        {r.source === "clinic" ? (
                          <Stethoscope className="h-4 w-4 text-primary" />
                        ) : (
                          <FileText className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {r.report_date ? formatLongDate(r.report_date) : "Undated report"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.source === "clinic"
                            ? `Added by your nutritionist${r.lab_name ? ` · ${r.lab_name}` : ""}`
                            : `Logged by you · ${new Date(r.created_at).toLocaleDateString("en-IN")}`}
                        </p>
                      </div>
                    </div>
                    {groups.length > 0 && (
                      <div className="space-y-3">
                        {groups.map((g) => (
                          <div key={g.group}>
                            {groups.length > 1 && (
                              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                {g.group}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3">
                              {g.items.map((m) => {
                                const status = STATUS_STYLE[getMarkerStatus(m.key, m.value, profile)];
                                const range = rangeText(m.key, profile);
                                return (
                                  <div key={m.key}>
                                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                      {markerLabel(m.key)}
                                    </p>
                                    <p className="flex flex-wrap items-center gap-1 text-sm font-semibold text-foreground">
                                      <span>
                                        {m.value}
                                        {markerUnit(m.key) && (
                                          <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                                            {markerUnit(m.key)}
                                          </span>
                                        )}
                                      </span>
                                      {status && range && (
                                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}>
                                          {status.label}
                                        </span>
                                      )}
                                    </p>
                                    {range && (
                                      <p className="text-[10px] text-muted-foreground">Range {range}</p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {r.notes && (
                      <p className="mt-2 whitespace-pre-line border-t pt-2 text-xs text-muted-foreground">
                        {r.notes}
                      </p>
                    )}
                  </div>
                );
              })}
              </div>
            </SectionCard>
          </>
        )}
      </div>

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
    <BottomSheet title="Log blood report" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`mb-1.5 block ${MICRO_LABEL}`}>Report date</label>
          <input
            type="date"
            value={date}
            max={today}
            required
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {TRACKED_KEYS.map((t) => (
            <div key={t.key}>
              <label className={`mb-1.5 block ${MICRO_LABEL}`}>
                {t.label} <span className="normal-case tracking-normal">({t.unit})</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={values[t.key] ?? ""}
                onChange={(e) => setVal(t.key, e.target.value)}
                placeholder="—"
                className={INPUT}
              />
            </div>
          ))}
        </div>

        <div>
          <label className={`mb-1.5 block ${MICRO_LABEL}`}>Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="Lab name, doctor, observations…"
            className={INPUT}
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BUTTON_GHOST}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BUTTON_PRIMARY}`}>
            <Plus className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
