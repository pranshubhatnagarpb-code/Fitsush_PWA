import { useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase";
import { Plus } from "lucide-react";
import { BottomSheet, ErrorNote, BUTTON_PRIMARY, BUTTON_GHOST, INPUT, MICRO_LABEL } from "@/components/ui-cards";

type Field = {
  key:
    | "weight"
    | "body_fat_percent"
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
  { key: "body_fat_percent", label: "Body Fat", unit: "%", step: "0.1" },
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
    const { error: insErr } = await supabase.from("body_measurements").insert({
      client_id: clientId,
      measurement_date: date,
      ...numeric,
      bmi,
      notes: notes.trim() || null,
    });
    setSaving(false);

    if (insErr) {
      setError(insErr.message);
      return;
    }
    onSaved();
  };

  return (
    <BottomSheet title="Add measurement" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`mb-1.5 block ${MICRO_LABEL}`}>Date</label>
          <input
            type="date"
            value={date}
            max={today}
            required
            onChange={(e) => setDate(e.target.value)}
            className={INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key}>
              <label className={`mb-1.5 block ${MICRO_LABEL}`}>
                {f.label} <span className="normal-case tracking-normal">({f.unit})</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                min="0"
                value={values[f.key] ?? ""}
                onChange={(e) => setVal(f.key, e.target.value)}
                placeholder="—"
                className={INPUT}
              />
            </div>
          ))}
        </div>

        <p className="rounded-2xl bg-muted/60 px-4 py-2.5 text-xs text-muted-foreground">
          {heightCm
            ? `BMI is auto-calculated from your weight and your profile height (${heightCm} cm).`
            : "Add your height in your profile to auto-calculate BMI."}
        </p>

        <div>
          <label className={`mb-1.5 block ${MICRO_LABEL}`}>Notes (optional)</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="How are you feeling?"
            className={INPUT}
          />
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={`flex-1 ${BUTTON_GHOST}`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`flex-1 ${BUTTON_PRIMARY}`}>
            <Plus className="h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </BottomSheet>
  );
}
