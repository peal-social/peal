import type { GenericEndpointContext } from "better-auth";
import { Option } from "effect";

import type { SiteMeasurementSettings } from "#shared/application/site-measurement.ts";

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
 * The visitor to link to an account just made in this request, where a
 * sign-up links one: the id in the visitor's cookie the request carries
 * (`visitorOf`). Notes the request as one that made an account.
 */
export const visitorOfSignUp = (
  context: GenericEndpointContext | null,
  site: Option.Option<SiteMeasurementSettings>
): Option.Option<string> => {
  if (context?.request !== undefined) {
    madeAccount.add(context.request);
  }

  return site.pipe(
    Option.flatMap(({ token }) =>
      visitorOf(context?.headers?.get("cookie"), token)
    )
  );
};

// Whether the request carries the visitor's cookie, whatever it holds.
const carriesVisitor = (ctx: GenericEndpointContext, token: string) =>
  (ctx.headers?.get("cookie") ?? "")
    .split(";")
    .some((cookie) => cookie.trim().startsWith(`${visitorCookieName(token)}=`));

// The routes after which the visitor's cookie goes: a password's sign-up,
// whatever it answered, and a provider's callback that made an account.
const endsVisitor = (ctx: GenericEndpointContext): boolean =>
  ctx.path === "/sign-up/email" ||
  (ctx.path?.startsWith("/callback/") &&
    ctx.request !== undefined &&
    madeAccount.has(ctx.request));

/**
 * Part of Better Auth's after hook, where a sign-up links the site's
 * visitor: expires the visitor's cookie the request carried, after a
 * password's sign-up whether it made an account or answered a known
 * address's made-up one, so the answer never tells which addresses have an
 * account, and after a provider's callback that made one. The browser's
 * later visits then get a new visitor, linked to no account. Same name,
 * `Path=/`, `Max-Age=0`, `Secure`, `SameSite=Lax`, and the parent domain
 * where the cookie is set on one.
 */
export const expireVisitorCookie = (
  ctx: GenericEndpointContext,
  site: Option.Option<SiteMeasurementSettings>
): void => {
  if (
    Option.isNone(site) ||
    !endsVisitor(ctx) ||
    !carriesVisitor(ctx, site.value.token)
  ) {
    return;
  }

  ctx.setCookie(visitorCookieName(site.value.token), "", {
    ...Option.match(site.value.cookieDomain, {
      onNone: () => ({}),
      onSome: (domain) => ({ domain }),
    }),
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
};
