import { Context } from "effect";
import type { Effect } from "effect";

import type { WorkspaceId } from "#shared/domain/ids.ts";

import type { ChatConnectLimited } from "./chat-connect-limited.ts";

/**
 * How often a workspace may try to connect a chat: each try hands the
 * platform the secret it was given, so a workspace cannot have Peal try
 * webhooks' addresses or bots' tokens at will.
 */
export class ChatConnectPace extends Context.Service<
  ChatConnectPace,
  {
    /** Takes one try for the workspace, or refuses it for now. */
    readonly take: (
      workspaceId: WorkspaceId
    ) => Effect.Effect<void, ChatConnectLimited>;
  }
>()("peal-server/channels/application/ChatConnectPace") {}
