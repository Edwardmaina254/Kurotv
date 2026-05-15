// src/lib/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Vite ONLY sees variables starting with VITE_ via import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    // This is the error you are seeing! 
    // It means the two lines above came back empty.
    throw new Error("Missing Supabase environment variables! Check your Railway variables.");
}

// Global caching to prevent Vite Hot Module Replacement (HMR) 
// from spinning up duplicate GoTrue instances during local dev.
declare global {
    // eslint-disable-next-line no-var
    var __supabaseClient: SupabaseClient | undefined
}

export const supabase = globalThis.__supabaseClient ?? createClient(supabaseUrl, supabaseAnonKey)

// If we are in local development mode, save the instance globally
if (import.meta.env.DEV) {
    globalThis.__supabaseClient = supabase
}