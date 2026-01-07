
import { createClient } from '@supabase/supabase-js';

// let supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
// let supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

// HARDCODED FOR DEBUGGING - WILL REVERT AFTER TEST
let supabaseUrl = "https://vcswjiyxqhhdpvmsamil.supabase.co";
let supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjc3dqaXl4cWhoZHB2bXNhbWlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMzAxMzQsImV4cCI6MjA3NDcwNjEzNH0.eFzpsvWl0vuTudXSTntbczZj1ug13bAJbDPYUZ75VIQ";

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Config Missing (Non-blocking debug mode):', {
        url: supabaseUrl ? 'Defined' : 'Missing',
        key: supabaseAnonKey ? 'Defined' : 'Missing',
        availableKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
    });
    // Fallback to empty strings to allow app to render debug info
    if (!supabaseUrl) supabaseUrl = 'https://placeholder.supabase.co';
    if (!supabaseAnonKey) supabaseAnonKey = 'placeholder';
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getFunctionUrl = (functionName: string) => {
    return `${supabaseUrl}/functions/v1/${functionName}`;
};
