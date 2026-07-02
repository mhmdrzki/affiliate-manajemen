// /*
// Tujuan: Menyediakan instansiasi server-side Supabase Client yang di-mock untuk lokal tanpa login.
// Caller: Next.js Server Components, Actions, API Routes
// Dependensi: None
// Main Functions: createClient
// Side Effects: None
// */

export async function createClient() {
  const mockUser = {
    id: '00000000-0000-0000-0000-000000000000',
    email: 'local@domain.com',
    user_metadata: { display_name: 'Local User' }
  };

  return {
    auth: {
      getUser: async () => ({
        data: { user: mockUser },
        error: null,
      }),
      getSession: async () => ({
        data: { session: { user: mockUser } },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      signInWithPassword: async () => ({ data: { user: mockUser }, error: null }),
      signUp: async () => ({ data: { user: mockUser }, error: null }),
    },
    // Fallbacks just in case
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: null, error: new Error('Use Drizzle instead') }),
          order: () => ({ data: [], error: null })
        }),
        order: () => ({ data: [], error: null })
      })
    })
  } as any;
}

