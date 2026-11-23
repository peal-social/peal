CREATE TABLE "assistant"."slideshows" (
	"aspect" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"finished_at" timestamp with time zone,
	"id" uuid PRIMARY KEY,
	"image_media_ids" uuid[] NOT NULL,
	"media_id" uuid,
	"plan" jsonb,
	"reason" text,
	"requested_by" uuid,
	"sandbox" boolean NOT NULL,
	"started_at" timestamp with time zone,
	"status" text NOT NULL,
	"voiceover_media_id" uuid,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "slideshows_one_at_a_time" ON "assistant"."slideshows" ("workspace_id") WHERE "status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "slideshows_workspace" ON "assistant"."slideshows" ("workspace_id","created_at" DESC NULLS LAST);