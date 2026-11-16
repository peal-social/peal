CREATE TABLE "ads"."campaign_days" (
	"account_id" uuid,
	"campaign_external_id" text,
	"clicks" integer NOT NULL,
	"day" date,
	"impressions" integer NOT NULL,
	"spend_micros" bigint NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "campaign_days_pkey" PRIMARY KEY("account_id","campaign_external_id","day")
);
--> statement-breakpoint
ALTER TABLE "ads"."accounts" ADD COLUMN "reached_through" text;--> statement-breakpoint
ALTER TABLE "ads"."campaigns" ADD COLUMN "kind" text;--> statement-breakpoint
CREATE INDEX "campaign_days_workspace_day" ON "ads"."campaign_days" ("workspace_id","day");--> statement-breakpoint
CREATE INDEX "campaign_days_day" ON "ads"."campaign_days" ("day");--> statement-breakpoint
ALTER TABLE "ads"."campaign_days" ADD CONSTRAINT "campaign_days_account_id_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ads"."accounts"("id") ON DELETE CASCADE;