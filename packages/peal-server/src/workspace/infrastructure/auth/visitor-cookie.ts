import type { GenericEndpointContext } from "better-auth";
import { Option, Schema } from "effect";

import type { SiteMeasurementSettings } from "#shared/application/site-measurement.ts";

import { asksNotToBeFollowed, siteAnswerAllows } from "./site-answer.ts";
import { visitorOf } from "./visitor-of.ts";

/**
 * The cookie posthog-js keeps the site's visitor in, named after the
 * project's token.
 */
export const visitorCookieName = (token: string): string =>
  `ph_${token}_posthog`;

// The requests that made an account, in which a provider's callback
// expires the visitor's cookie: Better Auth hands the account's hook and
// the route's after hook the same request.
const madeAccount = new WeakSet<Request>();

/**
 * The cookie naming the visitor a sign-up retired, which the site's pages
 * compare their own with before anything leaves (peal-ui's
 * `retiredVisitorCookieName`): a page left open across the sign-up keeps
 * the visitor in memory and would save its cookie again.
 */
export const retiredVisitorCookieName = "peal_site_retired";

/**
 * The visitor to link to an account just made in this request, where a
 * sign-up links one: the id in the visitor's cookie the request carries
 * (`visitorOf`), only while the site's answer, in the same request,
 * allows following them (`siteAnswerAllows`) and the browser does not ask
 * not to be followed. The SDK renews its cookie on each visit, so the
 * cookie alone says nothing of the answer. Notes the request as one that
 * made an account.
 */
export const visitorOfSignUp = (
  context: GenericEndpointContext | null,
  site: Option.Option<SiteMeasurementSettings>
): Option.Option<string> => {
  if (context?.request !== undefined) {
    madeAccount.add(context.request);
  }

  const cookieHeader = context?.headers?.get("cookie");

  if (
    asksNotToBeFollowed(context?.headers) ||
    !siteAnswerAllows(cookieHeader, Date.now())
  ) {
    return Option.none();
  }

  return site.pipe(
    Option.flatMap(({ token }) => visitorOf(cookieHeader, token))
  );
};

// Whether the request carries the visitor's cookie, whatever it holds.
const carriesVisitor = (ctx: GenericEndpointContext, token: string) =>
  (ctx.headers?.get("cookie") ?? "")
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${visitorCookieName(token)}=`));

// The status a route answered, where it says one: a Response's, or an
// error's (Better Auth runs its after hooks on an error too, and keeps the
// cookies they set; a plain result says none, and went through).
const decodeStatus = Schema.decodeUnknownOption(
  Schema.Struct({
    returned: Schema.Union([
      Schema.Struct({ status: Schema.Number }),
      Schema.Struct({ statusCode: Schema.Number }),
    ]),
  })
);

// Whether the route refused the request: a status of 400 or more.
const isRefusal = (context: GenericEndpointContext["context"]): boolean =>
  Option.match(decodeStatus(context), {
    onNone: () => false,
    onSome: ({ returned }) =>
      ("status" in returned ? returned.status : returned.statusCode) >= 400,
  });

// The routes after which the visitor's cookie goes: a password's sign-up
// that went through, whether it made an account or answered a known
// address's made-up one alike (both answer 200), and a provider's callback
// that made an account.
const endsVisitor = (ctx: GenericEndpointContext): boolean =>
  ctx.path === "/sign-up/email" ||
  (ctx.path?.startsWith("/callback/") &&
    ctx.request !== undefined &&
    madeAccount.has(ctx.request));

/**
 * Part of Better Auth's after hook, where a sign-up links the site's
 * visitor: expires the visitor's cookie the request carried, after a
 * password's sign-up that went through, whether it made an account or
 * answered a known address's made-up one, so the answer never tells which
 * addresses have an account, and after a provider's callback that made
 * one; never after a refused sign-up, which a retry may still link. The
 * browser's later visits then get a new visitor, linked to no account.
 * Same name, `Path=/`, `Max-Age=0`, `Secure`, `SameSite=Lax`, and the
 * registrable domain PostHog's SDK set it on
 * (PEAL_POSTHOG_SITE_COOKIE_DOMAIN). Where the cookie held a visitor the
 * request's answer allowed following, `peal_site_retired` names it, linked
 * or not alike (a known address reads as a new one), until the browser
 * closes: it only has to outlive a site tab left open.
 */
export const expireVisitorCookie = (
  ctx: GenericEndpointContext,
  site: Option.Option<SiteMeasurementSettings>
): void => {
  if (
    Option.isNone(site) ||
    isRefusal(ctx.context) ||
    !endsVisitor(ctx) ||
    !carriesVisitor(ctx, site.value.token)
  ) {
    return;
  }

  const domain = Option.match(site.value.cookieDomain, {
    onNone: () => ({}),
    onSome: (name) => ({ domain: name }),
  });

  ctx.setCookie(visitorCookieName(site.value.token), "", {
    ...domain,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });

  const cookieHeader = ctx.headers?.get("cookie");

  // Named only for a visitor the answer allowed following: a refusal, an
  // answer past its days and a browser that asks not to be followed leave
  // nothing behind but the expiry.
  const retired =
    asksNotToBeFollowed(ctx.headers) ||
    !siteAnswerAllows(cookieHeader, Date.now())
      ? Option.none<string>()
      : visitorOf(cookieHeader, site.value.token);

  if (Option.isSome(retired)) {
    // A session cookie: it only has to outlive a site tab left open.
    ctx.setCookie(retiredVisitorCookieName, retired.value, {
      ...domain,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  }
};
