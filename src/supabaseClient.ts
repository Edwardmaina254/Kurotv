// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

// Use the URL and the "anon" key from your screenshot
const supabaseUrl = 'https://qpcfmluwslfoiiszgoqi.supabase.co';
const supabaseKey = 'sb_publishable_zKvKPrWpbXaX7pY63q1Cdw_Bi1TG...'; // Copy the full string from your 'default' anon key

export const supabase = createClient(supabaseUrl, supabaseKey);