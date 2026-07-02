// /*
// Tujuan: Middleware Next.js lokal (tanpa proteksi auth Supabase).
// Caller: Next.js Routing Engine (tiap HTTP request)
// Dependensi: next/server
// Main Functions: middleware
// Side Effects: None
// */

import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

