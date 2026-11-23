import { Context } from "effect";
import type { Effect, Option, Schema } from "effect";

/**
 * Whether a document is a Shotstack Edit that Shotstack's own schema
 * accepts: the edit as the schema reads it (numbers given as text read as
 * numbers, its defaults filled), or none. It reads the document alone,
 * never a file it names, and never logs it.
 */
export class EditChecker extends Context.Service<
  EditChecker,
  {
    readonly check: (
      edit: Schema.JsonObject
    ) => Effect.Effect<Option.Option<Schema.JsonObject>>;
  }
>()("peal-server/assistant/application/EditChecker") {}
