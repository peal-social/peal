import { DateTime, Duration, Option, Result, Schema } from "effect";

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
      // When Meta sent it: milliseconds since the epoch on Messenger's
      // pages, read as seconds when it is too small to be milliseconds.
      time: Schema.optionalKey(Schema.Number),
    })
  ),
  object: Schema.Literals(["page", "instagram"]),
});

// One batch, or a list of them, as Instagram's examples write it.
const decodeEnvelope = Schema.decodeUnknownResult(
  Schema.fromJsonString(EnvelopeSchema)
);

const decodeEnvelopes = Schema.decodeUnknownResult(
  Schema.fromJsonString(Schema.Array(EnvelopeSchema))
);

type Envelope = typeof EnvelopeSchema.Type;

// Meta's text is UTF-8: bytes that are not are no event.
const utf8 = new TextDecoder("utf-8", { fatal: true });

const idOf = (id: number | string) =>
  storableLine(String(id), maxPlatformIdLength);

/**
 * How old an entry may be when it arrives: Meta retries a failed delivery
 * for an hour at most, so an older one was kept by someone and sent again.
 */
export const maxEventAge = Duration.days(1);

// Below this, a `time` is seconds, not milliseconds (before 1973 as ms).
const smallestMillis = 100_000_000_000;

type Entry = Envelope["entry"][number];

const isStale = (entry: Entry, now: DateTime.Utc): boolean => {
  if (entry.time === undefined) {
    return false;
  }

  const millis = entry.time < smallestMillis ? entry.time * 1000 : entry.time;

  return DateTime.toEpochMillis(now) - millis > Duration.toMillis(maxEventAge);
};

const eventsOf = (
  entries: readonly Entry[],
  platform: MessageEvent["platform"]
) =>
  entries.flatMap((entry) =>
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

/** What a signed body says: its events, and the entries left out as too old. */
export interface MetaEvents {
  readonly events: readonly MessageEvent[];
  readonly stale: number;
}

const readEnvelope = (envelope: Envelope, now: DateTime.Utc): MetaEvents => {
  const platform = envelope.object === "page" ? "facebook" : "instagram";
  const fresh = envelope.entry.filter((entry) => !isStale(entry, now));

  return {
    events: eventsOf(fresh, platform),
    stale: envelope.entry.length - fresh.length,
  };
};

/**
 * The events of a body Meta signed, as ids: one a messaging item, its
 * account the entry's (a Page, `object: "page"`, is `facebook`; an
 * Instagram account, `instagram`), but for the entries sent over
 * `maxEventAge` before `now`, which are only counted: a signed body
 * replayed later causes nothing. A failure when the bytes are not UTF-8
 * JSON of one of those objects; it says nothing of what they hold.
 */
export const decodeMetaEvents = (
  body: Uint8Array,
  now: DateTime.Utc
): Result.Result<MetaEvents, "unreadable"> => {
  let text: string;

  try {
    text = utf8.decode(body);
  } catch {
    return Result.fail("unreadable");
  }

  const envelopes = decodeEnvelope(text).pipe(
    Result.map((envelope): readonly Envelope[] => [envelope]),
    Result.orElse(() => decodeEnvelopes(text))
  );

  return envelopes.pipe(
    Result.map((decoded) => {
      const read = decoded.map((envelope) => readEnvelope(envelope, now));

      return {
        events: read.flatMap(({ events }) => events),
        stale: read.reduce((total, { stale }) => total + stale, 0),
      };
    }),
    Result.mapError(() => "unreadable" as const)
  );
};
