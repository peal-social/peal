import type { Option } from "effect";
import { Schema } from "effect";

/**
 * The storage key a tab of Peal writes its news to, and removes at once:
 * the browser tells every other tab of the same origin of the change.
 */
export const tabsKey = "peal.measurement-news";

/**
 * What one tab tells the others: the person's new choice, or that they
 * signed out. Each then follows at once, rather than when it is reloaded.
 */
export const TabNewsSchema = Schema.Union([
  Schema.Struct({
    consent: Schema.Literals(["granted", "refused"]),
    decidedAt: Schema.String,
    kind: Schema.Literal("chosen"),
  }),
  Schema.Struct({ kind: Schema.Literal("signedOut") }),
]);

export type TabNews = typeof TabNewsSchema.Type;

/** What another tab wrote, none for anything else. */
export const tabNewsOf = (written: string | null): Option.Option<TabNews> =>
  Schema.decodeUnknownOption(Schema.fromJsonString(TabNewsSchema))(written);

/** The choice as the server last told it, or as this browser just made it. */
export interface ConsentNow {
  readonly consent: "granted" | "refused" | "undecided";
  readonly decidedAt: string | null;
}

/** A choice made in this browser, and what the server said when it was. */
export interface Chosen extends ConsentNow {
  readonly over: ConsentNow;
}

/**
 * The choice that holds: one made in this browser while the server's
 * answer is still the one it was made over, the server's once the page
 * read it again (after a refresh, another tab's choice, an expiry).
 */
export const consentNow = (
  server: ConsentNow,
  chosen: Chosen | null
): ConsentNow =>
  chosen !== null &&
  chosen.over.consent === server.consent &&
  chosen.over.decidedAt === server.decidedAt
    ? { consent: chosen.consent, decidedAt: chosen.decidedAt }
    : server;
