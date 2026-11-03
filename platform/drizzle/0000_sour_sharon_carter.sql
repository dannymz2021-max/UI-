CREATE TABLE `creator_briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`brief_json` text NOT NULL,
	`input_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `brief_owner_created` ON `creator_briefs` (`owner`,`created_at`);--> statement-breakpoint
CREATE TABLE `creator_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`status` text NOT NULL,
	`brief_json` text NOT NULL,
	`model` text NOT NULL,
	`result_key` text,
	`validation_json` text,
	`provider_request_id` text,
	`usage_json` text,
	`error_code` text,
	`error_message` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `job_owner_created` ON `creator_jobs` (`owner`,`created_at`);