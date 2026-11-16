import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { abilitiesOf } from "#engagement/domain/engagement-abilities.ts";
import { privateReplyStanding } from "#engagement/domain/private-reply-standing.ts";
import type { ChannelConnection } from "#shared/domain/channel-connection.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
  instagramPageMessageScopes,
} from "#shared/domain/inbox-message-platform.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import {
  facebookCommentScopes,
  instagramLoginCommentScope,
  instagramPageCommentScope,
} from "#shared/domain/inbox-platform.ts";
import type { InboxPlatforms } from "#shared/domain/inbox-platform.ts";
import type { Platform } from "#shared/domain/platform.ts";

const meta: InboxPlatforms = new Set(["facebook", "instagram"]);

const metaMessages: InboxMessagePlatforms = new Set(["facebook", "instagram"]);

const through = (connection: ChannelConnection) => Option.some(connection);

// Each way in, with every permission a private reply takes there.
const waysIn: readonly {
  readonly name: string;
  readonly platform: Platform;
  readonly connection: Option.Option<ChannelConnection>;
  readonly scopes: readonly string[];
}[] = [
  {
    connection: Option.none(),
    name: "a Facebook Page",
    platform: "facebook",
    scopes: [facebookCommentScopes.read, ...facebookMessageScopes],
  },
  {
    connection: through("facebookLogin"),
    name: "Instagram through a Page",
    platform: "instagram",
    scopes: [instagramPageCommentScope, ...instagramPageMessageScopes],
  },
  {
    connection: Option.none(),
    name: "Instagram through a Page, stored without its way in",
    platform: "instagram",
    scopes: [instagramPageCommentScope, ...instagramPageMessageScopes],
  },
  {
    connection: through("instagramLogin"),
    name: "Instagram through Instagram Login",
    platform: "instagram",
    scopes: [instagramLoginCommentScope, instagramLoginMessageScope],
  },
];

describe("whether a channel can send a private reply", () => {
  it.each(waysIn)(
    "is available on $name with the comments' and the messages' permissions, its messages on",
    ({ connection, platform, scopes }) => {
      expect(
        privateReplyStanding(
          platform,
          connection,
          scopes,
          meta,
          metaMessages,
          true
        )
      ).toBe("available");
    }
  );

  it.each(waysIn)(
    "asks to reconnect $name that lacks one of them",
    ({ connection, platform, scopes }) => {
      for (const missing of scopes) {
        expect(
          privateReplyStanding(
            platform,
            connection,
            scopes.filter((scope) => scope !== missing),
            meta,
            metaMessages,
            true
          )
        ).toBe("reconnect");
      }
    }
  );

  it("never takes Instagram Login's permissions through a Page, nor the reverse", () => {
    expect(
      privateReplyStanding(
        "instagram",
        through("facebookLogin"),
        [instagramLoginCommentScope, instagramLoginMessageScope],
        meta,
        metaMessages,
        true
      )
    ).toBe("reconnect");
    expect(
      privateReplyStanding(
        "instagram",
        through("instagramLogin"),
        [instagramPageCommentScope, ...instagramPageMessageScopes],
        meta,
        metaMessages,
        true
      )
    ).toBe("reconnect");
  });

  it.each(waysIn)(
    "is off on $name while its messages are off, or the server reads neither its comments nor its messages",
    ({ connection, platform, scopes }) => {
      const standing = (
        inbox: InboxPlatforms,
        messages: InboxMessagePlatforms,
        on: boolean
      ) =>
        privateReplyStanding(platform, connection, scopes, inbox, messages, on);

      expect(standing(meta, metaMessages, false)).toBe("unsupported");
      expect(standing(new Set(), metaMessages, true)).toBe("unsupported");
      expect(standing(meta, new Set(), true)).toBe("unsupported");
    }
  );

  it("is never on a platform without Meta's private replies", () => {
    for (const platform of [
      "mastodon",
      "bluesky",
      "x",
      "linkedin",
      "youtube",
    ] satisfies Platform[]) {
      expect(
        privateReplyStanding(
          platform,
          Option.none(),
          ["write:statuses", "read:statuses"],
          new Set(["linkedin", "youtube"]),
          new Set(["mastodon", "bluesky"]),
          true
        )
      ).toBe("unsupported");
    }
  });

  it("is not something a channel's scopes alone decide", () => {
    expect(
      abilitiesOf(
        "facebook",
        [facebookCommentScopes.read, ...facebookMessageScopes],
        meta
      ).privateReply
    ).toBe("unsupported");
  });
});
