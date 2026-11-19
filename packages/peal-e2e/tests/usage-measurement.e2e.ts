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

// The ids an event carries that could tie it to another: none may pass
// from one consent to the next.
const idsOf = (event: Received): readonly string[] =>
  [
    "$device_id",
    "$pageview_id",
    "$prev_pageview_id",
    "$session_id",
    "$window_id",
  ].flatMap((key) => {
    const id = textOf(event.properties[key]);

    return id === "" || id === event.distinctId ? [] : [id];
  });

// The headers the relay lets reach PostHog, whatever the browser sent:
// the request's type, and what the relay's own fetch adds.
const relayedHeaders = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "connection",
  "content-length",
  "content-type",
  "host",
  "sec-fetch-mode",
  "user-agent",
]);

let memberId = "";
let workspaceId = "";
let allowedAt = 0;
let withdrawnAt = 0;

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
    await app.open(`/app/${workspaceId}/posts`);

    // A page opened without a reload counts too.
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Drafts")
      .tap();

    await eventually(
      () =>
        received().filter(
          (event) =>
            fromBrowser(event) &&
            event.event === "$pageview" &&
            event.distinctId !== memberId &&
            textOf(event.properties["$current_url"]).endsWith("/app/:id/drafts")
        ),
      "an anonymous page view of a page opened without a reload"
    );

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

    // The relay forwards no cookie, and no header of the browser's but
    // the request's type.
    for (const { headers } of fromTheBrowser) {
      expect(headers.filter((header) => !relayedHeaders.has(header))).toEqual(
        []
      );
    }

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

    allowedAt = linesSoFar();

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

    // Pages opened without a reload count under the member, the recording
    // goes on across them, and the app's own requests name the session.
    const recordedSoFar = after().filter(
      (event) => event.event === "$snapshot"
    ).length;

    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Drafts")
      .tap();

    await eventually(
      () =>
        after().filter(
          (event) =>
            event.event === "$pageview" &&
            event.distinctId === memberId &&
            textOf(event.properties["$current_url"]).endsWith("/app/:id/drafts")
        ),
      "the member's page view of a page opened without a reload"
    );

    await app.open(`/app/${workspaceId}/settings`);
    await screen
      .getByRole("navigation", "Workspace")
      .getByRole("link", "Tags")
      .tap();
    await screen.getByLabel("Name").fill("Measured");
    await screen.getByRole("button", "Add the tag").tap();
    await expect(screen.getByText("The tag is added.")).toBeVisible();

    const current = await eventually(
      () =>
        after().filter(
          (event) =>
            event.event === "$pageview" &&
            event.distinctId === memberId &&
            textOf(event.properties["$current_url"]).endsWith(
              "/app/:id/settings/tags"
            )
        ),
      "the member's page view of the tags"
    );

    const tagged = await eventually(
      () =>
        received().filter(
          (event) =>
            event.path === serverCapture &&
            event.event === "api_operation" &&
            event.properties["operation"] === "tags.create"
        ),
      "the server's event of the tag the page added"
    );

    expect(tagged[0]?.properties["$session_id"]).toBe(
      current[0]?.properties["$session_id"]
    );

    await eventually(
      () =>
        after()
          .filter((event) => event.event === "$snapshot")
          .slice(recordedSoFar),
      "more of the recording after pages opened without a reload"
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

    withdrawnAt = linesSoFar();

    // In place, without a reload: a link of the app.
    await screen.getByRole("link", "Agenda").tap();

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

  test("ties no id of one consent to the next", async ({ app, browser }) => {
    await asPerson(browser);
    // A full load after withdrawing too.
    await app.open(`/app/${workspaceId}/posts`);

    await eventually(
      () =>
        received().filter(
          (event) =>
            event.line >= withdrawnAt &&
            fromBrowser(event) &&
            event.event === "$pageview" &&
            textOf(event.properties["$current_url"]).endsWith("/posts")
        ),
      "a page view of a full load after withdrawing"
    );

    // Each id the events go by (the member's, then each anonymous one, a
    // new one per page load and per consent change), with the other ids
    // its events carry: none of those may appear under two of them. The
    // SDK sends in batches, so the events are told apart by whom they are
    // about, never by when they came.
    const byWhom = new Map<string, Set<string>>();

    for (const event of received().filter(fromBrowser)) {
      const ids = byWhom.get(event.distinctId) ?? new Set<string>();

      for (const id of idsOf(event)) {
        ids.add(id);
      }

      byWhom.set(event.distinctId, ids);
    }

    const owners = new Map<string, string>();

    for (const [whom, ids] of byWhom) {
      for (const id of ids) {
        const owner = owners.get(id) ?? whom;

        expect({ id, owner }).toEqual({ id, owner: whom });
        owners.set(id, whom);
      }
    }

    expect(byWhom.has(memberId)).toBeTruthy();
    expect(byWhom.size).toBeGreaterThan(2);
    // No property names the member but their own events' id.
    expect(owners.has(memberId)).toBeFalsy();
  });
});
