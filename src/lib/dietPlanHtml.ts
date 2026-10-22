// ===========================================================================
// Diet plan chart HTML — the single layout used everywhere a diet plan is
// printed or downloaded:
//   PMS: Saved Plans download, manual planner Download PDF, PDF made on Publish
//   PWA: "Download PDF" on the client's Diet Plan page
//
// THIS FILE IS COPIED BYTE-FOR-BYTE between
//   PMS/src/lib/dietPlanHtml.ts  and  client-wellness-portal-main/src/lib/dietPlanHtml.ts
// (together with ./mealOptions.ts). If you change one, copy it to the other.
// It must stay free of app-specific imports: no Supabase, no '@/...' paths.
// Each app's dietPlanPdf.ts loads the data and calls buildPlanHtml().
// ===========================================================================

import { mealFoodOptions, mealOptionRowsHtml } from './mealOptions';

export type RecipeRow = { Meal_name: string; Ingredients: string; Instructions: string; Remarks: string };
export type AffiliateProduct = { product_name: string; link: string };
export type AffiliateProductRow = AffiliateProduct & { product_name_normalized: string };

// ---------------------------------------------------------------------------
// Recipe matching
// ---------------------------------------------------------------------------

function normalizeMealName(s: string): string {
  return (s || '').replace(/['"]/g, '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toWordSet(normalized: string): Set<string> {
  return new Set(normalized.split(' ').filter(w => w.length >= 2));
}

// Meal names to look up in meal_recipes for an AI plan (food plan options + alternative).
export function aiRecipeCandidates(aiData: any): string[] {
  const seen = new Set<string>();
  const candidates: string[] = [];
  ((aiData?.dayGroups ?? []) as any[]).forEach((dg: any) => {
    ((dg.meals ?? []) as any[]).forEach((m: any) => {
      [...mealFoodOptions(m), m.alternative].forEach((text: string) => {
        if (!text) return;
        text.split(/\n|,|;|\/|\+|\bor\b|\band\b|\bwith\b/i).forEach((piece: string) => {
          const cleaned = piece
            .replace(/\(.*?\)/g, '')
            .replace(/\d+\s*(g|ml|gm|kg|tsp|tbsp|cup|cups|pcs|piece|pieces|bowl|glass)\b/gi, '')
            .trim();
          if (cleaned.length < 3) return;
          const n = normalizeMealName(cleaned);
          if (n && !seen.has(n)) { seen.add(n); candidates.push(n); }
        });
      });
    });
  });
  return candidates;
}

// Picks the recipe names that match an AI plan's candidates (whole-word match either way).
export function matchAiRecipeNames(candidates: string[], recipeNames: string[]): string[] {
  const matched: string[] = [];
  candidates.forEach((candidate) => {
    const candidateWords = toWordSet(candidate);
    const match = recipeNames.find((name) => {
      const recipeWords = toWordSet(normalizeMealName(name));
      if (recipeWords.size === 0) return false;
      return [...recipeWords].every((w) => candidateWords.has(w)) ||
             [...candidateWords].every((w) => recipeWords.has(w));
    });
    if (match && !matched.includes(match)) matched.push(match);
  });
  return matched;
}

// meal_recipes.meal_name_normalized keys for every meal in a manual plan (exact-name match).
// Includes each meal's `recipes` (the recipe it was picked from), so a recipe
// still prints after staff reword how the meal reads.
export function manualRecipeKeys(days: any[]): string[] {
  const names = new Set<string>();
  const add = (text: unknown) => {
    const n = String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (n) names.add(n);
  };
  (days ?? []).forEach((d) => {
    dayMeals(d).forEach(({ options }) => options.forEach(add));
    if (Array.isArray(d?.meals)) d.meals.forEach((m: any) => (Array.isArray(m?.recipes) ? m.recipes : []).forEach(add));
  });
  return [...names];
}

export type PlanSupplement = { time: string; supplement: string; notes: string };

// A manual plan's supplements (diet_plans.supplements), ignoring empty rows.
export function planSupplements(plan: any): PlanSupplement[] {
  return (Array.isArray(plan?.supplements) ? plan.supplements : [])
    .map((s: any) => ({ time: String(s?.time ?? '').trim(), supplement: String(s?.supplement ?? '').trim(), notes: String(s?.notes ?? '').trim() }))
    .filter((s: PlanSupplement) => s.supplement);
}

// ---------------------------------------------------------------------------
// Affiliate product matching — grocery list + meal items, word-based fuzzy
// ---------------------------------------------------------------------------

const AFFILIATE_STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'in', 'for', 'with', 'and', 'or', 'to', 'is',
  'at', 'by', 'on', 'as', 'up', 'it', 'its',
]);

function getSignificantWords(s: string): Set<string> {
  return new Set(
    (s || '').toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length >= 3 && !AFFILIATE_STOP_WORDS.has(w)),
  );
}

