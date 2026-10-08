// Progress Summary — shared data/compute logic for the monthly AI progress
// report (see progressSummaryPdf.ts for the PDF builder). Pulls the client's
// full body_measurements AND blood_reports history (from the day they
// started) and reduces both to per-metric trend stats the report and the
// AI narrative both consume.
import { supabase } from '@/lib/supabase';
import { BLOOD_MARKERS, getMarkerStatus, type MarkerProfile, type MarkerStatus } from './bloodMarkers';

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricTrend {
  key: string;
  label: string;
  unit: string;
  first: number;
  latest: number;
  change: number;
  pctChange: number;
  improved: boolean;
  hasTrend: boolean; // false when there's only one data point
  series: MetricPoint[];
}

export interface BloodMetricTrend {
  key: string;
  label: string;
  unit: string;
  first: number;
  latest: number;
  change: number;
  pctChange: number;
  firstStatus: MarkerStatus;
  latestStatus: MarkerStatus;
  direction: 'improved' | 'worsened' | 'steady';
  hasTrend: boolean; // false when there's only one data point
  series: MetricPoint[];
}

export interface ProgressSummaryData {
  clientId: string;
  clientName: string;
  goal: string | null;
  sinceDate: string | null;
  latestDate: string | null;
  entryCount: number;
  metrics: MetricTrend[];
  bloodSinceDate: string | null;
  bloodLatestDate: string | null;
  bloodReportCount: number;
  bloodMetrics: BloodMetricTrend[];
}

interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
}

// Same curated subset the PWA's own Progress page collects/shows, so a
// client's self-logged entries and a staff-logged BCA entry both roll up
// into the same report consistently.
const METRIC_CONFIG: MetricConfig[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', lowerIsBetter: true },
  { key: 'bmi', label: 'BMI', unit: '', lowerIsBetter: true },
  { key: 'body_fat_percent', label: 'Body Fat', unit: '%', lowerIsBetter: true },
  { key: 'waist', label: 'Waist', unit: 'cm', lowerIsBetter: true },
  { key: 'hip', label: 'Hip', unit: 'cm', lowerIsBetter: true },
  { key: 'chest', label: 'Chest', unit: 'cm', lowerIsBetter: true },
  { key: 'thigh', label: 'Thigh', unit: 'cm', lowerIsBetter: true },
  { key: 'arm', label: 'Arm', unit: 'cm', lowerIsBetter: true },
  { key: 'neck', label: 'Neck', unit: 'cm', lowerIsBetter: true },
];

export const CHART_METRIC_KEYS = ['weight', 'bmi', 'waist'];

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeMetricTrends(
  rows: Array<Record<string, unknown> & { measurement_date: string }>,
): MetricTrend[] {
  const trends: MetricTrend[] = [];
  for (const cfg of METRIC_CONFIG) {
    const series: MetricPoint[] = rows
      .filter((r) => typeof r[cfg.key] === 'number')
      .map((r) => ({ date: r.measurement_date, value: r[cfg.key] as number }));
    if (series.length === 0) continue;

    const first = series[0].value;
    const latest = series[series.length - 1].value;
    const change = round1(latest - first);
    const pctChange = first !== 0 ? round1((change / first) * 100) : 0;
    const improved = cfg.lowerIsBetter ? change < 0 : change > 0;

    trends.push({
      key: cfg.key,
      label: cfg.label,
      unit: cfg.unit,
      first,
      latest,
      change,
      pctChange,
      improved: series.length > 1 && improved,
      hasTrend: series.length > 1,
      series,
    });
  }
  return trends;
}

