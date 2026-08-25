CREATE TYPE "public"."contribution_status" AS ENUM('pending', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."pool_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE "contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"pool_id" text NOT NULL,
	"contributor_name" text,
	"contributor_address" text,
	"amount" numeric(18, 7) NOT NULL,
	"tx_hash" text NOT NULL,
	"status" "contribution_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contributions_tx_hash_unique" UNIQUE("tx_hash")
);
--> statement-breakpoint
CREATE TABLE "pools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"goal_amount" numeric(18, 7) NOT NULL,
	"deadline" timestamp with time zone,
	"organizer_address" text NOT NULL,
	"organizer_user_id" text NOT NULL,
	"status" "pool_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_pool_id_pools_id_fk" FOREIGN KEY ("pool_id") REFERENCES "public"."pools"("id") ON DELETE no action ON UPDATE no action;