import { describe, expect, it } from "@effect/vitest";
import { Cause, DateTime } from "effect";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type {
  Channel,
  CommentRule,
  Platform,
  PlatformCommentRule,
} from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import {
  commentRuleRequestOf,
  freshCommentRule,
  keywordsTyped,
  resumeHeld,
  ruleChannelsOf,
  ruleFormStateOf,
} from "#comment-rules/rules.ts";
import type { CommentRuleDraft } from "#comment-rules/rules.ts";
import {
  CommentRuleFormView,
  CommentRuleView,
  RuleActionsView,
} from "#components/comment-rules/comment-rule-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

// Comment rules in the web app: the request the form sends, and how a
// rule reads, in both languages.

const rule: CommentRule = {
  channelId: "0190f3a0-0000-7000-8000-00000000c001",
  channels: [
    {
      channelId: "0190f3a0-0000-7000-8000-00000000c001",
      platform: "mastodon",
      privateReply: "noApi",
      reply: "available",
    },
  ],
  createdAt: DateTime.makeUnsafe("2026-07-06T07:00:00Z"),
  endedReason: null,
  holdsPrivateReply: false,
  id: "0190f3a0-0000-7000-8000-0000000c0001",
  keywords: ["price", "prix"],
  matches: [
    {
      code: null,
      commentId: "0190f3a0-0000-7000-8000-0000000c0101",
      lookedAt: DateTime.makeUnsafe("2026-07-06T08:00:00Z"),
      outcome: "replied",
      privateCode: null,
      privateReplyId: null,
      privateStatus: null,
      replyId: "0190f3a0-0000-7000-8000-0000000c0201",
    },
  ],
  postId: null,
  privateReply: null,
  reply: "The price list is on our site.",
  startedBy: null,
  status: "active",
};

// The same rule on Instagram, with a private reply: one sent, one whose
// public reply failed, one the channel's messages kept back.
const privateRule: CommentRule = {
  ...rule,
  channels: [
    {
      channelId: "0190f3a0-0000-7000-8000-00000000c005",
      platform: "instagram",
      privateReply: "messagesOff",
      reply: "available",
    },
  ],
  matches: [
    {
      code: null,
      commentId: "0190f3a0-0000-7000-8000-0000000c0101",
      lookedAt: DateTime.makeUnsafe("2026-07-06T08:00:00Z"),
      outcome: "replied",
      privateCode: null,
      privateReplyId: "0190f3a0-0000-7000-8000-0000000c0301",
      privateStatus: "sent",
      replyId: "0190f3a0-0000-7000-8000-0000000c0201",
    },
    {
      code: null,
      commentId: "0190f3a0-0000-7000-8000-0000000c0102",
      lookedAt: DateTime.makeUnsafe("2026-07-06T08:10:00Z"),
      outcome: "replied",
      privateCode: "publicReplyFailed",
      privateReplyId: null,
      privateStatus: null,
      replyId: "0190f3a0-0000-7000-8000-0000000c0202",
    },
    {
      code: null,
      commentId: "0190f3a0-0000-7000-8000-0000000c0103",
      lookedAt: DateTime.makeUnsafe("2026-07-06T08:20:00Z"),
      outcome: "replied",
      privateCode: "messagesOff",
      privateReplyId: null,
      privateStatus: null,
      replyId: "0190f3a0-0000-7000-8000-0000000c0203",
    },
  ],
  holdsPrivateReply: true,
  privateReply: "Here is the list. (Automatic message)",
};

const inLocale = async (locale: "en" | "fr", node: React.ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {node}
    </NextIntlClientProvider>
  );

const render = async (locale: "en" | "fr", shown: CommentRule = rule) =>
  await inLocale(locale, <CommentRuleView actions={null} rule={shown} />);

