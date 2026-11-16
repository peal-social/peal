import { Schema } from "effect";

import { Uuid7Schema } from "#shared/domain/ids.ts";

/** A private reply's id: a UUIDv7, so private replies read in the order they were written. */
export const PrivateReplyIdSchema = Uuid7Schema.pipe(
  Schema.brand("PrivateReplyId")
);

export type PrivateReplyId = typeof PrivateReplyIdSchema.Type;