export function computeBloodMetricTrends(
  rows: Array<Record<string, unknown> & { report_date: string }>,
  profile?: MarkerProfile,
): BloodMetricTrend[] {
  const trends: BloodMetricTrend[] = [];
  for (const def of BLOOD_MARKERS) {
    const series: MetricPoint[] = rows
      .filter((r) => typeof r[def.key] === 'number')
      .map((r) => ({ date: r.report_date, value: r[def.key] as number }));
    if (series.length === 0) continue;

    const first = series[0].value;
    const latest = series[series.length - 1].value;
    const change = round1(latest - first);
    const pctChange = first !== 0 ? round1((change / first) * 100) : 0;
    const firstStatus = getMarkerStatus(def.key, first, profile);
    const latestStatus = getMarkerStatus(def.key, latest, profile);

    let direction: 'improved' | 'worsened' | 'steady' = 'steady';
    if (series.length > 1) {
      if (latestStatus === 'normal' && firstStatus !== 'normal') direction = 'improved';
      else if (latestStatus !== 'normal' && firstStatus === 'normal') direction = 'worsened';
    }

    trends.push({
      key: def.key,
      label: def.label,
      unit: def.unit,
      first,
      latest,
      change,
      pctChange,
      firstStatus,
      latestStatus,
      direction,
      hasTrend: series.length > 1,
      series,
    });
  }
  return trends;
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

export async function fetchProgressSummaryData(clientId: string): Promise<ProgressSummaryData> {
  const [{ data: client, error: clientErr }, { data: rows, error: rowsErr }, { data: bloodReports, error: bloodErr }] = await Promise.all([
    supabase
      .from('clients')
      .select('name, goal, gender, date_of_birth, service_start_date, created_at')
      .eq('id', clientId)
      .single(),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('client_id', clientId)
      .order('measurement_date', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('blood_reports')
      .select('report_date, blood_report_values(*)')
      .eq('client_id', clientId)
      .order('report_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (clientErr) throw clientErr;
  if (rowsErr) throw rowsErr;
  if (bloodErr) throw bloodErr;

  const measurements = (rows ?? []) as Array<Record<string, unknown> & { measurement_date: string }>;
  const metrics = computeMetricTrends(measurements);

  const bloodRows = ((bloodReports ?? []) as any[]).map((r) => {
    const values = Array.isArray(r.blood_report_values) ? r.blood_report_values[0] : r.blood_report_values;
    return { report_date: r.report_date, ...(values ?? {}) };
  }) as Array<Record<string, unknown> & { report_date: string }>;
  // Functional ranges vary by sex/age (see bloodMarkers.ts) — age computed from DOB, not the stale clients.age snapshot
  const bloodMetrics = computeBloodMetricTrends(bloodRows, {
    sex: (client as any)?.gender,
    age: ageFromDob((client as any)?.date_of_birth),
  });

  const since = (client as any)?.service_start_date || (client as any)?.created_at || measurements[0]?.measurement_date || null;

  return {
    clientId,
    clientName: (client as any)?.name ?? 'Client',
    goal: (client as any)?.goal ?? null,
    sinceDate: since ? String(since).slice(0, 10) : null,
    latestDate: measurements.length > 0 ? measurements[measurements.length - 1].measurement_date : null,
    entryCount: measurements.length,
    metrics,
    bloodSinceDate: bloodRows.length > 0 ? bloodRows[0].report_date : null,
    bloodLatestDate: bloodRows.length > 0 ? bloodRows[bloodRows.length - 1].report_date : null,
    bloodReportCount: bloodRows.length,
    bloodMetrics,
  };
}

export async function fetchProgressInsightsNarrative(data: ProgressSummaryData): Promise<{ narrative: string; warnings: string[] } | null> {
  try {
    const { data: result, error } = await supabase.functions.invoke('generate-progress-insights', {
      body: {
        clientName: data.clientName,
        goal: data.goal,
        sinceDate: data.sinceDate,
        latestDate: data.latestDate,
        entryCount: data.entryCount,
        metrics: data.metrics.map((m) => ({
          label: m.label,
          unit: m.unit,
          first: m.first,
          latest: m.latest,
          change: m.change,
          pctChange: m.pctChange,
          improved: m.improved,
          hasTrend: m.hasTrend,
        })),
        bloodMetrics: data.bloodMetrics.map((m) => ({
          label: m.label,
          unit: m.unit,
          first: m.first,
          latest: m.latest,
          change: m.change,
          pctChange: m.pctChange,
          firstStatus: m.firstStatus,
          latestStatus: m.latestStatus,
          direction: m.direction,
          hasTrend: m.hasTrend,
        })),
      },
    });
    if (error) return null;
    if (!result || (result as any).error) return null;
    return {
      narrative: (result as any).narrative ?? '',
      warnings: Array.isArray((result as any).warnings) ? (result as any).warnings : [],
    };
  } catch {
    // AI narrative is an enhancement, not the core report — any failure
    // (quota exceeded, network, etc.) silently falls back to the
    // deterministic summary built in progressSummaryPdf.ts.
    return null;
  }
}
