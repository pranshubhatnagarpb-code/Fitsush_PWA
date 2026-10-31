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
import { dietPlanHtmlToPdfBlob, dietPlanPdfFileName } from "@/lib/dietPlanPdfFile";

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
export async function fetchPlanDays(planId: string): Promise<any[]> {
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

// Downloads the chart as a PDF file, rendered by the shared dietPlanPdfFile.ts —
// the same renderer PMS uses for the PDF it makes on Publish. (The browser's
// print dialog gave a different file per device, and on iOS printed the portal
// page instead of the chart.)
export async function downloadDietPlanPdf(plan: any, client: any): Promise<void> {
  const blob = await dietPlanHtmlToPdfBlob(await loadPlanHtml(plan, client));
  if (!blob) throw new Error("Could not prepare the PDF");
  // Anchor download, not window.open — popups are blocked in PWA standalone mode.
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = dietPlanPdfFileName(plan.plan_name);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
