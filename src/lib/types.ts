export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  gender: string | null;
  height: number | null;
  weight: number | null;
  date_of_birth: string | null;
  address: string | null;
  goal: string | null;
  is_active: boolean;
  health_conditions: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DietPlan {
  id: string;
  client_id: string;
  plan_name: string | null;
  status: string;
  is_published: boolean | null;
  published_at: string | null;
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
  week_number: number | null;
  // AI-generated plan data (full structured content)
  is_ai_generated: boolean | null;
  ai_plan_data: Record<string, unknown> | null;
  // legacy PDF fields stored directly on the plan row (used by current PMS)
  pdf_file_path: string | null;
  pdf_file_name: string | null;
  pdf_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  appointment_date: string;
  appointment_time: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientMeasurement {
  id: string;
  client_id: string;
  measurement_date: string;
  weight: number | null;
  bmi: number | null;
  body_fat_percentage: number | null;
  waist: number | null;
  hip: number | null;
  chest: number | null;
  thigh: number | null;
  arm: number | null;
  neck: number | null;
  measurement_notes: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientFeedback {
  id: string;
  client_id: string;
  feedback_text: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientDietPlanFile {
  id: string;
  client_id: string;
  diet_plan_id: string | null;
  file_path: string;
  file_name: string | null;
  is_published: boolean | null;
  published_at: string | null;
  created_at: string;
}

export interface ClientPortalUser {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
}

export interface ProgressEntry {
  id: string;
  client_id: string;
  entry_date: string;
  weight_kg: number | null;
  height_cm: number | null;
  sleep_quality_rating: number | null;
  digestion_rating: number | null;
  energy_rating: number | null;
  fatigue_rating: number | null;
  skin_rating: number | null;
  hair_rating: number | null;
  acidity_rating: number | null;
  bloating_rating: number | null;
  constipation_rating: number | null;
  sleep_hours: number | null;
  water_intake: string | null;
  activity_level: string | null;
  screen_time_hrs: number | null;
  stress_rating: number | null;
  blood_parameters: string[] | null;
  inflammation_concerns: boolean | null;
  meals_per_day: number | null;
  packaged_food_frequency: string | null;
  medications: { name: string; frequency?: string }[] | null;
  periods_status: string | null;
  period_flow: string[] | null;
  period_pain_severity: number | null;
  pms_symptoms: string[] | null;
  libido_rating: number | null;
  testosterone_status: string | null;
  stamina_rating: number | null;
  attention_rating: number | null;
  memory_rating: number | null;
  focus_rating: number | null;
  appetite: string | null;
  breastfed: boolean | null;
  breastfeeding_duration_months: number | null;
  formula_fed: boolean | null;
  solids_start_age_months: number | null;
  feeding_difficulties: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientBloodReport {
  id: string;
  client_id: string;
  report_date: string | null;
  extracted_data: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
