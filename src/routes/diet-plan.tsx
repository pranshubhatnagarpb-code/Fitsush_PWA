import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, ClientDietPlanFile } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText, Download, Eye, FileDown } from "lucide-react";

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
  const [pdfs, setPdfs] = useState<PdfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const load = async () => {
      // Pull ALL plans for this client (not just active) so completed/saved
      // plans with PDFs still surface.
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
          .order("created_at", { ascending: false }),
      ]);

      const plans = (plansRes.data ?? []) as DietPlan[];
      const files = (filesRes.data ?? []) as ClientDietPlanFile[];

      const active =
        plans.find((p) => (p.status ?? "").toLowerCase() === "active") ?? null;
      setActivePlan(active);

      // Build one merged, de-duplicated PDF list:
      // 1. PDFs from client_diet_plan_files (new table)
      // 2. PDFs from diet_plans.pdf_file_path (legacy/PMS)
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
          uploaded_at: f.created_at,
          source: "client_diet_plan_files",
        });
      }

      for (const p of plans) {
        if (!p.pdf_file_path || seenPaths.has(p.pdf_file_path)) continue;
        seenPaths.add(p.pdf_file_path);
        items.push({
          key: `p-${p.id}`,
          file_path: p.pdf_file_path,
          file_name: p.pdf_file_name,
          plan_name: p.plan_name,
          status: p.status,
          uploaded_at: p.pdf_uploaded_at ?? p.created_at,
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
      setLoading(false);
    };
    load();
  }, [clientProfile]);

  const openSignedUrl = async (item: PdfItem, mode: "view" | "download") => {
    setBusyKey(item.key);
    setErrorMsg(null);
    try {
      const downloadOpt =
        mode === "download" ? { download: item.file_name ?? true } : undefined;

      // Try canonical bucket first, then legacy fallback.
      let signed = await supabase.storage
        .from(PRIMARY_BUCKET)
        .createSignedUrl(item.file_path, 3600, downloadOpt);
      if (signed.error || !signed.data?.signedUrl) {
        signed = await supabase.storage
          .from(FALLBACK_BUCKET)
          .createSignedUrl(item.file_path, 3600, downloadOpt);
      }
      if (signed.error || !signed.data?.signedUrl) {
        setErrorMsg(signed.error?.message ?? "Could not generate download link");
        return;
      }
      window.open(signed.data.signedUrl, "_blank", "noopener,noreferrer");
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

          {/* Diet chart PDFs (from new table + legacy column) */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              Diet Chart PDFs
            </h3>

            {errorMsg && (
              <div className="mb-3 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {errorMsg}
              </div>
            )}

            {pdfs.length === 0 ? (
              <EmptyState
                icon={<FileDown className="h-10 w-10" />}
                title="No diet charts yet"
                description="Your nutritionist will upload your diet chart here."
              />
            ) : (
              <ul className="space-y-2">
                {pdfs.map((f) => {
                  const displayName =
                    f.plan_name ||
                    f.file_name ||
                    f.file_path.split("/").pop() ||
                    "Diet chart";
                  const isActive = (f.status ?? "").toLowerCase() === "active";
                  return (
                    <li key={f.key} className="rounded-2xl border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {displayName}
                            </p>
                            {f.status && (
                              <span
                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                                  isActive
                                    ? "bg-success/15 text-success"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {f.status}
                              </span>
                            )}
                          </div>
                          {f.file_name && f.plan_name && f.file_name !== f.plan_name && (
                            <p className="truncate text-xs text-muted-foreground">
                              {f.file_name}
                            </p>
                          )}
                          {f.uploaded_at && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(f.uploaded_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => openSignedUrl(f, "view")}
                          disabled={busyKey === f.key}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          onClick={() => openSignedUrl(f, "download")}
                          disabled={busyKey === f.key}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </PageShell>
  );
}