const channel = (id: string, platform: Platform): Channel => ({
  avatarUrl: null,
  connection: null,
  displayName: "Field Notes",
  handle: "@fieldnotes",
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

// One account, "Field Notes", on several platforms: as the platforms
// show it, every channel has the same name.
const channels: readonly Channel[] = [
  channel("instagram-1", "instagram"),
  channel("facebook-1", "facebook"),
  channel("mastodon-1", "mastodon"),
  channel("bluesky-1", "bluesky"),
  {
    ...channel("mastodon-off", "mastodon"),
    status: { _tag: "disabled", refreshNeeded: false },
  },
];

// Where rules answer, as a server that reads Facebook's and Instagram's
// comments, and Instagram's messages, says.
const platforms: readonly PlatformCommentRule[] = [
  { platform: "x", privateReply: "noApi", reply: "notAllowed" },
  { platform: "bluesky", privateReply: "noApi", reply: "notAllowed" },
  { platform: "mastodon", privateReply: "noApi", reply: "available" },
  { platform: "instagram", privateReply: "available", reply: "available" },
  { platform: "facebook", privateReply: "unsupported", reply: "available" },
  { platform: "threads", privateReply: "noApi", reply: "noApi" },
];

const form = async (
  locale: "en" | "fr",
  draft: CommentRuleDraft,
  mayMessage = true,
  offered: {
    readonly channels?: readonly Channel[];
    readonly platforms?: readonly PlatformCommentRule[];
  } = {}
) =>
  await inLocale(
    locale,
    <CommentRuleFormView
      busy={false}
      channels={offered.channels ?? channels}
      draft={draft}
      error={null}
      mayMessage={mayMessage}
      platforms={offered.platforms ?? platforms}
      renderChannelsLink={(text) => <u data-link="channels">{text}</u>}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  );

describe("the comment rule form's channels", () => {
  it("names each channel with its platform, so two of one name read apart", async () => {
    await expect(
      form("en", { ...freshCommentRule, channelId: "instagram-1" })
    ).resolves.toContain("@fieldnotes on Instagram");
    await expect(
      form("en", { ...freshCommentRule, channelId: "facebook-1" })
    ).resolves.toContain("@fieldnotes on Facebook");
    await expect(
      form("fr", { ...freshCommentRule, channelId: "mastodon-1" })
    ).resolves.toContain("@fieldnotes sur Mastodon");
  });

  it("offers only the channels that are on, on a platform where the server says rules answer", async () => {
    expect(
      ruleChannelsOf(channels, platforms).map(({ id }) => id)
    ).toStrictEqual(["instagram-1", "facebook-1", "mastodon-1"]);

    // A channel the select does not offer cannot show as chosen: the
    // select names no channel.
    const shown = await Promise.all(
      ["bluesky-1", "mastodon-off"].map(
        async (refused) =>
          await form("en", { ...freshCommentRule, channelId: refused })
      )
    );

    expect(
      shown.map((html) =>
        /data-slot="select-value"[^>]*>[^<]*(?:Field Notes|@fieldnotes)/u.test(
          html
        )
      )
    ).toStrictEqual([false, false]);
  });

  it("says in one sentence that no channel can have a rule, and where rules answer, in place of the form", async () => {
    const none = await form("en", freshCommentRule, true, {
      channels: [channel("bluesky-1", "bluesky")],
    });

    expect(none).toContain(
      "None of this workspace’s channels can have a rule. Rules answer on Mastodon, Instagram, and Facebook."
    );
    expect(none).not.toContain(">Start<");
    await expect(
      form("en", freshCommentRule, true, {
        channels: [channel("bluesky-1", "bluesky")],
        platforms: platforms.map((each) => ({ ...each, reply: "noApi" })),
      })
    ).resolves.toContain(
      "This server answers no comments by itself, so no channel can have a rule."
    );
    await expect(
      form("fr", freshCommentRule, true, {
        channels: [],
      })
    ).resolves.toContain("Aucun canal de cet espace de travail");
  });

  it("names a channel left out for being off or to reconnect, and links to Channels", async () => {
    const held = await form("en", freshCommentRule, true, {
      channels: [
        {
          ...channel("instagram-1", "instagram"),
          status: { _tag: "refreshNeeded" },
        },
        {
          ...channel("mastodon-off", "mastodon"),
          status: { _tag: "disabled", refreshNeeded: false },
        },
        channel("bluesky-1", "bluesky"),
      ],
    });

    expect([
      held.includes("@fieldnotes on Instagram must be connected again."),
      held.includes("@fieldnotes on Mastodon is turned off."),
      held.includes('<u data-link="channels">Channels</u>'),
      held.includes("on Bluesky"),
      held.includes(">Start<"),
    ]).toStrictEqual([true, true, true, false, false]);
  });

  it("says in French which channel to turn back on", async () => {
    await expect(
      form("fr", freshCommentRule, true, {
        channels: [
          {
            ...channel("mastodon-off", "mastodon"),
            status: { _tag: "disabled", refreshNeeded: false },
          },
        ],
      })
    ).resolves.toContain("@fieldnotes sur Mastodon est désactivé.");
  });
});

describe("the comment rule form's state", () => {
  it("fails when either answer failed, and waits for both", () => {
    const failed = AsyncResult.failure<never, string>(Cause.fail("refused"));

    expect([
      ruleFormStateOf(AsyncResult.success(channels), failed)._tag,
      ruleFormStateOf(failed, AsyncResult.success(platforms))._tag,
      ruleFormStateOf(AsyncResult.initial(), AsyncResult.success(platforms))
        ._tag,
      ruleFormStateOf(
        AsyncResult.success(channels),
        AsyncResult.success(platforms)
      )._tag,
    ]).toStrictEqual(["failed", "failed", "loading", "ready"]);
  });
});

describe("the comment rule form", () => {
  it("sends the channel, the keywords typed and the reply", () => {
    expect(keywordsTyped(" price, , prix ")).toStrictEqual(["price", "prix"]);
    expect(
      commentRuleRequestOf({
        channelId: "c",
        keywords: "price, prix",
        privateReply: null,
        reply: " On our site. ",
      })
    ).toStrictEqual({
      channelId: "c",
      keywords: ["price", "prix"],
      reply: "On our site.",
    });
    expect(
      commentRuleRequestOf({ ...freshCommentRule, keywords: "a", reply: "b" })
    ).toBe("channel");
    expect(
      commentRuleRequestOf({
        ...freshCommentRule,
        channelId: "c",
        keywords: " , ",
        reply: "b",
      })
    ).toBe("keywords");
  });

  it("sends a private reply only when one is asked for and written", () => {
    const draft: CommentRuleDraft = {
      channelId: "c",
      keywords: "price",
      privateReply: " Here is the list. ",
      reply: "In your messages.",
    };

    expect(commentRuleRequestOf(draft)).toStrictEqual({
      channelId: "c",
      keywords: ["price"],
      privateReply: "Here is the list.",
      reply: "In your messages.",
    });
    expect(commentRuleRequestOf({ ...draft, privateReply: "  " })).toBe(
      "privateReply"
    );
    expect(
      commentRuleRequestOf({ ...draft, privateReply: null })
    ).not.toHaveProperty("privateReply");
  });

  it("offers a private reply on Instagram and Facebook only, to who may send messages, with its hint", async () => {
    const onInstagram = await form("en", {
      ...freshCommentRule,
      channelId: "instagram-1",
      privateReply: "",
    });

    expect(onInstagram).toContain("Also send a private message");
    expect(onInstagram).toContain("say in it that the message is automatic");
    await expect(
      form("en", { ...freshCommentRule, channelId: "mastodon-1" })
    ).resolves.not.toContain("Also send a private message");
    await expect(
      form("en", { ...freshCommentRule, channelId: "instagram-1" }, false)
    ).resolves.not.toContain("Also send a private message");
    await expect(
      form("fr", {
        ...freshCommentRule,
        channelId: "instagram-1",
        privateReply: "",
      })
    ).resolves.toContain("Envoyer aussi un message privé");
  });

  it("offers no private reply where the server says it sends none", async () => {
    // Facebook, whose messages this server does not read.
    await expect(
      form("en", { ...freshCommentRule, channelId: "facebook-1" })
    ).resolves.not.toContain("Also send a private message");
  });

  it("reads a rule and what it did, in both languages", async () => {
    await expect(render("en")).resolves.toContain(
      "When a comment says: price, prix"
    );
    await expect(render("en")).resolves.toContain("Mastodon: answers there");
    await expect(render("fr")).resolves.toContain(
      "Quand un commentaire dit : price, prix"
    );
  });

  it("reads a rule's private reply, where it goes and what came of each", async () => {
    const english = await render("en", privateRule);

    expect(english).toContain("Here is the list. (Automatic message)");
    expect(english).toContain(
      "Instagram: answers there; private message: turn the channel’s direct messages on"
    );
    expect(english).toContain("Private message sent");
    expect(english).toContain(
      "No private message: the public reply did not go out"
    );
    expect(english).toContain(
      "No private message: the channel’s direct messages are off"
    );
  });

  it("never says sent of a private reply no longer kept", async () => {
    const purged: CommentRule = {
      ...privateRule,
      matches: [
        {
          code: null,
          commentId: "0190f3a0-0000-7000-8000-0000000c0104",
          lookedAt: DateTime.makeUnsafe("2026-06-01T08:00:00Z"),
          outcome: "replied",
          privateCode: null,
          privateReplyId: "0190f3a0-0000-7000-8000-0000000c0304",
          privateStatus: null,
          replyId: "0190f3a0-0000-7000-8000-0000000c0204",
        },
      ],
    };

    const english = await render("en", purged);

    expect(english).not.toContain("Private message sent");
    expect(english).toContain("Private message made, no longer kept");
  });

  it("reads a rule's private outcomes in French", async () => {
    await expect(render("fr", privateRule)).resolves.toContain(
      "Message privé envoyé"
    );
  });

  it("holds back resuming a rule with a private message from who may not send messages, and says who can", async () => {
    // As one who may not read it sees the rule: the text hidden, held.
    const paused: CommentRule = {
      ...privateRule,
      privateReply: null,
      status: "paused",
    };

    expect([
      resumeHeld(paused, false),
      resumeHeld(paused, true),
      resumeHeld({ ...rule, status: "paused" }, false),
    ]).toStrictEqual([true, false, false]);

    const actions = async (held: boolean, locale: "en" | "fr" = "en") =>
      await inLocale(
        locale,
        <RuleActionsView
          busy={false}
          held={held}
          onPause={() => {}}
          onRemovePrivate={() => {}}
          onStop={() => {}}
          rule={paused}
        />
      );

    const heldBack = await actions(true);

    expect(heldBack).not.toContain(">Resume<");
    expect(heldBack).toContain(
      "It sends private messages: an owner, or a member allowed to send messages, can resume it."
    );
    await expect(actions(false)).resolves.toContain(">Resume<");
    await expect(actions(true, "fr")).resolves.toContain(
      "Elle envoie des messages privés"
    );
  });
});
