// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// We pull the keys securely from the .env file instead of hardcoding them!
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);