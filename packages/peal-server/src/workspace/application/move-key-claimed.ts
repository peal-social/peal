import { Schema } from "effect";

import { WorkspaceIdSchema } from "#shared/domain/ids.ts";

/**
 * Another request claimed the move's idempotency key meanwhile: the move
 * is rolled back, and the request answered as a replay of the other.
 */
export class MoveKeyClaimed extends Schema.TaggedError<MoveKeyClaimed>()(
  "MoveKeyClaimed",
  {
    channelId: Schema.Option(Schema.String),
    sameRequest: Schema.Boolean,
    workspaceId: WorkspaceIdSchema,
  }
) {}
