// /*
// Tujuan: Route Handler CRUD utama (GET list, POST create) untuk data Produk.
// Caller: Frontend Client Components
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, drizzle-orm
// Main Functions: GET, POST
// Side Effects: Menulis dan membaca tabel products di SQLite lokal.
// */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getMockUser } from "@/lib/auth";
import { eq, and, like, or } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";

  const conditions = [eq(products.user_id, user.id)];

  if (search) {
    conditions.push(
      or(
        like(products.product_name, `%${search}%`),
        like(products.shop_name, `%${search}%`)
      ) as any
    );
  }

  if (category) {
    conditions.push(eq(products.category, category));
  }

  if (status) {
    conditions.push(eq(products.status, status));
  }

  try {
    const list = await db
      .select()
      .from(products)
      .where(and(...conditions));
    return NextResponse.json(list);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.product_name || !body.product_name.trim()) {
      return NextResponse.json({ error: "Nama produk wajib diisi." }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0];
    const productId = body.product_id?.trim() || crypto.randomUUID();

    const newProduct = {
      product_id: productId,
      user_id: user.id,
      product_name: body.product_name.trim(),
      shop_name: body.shop_name?.trim() || null,
      shop_code: body.shop_code?.trim() || null,
      category: body.category?.trim() || "Umum",
      stock_status: body.stock_status || "available",
      date_added: today,
      is_collaboration: body.is_collaboration ?? false,
      collab_target_count: body.collab_target_count || null,
      collab_deadline: body.collab_deadline || null,
      collab_start_date: body.collab_start_date || null,
      status: body.status || "active",
      commission_rate: body.commission_rate !== undefined && body.commission_rate !== null ? parseFloat(body.commission_rate) : null,
      avg_price: body.avg_price !== undefined && body.avg_price !== null ? parseFloat(body.avg_price) : null,
      stock_updated_at: today,
      last_oos_started_at: body.last_oos_started_at || null,
      last_oos_ended_at: body.last_oos_ended_at || null,
      pre_oos_classification: body.pre_oos_classification || null,
      notes: body.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.insert(products).values(newProduct);

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
