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
  bmi: number | null;
  notes: string | null;
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
