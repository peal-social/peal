import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option, Result } from "effect";

import { CommentRuleIdSchema } from "#engagement/domain/comment-rule-id.ts";
import {
  changeCommentRule,
  commentRuleSupport,
  endCommentRule,
  isMatch,
  keywordsOf,
  ruleSupportOn,
  startCommentRule,
} from "#engagement/domain/comment-rule.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import type { InboxPlatforms } from "#shared/domain/inbox-platform.ts";
import { socialPlatforms } from "#shared/domain/platform.ts";

const now = DateTime.makeUnsafe("2026-07-06T07:00:00Z");

const ruleWith = (keywords: readonly string[]) =>
  startCommentRule(
    {
      id: CommentRuleIdSchema.make("00000000-0000-7000-8000-000000000601"),
      keywords: keywordsOf(keywords),
      privateReply: Option.none(),
      reply: "The price list is on our site.",
      scope: {
        _tag: "channel",
        channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000201"),
      },
      startedBy: Option.none(),
      startedVia: { _tag: "web" },
      workspaceId: WorkspaceIdSchema.make(
        "0b6c3b1e-2f6d-4a8e-9f0a-3c5d7e9f1a2b"
      ),
    },
    now
  );

describe("a comment rule's keywords", () => {
  it("are kept folded, trimmed and once each", () => {
    expect(
      keywordsOf([" Prix ", "PRIX", "", "Price  list", "Café"])
    ).toStrictEqual(["prix", "price list", "cafe"]);
  });

  it("match a comment that holds one as a word, whatever its case and accents", () => {
    const rule = ruleWith(["prix", "price list", "café"]);

    expect(isMatch(rule, "Quel est le PRIX ?")).toBeTruthy();
    expect(isMatch(rule, "Where is the price list?")).toBeTruthy();
    expect(isMatch(rule, "Un cafe, s'il vous plaît")).toBeTruthy();
    expect(isMatch(rule, "C'est surprixé")).toBeFalsy();
    expect(isMatch(rule, "pricelist")).toBeFalsy();
  });
});

describe("a comment rule", () => {
  it("pauses, resumes, and changes no more once ended", () => {
    const rule = ruleWith(["prix"]);

    const paused = Result.getOrThrow(
      changeCommentRule(rule, { paused: true }, now)
    );

    expect(paused.status._tag).toBe("paused");
    expect(
      Result.getOrThrow(changeCommentRule(paused, { paused: false }, now))
        .status._tag
    ).toBe("active");
    expect(
      Result.isFailure(
        changeCommentRule(endCommentRule(rule, "stopped", now), {}, now)
      )
    ).toBeTruthy();
  });

  it("answers only where the platform's rules let an app answer by itself", () => {
    expect({
      bluesky: commentRuleSupport.bluesky,
      linkedin: commentRuleSupport.linkedin,
      mastodon: commentRuleSupport.mastodon,
      x: commentRuleSupport.x,
      youtube: commentRuleSupport.youtube,
    }).toStrictEqual({
      bluesky: "notAllowed",
      linkedin: "notAllowed",
      mastodon: "available",
      x: "notAllowed",
      youtube: "notAllowed",
    });
  });

  it("keeps its private reply through a change, and drops it when told", () => {
    const rule = ruleWith(["prix"]);

    const given = Result.getOrThrow(
      changeCommentRule(
        rule,
        { privateReply: Option.some("Here is the list, privately.") },
        now
      )
    );

    expect(given.privateReply).toStrictEqual(
      Option.some("Here is the list, privately.")
    );

    const paused = Result.getOrThrow(
      changeCommentRule(given, { paused: true }, now)
    );

    expect(paused.privateReply).toStrictEqual(given.privateReply);
    expect(
      Result.getOrThrow(
        changeCommentRule(paused, { privateReply: Option.none() }, now)
      ).privateReply
    ).toStrictEqual(Option.none());
    expect(endCommentRule(given, "stopped", now).privateReply).toStrictEqual(
      given.privateReply
    );
  });
});

// What a rule carries on each platform, on a server reading those.
const byPlatform = (
  inbox: InboxPlatforms,
  messages: InboxMessagePlatforms = new Set()
) =>
  new Map(
    ruleSupportOn(inbox, messages).map(({ platform, ...support }) => [
      platform,
      support,
    ])
  );

describe("where comment rules answer", () => {
  it("names every platform once, in Peal's order", () => {
    expect(
      ruleSupportOn(new Set(), new Set()).map(({ platform }) => platform)
    ).toStrictEqual(socialPlatforms);
  });

  it("answers where the platform lets an app answer by itself", () => {
    const plain = byPlatform(new Set());

    expect(plain.get("mastodon")).toStrictEqual({
      privateReply: "noApi",
      reply: "available",
    });
    expect(plain.get("bluesky")?.reply).toBe("notAllowed");
    expect(plain.get("threads")?.reply).toBe("noApi");
    expect(byPlatform(new Set(["youtube"])).get("youtube")?.reply).toBe(
      "notAllowed"
    );
  });

  it("answers on Facebook and Instagram where the server reads their comments, privately where it reads their messages", () => {
    expect(byPlatform(new Set()).get("instagram")).toStrictEqual({
      privateReply: "unsupported",
      reply: "unsupported",
    });
    expect(byPlatform(new Set(["facebook"])).get("facebook")).toStrictEqual({
      privateReply: "unsupported",
      reply: "available",
    });
    expect(
      byPlatform(new Set(["instagram"]), new Set(["instagram"])).get(
        "instagram"
      )
    ).toStrictEqual({ privateReply: "available", reply: "available" });
  });

  it("sends no private message where the server reads the messages but not the comments", () => {
    expect(
      byPlatform(new Set(), new Set(["instagram"])).get("instagram")
    ).toStrictEqual({ privateReply: "unsupported", reply: "unsupported" });
  });
});
