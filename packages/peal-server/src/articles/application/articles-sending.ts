import { Schema } from "effect";

import { WorkspaceIdSchema } from "#shared/domain/ids.ts";

/**
 * An article of the workspace is being sent to its site: its articles
 * cannot be erased until the call has ended, as its job would find them
 * gone halfway. Never stored, nor answered: the workspace context tells it
 * as the workspace being busy.
 */
export class ArticlesSending extends Schema.TaggedError<ArticlesSending>()(
  "ArticlesSending",
  { workspaceId: WorkspaceIdSchema }
) {}
