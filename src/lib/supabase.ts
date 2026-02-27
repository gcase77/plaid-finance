import { createClient } from "@supabase/supabase-js";

declare const SUPABASE_URL: string;
declare const SUPABASE_PUBLISHABLE_KEY: string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