function cleanIngredientText(s: string): string {
  return s
    .replace(/\(.*?\)/g, '')
    .replace(/\d+\s*(g|ml|gm|kg|l|tsp|tbsp|cup|cups|pcs|piece|pieces|jar|jars|bottle|bottles|pack|packs|sachet|sachets|bowl|glass)\b/gi, '')
    .trim();
}

export function matchAffiliateProducts(aiData: any, products: AffiliateProductRow[]): AffiliateProduct[] {
  const candidates: string[] = [];
  ((aiData?.weeklyGroceryList ?? []) as any[]).forEach((cat: any) => {
    ((cat.items ?? []) as string[]).forEach((item) => {
      const cleaned = cleanIngredientText(item);
      if (cleaned.length >= 2) candidates.push(cleaned);
    });
  });
  ((aiData?.dayGroups ?? []) as any[]).forEach((dg: any) => {
    ((dg.meals ?? []) as any[]).forEach((m: any) => {
      [...mealFoodOptions(m), m.alternative].forEach((text: string) => {
        if (!text) return;
        text.split(/\n|,|;|\/|\+|\bor\b|\band\b|\bwith\b/i).forEach((piece: string) => {
          const cleaned = cleanIngredientText(piece);
          if (cleaned.length >= 3) candidates.push(cleaned);
        });
      });
    });
  });
  if (candidates.length === 0) return [];

  const normStr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const matched: AffiliateProduct[] = [];
  const seen = new Set<string>();
  products.forEach((p) => {
    if (seen.has(p.product_name_normalized)) return;
    const productWords = getSignificantWords(p.product_name);
    const productNorm = p.product_name_normalized;
    const isMatch = candidates.some((candidate) => {
      const candidateNorm = normStr(candidate);
      if (candidateNorm === productNorm || candidateNorm.includes(productNorm) || productNorm.includes(candidateNorm)) {
        return true;
      }
      // All significant words of the candidate appear in the product name,
      // e.g. "Pahari turmeric" → "Pahari Roots Lakadong Gold Turmeric".
      const candidateWords = getSignificantWords(candidate);
      return candidateWords.size >= 1 && [...candidateWords].every((w) => productWords.has(w));
    });
    if (isMatch) {
      seen.add(productNorm);
      matched.push({ product_name: p.product_name, link: p.link });
    }
  });
  return matched;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calculateAge(dateOfBirth: string): number | string {
  const birthDate = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

const MEAL_KEYS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const;

// A manual-planner day's meal as written: the saved text (recipe name / typed meal),
// falling back to the diet_options name for rows saved before *_text existed.
export function dayMealText(day: any, meal: (typeof MEAL_KEYS)[number]): string {
  return (day?.[`${meal}_text`] || day?.[`${meal}_option`]?.name || '').trim();
}

// Every meal of a manual-planner day, in chart order. Days saved with the
// `meals` list can have any meal times; older days only have the four columns.
// `options` lists every main-meal option (one entry when there's just one meal).
export function dayMeals(day: any): Array<{ label: string; text: string; options: string[] }> {
  const withOptions = (label: string, text: string, raw?: unknown) => {
    const opts = Array.isArray(raw) ? raw.map((o) => String(o ?? '').trim()).filter(Boolean) : [];
    return { label, text, options: opts.length ? opts : text ? [text] : [] };
  };
  if (Array.isArray(day?.meals) && day.meals.length > 0) {
    return day.meals.map((m: any) => withOptions(String(m?.label ?? '').trim(), String(m?.text ?? '').trim(), m?.options));
  }
  return MEAL_KEYS.map((m) => withOptions(m[0].toUpperCase() + m.slice(1), dayMealText(day, m)));
}

// Column headings for a plan's table: meal times in first-seen order, dropping
// any meal time that's empty on every day.
export function planMealColumns(days: any[]): string[] {
  const order: string[] = [];
  const used = new Set<string>();
  (days ?? []).forEach((d) => dayMeals(d).forEach(({ label, text }) => {
    const k = label.toLowerCase();
    if (!order.some((l) => l.toLowerCase() === k)) order.push(label);
    if (text) used.add(k);
  }));
  return order.filter((l) => used.has(l.toLowerCase()));
}

const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Number of days a manual plan covers. A day card's label can name several
// weekdays ("Monday – Friday", "Monday, Wednesday", "Every day"); labels with
// no weekday name (older plans, e.g. "Day 1") count as one day each.
export function countPlanDays(days: any[]): number {
  const weekdays = new Set<number>();
  let other = 0;
  (days ?? []).forEach((d) => {
    const label = String(d?.day_label ?? '').toLowerCase();
    if (/every\s*day/.test(label)) { WEEKDAY_NAMES.forEach((_, i) => weekdays.add(i)); return; }
    let found = false;
    label.split(',').forEach((part) => {
      const names = WEEKDAY_NAMES.map((n, i) => (part.includes(n) ? i : -1)).filter((i) => i >= 0);
      if (names.length === 0) return;
      found = true;
      if (names.length >= 2 && /[–-]/.test(part)) {
        for (let i = Math.min(...names); i <= Math.max(...names); i++) weekdays.add(i);
      } else names.forEach((i) => weekdays.add(i));
    });
    if (!found) other++;
  });
  return weekdays.size + other;
}

export function dayMealOptionsFor(day: any, label: string): string[] {
  return dayMeals(day).find((m) => m.label.toLowerCase() === label.toLowerCase())?.options ?? [];
}

function escapeText(str: string): string {
  return (str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

// ---------------------------------------------------------------------------
// Manual plan layout (diet_plan_days)
// ---------------------------------------------------------------------------

function buildManualPlanHtml(plan: any, recipes: RecipeRow[], logoDataUrl: string): string {
  const clientDetails = {
    name: plan.clients?.name || 'Client',
    age: plan.clients?.date_of_birth ? calculateAge(plan.clients.date_of_birth) : plan.clients?.age ?? '--',
    gender: plan.clients?.gender || 'Not specified',
    height: plan.clients?.height || '--',
    weight: plan.clients?.weight || '--',
    skinType: plan.clients?.skin_type || 'Not specified',
    hairType: plan.clients?.hair_type || 'Not specified',
    goal: plan.clients?.goal || 'Not specified',
    dietPreference: plan.clients?.diet_preference || 'Not specified',
    healthConditions: (plan.clients?.health_conditions as string[]) || [],
    notes: plan.clients?.notes || '',
  };

  // Manual plan (diet_plan_days) — same look as the AI plan PDF (buildRichAIPlanHtml):
  // clinic logo, title, client details box, orange meal table, recipes, footer.
  const days = ((plan.diet_plan_days ?? []) as any[]).sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const mealColumns = planMealColumns(days);
  const showCalories = days.some((d) => d.total_calories);
  const healthConditions: string[] = Array.isArray(clientDetails.healthConditions)
    ? clientDetails.healthConditions
    : clientDetails.healthConditions ? [String(clientDetails.healthConditions)] : [];

  const fmtDate = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
  const dateRange = (() => {
    const startStr = plan.start_date;
    if (!startStr) return '';
    const start = new Date(startStr);
    if (isNaN(start.getTime())) return '';
    const endDate = plan.end_date ? new Date(plan.end_date) : new Date(start.getTime() + (Math.max(days.length, 1) - 1) * 86400000);
    return `${fmtDate(start)} to ${fmtDate(endDate)}`;
  })();
  const weeks = [...new Set(days.map((d) => /week\s*\d+/i.exec(d.day_label || '')?.[0]).filter(Boolean))] as string[];
  const weekLabel = weeks.length ? weeks.join(', ') : plan.week_number ? `Week ${plan.week_number}` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeText(plan.plan_name || 'Diet Plan')}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:25px 35px;color:#333;font-size:11px;line-height:1.4}
    .header{text-align:center;margin-bottom:25px;border-bottom:2px solid #FF4D06;padding-bottom:15px}
    .header img{width:180px;height:auto;margin-bottom:12px}
    .header h1{color:#FF4D06;font-size:20px;margin-bottom:5px}
    .header p{color:#666;font-size:12px}
    .week-badge{display:inline-block;background:#FF4D06;color:white;padding:3px 8px;border-radius:12px;font-size:10px;margin-left:10px}
    .client-details{background:#f0f7ff;border:1px solid #b3d1ff;border-radius:8px;padding:15px;margin-bottom:20px}
    .client-details h3{color:#1a5fb4;font-size:14px;margin-bottom:10px}
    .client-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:10px}
    .client-grid div{margin-bottom:5px}
    .client-grid span{font-weight:bold;color:#555}
    .condition-badge{display:inline-block;background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:10px;font-size:9px;margin-right:4px;margin-bottom:4px}
    .intro{background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #FF4D06}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10px}
    th{background:#FF4D06;color:white;padding:8px;text-align:left;font-weight:bold}
    td{padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
    tr:nth-child(even){background:#f9f9f9}
    .section-title{color:#FF4D06;font-size:16px;font-weight:bold;margin:25px 0 15px;border-bottom:1px solid #FED7AA;padding-bottom:5px}
    .day-title{font-size:14px;color:#FF4D06;font-weight:700;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #FED7AA}
    .day-notes{font-size:10px;color:#555;margin:-12px 0 16px;padding:6px 8px;background:#fff7ed;border-radius:4px}
    tbody tr:nth-child(even){background:transparent}
    .footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:9px;color:#999}
    @media print{body{padding:15px}}
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Fitsush Logo"/>` : ''}
    <h1>${escapeText(plan.plan_name || 'Diet Plan')}</h1>
    ${weekLabel ? `<p><span class="week-badge" style="margin-left:0">${escapeText(weekLabel)}</span></p>` : ''}
  </div>

  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-grid">
      <div><span>Name:</span> ${escapeText(clientDetails.name)}</div>
      <div><span>Age:</span> ${clientDetails.age} years</div>
      <div><span>Gender:</span> ${escapeText(String(clientDetails.gender))}</div>
      <div><span>Height/Weight:</span> ${clientDetails.height}cm / ${clientDetails.weight}kg</div>
      <div><span>Skin Type:</span> ${escapeText(String(clientDetails.skinType))}</div>
      <div><span>Hair Type:</span> ${escapeText(String(clientDetails.hairType))}</div>
      <div><span>Goal:</span> ${escapeText(String(clientDetails.goal))}</div>
      <div><span>Diet Preference:</span> ${escapeText(String(clientDetails.dietPreference))}</div>
      ${dateRange ? `<div><span>Date:</span> ${dateRange}</div>` : ''}
      <div><span>Duration:</span> ${countPlanDays(days)} ${countPlanDays(days) === 1 ? 'day' : 'days'}</div>
    </div>
    ${healthConditions.length > 0 ? `
    <div style="margin-top:10px">
      <h4 style="font-size:10px;margin-bottom:5px;color:#555">Health Conditions:</h4>
      ${healthConditions.map((c) => `<span class="condition-badge">${escapeText(c)}</span>`).join('')}
    </div>` : ''}
    ${clientDetails.notes ? `<div style="margin-top:10px;font-size:10px"><strong>Notes:</strong> ${escapeText(clientDetails.notes)}</div>` : ''}
  </div>

  ${plan.instructions ? `<div class="intro"><p><strong>General Instructions:</strong> ${escapeText(plan.instructions)}</p></div>` : ''}

  <h3 class="section-title">Diet Chart</h3>
  ${days.map((d: any) => `
    <h3 class="day-title">${escapeText(d.day_label)}${showCalories && d.total_calories ? ` <span style="font-size:11px;color:#888;font-weight:normal;">— ${d.total_calories} kcal</span>` : ''}</h3>
    <table>
      <thead><tr><th style="width:24%">Meal Time</th><th>Food Plan</th></tr></thead>
      <tbody>
        ${mealColumns.map((l) => mealOptionRowsHtml(
          dayMealOptionsFor(d, l).map(escapeText),
          [`<td><strong>${escapeText(l)}</strong></td>`],
          [],
        )).join('')}
      </tbody>
    </table>
    ${d.notes ? `<p class="day-notes"><strong>Notes:</strong> ${escapeText(d.notes)}</p>` : ''}
  `).join('')}

  ${planSupplements(plan).length > 0 ? `
  <h3 class="section-title">💊 Supplements</h3>
  <table>
    <thead><tr><th style="width:24%">Time</th><th style="width:40%">Supplement</th><th>Notes</th></tr></thead>
    <tbody>
      ${planSupplements(plan).map((sup) => `
        <tr><td><strong>${escapeText(sup.time) || '-'}</strong></td><td>${escapeText(sup.supplement)}</td><td>${escapeText(sup.notes) || '-'}</td></tr>
      `).join('')}
    </tbody>
  </table>` : ''}

  ${recipes.length > 0 ? `
  <div style="page-break-before:always;margin-top:24px">
    <h2 style="color:#FF4D06;font-size:18px;border-bottom:2px solid #FF4D06;padding-bottom:6px;margin-bottom:14px">Recipes for mentioned meals</h2>
    ${recipes.map(r => `
      <div style="margin-bottom:16px;page-break-inside:avoid">
        <h3 style="color:#1a5fb4;font-size:13px;margin-bottom:6px">${escapeText(r.Meal_name)}</h3>
        ${r.Ingredients ? `<div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Ingredients:</strong><br/>${escapeText(r.Ingredients)}</div>` : ''}
        <div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Instructions:</strong><br/>${escapeText(r.Instructions)}</div>
        ${r.Remarks ? `<div style="font-size:11px;line-height:1.5;color:#555"><strong>Remarks:</strong><br/>${escapeText(r.Remarks)}</div>` : ''}
      </div>`).join('')}
  </div>` : ''}

  <div class="footer">
    <p>© ${new Date().getFullYear()} Fitsush - Personalized Nutrition Plan</p>
    <p>This plan is customized based on your specific requirements and health profile.</p>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// AI plan layout (ai_plan_data)
// ---------------------------------------------------------------------------

function buildRichAIPlanHtml(
  aiData: any,
  client: any,
  planMeta: { planName: string; weekLabel: string; dateRange: string; duration: string },
  recipes: Array<{ Meal_name: string; Ingredients: string; Instructions: string; Remarks: string }>,
  affiliateProducts: Array<{ product_name: string; link: string }>,
  logoDataUrl: string,
): string {
  const esc = (s: string) => (s || '').replace(/\n/g, '<br/>');
  const escapePlain = (s: string) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const healthConditions: string[] = Array.isArray(client?.health_conditions)
    ? client.health_conditions
    : client?.health_conditions
    ? [client.health_conditions]
    : [];

  const age = (() => {
    if (!client?.date_of_birth) return client?.age ?? '--';
    const dob = new Date(client.date_of_birth);
    const today = new Date();
    let a = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) a--;
    return a;
  })();

  // Per-meal nutrition (calories/macros) is optional AI output; the column only shows if any meal has it.
  const hasNutrition = ((aiData.dayGroups ?? []) as any[]).some((g: any) => ((g.meals ?? []) as any[]).some((m: any) => m.nutrition));
  const formatNutrition = (n?: { calories?: string; protein?: string; carbs?: string; fat?: string }) => {
    if (!n) return '-';
    return [
      n.calories ? `🔥 ${n.calories}` : '',
      n.protein ? `P ${n.protein}` : '',
      n.carbs ? `C ${n.carbs}` : '',
      n.fat ? `F ${n.fat}` : '',
    ].filter(Boolean).join(' · ') || '-';
  };

  const dayGroupTables = ((aiData.dayGroups ?? []) as any[]).map((group: any) => `
    <h3 style="font-size:14px;color:#FF4D06;font-weight:700;margin:18px 0 8px;padding-bottom:4px;border-bottom:1px solid #FED7AA;">
      ${group.label ?? ''}${group.dates ? ` <span style="font-size:12px;color:#666;font-weight:normal;">(${group.dates})</span>` : ''}${group.dailyTotals ? ` <span style="font-size:11px;color:#888;font-weight:normal;">— Day total: ${esc(formatNutrition(group.dailyTotals))}</span>` : ''}
    </h3>
    <table>
      <thead><tr>
        <th style="width:${hasNutrition ? '11%' : '13%'}">Period</th><th style="width:${hasNutrition ? '7%' : '8%'}">Time</th>
        <th style="width:${hasNutrition ? '28%' : '34%'}">Food Plan</th><th style="width:${hasNutrition ? '25%' : '30%'}">Alternative</th>
        <th style="width:${hasNutrition ? '12%' : '15%'}">Notes</th>${hasNutrition ? '<th style="width:17%">Nutrition</th>' : ''}
      </tr></thead>
      <tbody>
        ${((group.meals ?? []) as any[]).map((m: any) => mealOptionRowsHtml(
          mealFoodOptions(m).map(esc),
          [`<td>${m.period ?? '-'}</td>`, `<td>${m.time ?? '-'}</td>`],
          [
            `<td style="color:#666;font-style:italic">${esc(m.alternative ?? '-')}</td>`,
            `<td>${esc(m.notes ?? '-')}</td>`,
            ...(hasNutrition ? [`<td>${esc(formatNutrition(m.nutrition))}</td>`] : []),
          ],
        )).join('')}
      </tbody>
    </table>`).join('');

  const recipesHtml = recipes.length === 0 ? '' : `
    <div style="page-break-before:always;margin-top:24px">
      <h2 style="color:#FF4D06;font-size:18px;border-bottom:2px solid #FF4D06;padding-bottom:6px;margin-bottom:14px">Recipes for mentioned meals</h2>
      ${recipes.map(r => `
        <div style="margin-bottom:16px;page-break-inside:avoid">
          <h3 style="color:#1a5fb4;font-size:13px;margin-bottom:6px">${escapePlain(r.Meal_name)}</h3>
          ${r.Ingredients ? `<div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Ingredients:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Ingredients)}</span></div>` : ''}
          <div style="font-size:11px;line-height:1.5;color:#333;margin-bottom:6px"><strong>Instructions:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Instructions)}</span></div>
          ${r.Remarks ? `<div style="font-size:11px;line-height:1.5;color:#555"><strong>Remarks:</strong><br/><span style="white-space:pre-wrap">${escapePlain(r.Remarks)}</span></div>` : ''}
        </div>`).join('')}
    </div>`;

  const affiliateHtml = affiliateProducts.length === 0 ? '' : `
    <div style="margin-top:24px;page-break-inside:avoid">
      <h2 style="color:#b45309;font-size:16px;border-bottom:2px solid #f59e0b;padding-bottom:6px;margin-bottom:12px">🛒 Shop Recommended Products</h2>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead><tr>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left;width:40%">Product</th>
          <th style="background:#f59e0b;color:white;padding:7px 10px;text-align:left">Buy Link</th>
        </tr></thead>
        <tbody>
          ${affiliateProducts.map((p, i) => `
            <tr style="background:${i % 2 === 0 ? '#fffbeb' : '#ffffff'}">
              <td style="padding:7px 10px;border-bottom:1px solid #fde68a;font-weight:500">${p.product_name}</td>
              <td style="padding:7px 10px;border-bottom:1px solid #fde68a">
                <a href="${p.link}" style="color:#b45309;text-decoration:underline;word-break:break-all">${p.link}</a>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${planMeta.planName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:25px 35px;color:#333;font-size:11px;line-height:1.4}
    .header{text-align:center;margin-bottom:25px;border-bottom:2px solid #FF4D06;padding-bottom:15px}
    .header img{width:180px;height:auto;margin-bottom:12px}
    .header h1{color:#FF4D06;font-size:20px;margin-bottom:5px}
    .header p{color:#666;font-size:12px}
    .week-badge{display:inline-block;background:#FF4D06;color:white;padding:3px 8px;border-radius:12px;font-size:10px;margin-left:10px}
    .client-details{background:#f0f7ff;border:1px solid #b3d1ff;border-radius:8px;padding:15px;margin-bottom:20px}
    .client-details h3{color:#1a5fb4;font-size:14px;margin-bottom:10px}
    .client-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;font-size:10px}
    .client-grid div{margin-bottom:5px}
    .client-grid span{font-weight:bold;color:#555}
    .condition-badge{display:inline-block;background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:10px;font-size:9px;margin-right:4px;margin-bottom:4px}
    .intro{background:#f9f9f9;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #FF4D06}
    .affirmations{background:#fef9e7;padding:15px;border-radius:8px;margin-bottom:20px;border-left:4px solid #f39c12}
    .affirmations h3{color:#f39c12;font-size:14px;margin-bottom:10px}
    .affirmations ul{margin-left:20px}
    .affirmations li{margin-bottom:5px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:10px}
    th{background:#FF4D06;color:white;padding:8px;text-align:left;font-weight:bold}
    td{padding:8px;border-bottom:1px solid #ddd;vertical-align:top}
    tr:nth-child(even){background:#f9f9f9}
    .serving{background:#e8f5e8;padding:10px;border-radius:5px;margin-bottom:15px;font-size:10px}
    .oil-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:15px}
    .oil-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .oil-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .oil-card ul{list-style:none;padding:0;margin:0}
    .oil-card li{font-size:9px;margin-bottom:2px}
    .notes-box{background:#fff3cd;border:1px solid #ffeaa7;border-radius:5px;padding:15px;margin-bottom:20px}
    .notes-box h4{color:#856404;font-size:12px;margin-bottom:10px}
    .notes-box ul{margin-left:15px}
    .notes-box li{margin-bottom:5px;font-size:10px}
    .grocery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .grocery-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .grocery-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .grocery-card ul{list-style:none;padding:0;margin:0}
    .grocery-card li{font-size:9px;margin-bottom:2px}
    .tips-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
    .tip-card{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px}
    .tip-card h4{font-size:11px;margin-bottom:5px;color:#495057}
    .tip-card p{font-size:9px;margin:0}
    .section-title{color:#FF4D06;font-size:16px;font-weight:bold;margin:25px 0 15px;border-bottom:1px solid #FED7AA;padding-bottom:5px}
    .disclaimer{background:#f8f9fa;border:1px solid #dee2e6;border-radius:5px;padding:10px;margin-top:20px;font-size:9px;font-style:italic;color:#6c757d}
    .footer{text-align:center;margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:9px;color:#999}
    @media print{body{padding:15px}}
  </style>
</head>
<body>
  <div class="header">
    ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Fitsush Logo"/>` : ''}
    <h1>${aiData.planName ?? planMeta.planName}</h1>
    <p><span class="week-badge" style="margin-left:0">${planMeta.weekLabel}</span></p>
  </div>

  <div class="client-details">
    <h3>📋 Client Details</h3>
    <div class="client-grid">
      <div><span>Name:</span> ${client?.name ?? '--'}</div>
      <div><span>Age:</span> ${age} years</div>
      <div><span>Gender:</span> ${client?.gender ?? 'Not specified'}</div>
      <div><span>Height/Weight:</span> ${client?.height ?? '--'}cm / ${client?.weight ?? '--'}kg</div>
      <div><span>Skin Type:</span> ${client?.skin_type ?? 'Not specified'}</div>
      <div><span>Hair Type:</span> ${client?.hair_type ?? 'Not specified'}</div>
      <div><span>Goal:</span> ${client?.goal ?? 'Not specified'}</div>
      <div><span>Diet Preference:</span> ${client?.diet_preference ?? 'Not specified'}</div>
      <div><span>Date:</span> ${planMeta.dateRange}</div>
      <div><span>Duration:</span> ${planMeta.duration} days</div>
    </div>
    ${healthConditions.length > 0 ? `
    <div style="margin-top:10px">
      <h4 style="font-size:10px;margin-bottom:5px;color:#555">Health Conditions:</h4>
      ${healthConditions.map((c: string) => `<span class="condition-badge">${c}</span>`).join('')}
    </div>` : ''}
    ${client?.notes ? `<div style="margin-top:10px;font-size:10px"><strong>Notes:</strong> ${client.notes}</div>` : ''}
  </div>

  ${aiData.introMessage ? `<div class="intro"><p>${esc(aiData.introMessage)}</p></div>` : ''}

  ${(aiData.affirmations?.length ?? 0) > 0 ? `
  <div class="affirmations">
    <h3>Positive Affirmations for ${client?.name ?? 'Client'}:</h3>
    <ul>${(aiData.affirmations as string[]).map(a => `<li>${a}</li>`).join('')}</ul>
  </div>` : ''}

  ${dayGroupTables}

  <h3 class="section-title">Additional Guidelines</h3>
  <div class="serving"><strong>Serving Size:</strong> ${aiData.servingSize ?? '1 bowl is 250ml, 1 cup 150ml, 1 katori 100ml'}</div>

  ${aiData.oilGuidelines ? `
  <div>
    <h4 style="font-size:11px;color:#333;margin-bottom:6px">Use of Oils:</h4>
    <div class="oil-grid">
      <div class="oil-card"><h4>Cooking - Group A</h4><ul>${((aiData.oilGuidelines.cooking?.groupA ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Cooking - Group B</h4><ul>${((aiData.oilGuidelines.cooking?.groupB ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Raw/Topping</h4><ul>${((aiData.oilGuidelines.raw ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
      <div class="oil-card"><h4>Deep Frying</h4><ul>${((aiData.oilGuidelines.deepFrying ?? []) as string[]).map(o => `<li>- ${o}</li>`).join('')}</ul></div>
    </div>
    <p style="font-style:italic;font-size:9px;color:#6c757d;margin:0">${aiData.oilGuidelines.note ?? ''}</p>
  </div>` : ''}

  ${(aiData.importantNotes?.length ?? 0) > 0 ? `
  <div class="notes-box">
    <h4>⚠️ Important Notes:</h4>
    <ul style="padding-left:15px">${(aiData.importantNotes as string[]).map(n => `<li>${n}</li>`).join('')}</ul>
  </div>` : ''}

  ${(aiData.weeklyGroceryList?.length ?? 0) > 0 ? `
  <h3 class="section-title">🛒 Weekly Grocery List</h3>
  <div class="grocery-grid">
    ${(aiData.weeklyGroceryList as any[]).map((cat: any) => `
      <div class="grocery-card">
        <h4>${cat.category}</h4>
        <ul>${(cat.items as string[]).map(item => `<li>${item}</li>`).join('')}</ul>
      </div>`).join('')}
  </div>` : ''}

  <div class="tips-grid">
    ${aiData.skinCareTips ? `<div class="tip-card"><h4>✨ Skin Care Tips</h4><p>${aiData.skinCareTips}</p></div>` : ''}
    ${aiData.hairCareTips ? `<div class="tip-card"><h4>💇 Hair Care Tips</h4><p>${aiData.hairCareTips}</p></div>` : ''}
    ${aiData.healthNotes ? `<div class="tip-card"><h4>🏥 Health Notes</h4><p>${aiData.healthNotes}</p></div>` : ''}
    <div class="tip-card"><h4>💊 Recommended Supplements</h4><p>${aiData.supplements ?? 'No supplements specified'}</p></div>
  </div>

  ${aiData.disclaimer ? `<div class="disclaimer"><strong>Disclaimer:</strong> ${aiData.disclaimer}</div>` : ''}

  ${recipesHtml}
  ${affiliateHtml}

  <div class="footer">© ${new Date().getFullYear()} Fitsush. This nutrition plan is personalized and should be followed as advised.</div>
</body>
</html>`;
}

function aiPlanMeta(plan: any) {
  // Compute date range from plan metadata
  const aiData = plan.ai_plan_data;
  const startDateStr = aiData.editableStartDate ?? plan.start_date ?? aiData.startDate ?? '';
  const dayCount = parseInt(aiData.editableDayCount ?? '7') || 7;
  let dateRange = 'Not specified';
  if (startDateStr) {
    try {
      const start = new Date(startDateStr);
      const end = new Date(start);
      end.setDate(start.getDate() + dayCount - 1);
      const fmt = (d: Date) =>
        `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      dateRange = `${fmt(start)} to ${fmt(end)}`;
    } catch { /* leave as Not specified */ }
  }

  const planMeta = {
    planName: aiData.planName ?? plan.plan_name ?? 'Diet Plan',
    weekLabel: plan.plan_name ?? aiData.planName ?? 'Diet Plan',
    dateRange,
    duration: String(dayCount),
  };

  return planMeta;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function buildPlanHtml(
  plan: any,
  opts: { recipes?: RecipeRow[]; affiliateProducts?: AffiliateProduct[]; logoDataUrl?: string } = {},
): string {
  const { recipes = [], affiliateProducts = [], logoDataUrl = '' } = opts;
  if (plan.is_ai_generated && plan.ai_plan_data) {
    return buildRichAIPlanHtml(plan.ai_plan_data, plan.clients ?? {}, aiPlanMeta(plan), recipes, affiliateProducts, logoDataUrl);
  }
  return buildManualPlanHtml(plan, recipes, logoDataUrl);
}
