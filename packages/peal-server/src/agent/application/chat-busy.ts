import { Schema } from "effect";

/** The chat has a run under way, on this server or another: one at a time, so its messages stay in order. */
export class ChatBusy extends Schema.TaggedError<ChatBusy>()("ChatBusy", {}) {}
