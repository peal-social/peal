CREATE TABLE "engagement"."private_replies" (
	"attempted_at" timestamp with time zone,
	"author_id" uuid,
	"call_claimed_at" timestamp with time zone,
	"channel_id" uuid NOT NULL,
	"comment_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY,
	"key_digest" text,
	"platform_message_id" text,
	"reason" text,
	"rule_id" uuid,
	"settled_at" timestamp with time zone,
	"status" text NOT NULL,
	"text" text NOT NULL,
	"thread_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "private_replies_status" CHECK ("status" IN ('sending', 'sent', 'failed', 'unconfirmed')),
	CONSTRAINT "private_replies_settled_at" CHECK (("status" = 'sending') = ("settled_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "private_replies_comment" ON "engagement"."private_replies" ("comment_id") WHERE "status" <> 'failed';--> statement-breakpoint
CREATE UNIQUE INDEX "private_replies_key" ON "engagement"."private_replies" ("workspace_id","key_digest") WHERE "key_digest" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "private_replies_settled" ON "engagement"."private_replies" ("settled_at") WHERE "settled_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "private_replies_channel" ON "engagement"."private_replies" ("channel_id");--> statement-breakpoint
CREATE INDEX "private_replies_thread" ON "engagement"."private_replies" ("thread_id","id");--> statement-breakpoint
CREATE INDEX "private_replies_sending" ON "engagement"."private_replies" ("created_at","id") WHERE "status" = 'sending';--> statement-breakpoint
CREATE INDEX "private_replies_author" ON "engagement"."private_replies" ("author_id") WHERE "author_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "engagement"."private_replies" ADD CONSTRAINT "private_replies_comment_id_comments_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "engagement"."comments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "engagement"."private_replies" ADD CONSTRAINT "private_replies_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "engagement"."threads"("id") ON DELETE CASCADE;