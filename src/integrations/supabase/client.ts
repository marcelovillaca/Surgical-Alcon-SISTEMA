import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// CLEANER ENV VAR HANDLING
const rawUrl = import.meta.env.VITE_SUPABASE_URL || "";
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

// TRIM ALL WHITESPACE - Vercel sometimes adds them invisibly
const SUPABASE_URL = rawUrl.trim();
const SUPABASE_PUBLISHABLE_KEY = rawKey.trim();

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error("CRITICAL: Supabase environment variables are missing!");
}

export const supabase = createClient<Database>(
  SUPABASE_URL || "https://placeholder.supabase.co", 
  SUPABASE_PUBLISHABLE_KEY || "placeholder-key", 
  {
    auth: {
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // Crucial for redirects
    }
  }
);