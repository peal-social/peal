import { Option, Result, Schema } from "effect";

import type { MessageEvent } from "#engagement/application/receive-message-events.ts";
import { maxPlatformIdLength } from "#engagement/domain/direct-message.ts";
import { storableLine } from "#shared/domain/platform-text.ts";

// What Peal reads of Meta's events, and nothing more: the object, each
// entry's account, and of each messaging item a message's id and whether
// its author took it back. Every other key (texts, senders, recipients,
// attachments and their addresses) is left out by the schema, so it never
// reaches a value that outlives the decoding. Meta's pages read
// 2026-11-16: Messenger's "messages", "message_echoes" and
// "message_edits" events; Instagram's "Webhooks" examples (`is_deleted`
// "Included when a customer deletes a message").

const IdSchema = Schema.Union([Schema.String, Schema.Number]);

const MessagingSchema = Schema.Struct({
  message: Schema.optionalKey(
    Schema.Struct({
      // A handover's note (`admin_text`) comes without one.
      is_deleted: Schema.optionalKey(Schema.Boolean),
      is_echo: Schema.optionalKey(Schema.Boolean),
      mid: Schema.optionalKey(Schema.String),
    })
  ),
  message_edit: Schema.optionalKey(
    Schema.Struct({ mid: Schema.optionalKey(Schema.String) })
  ),
});

const EnvelopeSchema = Schema.Struct({
  entry: Schema.Array(
    Schema.Struct({
      id: IdSchema,
      messaging: Schema.optionalKey(Schema.Array(MessagingSchema)),
    })
  ),
  object: Schema.Literals(["page", "instagram"]),
});

// One batch, or a list of them, as Instagram's examples write it.
const decodeEnvelopes = Schema.decodeUnknownResult(
  Schema.fromJsonString(
    Schema.Union([EnvelopeSchema, Schema.Array(EnvelopeSchema)])
  )
);

type Envelope = typeof EnvelopeSchema.Type;

// Meta's text is UTF-8: bytes that are not are no event.
const utf8 = new TextDecoder("utf-8", { fatal: true });

const idOf = (id: number | string) =>
  storableLine(String(id), maxPlatformIdLength);

const eventsOf = (envelope: Envelope): readonly MessageEvent[] => {
  const platform = envelope.object === "page" ? "facebook" : "instagram";

  return envelope.entry.flatMap((entry) =>
    (entry.messaging ?? []).map((item): MessageEvent => {
      const mid = item.message?.mid ?? item.message_edit?.mid;

      return {
        accountId: idOf(entry.id),
        deleted: item.message?.is_deleted === true,
        messageId:
          mid === undefined || idOf(mid) === ""
            ? Option.none()
            : Option.some(idOf(mid)),
        platform,
      };
    })
  );
};

/**
 * The events of a body Meta signed, as ids: one a messaging item, its
 * account the entry's (a Page, `object: "page"`, is `facebook`; an
 * Instagram account, `instagram`). A failure when the bytes are not UTF-8
 * JSON of one of those objects; it says nothing of what they hold.
 */
export const decodeMetaEvents = (
  body: Uint8Array
): Result.Result<readonly MessageEvent[], "unreadable"> => {
  let text: string;

  try {
    text = utf8.decode(body);
  } catch {
    return Result.fail("unreadable");
  }

  return decodeEnvelopes(text).pipe(
    Result.map((decoded) =>
      (Array.isArray(decoded) ? decoded : [decoded]).flatMap(eventsOf)
    ),
    Result.mapError(() => "unreadable" as const)
  );
};
