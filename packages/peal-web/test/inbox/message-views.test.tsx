import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { constVoid } from "effect/Function";
import { NextIntlClientProvider } from "next-intl";
import type {
  SocialChannel,
  InboxConversation,
  InboxDirectMessage,
} from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ConversationRowView } from "#components/inbox/inbox-rows.tsx";
import type { InboxRowLink } from "#components/inbox/inbox-rows.tsx";
import { ChannelMessagesView } from "#components/inbox/message-settings.tsx";
import {
  ConfirmMessageView,
  ConversationSummaryView,
  DirectMessageView,
  MessageBoxView,
  OutgoingMessageView,
  ReplyWindowView,
} from "#components/inbox/message-views.tsx";
import { loadMessages } from "#i18n/messages.ts";
import { readsNoMessages } from "#inbox/message-channels.ts";

const render = async (locale: "en" | "fr", view: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {view}
    </NextIntlClientProvider>
  );

const at = (iso: string) => DateTime.makeUnsafe(iso);

const RowLink: InboxRowLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const workspaceId = "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f";

const channel: SocialChannel = {
  avatarUrl: null,
  connection: null,
  displayName: "Synthetic studio",
  handle: "@studio@social.example",
  id: "00000000-0000-7000-8000-0000000000c3",
  label: null,
  platform: "mastodon",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const conversation: InboxConversation = {
  channelId: channel.id,
  id: "00000000-0000-7000-8000-0000000000f1",
  lastIncomingAt: at("2026-11-14T09:00:00Z"),
  lastMessageAt: at("2026-11-14T09:00:00Z"),
  messages: 2,
  participants: [
    {
      displayName: "A synthetic reader",
      handle: "reader@social.example",
      platformId: "7001",
    },
  ],
  readAt: null,
  request: false,
  unread: true,
};

const message: InboxDirectMessage = {
  attachments: 1,
  conversationId: conversation.id,
  fromAccount: false,
  id: "00000000-0000-7000-8000-0000000000f2",
  senderPlatformId: "7001",
  sentAt: at("2026-11-14T09:00:00Z"),
  text: "<b>Open</b> today?",
};

describe("the direct messages' views", () => {
  it("show a conversation's row, unread, in both languages", async () => {
    const view = (
      <ConversationRowView
        channel={channel}
        conversation={conversation}
        current={false}
        href={`/${workspaceId}/inbox/messages/${conversation.id}`}
        link={RowLink}
      />
    );

    const english = await render("en", view);
    const french = await render("fr", view);

    expect(english).toContain(
      `href="/${workspaceId}/inbox/messages/${conversation.id}"`
    );
    expect(english).toContain("With A synthetic reader");
    expect(english).toMatch(/Unread[\s\S]*2 messages/u);
    expect(french).toContain("Avec A synthetic reader");
    expect(french).toContain("Non lue");
  });

  it("show what someone wrote as text, never as markup, without the files", async () => {
    const html = await render(
      "en",
      <DirectMessageView conversation={conversation} message={message} />
    );

    expect(html).toContain("&lt;b&gt;Open&lt;/b&gt; today?");
    expect(html).not.toContain("<b>Open</b>");
    expect(html).toContain("A synthetic reader");
    expect(html).toContain("reader@social.example");
    expect(html).toContain("1 file, not shown");
  });

  it("lay each message out flat, with an avatar, the account's own as the account", async () => {
    const theirs = await render(
      "en",
      <DirectMessageView conversation={conversation} message={message} />
    );

    const own = await render(
      "fr",
      <DirectMessageView
        conversation={conversation}
        message={{ ...message, attachments: 0, fromAccount: true }}
      />
    );

    expect(theirs).toContain(">A<");
    expect(theirs).not.toContain("rounded-md border");
    expect(theirs).not.toContain("bg-muted ml-8");
    expect(own).toContain("Le compte");
    expect(own).not.toContain("fichier");
  });

  it("sum a conversation up: who, on which channel, unread, private, and the quiet ways out", async () => {
    const html = await render(
      "en",
      <ConversationSummaryView
        actions={<button type="button">Mark as read</button>}
        channel={channel}
        conversation={conversation}
      />
    );

    const read = await render(
      "fr",
      <ConversationSummaryView
        channel={undefined}
        conversation={{ ...conversation, unread: false }}
      />
    );

    expect(
      [
        "With A synthetic reader",
        "bg-brand",
        "Unread",
        "2 messages",
        "These messages are private",
        ">Mark as read<",
      ].filter((text) => !html.includes(text))
    ).toStrictEqual([]);
    expect(read).toContain("Lue");
    expect(read).not.toContain("bg-brand");
  });

  it("hang a message sent from Peal behind a line, with its text, how it ended and quiet answers", async () => {
    const html = await render(
      "en",
      <ul>
        <OutgoingMessageView
          actions={
            <ConfirmMessageView disabled={false} onConfirm={constVoid} />
          }
          message={{
            authorId: null,
            conversationId: conversation.id,
            createdAt: at("2026-11-14T09:30:00Z"),
            id: "00000000-0000-7000-8000-0000000000f3",
            platformMessageId: null,
            reason: "noResponse",
            settledAt: at("2026-11-14T09:31:00Z"),
            status: "unconfirmed",
            text: "<i>Yes</i>, until six.",
          }}
        />
      </ul>
    );

    expect(
      [
        "border-l-2",
        "Sent from Peal on Nov 14, 2026",
        "Message not confirmed yet",
        "&lt;i&gt;Yes&lt;/i&gt;, until six.",
        "It went out",
        // Quiet: ghost and extra small, never an outlined button.
        "h-6 gap-1 px-2 text-xs",
      ].filter((text) => !html.includes(text))
    ).toStrictEqual([]);
    expect(html).not.toContain("border-border bg-background");
  });

  it("say a message is private, and keep the box shut while one is on its way", async () => {
    const html = await render(
      "fr",
      <MessageBoxView
        error={null}
        maximum={5000}
        pending
        sending={false}
        text="Bonjour"
        onChange={constVoid}
        onSend={constVoid}
      />
    );

    expect(html).toContain("ne peut pas être repris");
    expect(html).toMatch(/7 sur 5\s000 caractères/u);
    expect(html).toContain("disabled");
  });

  it("show a channel's messages read or not as a switch named by the channel", async () => {
    const off = await render(
      "en",
      <ChannelMessagesView
        channel={channel}
        disabled={false}
        on={false}
        onSwitch={constVoid}
      />
    );

    const on = await render(
      "fr",
      <ChannelMessagesView channel={channel} disabled on onSwitch={constVoid} />
    );

    expect(off).toContain('role="switch"');
    expect(off).toContain('aria-checked="false"');
    expect(off).toMatch(
      /<label for="(?<id>[^"]+)"[^>]*>@studio@social\.example on Mastodon<\/label>.*id="\k<id>"[^>]*role="switch"/u
    );
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain("data-disabled");
  });

  it("offer to allow Bluesky's direct messages where the account must allow them first", async () => {
    const html = await render(
      "en",
      <ChannelMessagesView
        channel={{ ...channel, platform: "bluesky" }}
        disabled={false}
        on={false}
        onGrant={constVoid}
        onSwitch={constVoid}
      />
    );

    expect(html).toContain("Allow, on Bluesky");
    expect(html).not.toContain('role="switch"');
  });

  it("say until when Messenger and Instagram take an answer, and why the box is gone once they do not", async () => {
    const open = await render(
      "en",
      <ReplyWindowView
        window={{
          closesAt: at("2026-11-15T08:59:00Z"),
          open: true,
          personClosesAt: null,
        }}
      />
    );

    const shut = await render(
      "fr",
      <ReplyWindowView
        window={{
          closesAt: at("2026-11-15T08:59:00Z"),
          open: false,
          personClosesAt: null,
        }}
      />
    );

    const first = await render(
      "en",
      <ReplyWindowView
        window={{ closesAt: null, open: false, personClosesAt: null }}
      />
    );

    expect(open).toContain("You can answer until Nov 15, 2026, 8:59");
    expect(shut).toContain("24 heures");
    expect(first).toContain("never writes first");
  });

  it("say until when a person may answer by hand past the 24 hours, with Meta's Human Agent tag", async () => {
    const window = {
      closesAt: at("2026-11-15T08:59:00Z"),
      personClosesAt: at("2026-11-21T08:59:00Z"),
    };

    const within = await render(
      "en",
      <ReplyWindowView personOpen window={{ ...window, open: true }} />
    );

    const byHand = await render(
      "en",
      <ReplyWindowView personOpen window={{ ...window, open: false }} />
    );

    const byHandFr = await render(
      "fr",
      <ReplyWindowView personOpen window={{ ...window, open: false }} />
    );

    expect(within).toContain("You can answer until Nov 15, 2026, 8:59");
    expect(within).toContain("yourself until Nov 21, 2026, 8:59");
    expect(byHand).toContain(
      "you can still answer yourself until Nov 21, 2026, 8:59"
    );
    expect(byHand).toContain("Human Agent");
    expect(byHandFr).toContain("7 jours");
  });

  it("say when the time a person may answer by hand ended", async () => {
    const ended = await render(
      "en",
      <ReplyWindowView
        personOpen={false}
        window={{
          closesAt: at("2026-11-15T08:59:00Z"),
          open: false,
          personClosesAt: at("2026-11-21T08:59:00Z"),
        }}
      />
    );

    expect(ended).toContain("7 days");
    expect(ended).toContain("ended Nov 21, 2026, 8:59");
  });

  it("offer to allow Meta's direct messages, and say who may write before Meta's review", async () => {
    const page = await render(
      "en",
      <ChannelMessagesView
        channel={{ ...channel, platform: "facebook" }}
        disabled={false}
        on={false}
        onGrant={constVoid}
        onSwitch={constVoid}
      />
    );

    const instagram = await render(
      "fr",
      <ChannelMessagesView
        channel={{ ...channel, platform: "instagram" }}
        disabled={false}
        on={false}
        onSwitch={constVoid}
      />
    );

    expect(page).toContain("Allow, on Facebook");
    expect(page).toContain("App Review");
    expect(instagram).toContain("Outils connectés");
  });

  it("offer no switch where Peal reads none of the channel's messages, and say why", async () => {
    const unified = {
      ...channel,
      connection: "unifiedLogin",
      platform: "instagram",
    } as const;

    const english = await render(
      "en",
      <ChannelMessagesView
        channel={unified}
        disabled={false}
        on={false}
        onSwitch={constVoid}
        unsupported
      />
    );

    const french = await render(
      "fr",
      <ChannelMessagesView
        channel={unified}
        disabled={false}
        on={false}
        onSwitch={constVoid}
        unsupported
      />
    );

    expect(english).toContain(
      "Peal doesn’t read the messages of an account connected through a business portfolio."
    );
    expect(english).not.toContain('role="switch"');
    expect(english).not.toContain("<button");
    expect(english).not.toContain("App Review");
    expect(french).toContain("via un portefeuille business");
  });

  it("still lets a channel whose messages are read turn them off", async () => {
    const html = await render(
      "en",
      <ChannelMessagesView
        channel={{ ...channel, platform: "instagram" }}
        disabled={false}
        on
        onSwitch={constVoid}
        unsupported
      />
    );

    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
  });
});

describe(readsNoMessages, () => {
  it("names the channels whose messages Peal cannot read", () => {
    expect(
      readsNoMessages({
        ...channel,
        connection: "unifiedLogin",
        platform: "instagram",
      })
    ).toBeTruthy();
    expect(
      readsNoMessages({
        ...channel,
        connection: "facebookLogin",
        platform: "instagram",
      })
    ).toBeFalsy();
    expect(
      readsNoMessages({
        ...channel,
        connection: "instagramLogin",
        platform: "instagram",
      })
    ).toBeFalsy();
    expect(readsNoMessages(channel)).toBeFalsy();
  });
});
