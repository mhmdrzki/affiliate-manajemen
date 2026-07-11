// /*
// Tujuan: Menyediakan data user simulasi (mock) untuk environment lokal tanpa login/auth eksternal.
// Caller: Next.js Server Components, Actions, API Routes
// Dependensi: None
// Main Functions: getMockUser
// Side Effects: None
// */

export const mockUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: 'local@domain.com',
  user_metadata: { display_name: 'Local User' }
};

export async function getMockUser() {
  return mockUser;
}
