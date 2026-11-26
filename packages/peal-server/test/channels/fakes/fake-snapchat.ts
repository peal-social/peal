import { Effect } from "effect";

import type { SnapchatHosts } from "#shared/infrastructure/platforms/snapchat-api.ts";

import { fakeHttpServer, formOf, json } from "./fake-http-server.ts";
import type {
  FakeRequest,
  FakeResponse,
  JsonValue,
} from "./fake-http-server.ts";

/** Peal's synthetic Snapchat app. */
export const snapchatClient = {
  clientId: "synthetic-snapchat-client",
  clientSecret: "synthetic-snapchat-secret",
} as const;

/** A synthetic Public Profile, as `my_profile` shows it. */
export const snapchatProfile = {
  display_name: "Peal Example",
  id: "d6ed1cac-e0cd-4109-bf04-539cb8591838",
  logo_urls: {
    discover_feed_logo_url: "https://cf-st.sc-cdn.example/synthetic/72.png",
    manage_profile_logo_url: "https://cf-st.sc-cdn.example/synthetic/640.png",
    mega_profile_logo_url: "https://cf-st.sc-cdn.example/synthetic/90.png",
    original_logo_url: "https://cf-st.sc-cdn.example/synthetic/1280.png",
  },
  organization_id: "af00bec3-7b29-4c6b-a0bb-3908cfb13a81",
  profile_tier: "TIER_STANDARD",
  profile_type: "PUBLIC_PROFILE",
  snap_user_name: "peal_example",
} as const;

const bearerOf = (request: FakeRequest) =>
  String(request.headers["authorization"] ?? "").replace(/^Bearer /u, "");

const clientOf = (form: URLSearchParams) =>
  form.get("client_id") === snapchatClient.clientId &&
  form.get("client_secret") === snapchatClient.clientSecret;

/** An OAuth error, as RFC 6749 writes it. */
export const snapOAuthError = (error: string, status = 400): FakeResponse =>
  json({ error, error_description: "Synthetic refusal." }, status);

/** An answer in Snap's envelope saying `ERROR`, with this code. */
export const snapError = (errorCode: string, status: number): FakeResponse =>
  json(
    {
      debug_message: "Synthetic debug message.",
      display_message: "Synthetic display message.",
      error_code: errorCode,
      request_id: "synthetic-request-id",
      request_status: "ERROR",
    },
    status
  );

/** A bare answer of this status: no body Snap would write. */
export const bare = (
  status: number,
  contentType = "text/html"
): FakeResponse => ({
  headers: { "content-type": contentType },
  status,
});

/** The member refuses: back with OAuth's `access_denied`. */
const deny = (authorizationUrl: string) => ({
  error: "access_denied",
  state: new URL(authorizationUrl).searchParams.get("state") ?? "",
});

interface PendingCode {
  readonly redirectUri: string;
}

/**
 * Snap's OAuth and `my_profile` for one synthetic Public Profile: it issues
 * codes for the authorization page (`approve` plays the member), exchanges
 * them with the client's id and secret in the form and the exact
 * `redirect_uri`, issues one-hour access tokens, and refreshes with refresh
 * tokens, each answer bringing a new one (or none, `refreshWithoutToken`).
 * `failNext` makes the next answers to a route failures; `profile` replaces
 * the profile answered.
 */
export const fakeSnapchat = Effect.fnUntraced(function* fakeSnapchat() {
  const codes = new Map<string, PendingCode>();
  const accessTokens = new Set<string>();
  const refreshTokens = new Set<string>();
  const usedRefreshTokens: string[] = [];
  const failures = new Map<string, FakeResponse[]>();
  let issued = 0;
  let newRefreshTokens = true;
  let profile: JsonValue = snapchatProfile;

  const issue = (withRefresh: boolean) => {
    issued += 1;

    const access = `synthetic-snapchat-access-${issued}`;
    const refresh = `synthetic-snapchat-refresh-${issued}`;

    accessTokens.add(access);

    if (withRefresh) {
      refreshTokens.add(refresh);
    }

    const answer = {
      access_token: access,
      expires_in: 3600,
      scope: "snapchat-profile-api",
      token_type: "Bearer",
    };

    return json(withRefresh ? { ...answer, refresh_token: refresh } : answer);
  };

  const exchange = (request: FakeRequest): FakeResponse => {
    const form = formOf(request);

    if (!clientOf(form)) {
      return snapOAuthError("invalid_client", 401);
    }

    if (form.get("grant_type") === "refresh_token") {
      const token = form.get("refresh_token") ?? "";

      usedRefreshTokens.push(token);

      return refreshTokens.has(token)
        ? issue(newRefreshTokens)
        : snapOAuthError("invalid_grant");
    }

    const code = codes.get(form.get("code") ?? "");

    if (
      form.get("grant_type") !== "authorization_code" ||
      code === undefined ||
      code.redirectUri !== form.get("redirect_uri")
    ) {
      return snapOAuthError("invalid_grant");
    }

    codes.delete(form.get("code") ?? "");

    return issue(true);
  };

  const myProfile = (request: FakeRequest): FakeResponse => {
    if (!accessTokens.has(bearerOf(request))) {
      return {
        headers: {
          "content-type": "text/html",
          "www-authenticate":
            'Bearer error="invalid_token", error_description="The access token expired"',
        },
        status: 401,
      };
    }

    return json({
      public_profile: profile,
      request_id: "synthetic-request-id",
      request_status: "SUCCESS",
    });
  };

  const handle = (request: FakeRequest): FakeResponse => {
    const route = `${request.method} ${request.path}`;
    const failure = failures.get(route)?.shift();

    if (failure !== undefined) {
      return failure;
    }

    if (route === "POST /login/oauth2/access_token") {
      return exchange(request);
    }

    if (route === "GET /v1/public_profiles/my_profile") {
      return myProfile(request);
    }

    return snapError("NOT_FOUND", 404);
  };

  const server = yield* fakeHttpServer(handle);

  const hosts: SnapchatHosts = {
    accounts: new URL(server.url),
    api: new URL(server.url),
  };

  /** The member approves on the authorization page: back with a code. */
  const approve = (authorizationUrl: string) => {
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get("state") ?? "";
    const code = `synthetic-snapchat-code-${codes.size + 1}-${state.slice(0, 6)}`;

    codes.set(code, {
      redirectUri: url.searchParams.get("redirect_uri") ?? "",
    });

    return { code, state };
  };

  return {
    ...server,
    approve,
    deny,
    /** Expires every access token, as an hour passing would. */
    expireAccess: () => {
      accessTokens.clear();
    },
    failNext: (route: string, answers: readonly FakeResponse[]) => {
      failures.set(route, [...(failures.get(route) ?? []), ...answers]);
    },
    hosts,
    /** The profile `my_profile` answers from now on. */
    profile: (next: JsonValue) => {
      profile = next;
    },
    /** Refreshes answer no refresh token from now on. */
    refreshWithoutToken: () => {
      newRefreshTokens = false;
    },
    /** The refresh tokens sent, in order. */
    usedRefreshTokens: () => [...usedRefreshTokens],
  };
});
