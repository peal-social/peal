import { Effect } from "effect";

import type { SlackHosts } from "#shared/infrastructure/platforms/slack-api.ts";

import { fakeHttpServer, formOf, json } from "./fake-http-server.ts";
import type {
  FakeRequest,
  FakeResponse,
  JsonValue,
} from "./fake-http-server.ts";

/** Peal's synthetic Slack app. */
export const slackClient = {
  clientId: "1000000000001.2000000000001",
  clientSecret: "synthetic-slack-secret",
} as const;

/** A synthetic Slack workspace, and the channel picked on Slack's page. */
export const slackTeam = { id: "T0SYNTH01", name: "Peal Example" } as const;

export const slackPicked = { id: "C0SYNTH01", name: "#announcements" } as const;

/** The other channel of the workspace, which a reconnection may pick. */
export const slackOther = { id: "C0SYNTH02", name: "#general" } as const;

const asked = "incoming-webhook,chat:write,chat:write.public,files:write";

interface PendingCode {
  readonly channel: { readonly id: string; readonly name: string };
  readonly redirectUri: string;
  readonly scope: string;
}

const basicAuth = `Basic ${Buffer.from(
  `${slackClient.clientId}:${slackClient.clientSecret}`
).toString("base64")}`;

const refused = (error: string) => json({ error, ok: false });

/**
 * Slack's OAuth v2 for one synthetic workspace, from the "Installing with
 * OAuth" guide and `oauth.v2.access`'s page: the authorize page asks the
 * member for the channel the app's incoming webhook posts to (`approve`
 * plays them, picking `slackPicked` unless told), and the exchange, with
 * the app's credentials as Basic, answers a bot token that never expires,
 * the team, and the webhook with the channel's id and name. Every bot
 * token answered is the same one: an app has one bot per workspace.
 */
export const fakeSlack = Effect.fnUntraced(function* fakeSlack() {
  const codes = new Map<string, PendingCode>();
  const failures = new Map<string, FakeResponse[]>();

  const exchange = (request: FakeRequest): FakeResponse => {
    if (request.headers["authorization"] !== basicAuth) {
      return refused("invalid_client_id");
    }

    const form = formOf(request);
    const code = codes.get(form.get("code") ?? "");

    if (code === undefined) {
      return refused("invalid_code");
    }

    if (code.redirectUri !== form.get("redirect_uri")) {
      return refused("bad_redirect_uri");
    }

    codes.delete(form.get("code") ?? "");

    const answer: JsonValue = {
      access_token: "xoxb-synthetic-installed-token",
      app_id: "A0SYNTH01",
      authed_user: { id: "U0SYNTH01" },
      bot_user_id: "U0SYNTHBOT",
      enterprise: null,
      incoming_webhook: {
        channel: code.channel.name,
        channel_id: code.channel.id,
        configuration_url: "https://peal-example.slack.com/services/B0SYNTH01",
        url: "https://hooks.slack.com/services/T0SYNTH01/B0SYNTH01/synthetic-webhook-secret",
      },
      is_enterprise_install: false,
      ok: true,
      scope: code.scope,
      team: slackTeam,
      token_type: "bot",
    };

    return json(answer);
  };

  const handle = (request: FakeRequest): FakeResponse => {
    const route = `${request.method} ${request.path}`;
    const failure = failures.get(route)?.shift();

    if (failure !== undefined) {
      return failure;
    }

    return route === "POST /api/oauth.v2.access"
      ? exchange(request)
      : json({ error: "unknown_method", ok: false }, 404);
  };

  const server = yield* fakeHttpServer(handle);

  const hosts: SlackHosts = { api: server.url, uploads: server.url };

  /**
   * The member installs the app, picking `channel` for its posts, granting
   * the scopes asked, or only `granted`: back with a code.
   */
  const approve = (
    authorizationUrl: string,
    options: {
      readonly channel?: { readonly id: string; readonly name: string };
      readonly granted?: string;
    } = {}
  ) => {
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get("state") ?? "";
    const code = `slack-code-${String(codes.size + 1)}-${state.slice(0, 6)}`;

    codes.set(code, {
      channel: options.channel ?? slackPicked,
      redirectUri: url.searchParams.get("redirect_uri") ?? "",
      scope: options.granted ?? url.searchParams.get("scope") ?? asked,
    });

    return { code, state };
  };

  return {
    ...server,
    approve,
    /** The member cancels on Slack's page. */
    deny: (authorizationUrl: string) => ({
      error: "access_denied",
      state: new URL(authorizationUrl).searchParams.get("state") ?? "",
    }),
    failNext: (route: string, answers: readonly FakeResponse[]) => {
      failures.set(route, [...(failures.get(route) ?? []), ...answers]);
    },
    hosts,
  };
});
