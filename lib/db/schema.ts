// /*
// Tujuan: Skema database SQLite menggunakan Drizzle ORM dengan tipe-tipe non-null yang sesuai dengan TypeScript interface.
// Caller: Drizzle Kit, database instances
// Dependensi: drizzle-orm/sqlite-core
// Main Functions: Menetapkan tabel, kolom, relasi, dan indeks untuk profil, produk, konten, templates, import_logs, dan sales_data.
// Side Effects: None
// */

import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  display_name: text('display_name'),
  gemini_api_key_encrypted: text('gemini_api_key_encrypted'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const products = sqliteTable('products', {
  product_id: text('product_id').primaryKey(),
  user_id: text('user_id').notNull(),
  product_name: text('product_name').notNull(),
  shop_name: text('shop_name'),
  shop_code: text('shop_code'),
  category: text('category').default('Umum').notNull(),
  stock_status: text('stock_status').default('unknown').notNull(),
  date_added: text('date_added').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  is_collaboration: integer('is_collaboration', { mode: 'boolean' }).default(false).notNull(),
  collab_target_count: integer('collab_target_count'),
  collab_deadline: text('collab_deadline'),
  collab_start_date: text('collab_start_date'),
  status: text('status').default('active').notNull(),
  reset_testing_at: text('reset_testing_at'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const contents = sqliteTable('contents', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  product_id: text('product_id').references(() => products.product_id, { onDelete: 'set null' }),
  desc_text: text('desc_text'),
  tanggal_upload: text('tanggal_upload').notNull(),
  views: integer('views').default(0).notNull(),
  ctr: real('ctr').default(0).notNull(),
  ctor: real('ctor').default(0).notNull(),
  items_sold: integer('items_sold').default(0).notNull(),
  content_type: text('content_type').default('Video').notNull(),
  likes: integer('likes').default(0).notNull(),
  comments: integer('comments').default(0).notNull(),
  shares: integer('shares').default(0).notNull(),
  tiktok_content_id: text('tiktok_content_id').unique(),
  link_video: text('link_video'),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  type: text('type').notNull(), // hook, proof, cta
  content: text('content').notNull(),
  kategori: text('kategori').default('Umum').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const import_logs = sqliteTable('import_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  filename: text('filename').notNull(),
  inserted_count: integer('inserted_count').notNull(),
  updated_count: integer('updated_count').notNull(),
  skipped_count: integer('skipped_count').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const sales_data = sqliteTable('sales_data', {
  id: text('id').primaryKey(),
  order_id: text('order_id').notNull(),
  product_id: text('product_id').references(() => products.product_id, { onDelete: 'set null' }),
  contents_id: text('contents_id').references(() => contents.tiktok_content_id, { onDelete: 'set null' }),
  import_id: text('import_id').references(() => import_logs.id, { onDelete: 'cascade' }),
  order_type: text('order_type').notNull(), // 'shop_ads' | 'affiliate'
  price: real('price').notNull(),
  items_sold: integer('items_sold').notNull(),
  gmv: real('gmv').notNull(),
  est_commission: real('est_commission').notNull(),
  actual_commission: real('actual_commission').notNull(),
  settlement_status: text('settlement_status').notNull(), // 'settled' | 'pending' | 'awaiting_payment'
  ordered_at: text('ordered_at').notNull(),
  user_id: text('user_id').notNull(),
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
}, (table) => ({
  orderProductUniqueIdx: uniqueIndex('sales_data_order_product_unique_idx').on(table.order_id, table.product_id),
}));

export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  schedule_date: text('schedule_date').notNull(), // YYYY-MM-DD
  slot_number: integer('slot_number').notNull(),   // 1-7
  product_id: text('product_id').references(() => products.product_id, { onDelete: 'set null' }),
  product_name: text('product_name').notNull(),
  slot_type: text('slot_type').notNull(),           // 'collaboration' | 'fairness' | 'ranked'
  pool: text('pool'),                               // 'A' | 'B'
  score: real('score'),                             // skor produk saat digenerate
  created_at: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const scoring_params = sqliteTable('scoring_params', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  param_key: text('param_key').notNull(),  // 'TEST_BUDGET', 'GRACE_DAYS', etc.
  param_value: real('param_value').notNull(),
  updated_at: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

