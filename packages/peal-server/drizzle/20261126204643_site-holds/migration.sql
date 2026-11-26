ALTER TABLE "publishing"."post_targets" ADD COLUMN "published_by_site" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing"."post_targets" ADD COLUMN "site_hand_overs" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "publishing"."post_targets" ADD COLUMN "site_publish_at" timestamp with time zone;