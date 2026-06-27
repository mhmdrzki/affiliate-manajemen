// /*
// Tujuan: Menyediakan instansiasi client-side Supabase Client untuk environment browser.
// Caller: Komponen React Client (useClient, dll)
// Dependensi: @supabase/ssr, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// Main Functions: createClient
// Side Effects: Berkomunikasi dengan Supabase API via HTTP.
// */

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
