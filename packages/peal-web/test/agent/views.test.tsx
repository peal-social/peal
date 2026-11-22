import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "next-intl";
import type { AgentApproval, AgentMessage } from "peal-contract/agent";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { emptyChat } from "#agent/run-state.ts";
import type { ChatState } from "#agent/run-state.ts";
import { AgentMarkdown } from "#components/agent/agent-markdown.tsx";
import { PanelEmptyView } from "#components/agent/agent-views.tsx";
import {
  AgentOffView,
  ApprovalCardView,
  TranscriptView,
} from "#components/agent/chat-views.tsx";
import type { ChatLinks } from "#components/agent/chat-views.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { loadMessages } from "#i18n/messages.ts";

const PlainLink: LinkComponent = ({ children, ...props }) => (
  <a data-app-link="" {...props}>
    {children}
  </a>
);

const links: ChatLinks = {
  link: PlainLink,
  post: (postId) => `/synthetic-studio/posts/${postId}`,
  thread: (threadId) => `/synthetic-studio/inbox/${threadId}`,
};

const render = async (node: ReactNode, locale: Locale = "en") =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="Europe/Paris"
    >
      {node}
    </NextIntlClientProvider>
  );

const at = DateTime.makeUnsafe("2026-11-22T08:51:00Z");

const answer = (fields: Partial<AgentMessage>): AgentMessage => ({
  approvals: [],
  cards: [],
  createdAt: at,
  durationMs: null,
  id: "m2",
  media: [],
  outcome: null,
  rating: null,
  role: "assistant",
  steps: [],
  text: "",
  ...fields,
});

const asked: AgentMessage = {
  ...answer({ id: "m1" }),
  role: "user",
  text: "Find my drafts",
};

const transcript = async (state: ChatState) =>
  await render(
    <TranscriptView
      actions={{
        onCopy: () => {
          // Not pressed in a render.
        },
        onRate: () => {
          // Not pressed in a render.
        },
      }}
      links={links}
      nameOf={(id) => (id === "channel-1" ? "Client A (@client)" : null)}
      now={DateTime.makeUnsafe("2026-11-22T12:00:00Z")}
      state={state}
      onAnswer={() => {
        // Not pressed in a render.
      }}
    />
  );

describe(AgentMarkdown, () => {
  it("renders the agent's marks as elements, never its HTML", async () => {
    const html = await render(
      <AgentMarkdown
        link={PlainLink}
        text={
          "**Two** drafts <b>x</b>\n\n- [Open](/s/posts/p1)\n- [Docs](https://docs.example.com)"
        }
      />
    );

    expect([
      html.includes("<strong"),
      html.includes("&lt;b&gt;x&lt;/b&gt;"),
      html.includes('data-app-link="" href="/s/posts/p1"'),
      html.includes(
        'href="https://docs.example.com/" target="_blank" rel="noopener noreferrer"'
      ),
    ]).toStrictEqual([true, true, true, true]);
  });
});

describe(TranscriptView, () => {
  it("dates the chat, shows the person's message, and thinks before the answer", async () => {
    const html = await transcript({
      ...emptyChat,
      messages: [asked],
      run: { messageId: null, startedAt: at },
    });

    expect([
      html.includes("Today"),
      html.includes("Find my drafts"),
      html.includes("Thinking…"),
    ]).toStrictEqual([true, true, true]);
  });

  it("shows a running step as a live line", async () => {
    const html = await transcript({
      ...emptyChat,
      messages: [
        asked,
        answer({
          steps: [
            { at: 13, callId: "c1", state: "running", tool: "list_drafts" },
          ],
          text: "Let me look. ",
        }),
      ],
      run: { messageId: "m2", startedAt: at },
    });

    // The text, then the step's live line where it falls.
    expect(html.indexOf("Let me look.")).toBeLessThan(
      html.indexOf("Looking at posts…")
    );
    expect(html).not.toContain("Thinking…");
  });

  it("folds a finished answer's steps into how long it worked, with its ratings", async () => {
    const html = await transcript({
      ...emptyChat,
      messages: [
        asked,
        answer({
          durationMs: 7000,
          outcome: "answered",
          steps: [{ at: 13, callId: "c1", state: "done", tool: "list_drafts" }],
          text: "Let me look. You have two drafts.",
        }),
      ],
    });

    expect([
      html.includes("Worked for 7 seconds"),
      html.includes("You have two drafts."),
      html.includes('aria-label="Good answer"'),
      html.includes('aria-label="Copy the answer"'),
    ]).toStrictEqual([true, true, true, true]);
  });

  it("folds the text before the steps away, keeping the answer in view", async () => {
    const html = await transcript({
      ...emptyChat,
      messages: [
        asked,
        answer({
          durationMs: 7000,
          outcome: "answered",
          steps: [{ at: 13, callId: "c1", state: "done", tool: "list_drafts" }],
          text: "Let me look. You have two drafts.",
        }),
      ],
    });

    // Closed, the fold renders nothing of what it holds.
    expect([
      html.includes("Let me look."),
      html.includes("Looked at posts"),
    ]).toStrictEqual([false, false]);
  });

  it("has no fold for an answer without steps", async () => {
    const html = await transcript({
      ...emptyChat,
      messages: [
        asked,
        answer({ durationMs: 7000, outcome: "answered", text: "Hello." }),
      ],
    });

    expect([
      html.includes("Worked for"),
      html.includes("Hello."),
    ]).toStrictEqual([false, true]);
  });

  it("says why a run failed, in the reader's language", async () => {
    const state: ChatState = {
      ...emptyChat,
      messages: [asked],
      problem: { _tag: "failed", reason: "timedOut" },
    };

    await expect(transcript(state)).resolves.toContain(
      "The language model took too long to answer."
    );
  });

  it("says a saved answer failed, once the run's own words are gone", async () => {
    const failed = answer({ durationMs: 400, outcome: "failed", text: "" });
    const note = "This answer stopped on an error.";

    const [saved, live] = await Promise.all([
      transcript({ ...emptyChat, messages: [asked, failed] }),
      transcript({
        ...emptyChat,
        messages: [asked, failed],
        problem: { _tag: "failed", reason: "timedOut" },
      }),
    ]);

    expect([saved.includes(note), live.includes(note)]).toStrictEqual([
      true,
      false,
    ]);
  });
});

