CREATE TABLE "workspace"."invitation_emails" (
	"day" date,
	"sent" integer NOT NULL,
	"subject" text,
	CONSTRAINT "invitation_emails_pkey" PRIMARY KEY("subject","day"),
	CONSTRAINT "invitation_emails_sent" CHECK ("sent" > 0)
);
--> statement-breakpoint
CREATE INDEX "invitation_emails_day" ON "workspace"."invitation_emails" ("day");