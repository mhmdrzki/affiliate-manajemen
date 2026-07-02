// /*
// Tujuan: Menyediakan instansiasi client-side Supabase Client yang di-mock untuk lokal tanpa login.
// Caller: Komponen React Client (useClient, dll)
// Dependensi: None
// Main Functions: createClient
// Side Effects: None
// */

export function createClient() {
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
    }
  } as any;
}

