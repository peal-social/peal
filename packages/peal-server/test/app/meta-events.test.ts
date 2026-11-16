// What the server reads of Meta's events: an account's id, a message's id
// and whether its author took it back, never a text, a sender or a file.
// The samples are Meta's documented ones (Messenger's "messages",
// "message_echoes" and "message_edits" events, Instagram's messaging
// examples, read 2026-11-16), with synthetic values.
import { assert, describe, it } from "@effect/vitest";
import { DateTime, Option, Result } from "effect";
import type { Schema } from "effect";

import { decodeMetaEvents } from "#app/platform-events/meta-events.ts";

const encoder = new TextEncoder();

// A body Meta could send.
type Sample = typeof Schema.Json.Type;

const bytes = (value: Sample) => encoder.encode(JSON.stringify(value));

// When Meta sent the samples, in milliseconds as its pages write it, and
// when the server reads them: a minute later.
const sentAt = 1_763_288_400_000;
const now = DateTime.makeUnsafe(sentAt + 60_000);

const text = "Synthetic private words";
const sender = "synthetic-sender-7001";
const fileAddress = "https://lookaside.example/synthetic-story.jpg";

const messengerText = {
  entry: [
    {
      id: "synthetic-page-1",
      messaging: [
        {
          message: {
            mid: "m_synthetic_1",
            quick_reply: { payload: "synthetic" },
            text,
          },
          recipient: { id: "synthetic-page-1" },
          sender: { id: sender },
          timestamp: 1_458_692_752_478,
        },
      ],
      time: sentAt,
    },
  ],
  object: "page",
};

const messengerEcho = {
  entry: [
    {
      id: "synthetic-page-1",
      messaging: [
        {
          message: {
            app_id: 1_517_776_481_860_111,
            is_echo: true,
            metadata: "synthetic",
            mid: "m_synthetic_2",
            text,
          },
          recipient: { id: sender },
          sender: { id: "synthetic-page-1" },
          timestamp: 1_457_764_197_627,
        },
      ],
    },
  ],
  object: "page",
};

const messengerEdit = {
  entry: [
    {
      id: "synthetic-page-1",
      messaging: [
        {
          message_edit: { mid: "m_synthetic_3", num_edit: 1, text },
          recipient: { id: "synthetic-page-1" },
          sender: { id: sender },
          timestamp: 1_458_668_856_463,
        },
      ],
    },
  ],
  object: "page",
};

// A handover's note, which has no message id.
const messengerAdminText = {
  entry: [
    {
      id: "synthetic-page-1",
      messaging: [
        {
          message: { admin_text: text, handoff_reason: "other" },
          recipient: { id: "synthetic-page-1" },
          sender: { id: sender },
        },
      ],
    },
  ],
  object: "page",
};

const instagramStoryMention = {
  entry: [
    {
      id: "synthetic-instagram-1",
      messaging: [
        {
          message: {
            attachments: [
              { payload: { url: fileAddress }, type: "story_mention" },
            ],
            mid: "m_synthetic_4",
          },
          recipient: { id: "synthetic-instagram-1" },
          sender: { id: sender },
          timestamp: 1_700_000_000_000,
        },
      ],
      time: sentAt,
    },
  ],
  object: "instagram",
};

const instagramDeleted = {
  entry: [
    {
      id: "synthetic-instagram-1",
      messaging: [
        {
          message: { is_deleted: true, mid: "m_synthetic_5" },
          recipient: { id: "synthetic-instagram-1" },
          sender: { id: sender },
          timestamp: 1_700_000_000_000,
        },
      ],
    },
  ],
  object: "instagram",
};

// A comment's event on the same object: no message of it.
const instagramComment = {
  entry: [
    {
      changes: [
        {
          field: "comments",
          value: { from: { id: sender, username: "synthetic" }, text },
        },
      ],
      id: "synthetic-instagram-1",
    },
  ],
  object: "instagram",
};

// An entry sent at `time`, of one message.
const entry = (time: number, id: string) => ({
  id,
  messaging: [{ message: { mid: `m_${id}` } }],
  time,
});

