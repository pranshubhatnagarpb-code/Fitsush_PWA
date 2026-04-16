import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { DietPlan } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Utensils, CalendarDays, FileText } from "lucide-react";

export const Route = createFileRoute("/diet-plan")({
  component: DietPlanPage,
});

function DietPlanPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState<DietPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    supabase
      .from("diet_plans")
      .select("*")
      .eq("client_id", clientProfile.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        setPlan(data);
        setLoading(false);
      });
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  return (
    <PageShell title="My Diet Plan">
      {loading ? (
        <LoadingSpinner />
      ) : !plan ? (
        <EmptyState
          icon={<Utensils className="h-10 w-10" />}
          title="No active diet plan"
          description="Your nutritionist hasn't published a plan yet. Check back soon!"
        />
      ) : (
        <div className="space-y-4">
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
        </div>
      )}
    </PageShell>
  );
}
