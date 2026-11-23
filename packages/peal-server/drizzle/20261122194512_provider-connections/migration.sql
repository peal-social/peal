CREATE TABLE "assistant"."capability_models" (
	"capability" text,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"workspace_id" uuid,
	CONSTRAINT "capability_models_pkey" PRIMARY KEY("workspace_id","capability")
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
ALTER TABLE "assistant"."capability_models" ADD CONSTRAINT "capability_models_connection" FOREIGN KEY ("workspace_id","provider") REFERENCES "assistant"."provider_connections"("workspace_id","provider") ON DELETE CASCADE;