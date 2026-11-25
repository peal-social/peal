import { describe, expect, it } from "@effect/vitest";
import { AsyncResult } from "effect/reactivity";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RevokeOthersRow } from "#components/account/revoke-others.tsx";
import { SessionsView } from "#components/account/sessions-view.tsx";
import { loadMessages } from "#i18n/messages.ts";
import type { AccountSession } from "#settings/atoms.ts";
import { AuthCallFailed } from "#settings/auth-call.ts";

const render = async (locale: "en" | "fr", view: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {view}
    </NextIntlClientProvider>
  );

// The ids React gives each element by its place in the tree, which differ
// from one tree to the next.
const withoutIds = (html: string): string =>
  html.replaceAll(/ id="[^"]*"/gu, "");

const onChanged = () => {
  // Nothing changes while rendering to markup.
};

// What the page puts in place of signing in again: the view only places it.
const signInAgain = <button type="button">sign-in-again-slot</button>;

const sessions: readonly AccountSession[] = [
  {
    createdAt: new Date("2026-11-24T08:00:00Z"),
    id: "session-here",
    ipAddress: "192.0.2.10",
    token: "synthetic-token-here",
    updatedAt: new Date("2026-11-24T09:00:00Z"),
    userAgent: "Browser here",
  },
  {
    createdAt: new Date("2026-11-20T08:00:00Z"),
    id: "session-there",
    ipAddress: null,
    token: "synthetic-token-there",
    updatedAt: new Date("2026-11-21T09:00:00Z"),
    userAgent: "Browser there",
  },
];

type SessionsViewResult = AsyncResult.AsyncResult<
  readonly AccountSession[],
  AuthCallFailed
>;

const view = (result: SessionsViewResult) => (
  <SessionsView
    currentToken="synthetic-token-here"
    sessions={result}
    signInAgain={signInAgain}
    onChanged={onChanged}
  />
);

// Better Auth's answer to /list-sessions for a session signed in longer ago
// than its freshness allows.
const notFresh: SessionsViewResult = AsyncResult.fail(
  new AuthCallFailed({ code: "SESSION_NOT_FRESH", status: 403 })
);

describe(SessionsView, () => {
  it("lists a fresh session's sessions, with a way to sign out the others", async () => {
    const html = await render("en", view(AsyncResult.success(sessions)));

    expect(html).toContain("Browser here");
    expect(html).toContain("This session");
    expect(html).toContain('aria-label="Sign out of Browser there"');
    expect(html).not.toContain("Sign out of Browser here");
    expect(html).toContain("Sign out everywhere else");
  });

  it("asks a fresh session to sign in again nowhere", async () => {
    const html = await render("en", view(AsyncResult.success(sessions)));

    expect(html).not.toContain("Try again");
    expect(html).not.toContain("sign-in-again-slot");
  });

  it("asks a session signed in too long ago to sign in again, never to try again", async () => {
    const html = await render("en", view(notFresh));

    expect(html).toContain(
      "This list shows only for a short while after you sign in. Sign in again to see it."
    );
    expect(html).toContain("sign-in-again-slot");
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("could not be loaded");
  });

  it("says so in French too", async () => {
    const html = await render("fr", view(notFresh));

    expect(html).toContain(
      "Cette liste ne s’affiche que peu de temps après la connexion. Reconnectez-vous pour la voir."
    );
    expect(html).not.toContain("Réessayer");
  });

  it("lets a session signed in too long ago sign out everywhere else, as the list does", async () => {
    const pages = await Promise.all([
      render("en", <RevokeOthersRow onChanged={onChanged} />),
      render("en", view(AsyncResult.success(sessions))),
      render("en", view(notFresh)),
    ]);

    const [row, fresh, stale] = pages.map(withoutIds);

    expect(row).toContain("Sign out everywhere else");
    expect(row).toContain(
      "Every browser and device but this one must sign in again."
    );
    // The same row, so the same action, in both states.
    expect(fresh).toContain(row);
    expect(stale).toContain(row);
    expect(stale).toContain("sign-in-again-slot");
  });

  it("offers it in French too", async () => {
    const html = await render("fr", view(notFresh));

    expect(html).toContain("Fermer toutes les autres sessions");
    expect(html).toContain(
      "Tous les navigateurs et appareils, sauf celui-ci, devront se reconnecter."
    );
  });

  it("offers no way to sign out elsewhere while the list loads or failed otherwise", async () => {
    const pages = await Promise.all(
      [
        AsyncResult.initial(),
        AsyncResult.fail(new AuthCallFailed({ status: 500 })),
      ].map(async (result) => await render("en", view(result)))
    );

    for (const html of pages) {
      expect(html).not.toContain("Sign out everywhere else");
    }
  });

  it("offers to try again when the list failed for another reason", async () => {
    const failures: readonly SessionsViewResult[] = [
      // The server failed.
      AsyncResult.fail(new AuthCallFailed({ status: 500 })),
      // The request never got an answer, or the answer did not decode.
      AsyncResult.fail(new AuthCallFailed({ status: 0 })),
      // Another refusal, with a code of its own.
      AsyncResult.fail(new AuthCallFailed({ code: "FORBIDDEN", status: 403 })),
    ];

    const pages = await Promise.all(
      failures.map(async (failure) => await render("en", view(failure)))
    );

    for (const html of pages) {
      expect(html).toContain("Try again");
      expect(html).not.toContain("sign-in-again-slot");
    }
  });

  it("shows the list loading at first", async () => {
    const html = await render("en", view(AsyncResult.initial()));

    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Try again");
  });
});
