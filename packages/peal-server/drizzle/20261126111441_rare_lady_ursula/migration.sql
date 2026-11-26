CREATE TABLE "publishing"."site_files" (
	"featured_refused" boolean DEFAULT false NOT NULL,
	"media_id" uuid,
	"site_media_id" bigint NOT NULL,
	"source_url" text NOT NULL,
	"target_id" uuid,
	CONSTRAINT "site_files_pkey" PRIMARY KEY("target_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "publishing"."site_files" ADD CONSTRAINT "site_files_target_id_post_targets_id_fkey" FOREIGN KEY ("target_id") REFERENCES "publishing"."post_targets"("id") ON DELETE CASCADE;