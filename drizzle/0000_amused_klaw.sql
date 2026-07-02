CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text,
	`desc_text` text,
	`tanggal_upload` text NOT NULL,
	`durasi` integer DEFAULT 0 NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`ctor` real DEFAULT 0 NOT NULL,
	`items_sold` integer DEFAULT 0 NOT NULL,
	`gmv` real DEFAULT 0 NOT NULL,
	`est_komisi` real DEFAULT 0 NOT NULL,
	`tiktok_content_id` text,
	`content_type` text DEFAULT 'Video' NOT NULL,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`total_revenue` real DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`link_video` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`inserted_count` integer DEFAULT 0 NOT NULL,
	`updated_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tiktok_order_id` text NOT NULL,
	`product_id` text,
	`content_id` text,
	`sku_id` text,
	`product_name` text,
	`items_sold` integer DEFAULT 0 NOT NULL,
	`items_refunded` integer DEFAULT 0 NOT NULL,
	`price` real DEFAULT 0 NOT NULL,
	`gmv` real DEFAULT 0 NOT NULL,
	`order_type` text DEFAULT 'affiliate' NOT NULL,
	`settlement_status` text DEFAULT 'Pending' NOT NULL,
	`commission_rate` real DEFAULT 0 NOT NULL,
	`est_commission` real DEFAULT 0 NOT NULL,
	`actual_commission` real DEFAULT 0 NOT NULL,
	`total_final_earned` real DEFAULT 0 NOT NULL,
	`shop_name` text,
	`shop_code` text,
	`order_date` text NOT NULL,
	`settlement_date` text,
	`import_log_id` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`import_log_id`) REFERENCES `import_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_dedup` ON `orders` (`user_id`,`tiktok_order_id`,`sku_id`);--> statement-breakpoint
CREATE TABLE `period_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`user_id` text NOT NULL,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`ctor` real DEFAULT 0 NOT NULL,
	`items_sold` integer DEFAULT 0 NOT NULL,
	`gmv` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`nama` text NOT NULL,
	`brand` text,
	`jenis` text,
	`harga` integer DEFAULT 0 NOT NULL,
	`komisi` integer DEFAULT 0 NOT NULL,
	`kategori` text DEFAULT 'Umum' NOT NULL,
	`label_prestasi` text DEFAULT '-' NOT NULL,
	`gmv_aktif` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'aktif' NOT NULL,
	`desc_variants` text,
	`bench_score` real DEFAULT 0 NOT NULL,
	`topsis_score` real DEFAULT 0 NOT NULL,
	`klasifikasi` text DEFAULT 'MONITOR' NOT NULL,
	`slot_rek` text DEFAULT '' NOT NULL,
	`score_mode` text DEFAULT 'benchmark' NOT NULL,
	`tiktok_product_id` text,
	`shop_name` text,
	`shop_code` text,
	`avg_commission_rate` real DEFAULT 0 NOT NULL,
	`total_revenue` real DEFAULT 0 NOT NULL,
	`total_orders` integer DEFAULT 0 NOT NULL,
	`net_items_sold` integer DEFAULT 0 NOT NULL,
	`total_refunded` integer DEFAULT 0 NOT NULL,
	`kuota_mingguan` integer DEFAULT 0 NOT NULL,
	`aksi_rekomendasi` text DEFAULT '' NOT NULL,
	`shop_ads_ratio` real DEFAULT 0 NOT NULL,
	`regularity_score` real DEFAULT 0 NOT NULL,
	`is_kerjasama` integer DEFAULT false NOT NULL,
	`kerjasama_target` integer DEFAULT 0 NOT NULL,
	`kerjasama_deadline` text,
	`last_oos_started_at` text,
	`last_oos_ended_at` text,
	`pre_oos_classification` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`gemini_api_key_encrypted` text,
	`scoring_mode` text DEFAULT 'benchmark' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`schedule_data` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_history` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`status` text NOT NULL,
	`changed_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`changed_by` text DEFAULT 'user' NOT NULL,
	`notes` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`content` text NOT NULL,
	`kategori` text DEFAULT 'Umum' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
