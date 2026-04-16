import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Appointment, DietPlan, ClientFeedback } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import { SummaryCard, EmptyState, LoadingSpinner } from "@/components/ui-cards";
import { Scale, Utensils, Calendar, MessageSquare, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<ClientFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const fetchData = async () => {
      const [planRes, apptRes, feedbackRes] = await Promise.all([
        supabase
          .from("diet_plans")
          .select("*")
          .eq("client_id", clientProfile.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("*")
          .eq("client_id", clientProfile.id)
          .gte("appointment_date", new Date().toISOString().split("T")[0])
          .order("appointment_date", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("client_feedback")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setActivePlan(planRes.data);
      setNextAppointment(apptRes.data);
      setLatestFeedback(feedbackRes.data);
      setLoading(false);
    };
    fetchData();
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner />;

  const firstName = clientProfile?.name?.split(" ")[0] ?? "there";

  return (
    <PageShell title="Dashboard">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold text-foreground">
          Hello, {firstName} <Sparkles className="mb-1 inline h-5 w-5 text-primary" />
        </h2>
        <p className="text-sm text-muted-foreground">Here's your health snapshot</p>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <SummaryCard
            icon={<Scale className="h-4 w-4" />}
            label="Weight"
            value={clientProfile?.weight ? `${clientProfile.weight} kg` : null}
            subtitle={clientProfile?.goal ?? undefined}
            variant="primary"
          />
          <SummaryCard
            icon={<Utensils className="h-4 w-4" />}
            label="Active Plan"
            value={activePlan?.plan_name ?? "None"}
            subtitle={activePlan?.status ?? undefined}
          />
          <SummaryCard
            icon={<Calendar className="h-4 w-4" />}
            label="Next Appointment"
            value={
              nextAppointment
                ? new Date(nextAppointment.appointment_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "None"
            }
            subtitle={nextAppointment?.appointment_time ?? undefined}
          />
          <SummaryCard
            icon={<MessageSquare className="h-4 w-4" />}
            label="Latest Feedback"
            value={latestFeedback?.feedback_text?.slice(0, 30) ?? "None"}
            subtitle={
              latestFeedback
                ? new Date(latestFeedback.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : undefined
            }
          />
        </div>
      )}
    </PageShell>
  );
}