const approval: AgentApproval = {
  at: DateTime.makeUnsafe("2026-11-23T08:00:00Z"),
  callId: "call-2",
  channelIds: ["channel-1", "channel-gone"],
  inReplyTo: null,
  postId: "post-1",
  state: "pending",
  text: "Our spring sale starts Monday.",
  threadId: null,
  tool: "schedule_post",
};

const approvalCard = async (shown: AgentApproval, locale: Locale = "en") =>
  await render(
    <ApprovalCardView
      approval={shown}
      busy={false}
      links={links}
      nameOf={(id) => (id === "channel-1" ? "Client A (@client)" : null)}
      onAnswer={() => {
        // Not pressed in a render.
      }}
    />,
    locale
  );

describe(ApprovalCardView, () => {
  it("says what the change does from the request, then Approve and Decline", async () => {
    const html = await approvalCard(approval);

    expect([
      html.includes("Schedule this post"),
      html.includes("Our spring sale starts Monday."),
      html.includes("Client A (@client)"),
      html.includes("1 other channel"),
      html.includes("9:00"),
      html.includes(">Approve<"),
      html.includes(">Decline<"),
      html.includes('href="/synthetic-studio/posts/post-1"'),
    ]).toStrictEqual([true, true, true, true, true, true, true, true]);
  });

  it("quotes the comment a reply answers, and its author", async () => {
    const html = await approvalCard({
      ...approval,
      inReplyTo: { author: "Claire Martin", text: "Is it a hybrid?" },
      postId: null,
      text: "Yes, a plug-in hybrid.",
      threadId: "thread-1",
      tool: "reply_to_comment",
    });

    expect([
      html.includes("Reply to this comment"),
      html.includes("Claire Martin wrote"),
      html.includes("Is it a hybrid?"),
      html.includes("Yes, a plug-in hybrid."),
    ]).toStrictEqual([true, true, true, true]);
  });

  it("shows how it was answered, without the buttons", async () => {
    const html = await approvalCard({ ...approval, state: "expired" }, "fr");

    expect([
      html.includes("Expiré"),
      html.includes(">Approuver<"),
    ]).toStrictEqual([true, false]);
  });
});

describe(AgentOffView, () => {
  it("links the assistant settings for those who may change them", async () => {
    const html = await render(
      <AgentOffView
        billingHref={null}
        link={PlainLink}
        reason="noModel"
        settingsHref="/synthetic-studio/settings/assistant"
      />
    );

    expect([
      html.includes("Set up a text provider"),
      html.includes("Ask an owner"),
    ]).toStrictEqual([true, false]);
  });

  it("asks for a payment method, and others to ask an admin", async () => {
    const html = await render(
      <AgentOffView
        billingHref="/synthetic-studio/billing"
        link={PlainLink}
        reason="paymentMethod"
        settingsHref={null}
      />
    );

    expect([
      html.includes("Add a payment method"),
      html.includes("Ask an owner"),
    ]).toStrictEqual([true, true]);
  });
});

describe(PanelEmptyView, () => {
  it.each(["en", "fr"] as const)(
    "welcomes the person with the examples (%s)",
    async (locale) => {
      const html = await render(
        <PanelEmptyView
          disabled={false}
          onPick={() => {
            // Not pressed in a render.
          }}
        />,
        locale
      );

      expect(html).toContain(
        locale === "en" ? "Welcome to Peal" : "Bienvenue dans Peal"
      );
    }
  );
});
