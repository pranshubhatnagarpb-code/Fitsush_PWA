import { supabase } from "@/lib/supabase";
import {
  buildPlanHtml,
  aiRecipeCandidates,
  matchAiRecipeNames,
  manualRecipeKeys,
  matchAffiliateProducts,
  type RecipeRow,
  type AffiliateProductRow,
} from "@/lib/dietPlanHtml";

// Loads what the shared diet chart layout (dietPlanHtml.ts — identical to
// PMS's copy) needs, so the client's "Download PDF" matches what PMS prints.
// Mirrors PMS/src/lib/dietPlanPdf.ts's data loading.

const RECIPE_COLUMNS = "Meal_name, Ingredients, Instructions, Remarks";

// Supabase caps responses at 1000 rows per request, so page through the table.
async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const all: T[] = [];
  const batchSize = 1000;
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + batchSize - 1);
    if (error || !data) return all;
    all.push(...(data as T[]));
    if (data.length < batchSize) return all;
  }
}

// AI plans: match on names only (small download), then fetch the full recipes that matched.
async function fetchRecipesForAIPlan(aiData: any): Promise<RecipeRow[]> {
  const candidates = aiRecipeCandidates(aiData);
  if (candidates.length === 0) return [];
  const names = await fetchAllRows<{ Meal_name: string }>("meal_recipes", "Meal_name");
  const matched = matchAiRecipeNames(candidates, names.map((r) => r.Meal_name));
  if (matched.length === 0) return [];
  const { data } = await supabase.from("meal_recipes").select(RECIPE_COLUMNS).in("Meal_name", matched);
  const byName = new Map(((data ?? []) as RecipeRow[]).map((r) => [r.Meal_name, r]));
  return matched.flatMap((n) => (byName.has(n) ? [byName.get(n)!] : []));
}

async function fetchRecipesForManualPlan(days: any[]): Promise<RecipeRow[]> {
  const keys = manualRecipeKeys(days);
  if (keys.length === 0) return [];
  const { data, error } = await supabase.from("meal_recipes").select(RECIPE_COLUMNS).in("meal_name_normalized", keys);
  return error || !data ? [] : (data as RecipeRow[]);
}

// Manual plans keep their meals in diet_plan_days (the PWA's plan row doesn't include them).
async function fetchPlanDays(planId: string): Promise<any[]> {
  const { data } = await supabase
    .from("diet_plan_days")
    .select(`
      *,
      breakfast_option:diet_options!diet_plan_days_breakfast_option_id_fkey (id, name, calories),
      lunch_option:diet_options!diet_plan_days_lunch_option_id_fkey (id, name, calories),
      snacks_option:diet_options!diet_plan_days_snacks_option_id_fkey (id, name, calories),
      dinner_option:diet_options!diet_plan_days_dinner_option_id_fkey (id, name, calories)
    `)
    .eq("diet_plan_id", planId);
  return data ?? [];
}

async function loadLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch("/fitsush-logo.webp");
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export async function loadPlanHtml(plan: any, client: any): Promise<string> {
  const isAI = !!(plan.is_ai_generated && plan.ai_plan_data);
  const days = isAI ? [] : await fetchPlanDays(plan.id);
  const [recipes, affiliateProducts, logoDataUrl] = await Promise.all([
    isAI ? fetchRecipesForAIPlan(plan.ai_plan_data) : fetchRecipesForManualPlan(days),
    isAI
      ? fetchAllRows<AffiliateProductRow>("affiliate_products", "product_name, link, product_name_normalized")
          .then((products) => matchAffiliateProducts(plan.ai_plan_data, products))
      : Promise.resolve([]),
    loadLogoDataUrl(),
  ]);
  return buildPlanHtml({ ...plan, clients: client, diet_plan_days: days }, { recipes, affiliateProducts, logoDataUrl });
}

// Prints via a hidden iframe — window.open/_blank popups are blocked in PWA standalone mode.
export async function printDietPlan(plan: any, client: any): Promise<void> {
  const html = await loadPlanHtml(plan, client);
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;width:0;height:0;border:none;opacity:0";
  iframe.srcdoc = html;
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 400);
  };
  document.body.appendChild(iframe);
}
