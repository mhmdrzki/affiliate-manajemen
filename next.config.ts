/**
 * Tujuan: Konfigurasi utama aplikasi Next.js, termasuk limitasi ukuran server actions.
 * Caller: Next.js framework build & runtime.
 * Dependensi: -
 * Main Functions: default export nextConfig.
 * Side Effects: -
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;

