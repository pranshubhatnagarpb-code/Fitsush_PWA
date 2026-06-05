import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan, ClientDietPlanFile, Client } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText, Download, Eye, FileDown } from "lucide-react";

const PRIMARY_BUCKET = "diet-plan-pdfs";
const FALLBACK_BUCKET = "diet-pdfs";

function openPlanAsPdf(plan: DietPlan, clientProfile: Client | null): void {
  const ai = plan.ai_plan_data as Record<string, unknown> | null;
  const clientName = clientProfile?.name ?? "Client";
  const healthConditions: string[] = Array.isArray(clientProfile?.health_conditions)
    ? (clientProfile.health_conditions as string[])
    : clientProfile?.health_conditions
    ? [clientProfile.health_conditions]
    : [];

  let body = "";

  if (ai) {
    const dayGroups = (ai.dayGroups as any[]) ?? [];
    const affirmations = (ai.affirmations as string[]) ?? [];
    const importantNotes = (ai.importantNotes as string[]) ?? [];

    body = `
      <div class="header">
        <h1>${ai.planName ?? plan.plan_name ?? "Diet Plan"}</h1>
        <p>Personalized plan for ${clientName}
          ${plan.week_number ? `<span class="badge">Week ${plan.week_number}</span>` : ""}
        </p>
      </div>

      <div class="card">
        <h3>Client Details</h3>
        <div class="grid2">
          <div><b>Name:</b> ${clientName}</div>
          <div><b>Goal:</b> ${clientProfile?.goal ?? "Not specified"}</div>
          ${clientProfile?.height ? `<div><b>Height:</b> ${clientProfile.height} cm</div>` : ""}
          ${clientProfile?.weight ? `<div><b>Weight:</b> ${clientProfile.weight} kg</div>` : ""}
        </div>
        ${healthConditions.length > 0 ? `<p style="margin-top:8px"><b>Health Conditions:</b> ${healthConditions.map(c => `<span class="badge-blue">${c}</span>`).join(" ")}</p>` : ""}
      </div>

      ${ai.introMessage ? `<div class="intro"><p>${String(ai.introMessage).replace(/\n/g, "<br/>")}</p></div>` : ""}

      ${affirmations.length > 0 ? `
      <div class="card green">
        <h3>Affirmations</h3>
        <ul>${affirmations.map(a => `<li>${a}</li>`).join("")}</ul>
      </div>` : ""}

      ${dayGroups.map((g: any) => `
        <h3 class="section">${g.label ?? ""}${g.dates ? ` <span style="font-weight:normal;font-size:12px;color:#666">(${g.dates})</span>` : ""}</h3>
        <table>
          <thead><tr><th>Period</th><th>Time</th><th>Food Plan</th><th>Alternative</th><th>Notes</th></tr></thead>
          <tbody>
            ${((g.meals ?? []) as any[]).map(m => `
              <tr>
                <td>${m.period ?? "-"}</td>
                <td>${m.time ?? "-"}</td>
                <td>${m.foodPlan ?? "-"}</td>
                <td>${m.alternative ?? "-"}</td>
                <td>${m.notes ?? "-"}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      `).join("")}

      ${ai.servingSize ? `<div class="card"><b>Serving Size:</b> ${ai.servingSize}</div>` : ""}

      ${importantNotes.length > 0 ? `
      <div class="card yellow">
        <h4>Important Notes</h4>
        <ul>${importantNotes.map(n => `<li>${n}</li>`).join("")}</ul>
      </div>` : ""}

      ${ai.supplements ? `<div class="card"><h4>Recommended Supplements</h4><p>${ai.supplements}</p></div>` : ""}
      ${ai.disclaimer ? `<p style="font-size:9px;color:#888;margin-top:20px">${ai.disclaimer}</p>` : ""}
    `;
  } else {
    // Fallback for non-AI plans: just show instructions
    body = `
      <div class="header">
        <h1>${plan.plan_name ?? "Diet Plan"}</h1>
        <p>For ${clientName}</p>
      </div>
      ${plan.instructions ? `<div class="intro"><p>${plan.instructions.replace(/\n/g, "<br/>")}</p></div>` : ""}
    `;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${plan.plan_name ?? "Diet Plan"}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',sans-serif;padding:25px 35px;color:#334155;font-size:11px;line-height:1.5}
    .header{text-align:center;margin-bottom:20px;border-bottom:2px solid #00a896;padding-bottom:15px}
    .header h1{color:#00a896;font-size:20px;margin-bottom:5px}
    .header p{color:#64748b;font-size:12px}
    .badge{background:#00a896;color:white;padding:2px 8px;border-radius:10px;font-size:10px;margin-left:6px}
    .badge-blue{background:#e3f2fd;color:#1976d2;padding:2px 6px;border-radius:10px;font-size:9px;margin-right:4px}
    .card{background:#f0fdff;border:1px solid #b3e5e0;border-radius:8px;padding:14px;margin-bottom:16px}
    .card.green{background:#f0fdf4;border-color:#bbf7d0}
    .card.yellow{background:#fefce8;border-color:#fde047}
    .card h3,.card h4{color:#0d7477;font-size:13px;margin-bottom:8px}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .intro{background:#f0fdff;border-left:4px solid #00a896;padding:12px;margin-bottom:16px;border-radius:4px;font-style:italic}
    .section{color:#00a896;font-size:14px;font-weight:bold;margin:20px 0 10px;border-bottom:1px solid #b3e5e0;padding-bottom:4px}
    table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:10px}
    th{background:#00a896;color:white;padding:7px;text-align:left}
    td{padding:7px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tr:nth-child(even){background:#f8fafc}
    ul{margin-left:18px}
    li{margin-bottom:4px}
    .footer{text-align:center;margin-top:25px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:9px;color:#94a3b8}
    @media print{body{padding:15px}}
  </style>
</head>
<body>
  ${body}
  <div class="footer">© ${new Date().getFullYear()} Dr. Malika Kabra Rathi — Personalized Nutrition Plan</div>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.focus();
    // Small delay to let styles render before triggering print
    setTimeout(() => w.print(), 400);
  }
}

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
                        onClick={() => openPlanAsPdf(plan, clientProfile)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF
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
        </div>
      )}
    </PageShell>
  );
}
