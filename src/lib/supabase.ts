import { createClient } from '@supabase/supabase-js'

// Vite ONLY sees variables starting with VITE_ via import.meta.env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    // This is the error you are seeing! 
    // It means the two lines above came back empty.
    throw new Error("Missing Supabase environment variables! Check your Railway variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)