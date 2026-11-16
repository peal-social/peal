import { DataDeletionApi } from "peal-contract";
import type { MetaApp } from "peal-contract";

import type { ChannelPlatform } from "#channels/domain/platform.ts";
import { googleAdsCallbackPath } from "#shared/infrastructure/platforms/google-ads-paths.ts";
import { metaEventsPath } from "#shared/infrastructure/platforms/meta-apps.ts";
import { metaAdsCallbackPath } from "#shared/infrastructure/platforms/meta-graph.ts";

import { blueskyPaths } from "./bluesky/bluesky-client.ts";
import { googleBusinessCallbackPath } from "./google-business/google-business-authorizer.ts";
import { linkedinCallbackPath } from "./linkedin/linkedin-authorizer.ts";
import { mastodonCallbackPath } from "./mastodon/mastodon-authorizer.ts";
import { facebookLoginCallbackPath } from "./meta/facebook-login.ts";
import { instagramCallbackPath } from "./meta/instagram-login-authorizer.ts";
import { threadsCallbackPath } from "./meta/threads-authorizer.ts";
import { pinterestCallbackPath } from "./pinterest/pinterest-authorizer.ts";
import { slackCallbackPath } from "./slack/slack-authorizer.ts";
import { tiktokCallbackPath } from "./tiktok/tiktok-authorizer.ts";
import { wordpressComCallbackPath } from "./wordpress-com/wordpress-com-authorizer.ts";
import { xCallbackPath } from "./x/x-authorizer.ts";
import { youtubeCallbackPath } from "./youtube/youtube-authorizer.ts";

/** One address a platform is given, or reads. */
export interface PlatformAddress {
  /**
   * Who requests it: a member's browser, which the platform sends back
   * after the sign-in, or the platform's own servers, which no login page
   * in front of the server may stop.
   */
  readonly calledBy: "browser" | "platform";
  /** The field it goes in, in the platform's settings for the app. */
  readonly field: string;
  readonly url: string;
}

/**
 * The addresses of one sign-in: an app the operator registers with a
 * platform, or a client the server registers or publishes itself.
 */
export interface PlatformRegistration {
  readonly addresses: readonly PlatformAddress[];
  readonly id:
    | "bluesky"
    | "facebookLogin"
    | "googleAds"
    | "googleBusiness"
    | "instagramLogin"
    | "linkedin"
    | "linkedinPages"
    | "mastodon"
    | "metaAds"
    | "pinterest"
    | "slack"
    | "threads"
    | "tiktok"
    | "wordpressCom"
    | "x"
    | "youtube";
  /** The platform, and the product of its app, as the command prints it. */
  readonly name: string;
  /** What to know before registering them. */
  readonly notes: readonly string[];
  /** The platforms whose channels it connects. */
  readonly platforms: readonly ChannelPlatform[];
  /**
   * Who gives the platform the addresses: the operator, in the platform's
   * settings for the app, or the server, which needs nobody.
   */
  readonly registeredBy: "operator" | "server";
  /** The server's settings that hold the app's credentials. */
  readonly settings: readonly string[];
}

/**
 * Every address a platform needs to know, or reads, for a server at this
 * origin (PUBLIC_URL), each built from the path its sign-in or its route is
 * written with: the callback paths the authorizers send as `redirect_uri`,
 * Bluesky's client documents, and the contract's routes for Meta's signed
 * requests, and the route Meta's events reach. A platform that gains a sign-in or a route joins this list, or
 * its tests fail (`test/channels/infrastructure/platform-addresses.test.ts`
 * and `test/channels/container.test.ts`).
 */
