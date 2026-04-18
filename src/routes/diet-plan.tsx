import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, ClientDietPlanFile } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText, Download, Eye, FileDown } from "lucide-react";

const PDF_BUCKET = "diet-plan-pdfs";

export const Route = createFileRoute("/diet-plan")({
  component: DietPlanPage,
});

function DietPlanPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [files, setFiles] = useState<ClientDietPlanFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const load = async () => {
      const [planRes, filesRes] = await Promise.all([
        supabase
          .from("diet_plans")
          .select("*")
          .eq("client_id", clientProfile.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("client_diet_plan_files")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("created_at", { ascending: false }),
      ]);
      setPlan(planRes.data);
      setFiles(filesRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [clientProfile]);

  const openSignedUrl = async (file: ClientDietPlanFile, mode: "view" | "download") => {
    setBusyFileId(file.id);
    try {
      const bucket = file.bucket || PDF_BUCKET;
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.file_path, 3600, mode === "download" ? { download: file.file_name ?? true } : undefined);
      if (error || !data?.signedUrl) {
        alert(error?.message ?? "Could not generate download link");
        return;
      }
      // Open in new tab; on mobile this triggers the PDF viewer / system download
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } finally {
      setBusyFileId(null);
    }
  };

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  return (
    <PageShell title="My Diet Plan">
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="space-y-6">
          {/* Active plan */}
          {!plan ? (
            <EmptyState
              icon={<Utensils className="h-10 w-10" />}
              title="No active diet plan"
              description="Your nutritionist hasn't published a plan yet. Check back soon!"
            />
          ) : (
            <div className="rounded-2xl border bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <Utensils className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    {plan.plan_name ?? "Diet Plan"}
                  </h2>
                  <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    {plan.status}
                  </span>
                </div>
              </div>

              {(plan.start_date || plan.end_date) && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  <span>
                    {plan.start_date
                      ? new Date(plan.start_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    {" → "}
                    {plan.end_date
                      ? new Date(plan.end_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Ongoing"}
                  </span>
                </div>
              )}

              {plan.instructions && (
                <div className="rounded-xl bg-muted/50 p-4">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    Instructions
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {plan.instructions}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Diet chart PDFs */}
          <div>
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">
              Diet Chart PDFs
            </h3>
            {files.length === 0 ? (
              <EmptyState
                icon={<FileDown className="h-10 w-10" />}
                title="No diet charts yet"
                description="Your nutritionist will upload your diet chart here."
              />
            ) : (
              <ul className="space-y-2">
                {files.map((f) => {
                  const uploaded = f.uploaded_at ?? f.created_at;
                  const displayName =
                    f.plan_name || f.file_name || f.file_path.split("/").pop() || "Diet chart";
                  return (
                    <li
                      key={f.id}
                      className="rounded-2xl border bg-card p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {displayName}
                          </p>
                          {f.file_name && f.plan_name && f.file_name !== f.plan_name && (
                            <p className="truncate text-xs text-muted-foreground">{f.file_name}</p>
                          )}
                          {uploaded && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(uploaded).toLocaleDateString("en-IN", {
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
                          disabled={busyFileId === f.id}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          <Eye className="h-4 w-4" />
                          View
                        </button>
                        <button
                          onClick={() => openSignedUrl(f, "download")}
                          disabled={busyFileId === f.id}
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
