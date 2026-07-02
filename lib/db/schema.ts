// /*
// Tujuan: Skema database SQLite menggunakan Drizzle ORM dengan tipe-tipe non-null yang sesuai dengan TypeScript interface.
// Caller: Drizzle Kit, database instances
// Dependensi: drizzle-orm/sqlite-core
// Main Functions: Menetapkan tabel, kolom, relasi, dan indeks untuk produk, konten, orders, dll.
// Side Effects: None
// */

import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  display_name: text('display_name'),
  gemini_api_key_encrypted: text('gemini_api_key_encrypted'),
  scoring_mode: text('scoring_mode').default('benchmark').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  nama: text('nama').notNull(),
  brand: text('brand'),
  jenis: text('jenis'),
  harga: integer('harga').default(0).notNull(),
  komisi: integer('komisi').default(0).notNull(),
  kategori: text('kategori').default('Umum').notNull(),
  label_prestasi: text('label_prestasi').default('-').notNull(),
  gmv_aktif: integer('gmv_aktif', { mode: 'boolean' }).default(false).notNull(),
  status: text('status').default('aktif').notNull(), // aktif | jeda | habis
  desc_variants: text('desc_variants'), // Stored as JSON string
  bench_score: real('bench_score').default(0).notNull(),
  topsis_score: real('topsis_score').default(0).notNull(),
  klasifikasi: text('klasifikasi').default('MONITOR').notNull(),
  slot_rek: text('slot_rek').default('').notNull(),
  score_mode: text('score_mode').default('benchmark').notNull(),
  tiktok_product_id: text('tiktok_product_id'),
  shop_name: text('shop_name'),
  shop_code: text('shop_code'),
  avg_commission_rate: real('avg_commission_rate').default(0).notNull(),
  total_revenue: real('total_revenue').default(0).notNull(),
  total_orders: integer('total_orders').default(0).notNull(),
  net_items_sold: integer('net_items_sold').default(0).notNull(),
  total_refunded: integer('total_refunded').default(0).notNull(),
  kuota_mingguan: integer('kuota_mingguan').default(0).notNull(),
  aksi_rekomendasi: text('aksi_rekomendasi').default('').notNull(),
  shop_ads_ratio: real('shop_ads_ratio').default(0).notNull(),
  regularity_score: real('regularity_score').default(0).notNull(),
  is_kerjasama: integer('is_kerjasama', { mode: 'boolean' }).default(false).notNull(),
  kerjasama_target: integer('kerjasama_target').default(0).notNull(),
  kerjasama_deadline: text('kerjasama_deadline'),
  last_oos_started_at: text('last_oos_started_at'),
  last_oos_ended_at: text('last_oos_ended_at'),
  pre_oos_classification: text('pre_oos_classification'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const stock_history = sqliteTable('stock_history', {
  id: text('id').primaryKey(),
  product_id: text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  status: text('status').notNull(), // out_of_stock | available
  changed_at: text('changed_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  changed_by: text('changed_by').default('user').notNull(), // user | system
  notes: text('notes'),
});

export const contents = sqliteTable('contents', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  product_id: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  desc_text: text('desc_text'),
  tanggal_upload: text('tanggal_upload').notNull(),
  durasi: integer('durasi').default(0).notNull(), // in seconds
  views: integer('views').default(0).notNull(),
  ctr: real('ctr').default(0).notNull(),
  ctor: real('ctor').default(0).notNull(),
  items_sold: integer('items_sold').default(0).notNull(),
  gmv: real('gmv').default(0).notNull(),
  est_komisi: real('est_komisi').default(0).notNull(),
  tiktok_content_id: text('tiktok_content_id'),
  content_type: text('content_type').default('Video').notNull(),
  total_orders: integer('total_orders').default(0).notNull(),
  total_revenue: real('total_revenue').default(0).notNull(),
  likes: integer('likes').default(0).notNull(),
  comments: integer('comments').default(0).notNull(),
  shares: integer('shares').default(0).notNull(),
  link_video: text('link_video'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const period_snapshots = sqliteTable('period_snapshots', {
  id: text('id').primaryKey(),
  content_id: text('content_id').notNull().references(() => contents.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  period_start: text('period_start').notNull(),
  period_end: text('period_end').notNull(),
  views: integer('views').default(0).notNull(),
  ctr: real('ctr').default(0).notNull(),
  ctor: real('ctor').default(0).notNull(),
  items_sold: integer('items_sold').default(0).notNull(),
  gmv: real('gmv').default(0).notNull(),
});

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  type: text('type').notNull(), // hook, proof, cta
  content: text('content').notNull(),
  kategori: text('kategori').default('Umum').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  schedule_data: text('schedule_data').notNull(), // JSON stringified
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const import_logs = sqliteTable('import_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  filename: text('filename').notNull(),
  inserted_count: integer('inserted_count').default(0).notNull(),
  updated_count: integer('updated_count').default(0).notNull(),
  skipped_count: integer('skipped_count').default(0).notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  tiktok_order_id: text('tiktok_order_id').notNull(),
  product_id: text('product_id').references(() => products.id, { onDelete: 'set null' }),
  content_id: text('content_id').references(() => contents.id, { onDelete: 'set null' }),
  sku_id: text('sku_id'),
  product_name: text('product_name'),
  items_sold: integer('items_sold').default(0).notNull(),
  items_refunded: integer('items_refunded').default(0).notNull(),
  price: real('price').default(0).notNull(),
  gmv: real('gmv').default(0).notNull(),
  order_type: text('order_type').default('affiliate').notNull(),
  settlement_status: text('settlement_status').default('Pending').notNull(),
  commission_rate: real('commission_rate').default(0).notNull(),
  est_commission: real('est_commission').default(0).notNull(),
  actual_commission: real('actual_commission').default(0).notNull(),
  total_final_earned: real('total_final_earned').default(0).notNull(),
  shop_name: text('shop_name'),
  shop_code: text('shop_code'),
  order_date: text('order_date').notNull(),
  settlement_date: text('settlement_date'),
  import_log_id: text('import_log_id').references(() => import_logs.id, { onDelete: 'cascade' }),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (t) => ({
  unique_user_order_sku: uniqueIndex('idx_orders_dedup').on(t.user_id, t.tiktok_order_id, t.sku_id),
}));
