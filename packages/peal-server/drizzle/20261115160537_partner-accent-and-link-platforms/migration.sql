ALTER TABLE "channels"."connect_links" ADD COLUMN "platforms" text[];--> statement-breakpoint
ALTER TABLE "channels"."connect_links" ADD COLUMN "connected_platforms" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "channels"."connect_links" ADD COLUMN "started_platform" text;--> statement-breakpoint
ALTER TABLE "workspace"."partners" ADD COLUMN "accent_color" text;