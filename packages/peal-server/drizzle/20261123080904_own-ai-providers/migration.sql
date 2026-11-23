CREATE TABLE "assistant"."capability_models" (
	"capability" text,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"workspace_id" uuid,
	CONSTRAINT "capability_models_pkey" PRIMARY KEY("workspace_id","capability")
);
--> statement-breakpoint
CREATE TABLE "assistant"."own_audio_days" (
	"capability" text,
	"count" integer NOT NULL,
	"day" date,
	"workspace_id" uuid,
	CONSTRAINT "own_audio_days_pkey" PRIMARY KEY("workspace_id","day","capability"),
	CONSTRAINT "own_audio_days_count" CHECK ("count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "assistant"."provider_connections" (
	"base_url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"key_id" text NOT NULL,
	"provider" text,
	"sealed_key" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"workspace_id" uuid,
	CONSTRAINT "provider_connections_pkey" PRIMARY KEY("workspace_id","provider")
);
--> statement-breakpoint
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
ALTER TABLE "assistant"."image_providers" ADD COLUMN "provider" text;--> statement-breakpoint
ALTER TABLE "assistant"."text_providers" ADD COLUMN "provider" text;--> statement-breakpoint
CREATE UNIQUE INDEX "slideshows_one_at_a_time" ON "assistant"."slideshows" ("workspace_id") WHERE "status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "slideshows_workspace" ON "assistant"."slideshows" ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "video_generations_one_at_a_time" ON "assistant"."video_generations" ("workspace_id") WHERE "status" IN ('queued', 'running');--> statement-breakpoint
CREATE INDEX "video_generations_workspace" ON "assistant"."video_generations" ("workspace_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "assistant"."capability_models" ADD CONSTRAINT "capability_models_connection" FOREIGN KEY ("workspace_id","provider") REFERENCES "assistant"."provider_connections"("workspace_id","provider") ON DELETE CASCADE;