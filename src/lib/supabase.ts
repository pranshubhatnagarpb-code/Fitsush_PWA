import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zkmfghujpmpggnzfkyvw.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbWZnaHVqcG1wZ2duemZreXZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNDAzNjQsImV4cCI6MjA5MTgxNjM2NH0.NKB6AuzJat0GshkGyclWfSRjVvPQRomSr6HoVdMoExg";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