const decoded = (value: Sample) =>
  Result.getOrThrow(decodeMetaEvents(bytes(value), now)).events;

describe(decodeMetaEvents, () => {
  it("reads a Page's message, echo and edit as ids", () => {
    assert.deepStrictEqual(
      [
        ...decoded(messengerText),
        ...decoded(messengerEcho),
        ...decoded(messengerEdit),
      ],
      ["m_synthetic_1", "m_synthetic_2", "m_synthetic_3"].map((messageId) => ({
        accountId: "synthetic-page-1",
        deleted: false,
        messageId: Option.some(messageId),
        platform: "facebook",
      }))
    );
  });

  it("reads a note without a message as a change to the account", () => {
    assert.deepStrictEqual(decoded(messengerAdminText), [
      {
        accountId: "synthetic-page-1",
        deleted: false,
        messageId: Option.none(),
        platform: "facebook",
      },
    ]);
  });

  it("reads Instagram's messages, and one its author took back", () => {
    assert.deepStrictEqual(
      [...decoded(instagramStoryMention), ...decoded(instagramDeleted)],
      [
        {
          accountId: "synthetic-instagram-1",
          deleted: false,
          messageId: Option.some("m_synthetic_4"),
          platform: "instagram",
        },
        {
          accountId: "synthetic-instagram-1",
          deleted: true,
          messageId: Option.some("m_synthetic_5"),
          platform: "instagram",
        },
      ]
    );
  });

  it("reads no message of an entry without messaging", () => {
    assert.deepStrictEqual(decoded(instagramComment), []);
  });

  it("reads a batch Meta sends as a list, as its Instagram examples write it", () => {
    assert.deepStrictEqual(
      decoded([instagramDeleted]).map(({ messageId }) => messageId),
      [Option.some("m_synthetic_5")]
    );
  });

  it("holds no text, sender or file address of any sample", () => {
    const all = [
      messengerText,
      messengerEcho,
      messengerEdit,
      messengerAdminText,
      instagramStoryMention,
      instagramDeleted,
      instagramComment,
    ].flatMap(decoded);

    const written = JSON.stringify(all);

    assert.isAbove(all.length, 0);
    assert.notInclude(written, text);
    assert.notInclude(written, sender);
    assert.notInclude(written, fileAddress);
    assert.notInclude(written, "synthetic-story");
  });

  it("cleans and bounds the ids it reads", () => {
    const [event] = decoded({
      entry: [
        {
          id: "synthetic\u0000-page\t\n",
          messaging: [{ message: { mid: `m${"x".repeat(600)}\uD800` } }],
        },
      ],
      object: "page",
    });

    assert.strictEqual(event?.accountId, "synthetic-page");
    assert.isAtMost(
      Option.getOrElse(event?.messageId ?? Option.none(), () => "").length,
      512
    );
    assert.notInclude(
      Option.getOrElse(event?.messageId ?? Option.none(), () => ""),
      "\uD800"
    );
  });

  it("refuses what is not one of the objects it reads", () => {
    for (const raw of [
      encoder.encode("not json"),
      bytes({ entry: [], object: "user" }),
      bytes({ object: "page" }),
      bytes(null),
      new Uint8Array([0xff, 0xfe, 0x7b]),
    ]) {
      assert.isTrue(Result.isFailure(decodeMetaEvents(raw, now)));
    }
  });

  it("leaves out an entry Meta sent over a day ago, in milliseconds or seconds", () => {
    const read = Result.getOrThrow(
      decodeMetaEvents(
        bytes({
          entry: [
            entry(sentAt, "fresh-millis"),
            entry(Math.floor(sentAt / 1000), "fresh-seconds"),
            entry(sentAt - 2 * 24 * 60 * 60 * 1000, "stale-millis"),
            entry(
              Math.floor(sentAt / 1000) - 2 * 24 * 60 * 60,
              "stale-seconds"
            ),
          ],
          object: "page",
        }),
        now
      )
    );

    assert.deepStrictEqual(
      read.events.map(({ accountId }) => accountId),
      ["fresh-millis", "fresh-seconds"]
    );
    assert.strictEqual(read.stale, 2);
  });
});
