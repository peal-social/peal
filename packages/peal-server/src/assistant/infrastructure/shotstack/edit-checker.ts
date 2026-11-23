import { editSchema } from "@shotstack/schemas/zod";
import { Effect, Layer, Option, Schema } from "effect";

import { EditChecker } from "#assistant/application/ports/edit-checker.ts";

const decodeEdit = Schema.decodeUnknownOption(Schema.JsonObject);

/**
 * EditChecker on Shotstack's own schema for an Edit, the zod schema of
 * `@shotstack/schemas` (1.27.0, the version the web app's editor engine
 * depends on). zod stays in this file: the edit comes out as JSON, the
 * schema's coercions and defaults applied, and its errors, which quote the
 * edit, are never kept or logged.
 */
export const ShotstackEditCheckerLive = Layer.succeed(
  EditChecker,
  EditChecker.of({
    check: (edit) =>
      Effect.sync(() => editSchema.safeParse(edit)).pipe(
        Effect.map((parsed) =>
          parsed.success ? decodeEdit(parsed.data) : Option.none()
        ),
        // A schema that throws on a document refuses it.
        Effect.catchDefect(() =>
          Effect.succeed(Option.none<Schema.JsonObject>())
        )
      ),
  })
);
