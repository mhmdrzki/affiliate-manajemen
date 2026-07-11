// /*
// Tujuan: Konfigurasi Vitest untuk menjalankan testing lokal dengan dukungan path alias.
// Caller: Vitest CLI
// Dependensi: vitest/config
// Main Functions: default export
// Side Effects: None
// */

import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
