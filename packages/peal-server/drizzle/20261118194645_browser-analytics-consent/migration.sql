ALTER TABLE "auth"."user" ADD COLUMN "browser_analytics_consent" text;--> statement-breakpoint
ALTER TABLE "auth"."user" ADD COLUMN "browser_analytics_consent_at" timestamp with time zone;