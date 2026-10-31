import { dayMeals } from "@/lib/dietPlanHtml";
import { mealFoodOptions } from "@/lib/mealOptions";
import type { DietPlan } from "@/lib/types";

// Screen-side views of a diet plan (the PDF layout lives in the shared
// dietPlanHtml.ts; this file is PWA-only, so dietPlanHtml.ts stays identical
// to PMS's copy).

export interface PlanMeal {
  label: string;
  time?: string;
  options: string[];
  alternative?: string;
  notes?: string;
}

export interface PlanDayGroup {
  label: string;
  sub?: string;
  meals: PlanMeal[];
  notes?: string;
}

const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const WEEKDAYS_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));
const DAY_MS = 24 * 60 * 60 * 1000;

const ai = (plan: DietPlan): any => (plan.is_ai_generated && plan.ai_plan_data ? plan.ai_plan_data : null);
const clean = (s: unknown) => String(s ?? "").trim();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// "Day X of N" for a plan with a start date. N comes from end_date, else the
// AI plan's day count; null when the plan has no start date.
export function planDayProgress(plan: DietPlan): { day: number; total: number | null; pct: number } | null {
  const data = ai(plan);
  const startStr = data?.editableStartDate ?? plan.start_date ?? data?.startDate;
  if (!startStr) return null;
  const start = startOfDay(new Date(startStr));
  if (Number.isNaN(start.getTime())) return null;

  let total: number | null = null;
  if (plan.end_date) {
    const end = startOfDay(new Date(plan.end_date));
    if (!Number.isNaN(end.getTime())) total = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  } else if (data) {
    total = parseInt(data.editableDayCount ?? "7") || 7;
  }

  const raw = Math.round((startOfDay(new Date()).getTime() - start.getTime()) / DAY_MS) + 1;
  const day = Math.max(1, total ? Math.min(raw, total) : raw);
  return { day, total, pct: total ? (day / total) * 100 : 0 };
}

// Short notes for the client: the AI plan's important notes, else the plan's
// instructions, one note per line (leading bullets / numbers stripped).
export function planNotes(plan: DietPlan): string[] {
  const data = ai(plan);
  const fromAi = Array.isArray(data?.importantNotes) ? (data.importantNotes as unknown[]).map(clean).filter(Boolean) : [];
  if (fromAi.length) return fromAi;
  return (plan.instructions ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

// The plan's days as screen groups. AI plans use ai_plan_data.dayGroups;
// manual plans use their diet_plan_days rows (pass them in).
export function planDayGroups(plan: DietPlan, manualDays: any[] = []): PlanDayGroup[] {
  const data = ai(plan);
  if (data) {
    return ((data.dayGroups ?? []) as any[]).map((g) => ({
      label: clean(g.label) || "Daily Plan",
      sub: clean(g.dates) || undefined,
      meals: ((g.meals ?? []) as any[])
        .map((m) => ({
          label: clean(m.period) || "Meal",
          time: clean(m.time) || undefined,
          options: mealFoodOptions(m),
          alternative: clean(m.alternative) && clean(m.alternative) !== "-" ? clean(m.alternative) : undefined,
          notes: clean(m.notes) && clean(m.notes) !== "-" ? clean(m.notes) : undefined,
        }))
        .filter((m) => m.options.length > 0),
    }));
  }
  return [...manualDays]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((d) => ({
      label: clean(d.day_label) || "Daily Plan",
      meals: dayMeals(d)
        .filter((m) => m.options.length > 0)
        .map((m) => ({ label: m.label || "Meal", options: m.options })),
      notes: clean(d.notes) || undefined,
    }));
}

// Which weekdays (0 = Monday) a label names: "Every day", "Monday – Friday",
// "Mon, Wed", "Monday".
function labelWeekdays(label: string): Set<number> {
  const out = new Set<number>();
  const l = label.toLowerCase();
  if (/every\s*day|daily/.test(l)) {
    WEEKDAYS.forEach((_, i) => out.add(i));
    return out;
  }
  l.split(",").forEach((part) => {
    const hits = WEEKDAYS_SHORT.map((n, i) => (new RegExp(`\\b${n}`).test(part) ? i : -1)).filter((i) => i >= 0);
    if (hits.length >= 2 && /[–-]|\bto\b/.test(part)) {
      for (let i = Math.min(...hits); i <= Math.max(...hits); i++) out.add(i);
    } else hits.forEach((i) => out.add(i));
  });
  return out;
}

// The group to show for today: the one naming today's weekday, else the one
// naming today's plan day ("Day 3", "Day 1-3"), else the first.
export function todayGroupIndex(groups: PlanDayGroup[], planDay?: number | null): number {
  const weekday = (new Date().getDay() + 6) % 7;
  const byWeekday = groups.findIndex((g) => labelWeekdays(`${g.label} ${g.sub ?? ""}`).has(weekday));
  if (byWeekday >= 0) return byWeekday;
  if (planDay) {
    const byDay = groups.findIndex((g) => {
      const m = g.label.match(/day\s*(\d+)(?:\s*[–-]\s*(\d+))?/i);
      if (!m) return false;
      const from = Number(m[1]);
      const to = m[2] ? Number(m[2]) : from;
      return planDay >= from && planDay <= to;
    });
    if (byDay >= 0) return byDay;
  }
  return 0;
}
