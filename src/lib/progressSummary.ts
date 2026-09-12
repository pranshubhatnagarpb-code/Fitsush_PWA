// Progress Summary — shared data/compute logic for the monthly AI progress
// report (see progressSummaryPdf.ts for the PDF builder). Pulls the client's
// full body_measurements history (from the day they started) and reduces it
// to per-metric trend stats the report and the AI narrative both consume.
//
// Kept in sync by hand with PMS/src/lib/progressSummary.ts — the two apps
// don't share a package, but the shape and math must match so a client's
// self-downloaded report and a staff-downloaded one for the same client
// agree with each other.
import { supabase } from '@/lib/supabase';

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

export interface ProgressSummaryData {
  clientId: string;
  clientName: string;
  goal: string | null;
  sinceDate: string | null;
  latestDate: string | null;
  entryCount: number;
  metrics: MetricTrend[];
}

interface MetricConfig {
  key: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
}

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

export async function fetchProgressSummaryData(clientId: string): Promise<ProgressSummaryData> {
  const [{ data: client, error: clientErr }, { data: rows, error: rowsErr }] = await Promise.all([
    supabase
      .from('clients')
      .select('name, goal, service_start_date, created_at')
      .eq('id', clientId)
      .single(),
    supabase
      .from('body_measurements')
      .select('*')
      .eq('client_id', clientId)
      .order('measurement_date', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  if (clientErr) throw clientErr;
  if (rowsErr) throw rowsErr;

  const measurements = (rows ?? []) as Array<Record<string, unknown> & { measurement_date: string }>;
  const metrics = computeMetricTrends(measurements);

  const since = (client as any)?.service_start_date || (client as any)?.created_at || measurements[0]?.measurement_date || null;

  return {
    clientId,
    clientName: (client as any)?.name ?? 'You',
    goal: (client as any)?.goal ?? null,
    sinceDate: since ? String(since).slice(0, 10) : null,
    latestDate: measurements.length > 0 ? measurements[measurements.length - 1].measurement_date : null,
    entryCount: measurements.length,
    metrics,
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
