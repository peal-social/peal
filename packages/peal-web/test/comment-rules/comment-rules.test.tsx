import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { Channel, CommentRule } from "peal-contract";
import { renderToStaticMarkup } from "react-dom/server";

import {
  commentRuleRequestOf,
  freshCommentRule,
  keywordsTyped,
  resumeHeld,
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

const channel = (id: string, platform: "instagram" | "mastodon"): Channel => ({
  avatarUrl: null,
  connection: null,
  displayName: `Studio on ${platform}`,
  handle: "studio",
  id,
  label: null,
  platform,
  status: { _tag: "active" },
  tokenExpiresAt: null,
});

const form = async (
  locale: "en" | "fr",
  draft: CommentRuleDraft,
  mayMessage = true
) =>
  await inLocale(
    locale,
    <CommentRuleFormView
      busy={false}
      channels={[
        channel("instagram-1", "instagram"),
        channel("mastodon-1", "mastodon"),
      ]}
      draft={draft}
      error={null}
      mayMessage={mayMessage}
      onChange={() => {}}
      onSubmit={() => {}}
    />
  );

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
