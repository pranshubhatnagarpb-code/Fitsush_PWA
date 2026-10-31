import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Appointment, DietPlan, ClientFeedback, BodyMeasurement } from "@/lib/types";
import { PageShell } from "@/components/app-shell";
import {
  PageHero,
  HeroProgress,
  HERO_BUTTON_PRIMARY,
  SectionCard,
  LoadingSpinner,
  CHIP_TINT,
  MICRO_LABEL,
  formatShortDate,
} from "@/components/ui-cards";
import { planDayProgress, planNotes } from "@/lib/planDays";
import {
  Sparkles,
  ArrowRight,
  StickyNote,
  CalendarClock,
  MessageSquare,
  Quote,
  ChevronDown,
  Scale,
  Utensils,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

const NOTES_PREVIEW = 4;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(t: string | null): string | null {
  if (!t) return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]));
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function DashboardPage() {
  const { clientProfile, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activePlan, setActivePlan] = useState<DietPlan | null>(null);
  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);
  const [latestFeedback, setLatestFeedback] = useState<ClientFeedback | null>(null);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAllNotes, setShowAllNotes] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!clientProfile) return;
    const fetchData = async () => {
      const [planRes, apptRes, feedbackRes, measurementRes] = await Promise.all([
        // Published plans first, like the Diet page.
        supabase
          .from("diet_plans")
          .select("*")
          .eq("client_id", clientProfile.id)
          .eq("status", "active")
          .order("is_published", { ascending: false, nullsFirst: false })
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
        supabase
          .from("body_measurements")
          .select("*")
          .eq("client_id", clientProfile.id)
          .order("measurement_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setActivePlan(planRes.data);
      setNextAppointment(apptRes.data);
      setLatestFeedback(feedbackRes.data);
      setLatestMeasurement(measurementRes.data as BodyMeasurement | null);
      setLoading(false);
    };
    fetchData();
  }, [clientProfile]);

  if (authLoading || !isAuthenticated) return <LoadingSpinner fullScreen />;

  const firstName = clientProfile?.name?.split(" ")[0] ?? "there";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const progress = activePlan ? planDayProgress(activePlan) : null;
  const notes = activePlan ? planNotes(activePlan) : [];
  const visibleNotes = showAllNotes ? notes : notes.slice(0, NOTES_PREVIEW);
  const weight = latestMeasurement?.weight ?? clientProfile?.weight ?? null;

  return (
    <PageShell title="Home">
      <div className="space-y-4">
        <PageHero
          eyebrow={today}
          title={
            <>
              {greeting()}, {firstName} <Sparkles className="mb-1 inline h-5 w-5 text-hero-glow" />
            </>
          }
          subtitle="Here's your health snapshot"
        >
          {loading ? null : activePlan ? (
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/75">Your current plan</p>
              <p className="mt-0.5 font-display text-base font-bold leading-snug">
                {activePlan.plan_name ?? "Diet Plan"}
              </p>
              {progress && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs text-white/85">
                    Day {progress.day}
                    {progress.total ? ` of ${progress.total}` : ""}
                  </p>
                  {progress.total ? <HeroProgress pct={progress.pct} /> : null}
                </div>
              )}
              <Link to="/diet-plan" className={`mt-4 ${HERO_BUTTON_PRIMARY}`}>
                View today's meals <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/85 ring-1 ring-white/15 backdrop-blur-sm">
              <Utensils className="mb-1.5 h-4 w-4" />
              Your nutritionist hasn't shared a diet plan yet. It'll show up here once it's ready.
            </div>
          )}
        </PageHero>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {weight !== null && (
              <Link
                to="/progress"
                className="flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-sm transition-transform active:scale-[0.98]"
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${CHIP_TINT.primary}`}>
                  <Scale className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={MICRO_LABEL}>Latest weight</p>
                  <p className="font-display text-lg font-bold text-foreground">
                    {weight} <span className="text-sm font-medium text-muted-foreground">kg</span>
                  </p>
                </div>
                {latestMeasurement?.measurement_date && (
                  <span className="text-xs text-muted-foreground">{formatShortDate(latestMeasurement.measurement_date)}</span>
                )}
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            )}

            {notes.length > 0 && (
              <SectionCard
                icon={<StickyNote className="h-4 w-4" />}
                iconClassName={CHIP_TINT.notes}
                title="Important notes"
                subtitle="From your current plan"
              >
                <ol className="space-y-3">
                  {visibleNotes.map((n, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <p className="pt-0.5 text-sm leading-relaxed text-foreground">{n}</p>
                    </li>
                  ))}
                </ol>
                {notes.length > NOTES_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllNotes((v) => !v)}
                    className="mt-3 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-primary transition-transform active:scale-95"
                  >
                    {showAllNotes ? "Show less" : `Show all ${notes.length}`}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAllNotes ? "rotate-180" : ""}`} />
                  </button>
                )}
              </SectionCard>
            )}

            <SectionCard
              icon={<CalendarClock className="h-4 w-4" />}
              iconClassName={CHIP_TINT.info}
              title="Next appointment"
            >
              {nextAppointment ? (
                <div className="flex items-center gap-4">
                  <div className="w-16 shrink-0 overflow-hidden rounded-2xl border bg-card text-center shadow-sm">
                    <div className="bg-primary py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString("en-IN", { month: "short" })}
                    </div>
                    <div className="py-1.5 font-display text-2xl font-bold text-foreground">
                      {new Date(nextAppointment.appointment_date).getDate()}
                    </div>
                  </div>
                  <div>
                    <p className="font-display text-base font-bold text-foreground">
                      {new Date(nextAppointment.appointment_date).toLocaleDateString("en-IN", { weekday: "long" })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatTime(nextAppointment.appointment_time) ?? "Time to be confirmed"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming appointments scheduled.</p>
              )}
            </SectionCard>

            <SectionCard
              icon={<MessageSquare className="h-4 w-4" />}
              iconClassName={CHIP_TINT.success}
              title="Latest feedback"
              subtitle={latestFeedback ? `From your nutritionist · ${formatShortDate(latestFeedback.created_at)}` : undefined}
            >
              {latestFeedback?.feedback_text ? (
                <FeedbackQuote text={latestFeedback.feedback_text} />
              ) : (
                <p className="text-sm text-muted-foreground">No feedback yet.</p>
              )}
            </SectionCard>
          </>
        )}
      </div>
    </PageShell>
  );
}

function FeedbackQuote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 220;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-muted/50 py-4 pl-5 pr-4">
      <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary to-hero-glow" />
      <Quote className="absolute right-3 top-3 h-8 w-8 text-primary/10" />
      <p className={`relative whitespace-pre-line text-sm leading-relaxed text-foreground ${!expanded && long ? "line-clamp-4" : ""}`}>
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 text-xs font-semibold text-primary"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
