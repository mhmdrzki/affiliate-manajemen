CREATE TABLE `import_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`filename` text NOT NULL,
	`inserted_count` integer NOT NULL,
	`updated_count` integer NOT NULL,
	`skipped_count` integer NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`schedule_date` text NOT NULL,
	`slot_number` integer NOT NULL,
	`product_id` text,
	`product_name` text NOT NULL,
	`slot_type` text NOT NULL,
	`pool` text,
	`score` real,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`product_id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `scoring_params` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`param_key` text NOT NULL,
	`param_value` real NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `sales_data` ADD `import_id` text REFERENCES import_logs(id);