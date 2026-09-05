import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mmthyqbvcuilyjfmlscs.supabase.co";
const supabaseAnonKey = "sb_publishable_vtojQWPh-k8OuCrCPzOnJw_k9bnJ-fC";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
