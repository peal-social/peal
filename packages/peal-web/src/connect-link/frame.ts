import { PlatformSchema } from "peal-contract";

import { isAppPath } from "#shell/workspace-path.ts";

import { pendingLink } from "./pending-link.ts";

const linkPage = /^\/connect\/link$/u;

// The pages someone signs in, signs up or finds their way back in on.
const signInPage =
  /^(?:\/fr)?\/(?:sign-in|sign-up|forgot-password|reset-password|verify-email)$/u;

const callbackPage = /^\/connect\/(?<platform>[^/]+)\/callback$/u;

/**
 * The frame a page gets: the app's, with Peal's header and footer; its
 * own, for the signed-in app (`isAppPath`), whose layouts draw their own: a
 * workspace's sidebar, the page's panel and a bottom bar
 * (`WorkspaceShell`), or the setup page's (`SetupFrame`); the hosted one,
 * for
 * people who come through a connect link and have no Peal account; or
 * none yet, while only the browser can tell which.
 */
export type Frame = "app" | "hosted" | "own" | "signIn" | "unknown";

/** Whether the path is the platforms' callback page. */
export const isCallbackPage = (pathname: string): boolean =>
  callbackPage.test(pathname);

/**
 * Which frame a page gets: the hosted one for a connect link's page, and
 * for the platform's callback when the tab came through a link; its own
 * for the signed-in app's; the app's for every other page.
 */
export const frameOf = (pathname: string, cameThroughLink: boolean): Frame => {
  if (linkPage.test(pathname)) {
    return "hosted";
  }

  if (isCallbackPage(pathname) && cameThroughLink) {
    return "hosted";
  }

  if (signInPage.test(pathname)) {
    return "signIn";
  }

  return isAppPath(pathname) ? "own" : "app";
};

/**
 * Whether this tab is on a connect link's sign-in for the platform the
 * callback page is for, as its storage says.
 */
export const cameThroughLink = (pathname: string): boolean =>
  PlatformSchema.literals.some(
    (platform) =>
      callbackPage.exec(pathname)?.groups?.["platform"] === platform &&
      pendingLink(platform) !== null
  );
