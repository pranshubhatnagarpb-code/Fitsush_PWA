import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, ClientDietPlanFile, Client } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import {
  EmptyState,
  LoadingSpinner,
  PageHero,
  HeroProgress,
  SectionCard,
  ErrorNote,
  HERO_BUTTON_PRIMARY,
  BUTTON_OUTLINE,
  CHIP_TINT,
  NO_SCROLLBAR,
  formatLongDate,
} from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText, Download, Eye, ShoppingCart, ExternalLink, Loader2, Salad, StickyNote, ChevronDown } from "lucide-react";
import { downloadDietPlanPdf, fetchPlanDays } from "@/lib/dietPlanPdf";
import { planDayGroups, planDayProgress, todayGroupIndex } from "@/lib/planDays";

const PRIMARY_BUCKET = "diet-plan-pdfs";
const FALLBACK_BUCKET = "diet-pdfs";

type PdfItem = {
  key: string;
  file_path: string;
  file_name: string | null;
  plan_name: string | null;
  status: string | null;
  uploaded_at: string | null;
  source: "diet_plans" | "client_diet_plan_files";
};

export const Route = createFileRoute("/diet-plan")({
  component: DietPlanPage,
});

function DietPlanPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [publishedPlans, setPublishedPlans] = useState<DietPlan[]>([]);
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualDays, setManualDays] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [affiliateProducts, setAffiliateProducts] = useState<{ product_name: string; link: string; product_name_normalized: string }[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const load = async () => {
      // Pull ALL plans so we can match published files to their plan metadata,
      // but only PUBLISHED items are surfaced to the client.
      const [plansRes, filesRes] = await Promise.all([
        supabase
          .from("diet_plans")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("client_diet_plan_files")
          .select("*")
          .eq("client_id", clientProfile.id)
          .eq("is_published", true)
          .order("created_at", { ascending: false }),
      ]);

      const plans = (plansRes.data ?? []) as DietPlan[];
      const files = (filesRes.data ?? []) as ClientDietPlanFile[];

      // All published plans, newest first
      const published = plans.filter((p) => p.is_published === true);
      setPublishedPlans(published);

      // Active plan summary — prefer published+active, then any active, then any published.
      const active =
        plans.find(
          (p) => p.is_published === true && (p.status ?? "").toLowerCase() === "active"
        ) ??
        plans.find((p) => (p.status ?? "").toLowerCase() === "active") ??
        plans.find((p) => p.is_published === true) ??
        null;
      setActivePlan(active);

      // Build one merged, de-duplicated PUBLISHED PDF list:
      // 1. Published PDFs from client_diet_plan_files (canonical)
      // 2. Legacy fallback: diet_plans.pdf_file_path on PUBLISHED plans only
      const seenPaths = new Set<string>();
      const items: PdfItem[] = [];
      const planById = new Map(plans.map((p) => [p.id, p]));

      for (const f of files) {
        if (!f.file_path || seenPaths.has(f.file_path)) continue;
        seenPaths.add(f.file_path);
        const linkedPlan = f.diet_plan_id ? planById.get(f.diet_plan_id) : undefined;
        items.push({
          key: `f-${f.id}`,
          file_path: f.file_path,
          file_name: f.file_name,
          plan_name: linkedPlan?.plan_name ?? null,
          status: linkedPlan?.status ?? null,
          uploaded_at: f.published_at ?? f.created_at,
          source: "client_diet_plan_files",
        });
      }

      for (const p of plans) {
        // Legacy fallback: only include if the plan itself is explicitly published.
        if (!p.is_published) continue;
        if (!p.pdf_file_path || seenPaths.has(p.pdf_file_path)) continue;
        seenPaths.add(p.pdf_file_path);
        items.push({
          key: `p-${p.id}`,
          file_path: p.pdf_file_path,
          file_name: p.pdf_file_name,
          plan_name: p.plan_name,
          status: p.status,
          uploaded_at: p.published_at ?? p.pdf_uploaded_at ?? p.created_at,
          source: "diet_plans",
        });
      }

      // newest first
      items.sort(
        (a, b) =>
          new Date(b.uploaded_at ?? 0).getTime() -
          new Date(a.uploaded_at ?? 0).getTime()
      );

      setPdfs(items);

      // Extract all grocery list items from published AI plans and match affiliate products
      const groceryItems = new Set<string>();
      const normGrocery = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
      for (const p of published) {
        const ai = p.ai_plan_data as any;
        if (!ai?.weeklyGroceryList) continue;
        for (const cat of (ai.weeklyGroceryList as any[])) {
          for (const item of (cat.items as string[] ?? [])) {
            const n = normGrocery(item.replace(/\(.*?\)/g, "").replace(/\d+\s*(g|ml|kg|tsp|tbsp|cup|pcs)\b/gi, "").trim());
            if (n.length >= 2) groceryItems.add(n);
          }
        }
      }

      if (groceryItems.size > 0) {
        const { data: allProducts } = await supabase
          .from("affiliate_products" as any)
          .select("product_name, link, product_name_normalized");
        if (allProducts) {
          const matched = (allProducts as any[]).filter((p) => {
            const pn = p.product_name_normalized as string;
            return [...groceryItems].some(
              (g) => g === pn || g.includes(pn) || pn.includes(g)
            );
          });
          setAffiliateProducts(matched);
        }
      }

      setLoading(false);
    };
    load();
  }, [clientProfile]);

  // Manual plans keep their meals in diet_plan_days (AI plans carry them in ai_plan_data).
  useEffect(() => {
    if (!activePlan?.is_published || (activePlan.is_ai_generated && activePlan.ai_plan_data)) {
      setManualDays([]);
      return;
    }
    fetchPlanDays(activePlan.id).then(setManualDays);
  }, [activePlan]);

  const dayGroups = useMemo(
    // Only a published plan's meals are shown — drafts may still change.
    () => (activePlan?.is_published ? planDayGroups(activePlan, manualDays) : []),
    [activePlan, manualDays]
  );
  const todayIndex = useMemo(
    () => (activePlan ? todayGroupIndex(dayGroups, planDayProgress(activePlan)?.day) : 0),
    [activePlan, dayGroups]
  );
  useEffect(() => setSelectedGroup(todayIndex), [todayIndex]);

  // Same chart layout as PMS's download (shared dietPlanHtml.ts).
  const downloadPlanPdf = async (plan: DietPlan) => {
    const key = `pdf-${plan.id}`;
    setBusyKey(key);
    setErrorMsg(null);
    try {
      await downloadDietPlanPdf(plan, clientProfile);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Could not prepare the PDF");
    } finally {
      setBusyKey(null);
    }
  };

  const openSignedUrl = async (item: PdfItem, mode: "view" | "download") => {
    setBusyKey(item.key);
    setErrorMsg(null);
    try {
      // Try canonical bucket first, then legacy fallback.
      let signed = await supabase.storage
        .from(PRIMARY_BUCKET)
        .createSignedUrl(item.file_path, 3600);
      if (signed.error || !signed.data?.signedUrl) {
        signed = await supabase.storage
          .from(FALLBACK_BUCKET)
          .createSignedUrl(item.file_path, 3600);
      }
      if (signed.error || !signed.data?.signedUrl) {
        setErrorMsg(signed.error?.message ?? "Could not generate download link");
        return;
      }

      if (mode === "view") {
        window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        // Programmatic download — works in PWA standalone mode where
        // window.open/_blank is blocked by the browser.
        const res = await fetch(signed.data.signedUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = item.file_name ?? "diet-plan.pdf";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || !isAuthenticated) return <LoadingSpinner fullScreen />;

  const progress = activePlan ? planDayProgress(activePlan) : null;
  const dateRange = (plan: DietPlan) =>
    plan.start_date || plan.end_date
      ? `${plan.start_date ? formatLongDate(plan.start_date) : "—"} → ${plan.end_date ? formatLongDate(plan.end_date) : "Ongoing"}`
      : null;
  const filesFor = (plan: DietPlan) =>
    pdfs.filter(
      (f) =>
        f.key === `p-${plan.id}` ||
        (f.source === "client_diet_plan_files" && (f as any).diet_plan_id === plan.id)
    );
  const group = dayGroups[selectedGroup] ?? null;

  return (
    <PageShell title="Diet Plan">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-4">
          {!activePlan ? (
            <EmptyState
              icon={<Utensils className="h-6 w-6" />}
              title="No active diet plan"
              description="Your nutritionist hasn't published a plan yet. Past plans (if any) are listed below."
            />
          ) : (
            <PageHero
              eyebrow={activePlan.is_published ? "Your current plan" : "Plan in progress"}
              title={activePlan.plan_name ?? "Diet Plan"}
              subtitle={dateRange(activePlan) ?? undefined}
              icon={<Utensils className="h-5 w-5" />}
            >
              {progress && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs text-white/85">
                    <span>
                      Day {progress.day}
                      {progress.total ? ` of ${progress.total}` : ""}
                    </span>
                    {progress.total ? <span>{Math.round(progress.pct)}%</span> : null}
                  </div>
                  {progress.total ? <HeroProgress pct={progress.pct} /> : null}
                </div>
              )}
              {activePlan.is_published && (
                <button
                  type="button"
                  onClick={() => downloadPlanPdf(activePlan)}
                  disabled={busyKey === `pdf-${activePlan.id}`}
                  className={HERO_BUTTON_PRIMARY}
                >
                  {busyKey === `pdf-${activePlan.id}` ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {busyKey === `pdf-${activePlan.id}` ? "Preparing PDF…" : "Download PDF"}
                </button>
              )}
            </PageHero>
          )}

          {/* Meals by day — the day matching today is picked first */}
          {activePlan && dayGroups.length > 0 && (
            <SectionCard
              icon={<Salad className="h-4 w-4" />}
              title={selectedGroup === todayIndex ? "Today's meals" : "Meals"}
              subtitle={group ? [group.label, group.sub].filter(Boolean).join(" · ") : undefined}
            >
              {dayGroups.length > 1 && (
                <div className={`-mx-5 mb-4 flex gap-2 overflow-x-auto px-5 ${NO_SCROLLBAR}`}>
                  {dayGroups.map((g, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedGroup(i)}
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        i === selectedGroup
                          ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {i === todayIndex ? `Today · ${g.label}` : g.label}
                    </button>
                  ))}
                </div>
              )}
              {group && group.meals.length > 0 ? (
                <ol className="space-y-3">
                  {group.meals.map((m, i) => (
                    <li key={i} className="rounded-2xl bg-muted/50 p-4">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="font-display text-sm font-bold text-foreground">{m.label}</p>
                        {m.time && <span className="text-xs font-medium text-muted-foreground">{m.time}</span>}
                      </div>
                      {m.options.length === 1 ? (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground">{m.options[0]}</p>
                      ) : (
                        <ul className="mt-2 space-y-1.5">
                          {m.options.map((o, oi) => (
                            <li key={oi} className="flex gap-2 text-sm leading-relaxed text-foreground">
                              <span className="mt-0.5 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                                {oi + 1}
                              </span>
                              <span className="whitespace-pre-line">{o}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {m.alternative && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          <span className="font-semibold">Alternative:</span> {m.alternative}
                        </p>
                      )}
                      {m.notes && <p className="mt-1 text-xs italic text-muted-foreground">{m.notes}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No meals listed for this day.</p>
              )}
              {group?.notes && (
                <p className="mt-3 whitespace-pre-line rounded-2xl bg-warning/10 px-4 py-3 text-xs text-foreground">{group.notes}</p>
              )}
            </SectionCard>
          )}

          {activePlan?.instructions && (
            <SectionCard
              icon={<StickyNote className="h-4 w-4" />}
              iconClassName={CHIP_TINT.notes}
              title="Instructions"
            >
              <p
                className={`whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
                  instructionsOpen ? "" : "line-clamp-6"
                }`}
              >
                {activePlan.instructions}
              </p>
              {activePlan.instructions.length > 300 && (
                <button
                  type="button"
                  onClick={() => setInstructionsOpen((v) => !v)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  {instructionsOpen ? "Show less" : "Read more"}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${instructionsOpen ? "rotate-180" : ""}`} />
                </button>
              )}
            </SectionCard>
          )}

          {/* All published plans — one row per plan with Download button */}
          <SectionCard
            icon={<FileText className="h-4 w-4" />}
            iconClassName={CHIP_TINT.info}
            title="All published plans"
            subtitle={publishedPlans.length ? `${publishedPlans.length} plan${publishedPlans.length === 1 ? "" : "s"}` : undefined}
          >
            {publishedPlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Your nutritionist will publish your diet plan here when it's ready.
              </p>
            ) : (
              <ul className="space-y-3">
                {publishedPlans.map((plan) => {
                  const isCurrent = plan.id === activePlan?.id;
                  const files = filesFor(plan);
                  return (
                    <li key={plan.id} className="rounded-2xl border p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{plan.plan_name ?? "Diet Plan"}</p>
                        {isCurrent && (
                          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                            Current
                          </span>
                        )}
                      </div>
                      {dateRange(plan) && (
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          {dateRange(plan)}
                        </p>
                      )}
                      {plan.published_at && (
                        <p className="mt-0.5 text-xs text-muted-foreground">Published {formatLongDate(plan.published_at)}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-2">
                        {/* Uploaded file — View / Download via signed URL if available */}
                        {files.slice(0, 1).map((f) => (
                          <span key={f.key} className="contents">
                            <button
                              onClick={() => openSignedUrl(f, "view")}
                              disabled={busyKey === f.key}
                              className={BUTTON_OUTLINE}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View file
                            </button>
                            <button
                              onClick={() => openSignedUrl(f, "download")}
                              disabled={busyKey === f.key}
                              className={BUTTON_OUTLINE}
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download file
                            </button>
                          </span>
                        ))}
                        {/* Always-available client-side PDF generation */}
                        <button
                          onClick={() => downloadPlanPdf(plan)}
                          disabled={busyKey === `pdf-${plan.id}`}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-md shadow-primary/25 transition-transform hover:bg-primary/90 active:scale-95 disabled:opacity-60"
                        >
                          {busyKey === `pdf-${plan.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          {busyKey === `pdf-${plan.id}` ? "Preparing PDF…" : "Download PDF"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Error from PDF / signed-URL generation */}
            {errorMsg && <div className="mt-3"><ErrorNote>{errorMsg}</ErrorNote></div>}
          </SectionCard>

          {/* Affiliate product links matched from grocery list */}
          {affiliateProducts.length > 0 && (
            <SectionCard
              icon={<ShoppingCart className="h-4 w-4" />}
              iconClassName={CHIP_TINT.success}
              title="Shop recommended products"
              subtitle="From your plan's grocery list"
            >
              <div className="space-y-2">
                {affiliateProducts.map((p) => (
                  <a
                    key={p.product_name_normalized}
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm font-medium text-foreground transition-transform hover:bg-muted active:scale-[0.98]"
                  >
                    <span className="truncate">{p.product_name}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </PageShell>
  );
}
