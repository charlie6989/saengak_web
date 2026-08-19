
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_PUBLIC_SUPABASE_URL;
const supabasePublicKey =
    import.meta.env.VITE_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey);

// Keep the public storefront quiet while the dedicated Shopify Online Store is
// locked. These flags are intentionally opt-in: unlock Shopify first, verify
// real products, then enable the matching Vercel production variable.
export const isShopifyStorefrontEnabled =
    isSupabaseConfigured && import.meta.env.VITE_PUBLIC_SHOPIFY_STOREFRONT_ENABLED === 'true';
export const isShopifyTagCatalogEnabled =
    isShopifyStorefrontEnabled && import.meta.env.VITE_PUBLIC_SHOPIFY_TAGS_ENABLED === 'true';

// Keep the public site renderable while membership infrastructure is being
// configured. Calls made through this disabled client fail normally instead of
// crashing every route during module evaluation.
export const supabase = createClient(
    supabaseUrl || 'https://disabled.invalid',
    supabasePublicKey || 'disabled-public-key',
    isSupabaseConfigured ? undefined : { auth: { persistSession: false, autoRefreshToken: false } }
);

export const getFunctionUrl = (functionName: string) => {
    if (!isSupabaseConfigured) {
        throw new Error(`Supabase function ${functionName} is unavailable until public environment variables are configured`);
    }
    return `${supabaseUrl}/functions/v1/${functionName}`;
};

export const getFunctionHeaders = (extraHeaders: Record<string, string> = {}) => {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        apikey: supabasePublicKey || '',
        ...extraHeaders,
    };

    // Legacy anon keys are JWTs and still need the Bearer header on functions
    // deployed with verify_jwt=true. New sb_publishable keys must not be sent as Bearer.
    if (supabasePublicKey?.startsWith('eyJ')) {
        headers.Authorization = `Bearer ${supabasePublicKey}`;
    }

    return headers;
};
