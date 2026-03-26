import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// DIAGNOSTIC - LOG VARIABLES (will show up in browser console but safely)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("CRITICAL: Supabase environment variables are missing!");
} else {
  console.log("Supabase URL initialized:", SUPABASE_URL.substring(0, 10) + "...");
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "https://placeholder.supabase.co", 
  SUPABASE_PUBLISHABLE_KEY || "placeholder-key", 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);