export const platformRegistrations = (
  publicUrl: string
): readonly PlatformRegistration[] => {
  const at = (path: string) => new URL(path, publicUrl).href;

  const redirect = (field: string, path: string): PlatformAddress => ({
    calledBy: "browser",
    field,
    url: at(path),
  });

  const { deauthorize, request } = DataDeletionApi.endpoints;

  // Meta's signed requests for one of its apps: the same two routes for
  // each, under the app's name.
  const signedRequests = (app: MetaApp): readonly PlatformAddress[] => [
    {
      calledBy: "platform",
      field: "Data deletion request URL",
      url: at(request.path.replace(":app", app)),
    },
    {
      calledBy: "platform",
      field: "Deauthorize callback URL",
      url: at(deauthorize.path.replace(":app", app)),
    },
  ];

  // Where an app's Webhooks product sends its events, checked with the
  // operator's verify token, then signed with the app's secret.
  const events = (app: "facebook" | "instagram"): PlatformAddress => ({
    calledBy: "platform",
    field: "Webhooks: callback URL",
    url: at(metaEventsPath.replace(":app", app)),
  });

  const eventsNote =
    "Webhooks (direct messages): the Verify Token is META_WEBHOOK_VERIFY_TOKEN, and the app must be published (Live) for Meta to send events.";

  return [
    {
      addresses: [redirect("Redirect URI", mastodonCallbackPath)],
      id: "mastodon",
      name: "Mastodon",
      notes: [
        "Nothing to register: the server registers itself, with this address, on each Mastodon server a member connects.",
      ],
      platforms: ["mastodon"],
      registeredBy: "server",
      settings: [],
    },
    {
      addresses: [
        {
          calledBy: "platform",
          field: "Client metadata",
          url: at(blueskyPaths.metadata),
        },
        {
          calledBy: "platform",
          field: "Client keys",
          url: at(blueskyPaths.jwks),
        },
        redirect("Redirect URI", blueskyPaths.callback),
      ],
      id: "bluesky",
      name: "Bluesky",
      notes: [
        "Nothing to register: Bluesky's servers read the client's metadata and keys at these addresses, which must answer them without a sign-in.",
        "PUBLIC_URL must be HTTPS, without a port.",
      ],
      platforms: ["bluesky"],
      registeredBy: "server",
      settings: ["BLUESKY_CLIENT_KEYS"],
    },
    {
      addresses: [
        redirect("Authorized redirect URL (Auth)", linkedinCallbackPath),
      ],
      id: "linkedin",
      name: "LinkedIn",
      notes: [],
      platforms: ["linkedin"],
      registeredBy: "operator",
      settings: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    },
    {
      addresses: [
        redirect("Authorized redirect URL (Auth)", linkedinCallbackPath),
      ],
      id: "linkedinPages",
      name: "LinkedIn: a second app, with the Community Management API, for company pages",
      notes: [
        "LinkedIn gives the Community Management API to an app that has no other product: it is not the app that connects profiles, and takes the same address.",
      ],
      platforms: ["linkedin"],
      registeredBy: "operator",
      settings: ["LINKEDIN_PAGES_CLIENT_ID", "LINKEDIN_PAGES_CLIENT_SECRET"],
    },
    {
      addresses: [
        redirect("Callback URI (user authentication settings)", xCallbackPath),
      ],
      id: "x",
      name: "X",
      notes: [
        "X refuses localhost: in development, use http://127.0.0.1 and its port.",
      ],
      platforms: ["x"],
      registeredBy: "operator",
      settings: ["X_CLIENT_ID", "X_CLIENT_SECRET"],
    },
    {
      addresses: [
        redirect(
          "Valid OAuth redirect URIs",
          facebookLoginCallbackPath("facebook")
        ),
        redirect(
          "Valid OAuth redirect URIs",
          facebookLoginCallbackPath("instagram")
        ),
        ...signedRequests("facebook"),
        events("facebook"),
      ],
      id: "facebookLogin",
      name: "Meta: Facebook Login, for Facebook Pages and Instagram through a Page",
      notes: [eventsNote],
      platforms: ["facebook", "instagram"],
      registeredBy: "operator",
      settings: ["META_APP_ID", "META_APP_SECRET"],
    },
    {
      addresses: [redirect("Valid OAuth redirect URIs", metaAdsCallbackPath)],
      id: "metaAds",
      name: "Meta: ads, on the same app as Facebook Login",
      notes: [
        "Only when PEAL_ADS is read or spend: the sign-in to Meta's ad network, which connects ad accounts, never a channel. Its data deletion and deauthorize callbacks are Facebook Login's.",
      ],
      // It connects ad accounts, which are no platform's channels.
      platforms: [],
      registeredBy: "operator",
      settings: ["META_APP_ID", "META_APP_SECRET", "PEAL_ADS"],
    },
    {
      addresses: [redirect("Authorized redirect URI", googleAdsCallbackPath)],
      id: "googleAds",
      name: "Google Ads: a Google OAuth client, as a web application",
      notes: [
        "Only when PEAL_ADS is read or spend and PEAL_ADS_NETWORKS names google: the read-only sign-in to Google Ads, which connects ad accounts, never a channel.",
        "Enable the Google Ads API in the client's Cloud project: the access level Google gives is the project's (Test reads test accounts only; apply for Explorer on the Cloud console's Google Ads API page). No developer token: Google retired them on 9 September 2026.",
      ],
      // It connects ad accounts, which are no platform's channels.
      platforms: [],
      registeredBy: "operator",
      settings: [
        "GOOGLE_ADS_CLIENT_ID",
        "GOOGLE_ADS_CLIENT_SECRET",
        "PEAL_ADS",
        "PEAL_ADS_NETWORKS",
      ],
    },
    {
      addresses: [
        redirect(
          "OAuth redirect URIs (Business login settings)",
          instagramCallbackPath
        ),
        ...signedRequests("instagram"),
        events("instagram"),
      ],
      id: "instagramLogin",
      name: "Meta: Instagram, for Instagram with Instagram Login",
      notes: [eventsNote],
      platforms: ["instagram"],
      registeredBy: "operator",
      settings: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"],
    },
    {
      addresses: [
        redirect("Redirect callback URL", threadsCallbackPath),
        ...signedRequests("threads"),
      ],
      id: "threads",
      name: "Meta: Threads",
      notes: [],
      platforms: ["threads"],
      registeredBy: "operator",
      settings: ["THREADS_APP_ID", "THREADS_APP_SECRET"],
    },
    {
      addresses: [
        redirect("Redirect URI for the web (Login Kit)", tiktokCallbackPath),
      ],
      id: "tiktok",
      name: "TikTok",
      notes: [
        "TikTok takes HTTPS redirect URIs only: in development, use an HTTPS tunnel.",
      ],
      platforms: ["tiktok"],
      registeredBy: "operator",
      settings: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
    },
    {
      addresses: [redirect("Authorized redirect URI", youtubeCallbackPath)],
      id: "youtube",
      name: "YouTube: a Google OAuth client, as a web application",
      notes: [],
      platforms: ["youtube"],
      registeredBy: "operator",
      settings: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"],
    },
    {
      addresses: [redirect("Redirect URIs", pinterestCallbackPath)],
      id: "pinterest",
      name: "Pinterest",
      notes: ["Pinterest takes the exact address only."],
      platforms: ["pinterest"],
      registeredBy: "operator",
      settings: ["PINTEREST_APP_ID", "PINTEREST_APP_SECRET"],
    },
    {
      addresses: [redirect("Redirect URLs", wordpressComCallbackPath)],
      id: "wordpressCom",
      name: "WordPress.com: an application (developer.wordpress.com/apps), of type Web",
      notes: [
        "Its sites, and the Jetpack sites a member reaches there, connect as websites, one picked per sign-in: Peal asks for no scope, WordPress.com's single-site access.",
      ],
      platforms: ["wordpressCom"],
      registeredBy: "operator",
      settings: ["WORDPRESS_COM_CLIENT_ID", "WORDPRESS_COM_CLIENT_SECRET"],
    },
    {
      addresses: [
        redirect("Authorized redirect URI", googleBusinessCallbackPath),
      ],
      id: "googleBusiness",
      name: "Google Business Profile: a Google OAuth client, as a web application",
      notes: [
        "The client of the Google Cloud project Google gave access to the Business Profile APIs: YouTube's client, when one project has both, then takes both addresses.",
      ],
      platforms: ["googleBusiness"],
      registeredBy: "operator",
      settings: ["GOOGLE_BUSINESS_CLIENT_ID", "GOOGLE_BUSINESS_CLIENT_SECRET"],
    },
    {
      addresses: [redirect("Redirect URLs", slackCallbackPath)],
      id: "slack",
      name: "Slack: an app (api.slack.com/apps), with public distribution",
      notes: [
        "Bot token scopes: incoming-webhook, chat:write, chat:write.public, files:write. Leave token rotation off: it cannot be turned off again.",
      ],
      platforms: ["slack"],
      registeredBy: "operator",
      settings: ["SLACK_CLIENT_ID", "SLACK_CLIENT_SECRET"],
    },
  ];
};

const describeAddress = ({ calledBy, field, url }: PlatformAddress) =>
  [
    `  ${field}`,
    calledBy === "platform"
      ? `    ${url}  (the platform's servers call it)`
      : `    ${url}`,
  ].join("\n");

const describeRegistration = (registration: PlatformRegistration) =>
  [
    registration.name,
    ...(registration.settings.length === 0
      ? []
      : [`  Its credentials go in ${registration.settings.join(", ")}.`]),
    ...registration.notes.map((note) => `  ${note}`),
    ...registration.addresses.map(describeAddress),
  ].join("\n");

/** The addresses as the `platform-addresses` command prints them. */
export const describeRegistrations = (
  publicUrl: string,
  registrations: readonly PlatformRegistration[]
): string =>
  [
    `Addresses to register with each platform, for PUBLIC_URL ${publicUrl}`,
    ...registrations.map(describeRegistration),
  ].join("\n\n");
