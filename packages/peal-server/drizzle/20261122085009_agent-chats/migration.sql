CREATE SCHEMA "agent";
--> statement-breakpoint
CREATE TABLE "agent"."chats" (
	"created_at" timestamp with time zone NOT NULL,
	"history" jsonb NOT NULL,
	"id" uuid PRIMARY KEY,
	"run_id" uuid,
	"run_until" timestamp with time zone,
	"starred" boolean NOT NULL,
	"title" text,
	"updated_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent"."messages" (
	"approvals" jsonb NOT NULL,
	"cards" jsonb NOT NULL,
	"chat_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"duration_ms" integer,
	"id" uuid PRIMARY KEY,
	"outcome" text,
	"rating" text,
	"role" text NOT NULL,
	"steps" jsonb NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "chats_owner_updated" ON "agent"."chats" ("workspace_id","user_id","updated_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "chats_user" ON "agent"."chats" ("user_id");--> statement-breakpoint
CREATE INDEX "chats_updated" ON "agent"."chats" ("updated_at");--> statement-breakpoint
CREATE INDEX "messages_chat" ON "agent"."messages" ("chat_id","id");--> statement-breakpoint
ALTER TABLE "agent"."messages" ADD CONSTRAINT "messages_chat_id_chats_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "agent"."chats"("id") ON DELETE CASCADE;