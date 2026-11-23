import { DateTime, Schema } from "effect";
import { agentApprovalLifetimeHours } from "peal-contract/agent";
import type { AgentApprovalPost, AgentMessage } from "peal-contract/agent";

// What an approval card lists of a change beyond its text: a channel's
// platform options, and how long a part waits. Each comes from the
// server's request, never the agent's words, and the card shows all of
// it: what goes out is never hidden.

/**
 * A platform option as the card lists it: its field, its value as text,
 * and the file of the library it names (a video's thumbnail, a reel's
 * cover), which the card shows as the file itself.
 */
export interface OptionLine {
  readonly field: string;
  readonly mediaId: string | null;
  readonly value: string;
}

// The options that name a file of the library, by their field's name:
// `thumbnailMediaId`, `coverMediaId`.
const namesMedia = (field: string) => field.endsWith("MediaId");

type TargetOptions = NonNullable<
  AgentApprovalPost["targets"][number]["options"]
>;

const isText = Schema.is(Schema.String);

const isTexts = Schema.is(Schema.Array(Schema.String));

const valueOf = (value: Schema.Json): string => {
  if (isText(value)) {
    return value;
  }

  return isTexts(value) ? value.join(", ") : JSON.stringify(value);
};

/**
 * A channel's options, each set field with its value, in the order of
 * their names; the platform's name, which tags them, and unset fields
 * left out.
 */
export const optionLinesOf = (
  options: TargetOptions | null
): readonly OptionLine[] =>
  options === null
    ? []
    : Object.entries(options)
        .filter(([field, value]) => field !== "platform" && value !== null)
        .toSorted(([one], [other]) => one.localeCompare(other, "en"))
        .map(([field, value]) => ({
          field,
          mediaId: namesMedia(field) && isText(value) ? value : null,
          value: valueOf(value),
        }));

/** A wait, in the largest unit that says it exactly. */
export interface Delay {
  readonly unit: "day" | "hour" | "minute" | "second";
  readonly value: number;
}

/**
 * How long something lasts, as the card says it: a part's wait after the
 * one before, a poll's time open.
 */
export const delayOf = (seconds: number): Delay => {
  if (seconds >= 86_400 && seconds % 86_400 === 0) {
    return { unit: "day", value: seconds / 86_400 };
  }

  if (seconds >= 3600 && seconds % 3600 === 0) {
    return { unit: "hour", value: seconds / 3600 };
  }

  if (seconds >= 60 && seconds % 60 === 0) {
    return { unit: "minute", value: seconds / 60 };
  }

  return { unit: "second", value: seconds };
};

/**
 * Whether an answer's changes waited past their lifetime: they read as
 * expired, as the server answers them once the chat is read again.
 */
export const lapsedAt = (
  message: AgentMessage,
  now: DateTime.Utc | null
): boolean =>
  now !== null &&
  DateTime.isGreaterThan(
    now,
    DateTime.add(message.createdAt, { hours: agentApprovalLifetimeHours })
  );
