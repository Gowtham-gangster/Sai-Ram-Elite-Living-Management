import { createBrowserClient } from '@supabase/ssr';

/**
 * Supabase client for Browser / Client Components
 * Uses public publishable key only.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.'
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
