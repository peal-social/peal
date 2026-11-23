CREATE TABLE "assistant"."own_audio_days" (
	"capability" text,
	"count" integer NOT NULL,
	"day" date,
	"workspace_id" uuid,
	CONSTRAINT "own_audio_days_pkey" PRIMARY KEY("workspace_id","day","capability"),
	CONSTRAINT "own_audio_days_count" CHECK ("count" >= 0)
);
