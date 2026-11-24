// Articles on a site on WordPress.com: the same calls as to a site of its
// own, under WordPress.com's API for the site, with its OAuth token.
import { assert, describe, it } from "@effect/vitest";
import { Effect, Option } from "effect";

import { ChannelRepository } from "#channels/application/channel-repository.ts";
import { onArticles, stateOf } from "#test/articles/article-support.ts";
import {
  comSite,
  sentToWordPressCom,
} from "#test/articles/wordpress-com-support.ts";

describe("an article on WordPress.com", () => {
  it.effect(
    "goes to the site through WordPress.com's API, with its token",
    () =>
      onArticles(
        Effect.gen(function* sent() {
          const { sent: article, site } = yield* sentToWordPressCom();

          assert.strictEqual(stateOf(article), "published");
          assert.lengthOf(site.posts(), 1);
          assert.strictEqual(site.posts()[0]?.title, "Spring sowing");
          assert.lengthOf(site.media(), 2);

          const requests = site.requests();

          assert.isTrue(
            requests.every(
              ({ authorization }) => authorization === `Bearer ${comSite.token}`
            )
          );
          assert.isTrue(requests.some(({ route }) => route === "/wp/v2/posts"));
        })
      )
  );

  it.effect("adopts its post when the answer was lost", () =>
    onArticles(
      Effect.gen(function* lost() {
        const { sent: article, site } = yield* sentToWordPressCom({
          drop: ({ method, route }) =>
            method === "POST" && route === "/wp/v2/posts",
        });

        assert.strictEqual(stateOf(article), "published");
        assert.lengthOf(site.posts(), 1);
      })
    )
  );

  it.effect("marks the channel to reconnect when the token is refused", () =>
    onArticles(
      Effect.gen(function* refused() {
        const { channelId, sent: article } = yield* sentToWordPressCom(
          {},
          "synthetic-revoked-token"
        );

        assert.strictEqual(stateOf(article), "failed");

        const channel = yield* ChannelRepository.use((channels) =>
          channels.get(channelId)
        );

        assert.strictEqual(
          Option.getOrUndefined(channel)?.status._tag,
          "refreshNeeded"
        );
      })
    )
  );
});
