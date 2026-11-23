CREATE TABLE "assistant"."video_generations" (
	"aspect" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"duration_seconds" integer,
	"finished_at" timestamp with time zone,
	"id" uuid PRIMARY KEY,
	"image_media_id" uuid,
	"media_id" uuid,
	"prompt" text,
	"reason" text,
	"requested_by" uuid,
	"started_at" timestamp with time zone,
	"status" text NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_one_at_a_time" ON "assistant"."video_generations" ("workspace_id") WHERE "status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "video_generations_workspace" ON "assistant"."video_generations" ("workspace_id","created_at" DESC NULLS LAST);