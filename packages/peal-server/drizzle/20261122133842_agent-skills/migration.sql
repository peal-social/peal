CREATE TABLE "agent"."skills" (
	"author_id" uuid,
	"created_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY,
	"instructions" text NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent"."messages" ADD COLUMN "skills" jsonb DEFAULT '[]' NOT NULL;--> statement-breakpoint
CREATE INDEX "skills_workspace" ON "agent"."skills" ("workspace_id","scope");--> statement-breakpoint
CREATE INDEX "skills_author" ON "agent"."skills" ("author_id");