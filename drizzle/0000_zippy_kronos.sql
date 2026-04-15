CREATE TABLE `availability_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	FOREIGN KEY (`schedule_id`) REFERENCES `availability_schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `availability_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type_id` text NOT NULL,
	`contact_id` text,
	`title` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'confirmed' NOT NULL,
	`location` text,
	`notes` text,
	`custom_field_data` text,
	`cancellation_token` text,
	`ical_event_id` text,
	`created_at` text DEFAULT (datetime('now')),
	`cancelled_at` text,
	FOREIGN KEY (`event_type_id`) REFERENCES `event_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`company` text,
	`tags` text,
	`custom_data` text,
	`notes` text,
	`total_bookings` integer DEFAULT 0,
	`last_booked_at` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contacts_email_unique` ON `contacts` (`email`);--> statement-breakpoint
CREATE TABLE `date_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`schedule_id` text NOT NULL,
	`date` text NOT NULL,
	`is_blocked` integer DEFAULT false,
	`start_time` text,
	`end_time` text,
	FOREIGN KEY (`schedule_id`) REFERENCES `availability_schedules`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `event_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`duration` integer NOT NULL,
	`location` text,
	`location_type` text,
	`color` text DEFAULT '#3B82F6',
	`availability_schedule_id` text,
	`buffer_before` integer DEFAULT 0,
	`buffer_after` integer DEFAULT 0,
	`max_per_day` integer,
	`min_notice` integer DEFAULT 60,
	`max_future_days` integer DEFAULT 60,
	`custom_fields` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`availability_schedule_id`) REFERENCES `availability_schedules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_types_slug_unique` ON `event_types` (`slug`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workflow_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_step_id` text NOT NULL,
	`booking_id` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`executed_at` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	FOREIGN KEY (`workflow_step_id`) REFERENCES `workflow_steps`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`step_order` integer NOT NULL,
	`action` text NOT NULL,
	`delay_minutes` integer DEFAULT 0,
	`email_subject` text,
	`email_body` text,
	`recipient_type` text DEFAULT 'invitee',
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`trigger` text NOT NULL,
	`event_type_id` text,
	`is_active` integer DEFAULT true,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`event_type_id`) REFERENCES `event_types`(`id`) ON UPDATE no action ON DELETE no action
);
