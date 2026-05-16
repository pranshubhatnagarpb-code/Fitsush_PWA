import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://qaaqpizwpniprtdzredy.supabase.co";
const supabaseAnonKey = "sb_publishable_lDw94z7bp-hl105_UZib9Q_A8Wr0HKg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
