import { Context } from "effect";
import type { Effect } from "effect";

import type { PrivateReplyId } from "#engagement/domain/private-reply-id.ts";

/**
 * Starts the durable job that sends a private reply. Inside a
 * TransactionRunner transaction a start commits, or rolls back, with what
 * the transaction writes, and the job runs after the commit.
 */
export class PrivateReplyJobs extends Context.Service<
  PrivateReplyJobs,
  {
    readonly start: (privateReplyId: PrivateReplyId) => Effect.Effect<void>;
    /**
     * Stops its job for good, in a transaction with what hands the private
     * reply to a person, so the job cannot wake after. A job that has
     * ended is left as it is.
     */
    readonly cancel: (privateReplyId: PrivateReplyId) => Effect.Effect<void>;
  }
>()("peal-server/engagement/application/PrivateReplyJobs") {}
