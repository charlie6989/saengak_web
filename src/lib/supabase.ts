
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase Config Error:', {
        url: supabaseUrl ? 'Defined' : 'Missing',
        key: supabaseAnonKey ? 'Defined' : 'Missing',
        allKeys: Object.keys(import.meta.env).filter(k => k.startsWith('VITE_'))
    });
    throw new Error(`Missing Supabase environment variables. URL: ${supabaseUrl ? 'OK' : 'MISSING'}, Key: ${supabaseAnonKey ? 'OK' : 'MISSING'}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getFunctionUrl = (functionName: string) => {
    return `${supabaseUrl}/functions/v1/${functionName}`;
};
