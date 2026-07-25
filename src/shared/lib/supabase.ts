import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const isPlaceholder = (val: string) => {
  return (
    !val ||
    val.includes("your-supabase-") ||
    val.includes("placeholder") ||
    val === ""
  );
};

export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

// Only initialize if properly configured to prevent throw during startup
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.log(
    "Nestor Database status: Running in local database mode (persisted via LocalStorage)."
  );
} else {
  console.log(
    "Nestor Database status: Connected to Supabase online cloud database."
  );
}
