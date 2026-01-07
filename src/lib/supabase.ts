
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

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
