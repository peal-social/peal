import { Effect, Layer, Option } from "effect";

import { SiteAuthorizers } from "#channels/application/site-authorizer.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import type { WordPressComHosts } from "#shared/infrastructure/platforms/wordpress-api.ts";

import { ChannelPlatforms } from "./channel-platform-settings.ts";
import { oauthClientConfig } from "./oauth-client.ts";
import { wordpressComAuthorizer } from "./wordpress-com/wordpress-com-authorizer.ts";

/**
 * The website sign-ins this server has: WordPress.com's when the operator
 * registered an app there (`WORDPRESS_COM_CLIENT_ID` and
 * `WORDPRESS_COM_CLIENT_SECRET`; one without the other stops the server).
 * Needs ChannelPlatforms, an HttpClient, the outbound guard and
 * SecureRandom.
 */
export const siteAuthorizersLive = (hosts: WordPressComHosts) =>
  Layer.effect(
    SiteAuthorizers,
    Effect.gen(function* SiteAuthorizersLive() {
      const settings = yield* ChannelPlatforms;
      const http = yield* publicHttpClient;
      const client = yield* oauthClientConfig("wordpressCom", "WORDPRESS_COM");

      const wordpressCom = Option.isSome(client)
        ? Option.some(
            yield* wordpressComAuthorizer({
              client: client.value,
              hosts,
              http,
              publicUrl: settings.publicUrl,
            })
          )
        : Option.none();

      return SiteAuthorizers.of({
        for: (platform) =>
          platform === "wordpressCom" ? wordpressCom : Option.none(),
      });
    })
  );
