// /*
// Tujuan: Middleware Next.js untuk merefresh sesi Supabase token dan melindungi rute terproteksi (dashboard).
// Caller: Next.js Routing Engine (tiap HTTP request)
// Dependensi: @supabase/ssr, next/server
// Main Functions: middleware
// Side Effects: Membaca/menulis sesi cookies, mengalihkan (redirect) rute request.
// */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Mendapatkan data user untuk memvalidasi token sesi
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isApiRoute = pathname.startsWith('/api');
  const isStaticFile = pathname.includes('.') || pathname.startsWith('/_next');

  // Proteksi rute: jika belum login, arahkan ke login (kecuali halaman auth, file statis, atau API)
  if (!user && !isAuthPage && !isStaticFile && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Jika sudah login, cegah akses kembali ke halaman login/register
  if (user && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
