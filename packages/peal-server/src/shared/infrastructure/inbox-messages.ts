import { Config, Effect, Layer, Option, Schema } from "effect";

import { CurrentInboxMessages } from "#shared/application/current-inbox-messages.ts";
import { InboxMessagePlatformSchema } from "#shared/domain/inbox-message-platform.ts";
import type {
  InboxMessagePlatform,
  InboxMessagePlatforms,
} from "#shared/domain/inbox-message-platform.ts";

import { InvalidInboxSettings } from "./invalid-inbox-settings.ts";
import {
  instagramAppConfig,
  metaAppConfig,
  metaWebhookVerifyTokenConfig,
} from "./platforms/meta-apps.ts";

const decodePlatform = Schema.decodeUnknownOption(InboxMessagePlatformSchema);

// The names the setting takes, as a sentence: "a, b and c".
const takenNames = (() => {
  const names = [...InboxMessagePlatformSchema.literals];
  const last = names.pop();

  return names.length === 0
    ? String(last)
    : `${names.join(", ")} and ${String(last)}`;
})();

/**
 * `PEAL_INBOX_MESSAGES`: the platforms whose direct messages the inbox
 * reads and answers, comma-separated among `mastodon`, `bluesky`,
 * `facebook` and `instagram`; none when unset or blank. Any other name
 * stops the server, as does a Meta platform without what it takes:
 * Facebook Pages Meta's main app (`META_APP_ID`, `META_APP_SECRET`),
 * Instagram either of its ways in (Meta's main app, or `INSTAGRAM_APP_ID`
 * and `INSTAGRAM_APP_SECRET`), and both `META_WEBHOOK_VERIFY_TOKEN`, as
 * Meta tells the server of new messages through its events. Off, no
 * conversation is read, the sign-ins ask what they asked before, and a
 * channel can do nothing with messages.
 */
export const inboxMessagesConfig = Effect.gen(function* inboxMessages() {
  const written = yield* Config.option(Config.String("PEAL_INBOX_MESSAGES"));

  const names = Option.getOrElse(written, () => "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");

  const platforms = new Set<InboxMessagePlatform>();

  for (const name of names) {
    const platform = decodePlatform(name);

    if (Option.isNone(platform)) {
      return yield* new InvalidInboxSettings({
        reason: `PEAL_INBOX_MESSAGES takes ${takenNames} only`,
      });
    }

    platforms.add(platform.value);
  }

  const meta = platforms.has("facebook") || platforms.has("instagram");

  if (meta && Option.isNone(yield* metaWebhookVerifyTokenConfig)) {
    return yield* new InvalidInboxSettings({
      reason:
        "facebook or instagram in PEAL_INBOX_MESSAGES needs META_WEBHOOK_VERIFY_TOKEN",
    });
  }

  const mainApp = yield* metaAppConfig;

  if (platforms.has("facebook") && Option.isNone(mainApp)) {
    return yield* new InvalidInboxSettings({
      reason:
        "facebook in PEAL_INBOX_MESSAGES needs META_APP_ID and META_APP_SECRET",
    });
  }

  if (
    platforms.has("instagram") &&
    Option.isNone(mainApp) &&
    Option.isNone(yield* instagramAppConfig)
  ) {
    return yield* new InvalidInboxSettings({
      reason:
        "instagram in PEAL_INBOX_MESSAGES needs META_APP_ID and META_APP_SECRET, or INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET",
    });
  }

  const read: InboxMessagePlatforms = platforms;

  return read;
});

/** The platforms the inbox reads direct messages on, as the operator set them. */
export const InboxMessagesLive = Layer.effect(
  CurrentInboxMessages,
  inboxMessagesConfig
);
