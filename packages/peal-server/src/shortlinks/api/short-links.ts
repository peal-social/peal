import { DateTime, Effect, Option, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import {
  Api,
  CurrentMember,
  InvalidDateRange,
  ShortLinkNotFound,
} from "peal-contract";
import type { CalendarDay } from "peal-contract";

import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { ChannelIdSchema, PostIdSchema } from "#shared/domain/ids.ts";
import { ShortLinkBase } from "#shortlinks/application/short-link-base.ts";
import { ShortLinkReports } from "#shortlinks/application/short-link-reports.ts";
import { ShortLinkSettings } from "#shortlinks/application/short-link-settings.ts";
import type { InvalidClickRange } from "#shortlinks/domain/invalid-click-range.ts";
import { ShortLinkIdSchema } from "#shortlinks/domain/short-link-id.ts";
import type { ShortLinkId } from "#shortlinks/domain/short-link-id.ts";

import { pageView, reportView, statusView } from "./short-links-view.ts";

const decodeLinkId = Schema.decodeUnknownOption(ShortLinkIdSchema);
const decodePostId = Schema.decodeUnknownOption(PostIdSchema);
const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);

// A day the contract checked, as its first instant (UTC).
const dayAsked = (day: CalendarDay | undefined): Option.Option<DateTime.Utc> =>
  Option.fromUndefinedOr(day).pipe(
    Option.map((written) => DateTime.makeUnsafe(`${written}T00:00:00Z`))
  );

const invalidRange = ({ maxDays }: InvalidClickRange) =>
  Effect.fail(
    new InvalidDateRange({
      message: `The range of days ends before it starts, or spans more than ${maxDays} days.`,
    })
  );

// A cursor given that is not one of this list's: refused.
const cursorAsked = (
  written: string | undefined
): Effect.Effect<Option.Option<ShortLinkId>, HttpApiError.BadRequest> => {
  if (written === undefined) {
    return Effect.succeedNone;
  }

  const id = decodeLinkId(written);

  return Option.isNone(id)
    ? Effect.fail(new HttpApiError.BadRequest())
    : Effect.succeed(id);
};

// A filter's id as asked: none when not given, and `matchesNothing` when
// given but not an id, which nothing of the workspace has, so the page is
// empty, as the posts' search answers it.
const filterAsked = <A>(
  written: string | undefined,
  decoded: (text: string) => Option.Option<A>
) => {
  const id = written === undefined ? Option.none<A>() : decoded(written);

  return { id, matchesNothing: written !== undefined && Option.isNone(id) };
};

// A failure of the server's own (the database, a bug) is a defect: 500.
export const ShortLinksHandlers = HttpApiBuilder.group(
  Api,
  "links",
  Effect.fn(function* shortLinksHandlers(handlers) {
    const reports = yield* ShortLinkReports;
    const settings = yield* ShortLinkSettings;
    const { base } = yield* ShortLinkBase;
    const written = base.pipe(Option.map((url) => url.href));

    return handlers
      .handle("status", () =>
        Effect.gen(function* status() {
          const actor = actorOf(yield* CurrentMember);

          return statusView(
            yield* settings.status(actor).pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
              })
            )
          );
        })
      )
      .handle("setDefault", ({ payload }) =>
        Effect.gen(function* setDefault() {
          const actor = actorOf(yield* CurrentMember);

          return statusView(
            yield* settings.setByDefault(actor, payload.byDefault).pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
              })
            )
          );
        })
      )
      .handle("list", ({ query }) =>
        Effect.gen(function* list() {
          const actor = actorOf(yield* CurrentMember);
          const channel = filterAsked(query.channelId, decodeChannelId);
          const post = filterAsked(query.postId, decodePostId);

          const report = yield* reports
            .list(actor, {
              channelId: channel.id,
              cursor: yield* cursorAsked(query.cursor),
              from: dayAsked(query.from),
              limit: Option.fromUndefinedOr(query.limit),
              postId: post.id,
              to: dayAsked(query.to),
            })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                InvalidClickRange: invalidRange,
                MissingPermission: forbidden,
              })
            );

          // Asked for the range and the permission all the same, so a
          // filter that matches nothing is refused as any other would be.
          return pageView(
            channel.matchesNothing || post.matchesNothing
              ? { ...report, links: [], next: Option.none() }
              : report,
            written
          );
        })
      )
      .handle("get", ({ params, query }) =>
        Effect.gen(function* get() {
          const actor = actorOf(yield* CurrentMember);
          const linkId = decodeLinkId(params.linkId);

          if (Option.isNone(linkId)) {
            return yield* new ShortLinkNotFound();
          }

          const report = yield* reports
            .get(actor, linkId.value, {
              from: dayAsked(query.from),
              to: dayAsked(query.to),
            })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                InvalidClickRange: invalidRange,
                MissingPermission: forbidden,
                ShortLinkNotFound: () => Effect.fail(new ShortLinkNotFound()),
              })
            );

          return reportView(report, written);
        })
      );
  })
);
