import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env["SUPABASE_URL"] || "";
const supabaseAnonKey = process.env["SUPABASE_ANON_KEY"] || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Erro: SUPABASE_URL ou SUPABASE_ANON_KEY não definidos no .env");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
