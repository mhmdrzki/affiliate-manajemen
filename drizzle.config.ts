// /*
// Tujuan: Konfigurasi Drizzle Kit untuk database SQLite lokal.
// Caller: Drizzle CLI
// Dependensi: None
// Main Functions: Configures schemas, migration output directory, and SQLite connection path.
// Side Effects: None
// */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'local.db',
  },
});
