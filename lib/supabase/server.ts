// /*
// Tujuan: Menyediakan instansiasi server-side Supabase Client untuk Server Components, Server Actions, dan Route Handlers.
// Caller: Next.js Server Components, Actions, API Routes
// Dependensi: @supabase/ssr, next/headers, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
// Main Functions: createClient
// Side Effects: Membaca/menulis HTTP cookies, berkomunikasi dengan Supabase API.
// */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Abaikan jika dipanggil dari Server Component yang bersifat read-only
          }
        },
      },
    }
  );
}
