import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { constVoid } from "effect/Function";
import { NextIntlClientProvider } from "next-intl";
import { inboxReviewRetentionDays } from "peal-contract";
import type {
  SocialChannel,
  InboxReview,
  InboxReviewThread,
} from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ReviewThreadRowView } from "#components/inbox/inbox-rows.tsx";
import type { InboxRowLink } from "#components/inbox/inbox-rows.tsx";
import {
  ReviewReplyBoxView,
  ReviewSummaryView,
  ReviewView,
} from "#components/inbox/review-views.tsx";
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

const RowLink: InboxRowLink = ({ children, ...props }) => (
  <a {...props}>{children}</a>
);

const workspaceId = "5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f";

const channel: SocialChannel = {
  avatarUrl: null,
  connection: null,
  displayName: "Synthetic bakery",
  handle: "Synthetic bakery",
  id: "00000000-0000-7000-8000-0000000000c2",
  label: null,
  platform: "googleBusiness",
  status: { _tag: "active" },
  tokenExpiresAt: null,
};

const thread: InboxReviewThread = {
  averageRating: 4.46,
  channelId: channel.id,
  id: "00000000-0000-7000-8000-0000000000e1",
  kind: "reviews",
  lastCollectedAt: at("2026-11-14T09:27:00Z"),
  lastReviewAt: at("2026-11-14T08:00:00Z"),
  reviews: 2,
  totalReviewCount: 31,
  unanswered: 1,
};

const review: InboxReview = {
  id: "00000000-0000-7000-8000-0000000000e2",
  markedAnswered: false,
  photos: 2,
  rating: 2,
  receivedAt: at("2026-11-14T09:27:00Z"),
  reply: {
    moderation: "pending",
    text: "Sorry about the wait.",
    updatedAt: at("2026-11-14T10:00:00Z"),
  },
  reviewerName: null,
  state: "answered",
  text: "<b>Slow</b> service.",
  threadId: thread.id,
  updatedAt: at("2026-11-14T08:00:00Z"),
  writtenAt: at("2026-11-14T08:00:00Z"),
};

describe("the reviews' views", () => {
  it("show a location's counts and Google's figures, in both languages", async () => {
    const view = (
      <ReviewThreadRowView
        channel={channel}
        current={false}
        href={`/${workspaceId}/inbox/reviews/${thread.id}`}
        link={RowLink}
        thread={thread}
      />
    );

    const english = await render("en", view);

    expect(english).toContain(`/${workspaceId}/inbox/reviews/${thread.id}`);
    expect(english).toContain("1 waiting of 2");
    expect(english).toContain("4.5 stars on average · 31 on Google");

    const french = await render("fr", view);

    expect(french).toContain("1 en attente sur 2");
    expect(french).toContain("4,5 étoiles en moyenne · 31 sur Google");
  });

  it("show a review as text, its stars, its photos counted, and the location's reply", async () => {
    const html = await render(
      "en",
      <ReviewView actions={null} replies={[]} review={review} />
    );

    expect(html).toContain("&lt;b&gt;Slow&lt;/b&gt; service.");
    expect(
      [
        "2 stars",
        "Someone who stays anonymous",
        "2 photos, not shown",
        "Google is checking it",
        "Sorry about the wait.",
      ].filter((text) => !html.includes(text))
    ).toStrictEqual([]);
    expect(html).not.toContain("photos.example");
  });

  it("lay a review out flat, with its state in a muted line and no badge", async () => {
    const waiting = await render(
      "en",
      <ReviewView
        actions={<button type="button">Reply</button>}
        replies={[]}
        review={{
          ...review,
          reply: null,
          reviewerName: "Ada",
          state: "new",
        }}
      />
    );

    expect(
      ["Waiting for an answer", "bg-brand", ">A<", ">Reply<"].filter(
        (text) => !waiting.includes(text)
      )
    ).toStrictEqual([]);
    expect(waiting).not.toContain('data-slot="badge"');
    expect(waiting).not.toContain("border-l-2");
  });

  it("hang the location's reply and the replies sent from Peal under the review", async () => {
    const html = await render(
      "fr",
      <ReviewView
        replies={[
          {
            authorId: null,
            createdAt: at("2026-11-14T09:59:00Z"),
            id: "00000000-0000-7000-8000-0000000000e3",
            reason: "noResponse",
            reviewId: review.id,
            settledAt: at("2026-11-14T10:00:00Z"),
            status: "unconfirmed",
            text: "Sorry about the wait.",
            threadId: thread.id,
          },
        ]}
        review={review}
      />
    );

    expect(html).toContain("border-l-2");
    expect(html).toMatch(/border-l-2[\s\S]*La réponse de l’établissement/u);
    expect(html).toContain("Google la vérifie");
    expect(html).toContain("Réponse pas encore confirmée");
    expect(html).toContain("text-destructive");
  });

  it("sum a location up: which, what waits, Google's figures and how long Peal keeps a review", async () => {
    const english = await render(
      "en",
      <ReviewSummaryView channel={channel} thread={thread} />
    );

    const french = await render(
      "fr",
      <ReviewSummaryView
        channel={undefined}
        thread={{ ...thread, unanswered: 0 }}
      />
    );

    expect(
      [
        "Location of",
        "1 waiting of 2",
        "4.5 stars on average · 31 on Google",
        `Peal keeps each review for ${String(inboxReviewRetentionDays)} days`,
        "bg-brand",
      ].filter((text) => !english.includes(text))
    ).toStrictEqual([]);
    expect(french).toContain("0 en attente sur 2");
    expect(french).not.toContain("bg-brand");
  });

  it("count a reply in Google's bytes, and hold the send past them", async () => {
    const html = await render(
      "fr",
      <ReviewReplyBoxView
        bytes={4100}
        error={null}
        maximum={4096}
        pending={false}
        reviewer={null}
        sending={false}
        text="é"
        onChange={constVoid}
        onSend={constVoid}
      />
    );

    expect(html).toMatch(/4\s100 sur 4\s096 octets/u);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Répondre à une personne anonyme");
  });

  it("name whom the one composer answers", async () => {
    const html = await render(
      "en",
      <ReviewReplyBoxView
        bytes={0}
        error={null}
        inputId="composer"
        maximum={4096}
        pending
        reviewer="Ada"
        sending={false}
        text=""
        onChange={constVoid}
        onSend={constVoid}
      />
    );

    expect(html).toContain("Reply to Ada as the location");
    expect(html).toContain('id="composer"');
    expect(html).toContain("A reply to this review is on its way");
  });
});
