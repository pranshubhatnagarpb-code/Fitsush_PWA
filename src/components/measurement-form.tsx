import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { X, Plus } from "lucide-react";

type Field = {
  key:
    | "weight"
    | "body_fat_percentage"
    | "waist"
    | "hip"
    | "chest"
    | "thigh"
    | "arm"
    | "neck";
  label: string;
  unit: string;
  step: string;
};

const FIELDS: Field[] = [
  { key: "weight", label: "Weight", unit: "kg", step: "0.1" },
  { key: "body_fat_percentage", label: "Body Fat", unit: "%", step: "0.1" },
  { key: "waist", label: "Waist", unit: "cm", step: "0.1" },
  { key: "hip", label: "Hip", unit: "cm", step: "0.1" },
  { key: "chest", label: "Chest", unit: "cm", step: "0.1" },
  { key: "thigh", label: "Thigh", unit: "cm", step: "0.1" },
  { key: "arm", label: "Arm", unit: "cm", step: "0.1" },
  { key: "neck", label: "Neck", unit: "cm", step: "0.1" },
];

interface Props {
  clientId: string;
  heightCm: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function MeasurementForm({ clientId, heightCm, onClose, onSaved }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setVal = (k: string, v: string) =>
    setValues((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const numeric: Record<string, number | null> = {};
    let anyValue = false;
    for (const f of FIELDS) {
      const raw = values[f.key]?.trim();
      if (raw === undefined || raw === "") {
        numeric[f.key] = null;
      } else {
        const n = Number(raw);
        if (Number.isNaN(n) || n < 0 || n > 1000) {
          setError(`Invalid ${f.label}`);
          return;
        }
        numeric[f.key] = n;
        anyValue = true;
      }
    }
    if (!anyValue) {
      setError("Enter at least one measurement");
      return;
    }

    // Auto-derive BMI when both weight and height (from profile) are present
    let bmi: number | null = null;
    if (numeric.weight && heightCm && heightCm > 0) {
      const m = heightCm / 100;
      bmi = Math.round((numeric.weight / (m * m)) * 10) / 10;
    }

    setSaving(true);
    const { error: insErr } = await supabase.from("client_measurements").insert({
      client_id: clientId,
      measurement_date: date,
      ...numeric,
      bmi,
      measurement_notes: notes.trim() || null,
    });
    setSaving(false);

    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            Add Measurement
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Date
            </label>
            <input
              type="date"
              value={date}
              max={today}
              required
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {f.label} <span className="lowercase">({f.unit})</span>
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step={f.step}
                  min="0"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setVal(f.key, e.target.value)}
                  placeholder="—"
                  className="w-full rounded-xl border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ))}
          </div>

          {heightCm ? (
            <p className="text-xs text-muted-foreground">
              BMI is auto-calculated from your weight and your profile height ({heightCm} cm).
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Add your height in your profile to auto-calculate BMI.
            </p>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notes (optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="How are you feeling?"
              className="w-full rounded-xl border bg-card px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
