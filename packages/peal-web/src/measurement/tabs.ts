import { Option, Schema } from "effect";

/**
 * The storage key a tab of Peal writes its news to, and removes at once:
 * the browser tells every other tab of the same origin of the change.
 */
export const tabsKey = "peal.measurement-news";

/**
 * What one tab tells the others: the person's new choice, that they signed
 * out, or that someone signed in. Each then follows at once, rather than
 * when it is reloaded.
 */
export const TabNewsSchema = Schema.Union([
  Schema.Struct({
    consent: Schema.Literals(["granted", "refused"]),
    decidedAt: Schema.String,
    kind: Schema.Literal("chosen"),
  }),
  Schema.Struct({ kind: Schema.Literal("signedOut") }),
  Schema.Struct({ kind: Schema.Literal("signedIn") }),
]);

export type TabNews = typeof TabNewsSchema.Type;

/**
 * Tells the browser's other tabs: written, then removed at once, so
 * nothing stays. A browser that refuses storage tells nothing, and the
 * other tabs follow when they are shown again.
 */
export const tellTabs = (news: TabNews): void => {
  try {
    localStorage.setItem(tabsKey, JSON.stringify(news));
    localStorage.removeItem(tabsKey);
  } catch {
    // Nothing more to do.
  }
};

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

const AnswerSchema = Schema.Struct({
  browserAnalytics: Schema.optionalKey(
    Schema.NullOr(
      Schema.Struct({
        consent: Schema.Literals(["granted", "refused", "undecided"]),
        decidedAt: Schema.NullOr(Schema.String),
      })
    )
  ),
  user: Schema.Struct({ id: Schema.String }),
});

/** What the page holds of the measurement, and for whom. */
export interface Held extends ConsentNow {
  readonly userId: string;
}

/**
 * What GET /api/me's answer says against what the page holds: `same`;
 * `changed` for another choice, one that expired, or none measured any
 * more; `otherPerson` once someone else signed in, in another tab. An
 * answer it cannot read says nothing changed.
 */
export const answerNews = (
  answer: string,
  held: Held
): "changed" | "otherPerson" | "same" =>
  Option.match(
    Schema.decodeUnknownOption(Schema.fromJsonString(AnswerSchema))(answer),
    {
      onNone: () => "same" as const,
      onSome: ({ browserAnalytics, user }) => {
        if (user.id !== held.userId) {
          return "otherPerson" as const;
        }

        return browserAnalytics === undefined ||
          browserAnalytics === null ||
          browserAnalytics.consent !== held.consent ||
          browserAnalytics.decidedAt !== held.decidedAt
          ? ("changed" as const)
          : ("same" as const);
      },
    }
  );
