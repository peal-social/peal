import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import { Option, Schema } from "effect";

import { requestsFile } from "../scripts/posthog.ts";
import { emailedLink } from "./support/mailpit.ts";

// How the web app measures a member's use, read from what the stand-in for
// PostHog received (scripts/posthog.ts): anonymous page views with nothing
// stored until the member allows more, then identified events, a recording
// and the server's events joined to the same session, and anonymous again
// once they withdraw. The module loads again for each attempt, so a retry
// signs up under a new address.
const run = randomUUID();
const name = "Robin Example";
const workspace = "Measured Studio";

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-measure@`);

const password = () => credentials.user("member").password;

const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu;

// The capture endpoint of the server's adapter; every other path is the
// browser's, through the relay.
const serverCapture = "/i/v1/analytics/events";

const PropertiesSchema = Schema.Record(Schema.String, Schema.Json);

const EventSchema = Schema.Struct({
  distinct_id: Schema.optionalKey(Schema.String),
  event: Schema.String,
  properties: Schema.optionalKey(PropertiesSchema),
});

const RequestSchema = Schema.Struct({
  body: Schema.Json,
  headers: Schema.Array(Schema.String),
  path: Schema.String,
});

const decodeRequest = Schema.decodeUnknownSync(
  Schema.fromJsonString(RequestSchema)
);

const decodeList = Schema.decodeUnknownOption(Schema.Array(Schema.Json));

const decodeBatch = Schema.decodeUnknownOption(
  Schema.Struct({ batch: Schema.Array(Schema.Json) })
);

const decodeEvent = Schema.decodeUnknownOption(EventSchema);

const decodeText = Schema.decodeUnknownOption(Schema.String);

const textOf = (value: typeof Schema.Json.Type | undefined): string =>
  Option.getOrElse(decodeText(value), () => "");

/** An event the stand-in received, with the request it came in. */
interface Received {
  readonly path: string;
  readonly headers: readonly string[];
  readonly line: number;
  readonly event: string;
  readonly distinctId: string;
  readonly properties: typeof PropertiesSchema.Type;
}

// The events a request carried: a batch, a list, or one event.
const eventsIn = (
  body: typeof Schema.Json.Type
): readonly (typeof Schema.Json.Type)[] =>
  decodeList(body).pipe(
    Option.orElse(() =>
      decodeBatch(body).pipe(Option.map(({ batch }) => batch))
    ),
    Option.getOrElse(() => [body])
  );

const received = (): readonly Received[] =>
  readFileSync(requestsFile, "utf-8")
    .split("\n")
    .filter((line) => line !== "")
    .flatMap((line, index) => {
      const request = decodeRequest(line);

      return eventsIn(request.body).flatMap((raw) =>
        Option.match(decodeEvent(raw), {
          onNone: () => [],
          onSome: (event) => {
            const properties = event.properties ?? {};

            return [
              {
                distinctId:
                  event.distinct_id ?? textOf(properties["distinct_id"]),
                event: event.event,
                headers: request.headers,
                line: index,
                path: request.path,
                properties,
              },
            ];
          },
        })
      );
    });

const fromBrowser = (event: Received) => event.path !== serverCapture;

// The SDK sends a batch every few seconds: wait for what a test expects.
const eventually = async (
  found: () => readonly Received[],
  what: string,
  attemptsLeft = 60
): Promise<readonly Received[]> => {
  const events = found();

  if (events.length > 0) {
    return events;
  }

  if (attemptsLeft === 0) {
    throw new Error(`The stand-in for PostHog never received ${what}`);
  }

  await sleep(500);

  return await eventually(found, what, attemptsLeft - 1);
};

// How many requests the stand-in had written, to read what came after.
const linesSoFar = () =>
  readFileSync(requestsFile, "utf-8")
    .split("\n")
    .filter((line) => line !== "").length;

const StoredSchema = Schema.Array(Schema.String);

// Every key of the page's local and session storage.
const storedKeys =
  "[...Object.keys(localStorage), ...Object.keys(sessionStorage)]";

// The SDK drops what a browser driven by a test sends as a bot's (its
// user agent says headless, `navigator.webdriver` is set): this one reads
// as a person's.
const personLike = `(() => {
  const userAgent = navigator.userAgent.replace("HeadlessChrome", "Chrome");
  const as = (name, value) =>
    Object.defineProperty(navigator, name, { configurable: true, get: () => value });
  as("userAgent", userAgent);
  as("userAgentData", undefined);
  as("webdriver", false);
})()`;

const asPerson = async (browser: {
  readonly addInitScript: (script: string) => Promise<void>;
}) => {
  await browser.addInitScript(personLike);
};

let memberId = "";
let workspaceId = "";

describe("the web app's measurement", { serial: true }, () => {
  test("signs up, confirms and creates a workspace", async ({
    app,
    browser,
    screen,
  }) => {
    await asPerson(browser);
    await app.open("/sign-up");
    await screen.getByLabel("Name").fill(name);
    await screen.getByLabel("Email").fill(address());
    await screen.getByLabel("Password").fill(password());
    await screen.getByRole("button", "Create my account").tap();
    await expect(screen.getByText("Check your inbox")).toBeVisible();

    await browser.goto(
      await emailedLink(address(), "Confirm your email for Peal")
    );
    await expect(screen.getByRole("heading", "Email confirmed")).toBeVisible();

    await app.open("/app");
    await screen.getByLabel("Workspace name").fill(workspace);
    await screen.getByRole("button", "Create the workspace").tap();

    const calendar = screen
      .getByRole("navigation", `Posts of ${workspace}`)
      .getByRole("link", "Calendar");

    await expect(calendar).toBeVisible();

    const href = (await calendar.getAttribute("href")) ?? "";

    workspaceId =
      /^\/app\/(?<id>[^/]+)\/calendar$/u.exec(href)?.groups?.["id"] ?? "";
    memberId = textOf(
      await browser.evaluate(
        "fetch('/api/me').then((answer) => answer.json()).then((me) => me.user.id)"
      )
    );

    expect(workspaceId).toMatch(uuid);
    expect(memberId).not.toBe("");
  });

  test("counts pages without knowing who, and stores nothing", async ({
    app,
    browser,
    screen,
  }) => {
    await asPerson(browser);
    await app.open("/app");
    await expect(
      screen.getByRole("heading", "Help us improve Peal")
    ).toBeVisible();

    await app.open(`/app/${workspaceId}/posts`);
    await app.open(`/app/${workspaceId}/channels`);

    const views = await eventually(
      () =>
        received().filter(
          (event) =>
            fromBrowser(event) &&
            event.event === "$pageview" &&
            textOf(event.properties["$current_url"]).includes(":id")
        ),
      "an anonymous page view of a workspace page"
    );

    for (const view of views) {
      expect(view.distinctId).not.toBe(memberId);
      expect(textOf(view.properties["$current_url"])).not.toMatch(uuid);
      expect(view.properties).not.toHaveProperty("workspace_id");
    }

    const fromTheBrowser = received().filter(fromBrowser);

    expect(fromTheBrowser.map(({ event }) => event)).not.toContain("$snapshot");
    // The relay forwards no cookie.
    expect(
      fromTheBrowser.filter(({ headers }) => headers.includes("cookie"))
    ).toEqual([]);

    const stored = Schema.decodeUnknownSync(StoredSchema)(
      await browser.evaluate(storedKeys)
    );

    const jar = await browser.cookies();
    const cookies = jar.map((cookie) => cookie.name);

    expect(
      [...stored, ...cookies].filter(
        (key) => key.startsWith("ph_") || key.startsWith("__ph")
      )
    ).toEqual([]);
  });

  test("links the member's use and records once they allow it", async ({
    app,
    browser,
    screen,
  }) => {
    await asPerson(browser);
    await app.open("/app");

    const allowedAt = linesSoFar();

    await screen.getByRole("button", "Allow").tap();
    await expect(
      screen.getByRole("heading", "Help us improve Peal")
    ).toBeHidden();

    // In place, without a reload: a link of the app.
    await screen
      .getByRole("navigation", `Posts of ${workspace}`)
      .getByRole("link", "All posts")
      .tap();

    const after = () =>
      received().filter(
        (event) => event.line >= allowedAt && fromBrowser(event)
      );

    await eventually(
      () =>
        after().filter(
          (event) =>
            event.event === "$identify" && event.distinctId === memberId
        ),
      "the member's $identify"
    );

    const views = await eventually(
      () =>
        after().filter(
          (event) =>
            event.event === "$pageview" &&
            event.distinctId === memberId &&
            event.properties["workspace_id"] === workspaceId
        ),
      "a page view under the member's id with the workspace"
    );

    await eventually(
      () => after().filter((event) => event.event === "$snapshot"),
      "a recording"
    );

    // A write from the page names the browser's session to Peal's API.
    const session = textOf(views[0]?.properties["$session_id"]);

    expect(session).toMatch(uuid);
    expect(
      await browser.evaluate(
        `(id) => fetch('/api/workspaces/' + id + '/posts', { body: JSON.stringify({ channelIds: [], content: { media: [], overrides: [], text: 'A synthetic draft.' } }), headers: { 'content-type': 'application/json' }, method: 'POST' }).then((answer) => answer.status)`,
        workspaceId
      )
    ).toBe(201);

    await eventually(
      () =>
        received().filter(
          (event) =>
            event.path === serverCapture &&
            event.event === "api_operation" &&
            event.distinctId === memberId &&
            event.properties["$session_id"] === session
        ),
      "a server event joined to the browser's session"
    );

    // What the SDK keeps once allowed, which the privacy policy names.
    const stored = Schema.decodeUnknownSync(StoredSchema)(
      await browser.evaluate(storedKeys)
    );

    const jar = await browser.cookies();
    const cookies = jar.map((cookie) => cookie.name);

    const kept = path.join(
      import.meta.dirname,
      "..",
      ".e2e",
      "posthog-storage.json"
    );

    const local = Schema.decodeUnknownSync(StoredSchema)(
      await browser.evaluate("Object.keys(localStorage)")
    );

    mkdirSync(path.dirname(kept), { recursive: true });

    writeFileSync(kept, JSON.stringify({ cookies, local, stored }, null, 2));

    expect(stored.some((key) => key.startsWith("ph_"))).toBeTruthy();
  });

  test("is anonymous again, with no recording, once withdrawn", async ({
    app,
    browser,
    screen,
  }) => {
    await asPerson(browser);
    await app.open("/app/account");
    await screen.getByRole("button", "Don’t allow").tap();
    await expect(screen.getByText(/^Not allowed since /u)).toBeVisible();

    // What the recording held until then may still be sent.
    await sleep(5000);

    const withdrawnAt = linesSoFar();

    await app.open(`/app/${workspaceId}/posts`);
    await app.open(`/app/${workspaceId}/channels`);

    const views = await eventually(
      () =>
        received().filter(
          (event) =>
            event.line >= withdrawnAt &&
            fromBrowser(event) &&
            event.event === "$pageview"
        ),
      "a page view after withdrawing"
    );

    await sleep(4000);

    for (const view of views) {
      expect(view.distinctId).not.toBe(memberId);
      expect(view.properties).not.toHaveProperty("workspace_id");
    }

    expect(
      received()
        .filter((event) => event.line >= withdrawnAt)
        .map(({ event }) => event)
    ).not.toContain("$snapshot");

    const stored = Schema.decodeUnknownSync(StoredSchema)(
      await browser.evaluate(storedKeys)
    );

    expect(stored.filter((key) => key.startsWith("ph_"))).toEqual([]);
  });
});
