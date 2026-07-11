// /*
// Tujuan: Redirect rute root (/) ke rute Master Produk (/products).
// Caller: Route / (root path)
// Dependensi: lib/auth.ts, next/navigation
// Main Functions: DashboardHome
// Side Effects: Mengalihkan rute HTTP ke /products jika user login, atau /login jika belum terautentikasi.
// */

import { redirect } from "next/navigation";
import { getMockUser } from "@/lib/auth";

export default async function DashboardHome() {
  const user = await getMockUser();

  if (!user) {
    redirect("/login");
  }

  redirect("/products");
}
