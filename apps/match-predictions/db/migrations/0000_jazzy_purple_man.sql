CREATE TABLE `challenges` (
	`nonce` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`polla_id` text NOT NULL,
	`player_address` text NOT NULL,
	`player_name` text NOT NULL,
	`memo_id` integer NOT NULL,
	`amount` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`tx_hash` text,
	`ledger` integer,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`polla_id`) REFERENCES `pollas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_polla_player_unique` ON `entries` (`polla_id`,`player_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_memo_unique` ON `entries` (`memo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `entries_tx_unique` ON `entries` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `entries_polla_idx` ON `entries` (`polla_id`);--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`polla_id` text NOT NULL,
	`position` integer NOT NULL,
	`home_team` text NOT NULL,
	`away_team` text NOT NULL,
	`kickoff_at` integer NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`result_at` integer,
	FOREIGN KEY (`polla_id`) REFERENCES `pollas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_polla_position_unique` ON `matches` (`polla_id`,`position`);--> statement-breakpoint
CREATE INDEX `matches_polla_idx` ON `matches` (`polla_id`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`polla_id` text NOT NULL,
	`winner_address` text NOT NULL,
	`winner_name` text NOT NULL,
	`amount` text NOT NULL,
	`memo_id` integer NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`tx_hash` text,
	`ledger` integer,
	`paid_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`polla_id`) REFERENCES `pollas`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_polla_winner_unique` ON `payouts` (`polla_id`,`winner_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_memo_unique` ON `payouts` (`memo_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `payouts_tx_unique` ON `payouts` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `payouts_polla_idx` ON `payouts` (`polla_id`);--> statement-breakpoint
CREATE TABLE `pollas` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`organizer_address` text NOT NULL,
	`organizer_name` text NOT NULL,
	`entry_amount` text NOT NULL,
	`deadline_at` integer NOT NULL,
	`exact_points` integer NOT NULL,
	`outcome_points` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`settled_pot` text,
	`settled_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pollas_code_unique` ON `pollas` (`code`);--> statement-breakpoint
CREATE INDEX `pollas_organizer_idx` ON `pollas` (`organizer_address`);--> statement-breakpoint
CREATE TABLE `predictions` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`match_id` text NOT NULL,
	`home_goals` integer NOT NULL,
	`away_goals` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `predictions_entry_match_unique` ON `predictions` (`entry_id`,`match_id`);--> statement-breakpoint
CREATE INDEX `predictions_entry_idx` ON `predictions` (`entry_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`address` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sessions_address_idx` ON `sessions` (`address`);--> statement-breakpoint
CREATE TABLE `sync_state` (
	`polla_id` text PRIMARY KEY NOT NULL,
	`last_cursor` text,
	`synced_at` integer NOT NULL,
	FOREIGN KEY (`polla_id`) REFERENCES `pollas`(`id`) ON UPDATE no action ON DELETE cascade
);
