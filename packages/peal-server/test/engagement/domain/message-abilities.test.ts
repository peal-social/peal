import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import {
  messageAbilitiesOf,
  namesMessageScopes,
} from "#engagement/domain/message-abilities.ts";
import {
  blueskyChatScopes,
  blueskyChatService,
} from "#shared/domain/bluesky-scopes.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
  instagramPageMessageScopes,
} from "#shared/domain/inbox-message-platform.ts";

const both = new Set(["mastodon", "bluesky"] as const);

const all = new Set(["mastodon", "bluesky", "facebook", "instagram"] as const);

const posting = ["pages_show_list", "pages_read_engagement"];

const page = Option.some("facebookLogin" as const);

const instagramLogin = Option.some("instagramLogin" as const);

describe("what a channel can do with its messages", () => {
  it("is nothing where the server reads no messages, or on another platform", () => {
    for (const platform of ["mastodon", "bluesky", "facebook"] as const) {
      expect(
        messageAbilitiesOf(
          platform,
          ["read", "write", ...blueskyChatScopes],
          new Set()
        )
      ).toStrictEqual({ read: "unsupported", send: "unsupported" });
    }

    expect(messageAbilitiesOf("threads", ["read"], all)).toStrictEqual({
      read: "unsupported",
      send: "unsupported",
    });
  });

  it("is reading and answering on Mastodon, with the statuses' scopes", () => {
    expect(
      messageAbilitiesOf(
        "mastodon",
        ["profile", "read:statuses", "write:statuses", "write:media"],
        both
      )
    ).toStrictEqual({ read: "available", send: "available" });
    expect(
      messageAbilitiesOf("mastodon", ["read", "write"], both)
    ).toStrictEqual({
      read: "available",
      send: "available",
    });
    expect(messageAbilitiesOf("mastodon", ["profile"], both)).toStrictEqual({
      read: "reconnect",
      send: "reconnect",
    });
  });

  it("is reading and answering on Bluesky once the chat scopes are granted", () => {
    expect(
      messageAbilitiesOf("bluesky", ["atproto", ...blueskyChatScopes], both)
    ).toStrictEqual({ read: "available", send: "available" });
    expect(
      messageAbilitiesOf(
        "bluesky",
        ["atproto", "repo:app.bsky.feed.post?action=create&action=delete"],
        both
      )
    ).toStrictEqual({ read: "reconnect", send: "reconnect" });
    expect(
      messageAbilitiesOf(
        "bluesky",
        [
          `rpc?lxm=chat.bsky.convo.listConvos&lxm=chat.bsky.convo.getMessages&aud=${encodeURIComponent(blueskyChatService)}`,
        ],
        both
      )
    ).toStrictEqual({ read: "available", send: "reconnect" });
  });

  it("is nothing on Meta's platforms where the server reads none of their messages", () => {
    expect(
      messageAbilitiesOf(
        "facebook",
        [...posting, ...facebookMessageScopes],
        both
      )
    ).toStrictEqual({ read: "unsupported", send: "unsupported" });
    expect(
      messageAbilitiesOf(
        "instagram",
        [instagramLoginMessageScope],
        both,
        instagramLogin
      )
    ).toStrictEqual({ read: "unsupported", send: "unsupported" });
  });

  it("is reading and answering a Page's messages with both its permissions", () => {
    expect(
      messageAbilitiesOf(
        "facebook",
        [...posting, ...facebookMessageScopes],
        all
      )
    ).toStrictEqual({ read: "available", send: "available" });

    for (const missing of facebookMessageScopes) {
      expect(
        messageAbilitiesOf(
          "facebook",
          [...posting, ...facebookMessageScopes].filter(
            (scope) => scope !== missing
          ),
          all
        )
      ).toStrictEqual({ read: "reconnect", send: "reconnect" });
    }
  });

  it("is reading and answering an Instagram account's through its Page with its three", () => {
    for (const connection of [page, Option.none()]) {
      expect(
        messageAbilitiesOf(
          "instagram",
          ["instagram_basic", ...instagramPageMessageScopes],
          all,
          connection
        )
      ).toStrictEqual({ read: "available", send: "available" });
    }

    for (const missing of instagramPageMessageScopes) {
      expect(
        messageAbilitiesOf(
          "instagram",
          instagramPageMessageScopes.filter((scope) => scope !== missing),
          all,
          page
        )
      ).toStrictEqual({ read: "reconnect", send: "reconnect" });
    }

    // Instagram Login's permission is no Page's.
    expect(
      messageAbilitiesOf("instagram", [instagramLoginMessageScope], all, page)
    ).toStrictEqual({ read: "reconnect", send: "reconnect" });
  });

  it("is reading and answering an Instagram account's through Instagram Login with its own", () => {
    expect(
      messageAbilitiesOf(
        "instagram",
        ["instagram_business_basic", instagramLoginMessageScope],
        all,
        instagramLogin
      )
    ).toStrictEqual({ read: "available", send: "available" });
    expect(
      messageAbilitiesOf(
        "instagram",
        ["instagram_business_basic", ...instagramPageMessageScopes],
        all,
        instagramLogin
      )
    ).toStrictEqual({ read: "reconnect", send: "reconnect" });
  });

  it("tells a Meta account that still names a messaging permission from one that names none", () => {
    expect(namesMessageScopes("facebook", ["pages_messaging"])).toBeTruthy();
    expect(namesMessageScopes("facebook", posting)).toBeFalsy();
    expect(
      namesMessageScopes("instagram", ["instagram_manage_messages"])
    ).toBeTruthy();
    expect(
      namesMessageScopes("instagram", [instagramLoginMessageScope])
    ).toBeTruthy();
    expect(namesMessageScopes("instagram", ["instagram_basic"])).toBeFalsy();
  });
});
