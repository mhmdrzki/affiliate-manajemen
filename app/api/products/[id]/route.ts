// /*
// Tujuan: Route Handler CRUD spesifik per produk (GET detail, PATCH update, DELETE) untuk data Produk.
// Caller: Frontend Client Components
// Dependensi: lib/db/index.ts, lib/db/schema.ts, lib/auth.ts, drizzle-orm
// Main Functions: GET, PATCH, DELETE
// Side Effects: Membaca, memperbarui, dan menghapus data products di SQLite lokal.
// */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { getMockUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [product] = await db
      .select()
      .from(products)
      .where(and(eq(products.product_id, id), eq(products.user_id, user.id)));

    if (!product) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const [existing] = await db
      .select()
      .from(products)
      .where(and(eq(products.product_id, id), eq(products.user_id, user.id)));

    if (!existing) {
      return NextResponse.json({ error: "Produk tidak ditemukan." }, { status: 404 });
    }

    const updateFields: any = {
      updated_at: new Date().toISOString(),
    };

    if (body.product_name !== undefined) updateFields.product_name = body.product_name;
    if (body.shop_name !== undefined) updateFields.shop_name = body.shop_name;
    if (body.shop_code !== undefined) updateFields.shop_code = body.shop_code;
    if (body.category !== undefined) updateFields.category = body.category;
    if (body.is_collaboration !== undefined) updateFields.is_collaboration = body.is_collaboration;
    if (body.collab_target_count !== undefined) updateFields.collab_target_count = body.collab_target_count;
    if (body.collab_deadline !== undefined) updateFields.collab_deadline = body.collab_deadline;
    if (body.collab_start_date !== undefined) updateFields.collab_start_date = body.collab_start_date;
    if (body.status !== undefined) updateFields.status = body.status;
    if (body.commission_rate !== undefined) updateFields.commission_rate = body.commission_rate !== null ? parseFloat(body.commission_rate) : null;
    if (body.avg_price !== undefined) updateFields.avg_price = body.avg_price !== null ? parseFloat(body.avg_price) : null;
    if (body.notes !== undefined) updateFields.notes = body.notes;

    await db
      .update(products)
      .set(updateFields)
      .where(and(eq(products.product_id, id), eq(products.user_id, user.id)));

    return NextResponse.json({ success: true, message: "Produk berhasil diperbarui." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getMockUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await db
      .delete(products)
      .where(and(eq(products.product_id, id), eq(products.user_id, user.id)));

    return NextResponse.json({ success: true, message: "Produk berhasil dihapus." });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
