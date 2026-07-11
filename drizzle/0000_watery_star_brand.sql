CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text,
	`desc_text` text,
	`tanggal_upload` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`ctr` real DEFAULT 0 NOT NULL,
	`ctor` real DEFAULT 0 NOT NULL,
	`items_sold` integer DEFAULT 0 NOT NULL,
	`content_type` text DEFAULT 'Video' NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`shares` integer DEFAULT 0 NOT NULL,
	`tiktok_content_id` text,
	`link_video` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contents_tiktok_content_id_unique` ON `contents` (`tiktok_content_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`product_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_name` text NOT NULL,
	`shop_name` text,
	`shop_code` text,
	`category` text DEFAULT 'Umum' NOT NULL,
	`stock_status` text DEFAULT 'unknown' NOT NULL,
	`date_added` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`is_collaboration` integer DEFAULT false NOT NULL,
	`collab_target_count` integer,
	`collab_deadline` text,
	`collab_start_date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`gemini_api_key_encrypted` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sales_data` (
	`order_id` text PRIMARY KEY NOT NULL,
	`product_id` text,
	`contents_id` text,
	`order_type` text NOT NULL,
	`price` real NOT NULL,
	`items_sold` integer NOT NULL,
	`gmv` real NOT NULL,
	`est_commission` real NOT NULL,
	`actual_commission` real NOT NULL,
	`settlement_status` text NOT NULL,
	`ordered_at` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`contents_id`) REFERENCES `contents`(`tiktok_content_id`) ON UPDATE no action ON DELETE set null
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
