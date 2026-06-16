import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { X, ChevronRight, ChevronLeft, Check, Loader2 } from "lucide-react";
import type { Client, ProgressEntry } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tiny reusable widgets (no external deps beyond what the PWA already uses)
// ---------------------------------------------------------------------------

function RatingButtons({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`h-9 w-9 rounded-xl text-sm font-semibold transition-colors ${
            value === n
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/15"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function SegmentedPicker({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/15"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const toggle = (o: string) =>
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => toggle(o)}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
            value.includes(o)
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-primary/15"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step = "1",
  suffix,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : parseFloat(e.target.value))}
        className="h-10 w-28 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branch detection
// ---------------------------------------------------------------------------
function getClientBranch(profile: Client): "female" | "male" | "child" {
  if (profile.date_of_birth) {
    const age = new Date().getFullYear() - new Date(profile.date_of_birth).getFullYear();
    if (age < 18) return "child";
  }
  if (profile.gender === "female") return "female";
  if (profile.gender === "male") return "male";
  return "female"; // default
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------
type FormState = Omit<ProgressEntry, "id" | "client_id" | "created_at" | "updated_at">;

function emptyForm(today: string): FormState {
  return {
    entry_date: today,
    weight_kg: null, height_cm: null,
    sleep_quality_rating: null, digestion_rating: null, energy_rating: null,
    fatigue_rating: null, skin_rating: null, hair_rating: null,
    acidity_rating: null, bloating_rating: null, constipation_rating: null,
    sleep_hours: null, water_intake: null, activity_level: null,
    screen_time_hrs: null, stress_rating: null,
    blood_parameters: [], inflammation_concerns: null,
    meals_per_day: null, packaged_food_frequency: null,
    medications: [],
    periods_status: null, period_flow: [], period_pain_severity: null, pms_symptoms: [],
    libido_rating: null, testosterone_status: null,
    stamina_rating: null, attention_rating: null, memory_rating: null,
    focus_rating: null, appetite: null,
    notes: null,
  };
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface Props {
  clientProfile: Client;
  onClose: () => void;
  onSaved: () => void;
}

export function HealthCheckinForm({ clientProfile, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FormState>(emptyForm(today));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const branch = getClientBranch(clientProfile);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("client_progress_entries").insert({
        ...form,
        client_id: clientProfile.id,
        blood_parameters: form.blood_parameters?.length ? form.blood_parameters : null,
        period_flow: form.period_flow?.length ? form.period_flow : null,
        pms_symptoms: form.pms_symptoms?.length ? form.pms_symptoms : null,
        medications: form.medications?.length ? form.medications : null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      onSaved();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    // Step 0: Body + Lifestyle
    {
      title: "Body & Daily Habits",
      content: (
        <div className="space-y-6">
          <FieldRow label="Date">
            <input
              type="date"
              value={form.entry_date}
              max={today}
              onChange={(e) => set("entry_date", e.target.value)}
              className="h-10 rounded-xl border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </FieldRow>
          <FieldRow label="Weight">
            <NumInput value={form.weight_kg} onChange={(v) => set("weight_kg", v)} min={2} max={300} step="0.1" suffix="kg" />
          </FieldRow>
          <FieldRow label="Sleep per night">
            <NumInput value={form.sleep_hours} onChange={(v) => set("sleep_hours", v)} min={3} max={14} step="0.5" suffix="hrs" />
          </FieldRow>
          <FieldRow label="Water intake">
            <SegmentedPicker
              options={[{ value: "<1L", label: "<1 L" }, { value: "1-2L", label: "1–2 L" }, { value: "2-3L", label: "2–3 L" }, { value: "3L+", label: "3 L+" }]}
              value={form.water_intake}
              onChange={(v) => set("water_intake", v)}
            />
          </FieldRow>
          <FieldRow label="Activity level">
            <SegmentedPicker
              options={[{ value: "sedentary", label: "Sedentary" }, { value: "light", label: "Light" }, { value: "moderate", label: "Moderate" }, { value: "active", label: "Active" }, { value: "very_active", label: "Very active" }]}
              value={form.activity_level}
              onChange={(v) => set("activity_level", v)}
            />
          </FieldRow>
          <FieldRow label="Screen time">
            <NumInput value={form.screen_time_hrs} onChange={(v) => set("screen_time_hrs", v)} min={0} max={24} step="0.5" suffix="hrs/day" />
          </FieldRow>
        </div>
      ),
    },
    // Step 1: Symptom ratings
    {
      title: "How are you feeling?",
      content: (
        <div className="space-y-5">
          {([
            ["sleep_quality_rating", "Sleep quality",    "5 = sleeping very well"],
            ["digestion_rating",     "Digestion",        "5 = excellent digestion"],
            ["energy_rating",        "Daily energy",     "5 = high energy all day"],
            ["fatigue_rating",       "Fatigue level",    "1 = always tired · 5 = rarely tired"],
            ["skin_rating",          "Skin health",      "5 = clear, healthy skin"],
            ["hair_rating",          "Hair health",      "5 = strong, healthy hair"],
            ["acidity_rating",        "Acidity severity",     "5 = very severe acidity"],
            ["bloating_rating",       "Bloating severity",    "5 = very severe bloating"],
            ["constipation_rating",   "Constipation severity","5 = very severe constipation"],
          ] as [keyof FormState, string, string][]).map(([k, label, hint]) => (
            <FieldRow key={k} label={label} hint={hint}>
              <RatingButtons value={form[k] as number | null} onChange={(n) => set(k, n)} />
            </FieldRow>
          ))}
        </div>
      ),
    },
    // Step 2: Health details
    {
      title: "Health Details",
      content: (
        <div className="space-y-6">
          <FieldRow label="Stress level" hint="1 = very low · 5 = very high">
            <RatingButtons value={form.stress_rating} onChange={(n) => set("stress_rating", n)} />
          </FieldRow>
          <FieldRow label="Meals per day">
            <NumInput value={form.meals_per_day} onChange={(v) => set("meals_per_day", v ? Math.round(v) : null)} min={1} max={8} />
          </FieldRow>
          <FieldRow label="Blood markers (select any concerns)">
            <MultiChips
              options={["Haemoglobin", "HbA1c", "Fasting glucose", "Cholesterol", "LDL", "HDL", "Triglycerides", "TSH", "Vitamin D", "Vitamin B12", "Iron/Ferritin", "Uric acid", "CRP"]}
              value={form.blood_parameters ?? []}
              onChange={(v) => set("blood_parameters", v)}
            />
          </FieldRow>
          <FieldRow label="Inflammation concerns?">
            <SegmentedPicker
              options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
              value={form.inflammation_concerns === null ? null : form.inflammation_concerns ? "yes" : "no"}
              onChange={(v) => set("inflammation_concerns", v === "yes")}
            />
          </FieldRow>
        </div>
      ),
    },
    // Step 3: Branch-specific
    {
      title: branch === "female" ? "Women's Health" : branch === "male" ? "Men's Health" : "Child's Health",
      content: branch === "female" ? (
        <div className="space-y-5">
          <FieldRow label="Periods status">
            <SegmentedPicker
              options={[{ value: "regular", label: "Regular" }, { value: "irregular", label: "Irregular" }, { value: "absent", label: "Absent" }, { value: "menopausal", label: "Menopausal" }]}
              value={form.periods_status}
              onChange={(v) => set("periods_status", v)}
            />
          </FieldRow>
          <FieldRow label="Flow">
            <MultiChips
              options={["light", "moderate", "heavy", "very heavy", "clots"]}
              value={form.period_flow ?? []}
              onChange={(v) => set("period_flow", v)}
            />
          </FieldRow>
          <FieldRow label="Pain severity" hint="1 = none · 5 = severe">
            <RatingButtons value={form.period_pain_severity} onChange={(n) => set("period_pain_severity", n)} />
          </FieldRow>
          <FieldRow label="PMS symptoms">
            <MultiChips
              options={["mood swings", "cramps", "bloating", "breast tenderness", "headaches", "cravings", "fatigue"]}
              value={form.pms_symptoms ?? []}
              onChange={(v) => set("pms_symptoms", v)}
            />
          </FieldRow>
        </div>
      ) : branch === "male" ? (
        <div className="space-y-5">
          <FieldRow label="Libido" hint="1 = very low · 5 = excellent">
            <RatingButtons value={form.libido_rating} onChange={(n) => set("libido_rating", n)} />
          </FieldRow>
          <FieldRow label="Testosterone status">
            <SegmentedPicker
              options={[{ value: "not_tested", label: "Not tested" }, { value: "normal", label: "Normal" }, { value: "low", label: "Low" }, { value: "high", label: "High" }, { value: "unsure", label: "Unsure" }]}
              value={form.testosterone_status}
              onChange={(v) => set("testosterone_status", v)}
            />
          </FieldRow>
        </div>
      ) : (
        <div className="space-y-5">
          {([["stamina_rating", "Stamina"], ["attention_rating", "Attention span"], ["memory_rating", "Memory"], ["focus_rating", "Focus"]] as [keyof FormState, string][]).map(([k, label]) => (
            <FieldRow key={k} label={label} hint="1 = very poor · 5 = excellent">
              <RatingButtons value={form[k] as number | null} onChange={(n) => set(k, n)} />
            </FieldRow>
          ))}
          <FieldRow label="Appetite">
            <SegmentedPicker
              options={[{ value: "poor", label: "Poor" }, { value: "variable", label: "Variable" }, { value: "good", label: "Good" }, { value: "very_good", label: "Very good" }, { value: "excessive", label: "Excessive" }]}
              value={form.appetite}
              onChange={(v) => set("appetite", v)}
            />
          </FieldRow>
        </div>
      ),
    },
    // Step 4: Notes
    {
      title: "Anything else?",
      content: (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Optional — share anything else you'd like your nutritionist to know.</p>
          <textarea
            rows={5}
            maxLength={500}
            placeholder="How are you feeling overall? Any changes since last check-in?"
            value={form.notes ?? ""}
            onChange={(e) => set("notes", e.target.value || null)}
            className="w-full rounded-xl border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          />
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Step {step + 1} of {steps.length}</p>
          <h2 className="text-base font-semibold text-foreground">{current.title}</h2>
        </div>
        <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:bg-muted">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div className="h-1 bg-primary transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {current.content}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t bg-background px-4 py-3">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="flex items-center gap-1 rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Submit Check-in
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
