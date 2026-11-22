import { Schema } from "effect";

/**
 * The workspace used every request of the day its source allows: the
 * server's model's daily quota (`server`, off a server that bills), or the
 * requests its own text provider may be sent in a day (`workspace`).
 */
export class DayExhausted extends Schema.TaggedError<DayExhausted>()(
  "DayExhausted",
  {
    dailyLimit: Schema.Int,
    resetsAt: Schema.DateTimeUtc,
    source: Schema.Literals(["workspace", "server"]),
  }
) {}
