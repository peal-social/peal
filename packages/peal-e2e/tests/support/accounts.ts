import { Client } from "pg";

import { emailedLink } from "./mailpit.ts";

/**
 * Signs up an account through the server's API and confirms its address
 * from the emailed link, as a person would, without the pages: for the
 * accounts a test acts on rather than as.
 */
export const confirmedAccount = async (
  baseUrl: string,
  account: {
    readonly email: string;
    readonly name: string;
    readonly password: string;
  }
): Promise<void> => {
  const created = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    body: JSON.stringify(account),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST",
  });

  if (!created.ok) {
    throw new Error(`Signing up answered ${created.status}`);
  }

  // The link keeps the password only in the browser that signed up: its
  // cookies go with it.
  const cookie = created.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .filter((pair) => !pair.endsWith("="))
    .join("; ");

  // The link opens the confirmation page, which posts its token: opening
  // it alone confirms nothing.
  const link = new URL(
    await emailedLink(account.email, "Confirm your email for Peal")
  );

  const confirmed = await fetch(`${baseUrl}/api/auth/confirm-email`, {
    body: JSON.stringify({ token: link.searchParams.get("token") ?? "" }),
    headers: { "content-type": "application/json", cookie, origin: baseUrl },
    method: "POST",
  });

  if (!confirmed.ok) {
    throw new Error(`Confirming answered ${confirmed.status}`);
  }
};

/**
 * Makes an account staff (Better Auth's admin role), straight in the
 * database the run's server uses, as self-hosters do: no page grants it. The
 * account signs in again afterwards, as a session keeps the role it started
 * with. `legal` gives it the legal role too, which answers legal requests.
 */
export const makeStaff = async (
  email: string,
  { legal = false }: { readonly legal?: boolean } = {}
): Promise<void> => {
  const client = new Client({
    connectionString: process.env["DATABASE_URL"],
  });

  await client.connect();

  try {
    await client.query(`UPDATE auth."user" SET role = $2 WHERE email = $1`, [
      email.toLowerCase(),
      legal ? "admin,legal" : "admin",
    ]);
  } finally {
    await client.end();
  }
};

/**
 * Sets the language an account keeps, straight in the database the run's
 * server uses, as the Preferences page saves it: the app's pages follow it
 * on the next one opened, as GET /api/me reads the account on every
 * request.
 */
export const setAccountLanguage = async (
  email: string,
  locale: "en" | "fr"
): Promise<void> => {
  const client = new Client({
    connectionString: process.env["DATABASE_URL"],
  });

  await client.connect();

  try {
    await client.query(`UPDATE auth."user" SET locale = $2 WHERE email = $1`, [
      email.toLowerCase(),
      locale,
    ]);
  } finally {
    await client.end();
  }
};

/**
 * Moves back the sign-in time of every session of an account, straight in
 * the database the run's server uses, so Better Auth reads them as signed
 * in that long ago: past its freshness (a day), a session may no longer
 * list the account's sessions. The browser keeps the session in a
 * five-minute cookie cache (`peal.session_data`): clear that cookie too,
 * so the server reads the moved time.
 */
export const ageSessions = async (
  email: string,
  hours: number
): Promise<void> => {
  const client = new Client({
    connectionString: process.env["DATABASE_URL"],
  });

  await client.connect();

  try {
    await client.query(
      `UPDATE auth.session
          SET created_at = created_at - make_interval(hours => $2)
        WHERE user_id = (SELECT id FROM auth."user" WHERE email = $1)`,
      [email.toLowerCase(), hours]
    );
  } finally {
    await client.end();
  }
};

/**
 * Signs an account in through the server's API, as another device would,
 * and answers that device's session cookie alone: never the five-minute
 * cookie cache of the session (`peal.session_data`), which would answer
 * for the session after it ended.
 */
export const signedInElsewhere = async (
  baseUrl: string,
  account: { readonly email: string; readonly password: string }
): Promise<string> => {
  const signedIn = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify(account),
    headers: { "content-type": "application/json", origin: baseUrl },
    method: "POST",
  });

  if (!signedIn.ok) {
    throw new Error(`Signing in answered ${signedIn.status}`);
  }

  const token = signedIn.headers
    .getSetCookie()
    .map((header) => header.split(";")[0] ?? "")
    .find((pair) => pair.startsWith("peal.session_token="));

  if (token === undefined) {
    throw new Error("Signing in set no session cookie");
  }

  return token;
};

/** Whether the session a cookie names is still signed in. */
export const sessionLives = async (
  baseUrl: string,
  cookie: string
): Promise<boolean> => {
  const answer = await fetch(`${baseUrl}/api/auth/get-session`, {
    headers: { cookie, origin: baseUrl },
  });

  if (!answer.ok) {
    throw new Error(`Reading the session answered ${answer.status}`);
  }

  return (await answer.json()) !== null;
};
