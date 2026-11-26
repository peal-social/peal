ALTER TABLE "publishing"."posts" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "publishing"."posts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT date_trunc('milliseconds', now()) NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "posts_workspace_external_id" ON "publishing"."posts" ("workspace_id","external_id") WHERE "external_id" IS NOT NULL AND "status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX "posts_workspace_external_ids" ON "publishing"."posts" ("workspace_id","external_id") WHERE "external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "posts_workspace_updated" ON "publishing"."posts" ("workspace_id","updated_at","id");