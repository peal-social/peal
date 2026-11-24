import { pgSchema } from "drizzle-orm/pg-core";

// The one object for the Postgres schema `publishing`: drizzle-kit refuses
// a schema name declared twice, and the articles context's tables stay in it.
export const publishing = pgSchema("publishing");
