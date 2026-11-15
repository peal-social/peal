import { Console, Effect, Option, Redacted } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { ChannelSchema, KeySitePlatformSchema } from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { readSecret } from "#secret-input.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

/** peal channels connect-website: a website, to publish articles to. */
export const connectWebsite = Command.make(
  "connect-website",
  {
    address: Argument.String("address").pipe(
      Argument.withDescription(
        "The site's home page, such as https://blog.example.com."
      )
    ),
    json: jsonFlag,
    // Only a WordPress site of its own takes a password.
    platform: Flag.Literals("platform", ["wordpress"] as const).pipe(
      Flag.withDescription("What the site runs: wordpress."),
      Flag.withDefault("wordpress" as const)
    ),
    user: Flag.String("user").pipe(
      Flag.withMetavar("<login>"),
      Flag.withDescription(
        "The login name of the site's user Peal publishes as: an Author, an Editor or an Administrator."
      )
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("channels.connectWebsite")(function* connectWebsiteCommand(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    // Never an argument: typed without echo, or piped in.
    const password = yield* readSecret("The application password:");

    const channel = yield* client.channels
      .connectSite({
        params: { workspaceId: workspace.id },
        payload: {
          address: input.address,
          applicationPassword: Redacted.value(password),
          platform: input.platform,
          userName: input.user,
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(ChannelSchema, channel);

      return;
    }

    yield* Console.log(
      `Connected ${channel.displayName ?? channel.handle} (${channel.handle}) to ${workspace.name}, as channel ${channel.id}. Its application password is kept encrypted and never shown again; revoke it on the user's profile page on the site to cut Peal off.`
    );
  })
).pipe(
  Command.withDescription(
    "Connect a WordPress site, to publish articles to it: its address, the user Peal publishes as, and an application password made for Peal on that user's profile page. The password is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal channels connect-website https://blog.example.com --user editor < password.txt). A site counts as one channel. Needs channel:connect."
  )
);

/**
 * peal channels connect-website-key: an account on a publishing platform,
 * with a key made there for Peal.
 */
export const connectWebsiteKey = Command.make(
  "connect-website-key",
  {
    json: jsonFlag,
    platform: Flag.Literals("platform", KeySitePlatformSchema.literals).pipe(
      Flag.withDescription(
        "Where the account is: devto (DEV) or hashnode (Hashnode)."
      )
    ),
    publication: Flag.String("publication").pipe(
      Flag.withMetavar("<address>"),
      Flag.withDescription(
        "On Hashnode, the publication to publish to, such as blog.example.com; without it, the member's only one."
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("channels.connectWebsiteKey")(
    function* connectWebsiteKeyCommand(input) {
      const { client, url, workspace } = yield* inWorkspace(input.workspace);

      // Never an argument: typed without echo, or piped in.
      const key = yield* readSecret("The API key:");

      const channel = yield* client.channels
        .connectSiteWithKey({
          params: { workspaceId: workspace.id },
          payload: {
            apiKey: Redacted.value(key),
            platform: input.platform,
            ...Option.match(input.publication, {
              onNone: () => ({}),
              onSome: (publication) => ({ publication }),
            }),
          },
        })
        .pipe(Effect.mapError(explain(url)));

      if (input.json) {
        yield* printJson(ChannelSchema, channel);

        return;
      }

      yield* Console.log(
        `Connected ${channel.displayName ?? channel.handle} (${channel.handle}) to ${workspace.name}, as channel ${channel.id}. Its key is kept encrypted and never shown again; revoke it on the platform to cut Peal off.`
      );
    }
  )
).pipe(
  Command.withDescription(
    "Connect an account on a publishing platform, to publish articles to it, with a key made there for Peal: on DEV, an API key from Settings, Extensions; on Hashnode, a personal access token from the account's settings (Developer), with --publication naming the publication, which needs Hashnode's Pro plan for its API. The key is never an argument: the command asks for it at a terminal, without echo, or reads it from standard input (peal channels connect-website-key --platform devto < key.txt). An account, or a Hashnode publication, counts as one channel. Needs channel:connect."
  )
);
