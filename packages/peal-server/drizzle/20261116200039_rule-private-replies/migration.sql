ALTER TABLE "engagement"."comment_rule_matches" ADD COLUMN "private_code" text;--> statement-breakpoint
ALTER TABLE "engagement"."comment_rule_matches" ADD COLUMN "private_reply_id" uuid;--> statement-breakpoint
ALTER TABLE "engagement"."comment_rules" ADD COLUMN "private_reply" text;--> statement-breakpoint
CREATE INDEX "comment_rule_matches_waiting" ON "engagement"."comment_rule_matches" ("rule_id","looked_at") WHERE "private_code" = 'waiting';