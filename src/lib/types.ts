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
  start_date: string | null;
  end_date: string | null;
  instructions: string | null;
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
  created_at: string;
}

export interface ClientPortalUser {
  id: string;
  user_id: string;
  client_id: string;
  created_at: string;
}
