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

import { ChannelMessagesView } from "#components/inbox/message-settings.tsx";
import {
  ConversationRowView,
  DirectMessageView,
  MessageBoxView,
  ReplyWindowView,
} from "#components/inbox/message-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

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

const link = (href: string, label: string) => <a href={href}>{label}</a>;

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
        link={link}
        workspaceId={workspaceId}
      />
    );

    const english = await render("en", view);
    const french = await render("fr", view);

    expect(english).toContain(
      `href="/app/${workspaceId}/inbox/messages/${conversation.id}"`
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
    expect(html).toContain("1 file, not shown");
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

  it("say whether a channel's messages are read, and that turning them off deletes them", async () => {
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

    expect(off).toContain("Not read");
    expect(off).toContain("Read its messages");
    expect(on).toContain("supprimer");
    expect(on).toContain("disabled");
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
    expect(html).not.toContain("Read its messages");
  });

  it("say until when Messenger and Instagram take an answer, and why the box is gone once they do not", async () => {
    const open = await render(
      "en",
      <ReplyWindowView
        window={{ closesAt: at("2026-11-15T08:59:00Z"), open: true }}
      />
    );

    const shut = await render(
      "fr",
      <ReplyWindowView
        window={{ closesAt: at("2026-11-15T08:59:00Z"), open: false }}
      />
    );

    const first = await render(
      "en",
      <ReplyWindowView window={{ closesAt: null, open: false }} />
    );

    expect(open).toContain("You can answer until Nov 15, 2026, 8:59");
    expect(shut).toContain("24 heures");
    expect(first).toContain("never writes first");
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
});
