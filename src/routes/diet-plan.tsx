import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, ClientDietPlanFile, Client } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText, Download, Eye, FileDown, ShoppingCart, ExternalLink, Loader2 } from "lucide-react";
import { printDietPlan } from "@/lib/dietPlanPdf";

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

  // Same chart layout as PMS's download (shared dietPlanHtml.ts).
  const downloadPlanPdf = async (plan: DietPlan) => {
    const key = `pdf-${plan.id}`;
    setBusyKey(key);
    setErrorMsg(null);
    try {
      await printDietPlan(plan, clientProfile);
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

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  return (
    <PageShell title="My Diet Plan">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          {/* Active plan summary */}
          {!activePlan ? (
            <EmptyState
              icon={<Utensils className="h-10 w-10" />}
              title="No active diet plan"
              description="Your nutritionist hasn't published a plan yet. Past plan PDFs (if any) are listed below."
            />
          ) : (
            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Utensils className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    {activePlan.plan_name ?? "Diet Plan"}
                  </h2>
                  <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    {activePlan.status}
                  </span>
                </div>
              </div>

              {(activePlan.start_date || activePlan.end_date) && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {activePlan.start_date
                      ? new Date(activePlan.start_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    {" → "}
                    {activePlan.end_date
                      ? new Date(activePlan.end_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Ongoing"}
                  </span>
                </div>
              )}

              {activePlan.instructions && (
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Instructions
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {activePlan.instructions}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* All published plans — one card per plan with Download button */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              All Published Plans
            </h3>

            {publishedPlans.length === 0 ? (
              <EmptyState
                icon={<FileDown className="h-10 w-10" />}
                title="No published plans yet"
                description="Your nutritionist will publish your diet plan here when it's ready."
              />
            ) : (
              <ul className="space-y-3">
                {publishedPlans.map((plan) => {
                  const isCurrent = plan.id === activePlan?.id;
                  return (
                    <li key={plan.id} className="rounded-2xl border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {plan.plan_name ?? "Diet Plan"}
                            </p>
                            {isCurrent && (
                              <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success">
                                Current
                              </span>
                            )}
                          </div>
                          {(plan.start_date || plan.end_date) && (
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <CalendarDays className="h-3 w-3 shrink-0" />
                              <span>
                                {plan.start_date
                                  ? new Date(plan.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                  : "—"}
                                {" → "}
                                {plan.end_date
                                  ? new Date(plan.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                  : "Ongoing"}
                              </span>
                            </div>
                          )}
                          {plan.published_at && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Published{" "}
                              {new Date(plan.published_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          )}
                          {plan.instructions && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {plan.instructions}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Uploaded file — View / Download via signed URL if available */}
                      {pdfs.filter((f) =>
                        f.key === `p-${plan.id}` ||
                        (f.source === "client_diet_plan_files" &&
                          (f as any).diet_plan_id === plan.id)
                      ).length > 0 && (
                        <div className="mt-3 flex gap-2">
                          {pdfs
                            .filter((f) =>
                              f.key === `p-${plan.id}` ||
                              (f.source === "client_diet_plan_files" &&
                                (f as any).diet_plan_id === plan.id)
                            )
                            .slice(0, 1)
                            .map((f) => (
                              <>
                                <button
                                  key={`view-${f.key}`}
                                  onClick={() => openSignedUrl(f, "view")}
                                  disabled={busyKey === f.key}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                >
                                  <Eye className="h-4 w-4" />
                                  View File
                                </button>
                                <button
                                  key={`dl-${f.key}`}
                                  onClick={() => openSignedUrl(f, "download")}
                                  disabled={busyKey === f.key}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                                >
                                  <Download className="h-4 w-4" />
                                  Download File
                                </button>
                              </>
                            ))}
                        </div>
                      )}

                      {/* Always-available client-side PDF generation */}
                      <button
                        onClick={() => downloadPlanPdf(plan)}
                        disabled={busyKey === `pdf-${plan.id}`}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        {busyKey === `pdf-${plan.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {busyKey === `pdf-${plan.id}` ? "Preparing PDF..." : "Download PDF"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Error from signed-URL generation */}
            {errorMsg && (
              <div className="mt-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}
          </div>

          {/* Affiliate product links matched from grocery list */}
          {affiliateProducts.length > 0 && (
            <div>
              <h3 className="mb-3 font-display text-sm font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                Shop Recommended Products
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {affiliateProducts.map((p) => (
                  <a
                    key={p.product_name_normalized}
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    <span className="truncate">{p.product_name}</span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
