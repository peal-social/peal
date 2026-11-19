import { randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { gzipSync } from "node:zlib";

import { describe, test } from "@e2e-dev/web";
import { credentials, expect } from "e2e";
import { Option, Schema } from "effect";

import { projectToken, requestsFile } from "../scripts/posthog.ts";
import { siteRoot, siteUrlFile } from "../scripts/site.ts";
import { emailedLink } from "./support/mailpit.ts";
import { asPerson } from "./support/person.ts";
import { openedWorkspace } from "./support/workspaces.ts";

// How the marketing site measures, read from what the stand-in for PostHog
// received (scripts/posthog.ts) through the web app's relay in its site
// mode, which the run's site (scripts/site.ts) forwards /pulse/ to as the
// tunnel does: counted without a cookie until the visitor answers the
// consent notice and after a refusal, followed under one cookie once
// allowed, and that visitor linked to the account a sign-up in the same
// browser makes, once, by the server. The module loads again for each
// attempt, so a retry signs up under a new address.
const run = randomUUID();

const address = () =>
  credentials.user("member").username.replace("@", `+${run}-site@`);

const site = () => readFileSync(siteUrlFile, "utf-8").trim();

const output = path.dirname(requestsFile);

const visitorCookie = `ph_${projectToken}_posthog`;

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
  query: Schema.String,
  warnings: Schema.Array(
    Schema.Struct({ event: Schema.String, type: Schema.String })
  ),
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

interface Received {
  readonly distinctId: string;
  readonly event: string;
  readonly headers: readonly string[];
  readonly line: number;
  readonly path: string;
  readonly properties: typeof PropertiesSchema.Type;
}

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

// What PostHog's ingestion would have dropped so far, with its warning:
// the stand-in drops it as PostHog does (scripts/posthog.ts).
const ingestionWarnings = () =>
  readFileSync(requestsFile, "utf-8")
    .split("\n")
    .filter((line) => line !== "")
    .flatMap((line) => decodeRequest(line).warnings);

const linesSoFar = () =>
  readFileSync(requestsFile, "utf-8")
    .split("\n")
    .filter((line) => line !== "").length;

// The site's own events, from a line on.
const fromSite = (since: number) =>
  received().filter(
    (event) => event.line >= since && event.properties["source"] === "site"
  );

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

const pageViewOf = async (since: number, pathname: string, what: string) => {
  const views = await eventually(
    () =>
      fromSite(since).filter(
        (event) =>
          event.event === "$pageview" &&
          textOf(event.properties["$pathname"]) === pathname
      ),
    what
  );

  const [view] = views;

  if (view === undefined) {
    throw new Error(`No ${what}`);
  }

  return view;
};

const StoredSchema = Schema.Array(Schema.String);

const storedKeys =
  "[...Object.keys(localStorage), ...Object.keys(sessionStorage)]";

const BoxSchema = Schema.Struct({
  height: Schema.Number,
  innerHeight: Schema.Number,
  innerWidth: Schema.Number,
  top: Schema.Number,
  width: Schema.Number,
});

// The notice's box in the window.
const noticeBox = async (browser: {
  readonly evaluate: (script: string) => Promise<typeof Schema.Json.Type>;
}) => {
  const box = await browser.evaluate(
    `(() => { const r = document.querySelector(".peal-consent").getBoundingClientRect(); return { height: r.height, innerHeight, innerWidth, top: r.top, width: r.width }; })()`
  );

  return Schema.decodeUnknownSync(BoxSchema)(box);
};

// The names of the browser's cookies.
const cookieNames = async (browser: {
  readonly cookies: () => Promise<readonly { readonly name: string }[]>;
}) => {
  const jar = await browser.cookies();

  return jar.map(({ name }) => name);
};

// Whether the browser comes to hold the visitor's cookie: the SDK loads
// once the page is idle and saves it a moment after opting in, later on
// a slow machine, so it is waited for, ten seconds at most.
const holdsVisitor = async (
  browser: Parameters<typeof cookieNames>[0],
  attempts = 40
): Promise<boolean> => {
  const names = await cookieNames(browser);

  if (names.includes(visitorCookie) || attempts === 0) {
    return names.includes(visitorCookie);
  }

  await sleep(250);

  return await holdsVisitor(browser, attempts - 1);
};

// The notice's title, which names its region, in each language.
const titles = {
  en: "Can we keep a cookie?",
  fr: "Un cookie, vous permettez\u202F?",
} as const;

// Where a journey keeps what it saw, for the reviewer.
const keep = (from: string, name: string) => {
  mkdirSync(output, { recursive: true });
  copyFileSync(from, path.join(output, name));
};

let visitor = "";

// The WebKit run (e2e.webkit.config.ts), which writes beside the Chromium one.
const inWebKit = (process.env["PEAL_E2E_OUTPUT"] ?? "").endsWith("webkit");

// CI's Linux WebKit never shows the visitor's cookie on an http 127.0.0.1 origin; production checks it in a real WebKit browser instead.
const notInWebKit =
  "the visitor's cookie is not seen in CI's Linux WebKit on http://127.0.0.1; verified in production with a real WebKit browser";

// What the web app's SDK sends, beside the site's: its own events.
const fromApp = (since: number) =>
  received().filter(
    (event) =>
      event.line >= since &&
      event.path !== serverCapture &&
      event.properties["source"] !== "site"
  );

// The site's answer and PostHog's cookies, the app's session kept.
const forgetSite = async (browser: {
  readonly clearCookies: (filter: { readonly name: RegExp }) => Promise<void>;
}) => {
  await browser.clearCookies({
    name: /^(?:peal\.consent|peal_site_consent|peal_site_retired|ph_|__ph)/u,
  });
};

// Every journey below shares the browser's cookies, its init scripts and
// its emulated media, so they run one after the other, those that change
// what the browser asks (reduced motion, Global Privacy Control) last.
describe("the site, its notice and its measurement", { serial: true }, () => {
  describe("the site's measurement", () => {
    test("asks without taking focus, and counts the page without a cookie", async ({
      browser,
      screen,
    }) => {
      await asPerson(browser);

      // Every request the page sends to the relay, by path.
      const pulses: string[] = [];

      await browser.route(/\/pulse\//u, async (route) => {
        pulses.push(new URL(route.request.url).pathname);
        await route.continue();
      });

      const since = linesSoFar();

      await browser.goto(`${site()}/`);

      const notice = screen.getByRole("region", "Can we keep a cookie?");

      await expect(notice).toBeVisible();

      // The two answers: the same variant, the same size.
      const [allowSize, refuseSize] = Schema.decodeUnknownSync(
        Schema.Array(
          Schema.Tuple([Schema.Number, Schema.Number, Schema.String])
        )
      )(
        await browser.evaluate(
          `[...document.querySelectorAll(".peal-consent__answer")].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), b.className]; })`
        )
      );

      expect(allowSize).toEqual(refuseSize);
      expect(allowSize?.[1]).toBe(34);

      expect(
        await browser.evaluate(
          "document.activeElement === document.body || document.activeElement === null"
        )
      ).toBe(true);

      // The page's first link stays a few tabs away: past the notice's
      // policy link and its two answers.
      const reached = async (tabs: number): Promise<boolean> => {
        if (tabs === 0) {
          return false;
        }

        await browser.keyboard.press("Tab");

        return (await browser.evaluate(
          "document.activeElement?.textContent?.includes('Follow the build') ?? false"
        )) === true
          ? true
          : await reached(tabs - 1);
      };

      expect(await reached(6)).toBe(true);

      const view = await pageViewOf(since, "/", "the home page's view");

      expect(view.distinctId).toBe("$posthog_cookieless");
      expect(view.properties["$cookieless_mode"]).toBe(true);
      expect(textOf(view.properties["$current_url"])).toBe(`${site()}/`);
      expect(view.properties["environment"]).toBe("e2e");
      expect(view.properties["locale"]).toBe("en");
      expect(view.headers).toContain("user-agent");
      expect(view.headers).toContain("x-forwarded-for");
      expect(view.headers).not.toContain("cookie");

      // Nothing stored in the browser for it.
      expect(await browser.evaluate("document.cookie")).toBe("");

      const stored = Schema.decodeUnknownSync(StoredSchema)(
        await browser.evaluate(storedKeys)
      );

      expect(
        stored.filter((key) => key.startsWith("ph_") || key.startsWith("__ph"))
      ).toEqual([]);

      // Events alone, at the SDK's own endpoint: no configuration, no flags.
      expect(pulses.length).toBeGreaterThan(0);
      expect([...new Set(pulses)]).toEqual(["/pulse/site/e/"]);
    });

    test("sends three campaign labels at most, and nothing else of the query", async ({
      browser,
    }) => {
      await asPerson(browser);

      const since = linesSoFar();

      await browser.goto(
        `${site()}/pricing/?utm_source=newsletter&utm_content=x&email=a@b.test`
      );

      const view = await pageViewOf(
        since,
        "/pricing/",
        "the pricing page's view"
      );

      expect(view.properties["utm_source"]).toBe("newsletter");
      expect(view.properties).not.toHaveProperty("utm_content");
      expect(textOf(view.properties["$current_url"])).toBe(
        `${site()}/pricing/`
      );
      expect(JSON.stringify(view.properties)).not.toContain("a@b.test");
    });

    test("keeps counting without a cookie after Don't allow", async ({
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await browser.goto(`${site()}/`);

      const since = linesSoFar();

      await screen.getByRole("button", "Don’t allow").tap();
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeHidden();

      const names = await cookieNames(browser);

      expect(names).toContain("peal.consent");
      expect(names).not.toContain(visitorCookie);

      await eventually(
        () =>
          fromSite(since).filter(
            (event) =>
              event.event === "consent_answered" &&
              event.properties["answer"] === "refused"
          ),
        "the refusal"
      );

      const next = linesSoFar();

      await browser.goto(`${site()}/pricing/`);

      const view = await pageViewOf(next, "/pricing/", "a view after refusing");

      expect(view.properties["$cookieless_mode"]).toBe(true);
    });

    test("opens from Cookie settings, with the answer and its date, and gives focus back", async ({
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await browser.goto(`${site()}/`);

      const settings = screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings");

      await settings.tap();

      const notice = screen.getByRole("region", "Can we keep a cookie?");

      await expect(notice).toBeVisible();
      await expect(
        notice.getByText(/^You didn’t allow this on /u)
      ).toBeVisible();
      expect(
        await browser.evaluate("document.activeElement?.textContent ?? ''")
      ).toBe("Can we keep a cookie?");

      await browser.keyboard.press("Escape");
      await expect(notice).toBeHidden();
      expect(
        await browser.evaluate("document.activeElement?.textContent ?? ''")
      ).toBe("Cookie settings");
    });

    test("follows one visitor across pages once allowed", async ({
      browser,
      screen,
    }) => {
      test.skip(inWebKit, notInWebKit);
      await asPerson(browser);
      await browser.goto(`${site()}/`);
      await screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings")
        .tap();
      await screen.getByRole("button", "Allow").tap();
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeHidden();

      expect(await holdsVisitor(browser)).toBeTruthy();

      const since = linesSoFar();

      await browser.goto(`${site()}/pricing/`);

      const pricing = await pageViewOf(since, "/pricing/", "a followed view");

      await browser.goto(`${site()}/privacy/`);

      const privacy = await pageViewOf(
        since,
        "/privacy/",
        "a third page's view"
      );

      visitor = pricing.distinctId;

      expect(visitor).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/u
      );
      expect(privacy.distinctId).toBe(visitor);
      expect(pricing.properties).not.toHaveProperty("$cookieless_mode");

      // What the site keeps once allowed, which the privacy policy names.
      const jar = await browser.cookies();

      const stored = Schema.decodeUnknownSync(StoredSchema)(
        await browser.evaluate(storedKeys)
      );

      // The visit's source the SDK keeps: a page without its query, the
      // referrer's origin alone.
      const kept = decodeURIComponent(
        jar.find(({ name }) => name === visitorCookie)?.value ?? ""
      );

      expect(kept).toContain('"u":"');
      expect(kept).not.toMatch(/"u":"[^"]*\?/u);
      expect(kept).not.toMatch(/"r":"https?:\/\/[^"]*\/[^"]/u);

      mkdirSync(output, { recursive: true });
      writeFileSync(
        path.join(output, "posthog-site-storage.json"),
        JSON.stringify(
          {
            cookies: jar.map(({ name, value }) => ({
              name,
              value: decodeURIComponent(value),
            })),
            stored,
          },
          null,
          2
        )
      );
    });

    test("links that visitor to the account a sign-up makes, once, and forgets it", async ({
      app,
      browser,
      screen,
    }) => {
      // It follows the visitor the journey above followed.
      test.skip(inWebKit, notInWebKit);
      await asPerson(browser);

      // A tab of the site left open across the sign-up, as a docs tab would
      // be, which must never follow the visitor the sign-up linked.
      const left = await browser.newTab();
      const leftSince = linesSoFar();

      await browser.goto(`${site()}/pricing/`);
      // Its measurement started: its first page view left.
      await pageViewOf(leftSince, "/pricing/", "the left tab's view");

      const [signUpTab] = browser.tabs();

      await signUpTab?.activate();

      // The visitor's cookie as the browser sends it with the sign-up.
      expect(await holdsVisitor(browser)).toBeTruthy();

      const since = linesSoFar();

      await app.open("/sign-up");
      await screen.getByLabel("Name").fill("Sam Example");
      await screen.getByLabel("Email").fill(address());
      await screen
        .getByLabel("Password")
        .fill(credentials.user("member").password);
      await screen.getByRole("button", "Create my account").tap();
      await expect(screen.getByText("Check your inbox")).toBeVisible();

      const aliases = await eventually(
        () =>
          received().filter(
            (event) =>
              event.line >= since &&
              event.path === serverCapture &&
              event.event === "$create_alias"
          ),
        "the server's alias"
      );

      expect(aliases).toHaveLength(1);
      expect(aliases[0]?.properties["alias"]).toBe(visitor);
      expect(aliases[0]?.distinctId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/u
      );

      expect(await cookieNames(browser)).not.toContain(visitorCookie);

      // The tab left open is shown again, and its visitor clicks: it follows
      // a new visitor, linked to none, never the one just linked.
      const afterSignUp = linesSoFar();

      await left.activate();

      await browser.evaluate(
        "document.dispatchEvent(new Event('visibilitychange'))"
      );
      await sleep(500);

      // Two clicks: the first finds the visitor retired, and leaves nothing.
      const click =
        "(() => { const link = document.querySelector('[data-measure-cta]'); link.addEventListener('click', (event) => event.preventDefault()); link.click(); })()";

      await browser.evaluate(click);
      await sleep(500);
      await browser.evaluate(click);

      await eventually(
        () =>
          fromSite(afterSignUp).filter(
            (event) => event.event === "site_cta_clicked"
          ),
        "the left tab's click"
      );

      expect(
        fromSite(afterSignUp).filter((event) => event.distinctId === visitor)
      ).toEqual([]);

      // PostHog's cookie, if the tab saved it again, names a new visitor;
      // only peal_site_retired still names the one linked.
      const jar = await browser.cookies();
      const posthogCookie = jar.find(({ name }) => name === visitorCookie);

      expect(decodeURIComponent(posthogCookie?.value ?? "")).not.toContain(
        visitor
      );
      expect(jar.find(({ name }) => name === "peal_site_retired")?.value).toBe(
        visitor
      );

      await left.close();

      const next = linesSoFar();

      await browser.goto(`${site()}/`);

      const view = await pageViewOf(next, "/", "a view after the sign-up");

      expect(view.distinctId).not.toBe(visitor);
      expect(view.distinctId).not.toBe("$posthog_cookieless");
    });

    test("forgets everything once Don't allow follows Allow", async ({
      browser,
      screen,
    }) => {
      // It removes the retired visitor the sign-up above left.
      test.skip(inWebKit, notInWebKit);
      await asPerson(browser);
      await browser.goto(`${site()}/`);
      await screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings")
        .tap();
      // The sign-up before left the retired visitor's session cookie.
      expect(await cookieNames(browser)).toContain("peal_site_retired");

      await screen.getByRole("button", "Don’t allow").tap();
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeHidden();

      expect(await cookieNames(browser)).not.toContain(visitorCookie);
      expect(await cookieNames(browser)).not.toContain("peal_site_retired");

      const stored = Schema.decodeUnknownSync(StoredSchema)(
        await browser.evaluate(storedKeys)
      );

      expect(
        stored.filter((key) => key.startsWith("ph_") || key.startsWith("__ph"))
      ).toEqual([]);

      const next = linesSoFar();

      await browser.goto(`${site()}/pricing/`);

      const view = await pageViewOf(
        next,
        "/pricing/",
        "a view after Don't allow"
      );

      expect(view.properties["$cookieless_mode"]).toBe(true);
    });

    test("asks again, and counts without a cookie, once an answer is 183 days old", async ({
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await browser.clearCookies();
      await browser.setCookies([
        {
          name: "peal.consent",
          url: site(),
          value: `1.a.${String(Math.floor(Date.now() / 86_400_000) - 183)}`,
        },
      ]);

      const next = linesSoFar();

      await browser.goto(`${site()}/`);
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeVisible();

      const view = await pageViewOf(next, "/", "a view past the answer's days");

      expect(view.properties["$cookieless_mode"]).toBe(true);
      expect(await cookieNames(browser)).not.toContain(visitorCookie);
    });
  });

  describe("the web app beside the site's answers", () => {
    const besideRun = randomUUID();

    const member = () =>
      credentials.user("member").username.replace("@", `+${besideRun}-beside@`);

    let workspaceSlug = "";
    let memberId = "";

    test("signs up a member with a workspace", async ({
      app,
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await app.open("/sign-up");
      await screen.getByLabel("Name").fill("Alex Example");
      await screen.getByLabel("Email").fill(member());
      await screen
        .getByLabel("Password")
        .fill(credentials.user("member").password);
      await screen.getByRole("button", "Create my account").tap();
      await expect(screen.getByText("Check your inbox")).toBeVisible();
      await browser.goto(
        await emailedLink(member(), "Confirm your email for Peal")
      );
      await app.open("/");
      ({ slug: workspaceSlug } = await openedWorkspace(browser));
      memberId = textOf(
        await browser.evaluate(
          "fetch('/api/me').then((answer) => answer.json()).then((me) => me.user.id)"
        )
      );

      expect(workspaceSlug).not.toBe("");
      expect(memberId).not.toBe("");
    });

    test("keeps measuring the app, and keeps nothing of the site's answer, after the site's Don't allow", async ({
      app,
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await forgetSite(browser);
      await browser.goto(`${site()}/`);
      await screen.getByRole("button", "Don’t allow").tap();
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeHidden();

      const since = linesSoFar();

      await app.open(`/${workspaceSlug}/posts`);

      await eventually(
        () => fromApp(since).filter((event) => event.event === "$pageview"),
        "the app's anonymous page view after the site's refusal"
      );

      const local = Schema.decodeUnknownSync(StoredSchema)(
        await browser.evaluate("Object.keys(localStorage)")
      );

      expect(local.filter((key) => key.startsWith("__ph"))).toEqual([]);

      // The member allows the app's own measurement: it follows them,
      // whatever the site's answer said.
      const allowedAt = linesSoFar();

      // The workspace's home asks; `/` would move there itself, after Allow.
      await app.open(`/${workspaceSlug}`);
      await screen.getByRole("button", "Allow").tap();
      await expect(
        screen.getByRole("heading", "Help us improve Peal")
      ).toBeHidden();
      await app.open(`/${workspaceSlug}/channels`);

      await eventually(
        () =>
          fromApp(allowedAt).filter(
            (event) =>
              event.event === "$pageview" && event.distinctId === memberId
          ),
        "the member's page view once they allowed the app"
      );
    });

    test("keeps the app as it is after the site's Allow", async ({
      app,
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await browser.goto(`${site()}/`);
      await screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings")
        .tap();
      await screen.getByRole("button", "Allow").tap();

      const since = linesSoFar();

      await app.open(`/${workspaceSlug}/posts`);

      const views = await eventually(
        () =>
          fromApp(since).filter(
            (event) =>
              event.event === "$pageview" && event.distinctId === memberId
          ),
        "the member's page view after the site's Allow"
      );

      const siteVisitor = textOf(
        await browser.evaluate(
          `(() => { const raw = document.cookie.split('; ').find((c) => c.startsWith('${visitorCookie}=')); return raw === undefined ? '' : JSON.parse(decodeURIComponent(raw.slice(${String(visitorCookie.length + 1)}))).distinct_id; })()`
        )
      );

      expect(siteVisitor).not.toBe("");

      // Every event of the app's, the views and the rest, beside the
      // site's visitor cookie: none carries it.
      for (const event of [...views, ...fromApp(since)]) {
        expect(event.distinctId).not.toBe(siteVisitor);
        expect(JSON.stringify(event.properties)).not.toContain(siteVisitor);
      }

      const local = Schema.decodeUnknownSync(StoredSchema)(
        await browser.evaluate("Object.keys(localStorage)")
      );

      expect(local.filter((key) => key.startsWith("__ph"))).toEqual([]);
    });
  });

  describe("the notice on a phone and on a desktop", () => {
    const phones = [
      { height: 568, width: 320 },
      { height: 667, width: 375 },
    ] as const;

    for (const locale of ["en", "fr"] as const) {
      const home = locale === "en" ? "/" : "/fr/";

      for (const size of phones) {
        const name = `${String(size.width)}x${String(size.height)}`;

        test(`fits ${name} in ${locale}, under the header, and leaves the footer reachable`, async ({
          app,
          browser,
          screen,
        }) => {
          await asPerson(browser);
          await browser.clearCookies();
          await browser.setViewport(size);
          await browser.goto(`${site()}${home}`);
          await expect(
            screen.getByRole("region", titles[locale])
          ).toBeVisible();
          // Its rise ends.
          await sleep(600);

          const box = await noticeBox(browser);

          expect(box.width).toBeLessThanOrEqual(box.innerWidth);
          expect(box.height).toBeLessThanOrEqual(box.innerHeight / 2);

          const headerBottom = await browser.evaluate(
            "document.querySelector('header').getBoundingClientRect().bottom"
          );

          expect(Number(headerBottom)).toBeLessThanOrEqual(box.top);

          keep(
            await app.screenshot(`notice-${locale}-${name}`),
            `site-notice-${locale}-${name}.png`
          );

          await browser.evaluate(
            "window.scrollTo(0, document.body.scrollHeight)"
          );
          await sleep(300);

          const footerBottom = await browser.evaluate(
            "[...document.querySelectorAll('footer')].at(-1).getBoundingClientRect().bottom"
          );

          const scrolled = await noticeBox(browser);

          expect(Number(footerBottom)).toBeLessThanOrEqual(scrolled.top + 1);
        });
      }

      test(`shows at 1280 px in ${locale}`, async ({
        app,
        browser,
        screen,
      }) => {
        await asPerson(browser);
        await browser.clearCookies();
        await browser.setViewport({ height: 800, width: 1280 });
        await browser.goto(`${site()}${home}`);
        await expect(screen.getByRole("region", titles[locale])).toBeVisible();
        await sleep(600);
        keep(
          await app.screenshot(`notice-${locale}-1280`),
          `site-notice-${locale}-1280x800.png`
        );
      });
    }
  });

  describe("the notice with reduced motion", () => {
    test("stays still, and leaves at once", async ({ browser, screen }) => {
      await asPerson(browser);
      await browser.emulateMedia({ reducedMotion: "reduce" });
      await browser.clearCookies();
      await browser.goto(`${site()}/`);
      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeVisible();

      const art = "document.querySelector('.peal-consent__canvas').toDataURL()";
      const first = await browser.evaluate(art);

      await sleep(500);
      expect(await browser.evaluate(art)).toBe(first);

      await screen.getByRole("button", "Allow").tap();
      expect(
        await browser.evaluate("document.querySelector('.peal-consent').hidden")
      ).toBe(true);
    });
  });

  describe("a browser that asks not to be followed", () => {
    test("is never asked nor measured", async ({ browser, screen }) => {
      await asPerson(browser);
      await browser.addInitScript(
        "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { configurable: true, get: () => true })"
      );
      // The page an earlier journey left measures its leaving: it goes
      // before the count starts.
      await browser.goto("about:blank");
      await sleep(500);
      await browser.clearCookies();

      const pulses: string[] = [];

      await browser.route(/\/pulse\//u, async (route) => {
        pulses.push(route.request.url);
        await route.continue();
      });

      await browser.goto(`${site()}/`);
      await sleep(3000);

      await expect(
        screen.getByRole("region", "Can we keep a cookie?")
      ).toBeHidden();
      expect(pulses).toEqual([]);

      await screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings")
        .tap();
      await expect(
        screen.getByText(
          "Your browser asks sites not to track you, so we measure nothing here and there’s nothing to choose."
        )
      ).toBeVisible();
      await expect(screen.getByRole("button", "Allow")).toBeHidden();
      expect(pulses).toEqual([]);
    });

    test("removes what an earlier visit left once the browser asks not to be followed", async ({
      browser,
      screen,
    }) => {
      await asPerson(browser);
      await browser.addInitScript(
        "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { configurable: true, get: () => true })"
      );

      // What an earlier visit, before the signal, left behind.
      await browser.setCookies([
        {
          name: "peal_site_retired",
          url: site(),
          value: "019a0000-0000-7000-8000-00000000517e",
        },
        { name: visitorCookie, url: site(), value: "%7B%7D" },
      ]);

      await browser.goto(`${site()}/`);
      await screen
        .getByRole("contentinfo")
        .getByRole("link", "Cookie settings")
        .tap();
      await expect(
        screen.getByText(
          "Your browser asks sites not to track you, so we measure nothing here and there’s nothing to choose."
        )
      ).toBeVisible();

      const left = await cookieNames(browser);

      expect(left).not.toContain("peal_site_retired");
      expect(left).not.toContain(visitorCookie);
    });
  });

  // Last, over every journey above: PostHog takes a counted event only
  // with what its hash needs, the user agent, the host and the address.
  describe("what PostHog takes of the site", () => {
    test("drops none of the site's events", () => {
      expect(ingestionWarnings()).toEqual([]);
    });
  });
});

// The scripts the site's layout loads, gzip: the one loaded up front with
// what it imports, the notice, and the measurement (peal-ui's guide).
const budgets = { measurement: 70_000, notice: 10_000, upFront: 2048 };

describe("the site's scripts", () => {
  test("stay within their budgets", () => {
    const assets = path.join(siteRoot, "_astro");
    const files = readdirSync(assets);
    const read = (name: string) => readFileSync(path.join(assets, name));

    const gzip = (names: readonly string[]) =>
      names.reduce(
        (total, name) => total + gzipSync(read(name), { level: 9 }).length,
        0
      );

    const staticImports = (name: string): string[] =>
      [
        ...read(name)
          .toString("utf-8")
          .matchAll(/from"\.\/(?<file>[^"]+\.js)"/gu),
      ].map((match) => match.groups?.["file"] ?? "");

    const entry =
      /src="\/_astro\/(?<file>base\.astro_astro_type_script[^"]+\.js)"/u.exec(
        readFileSync(path.join(siteRoot, "index.html"), "utf-8")
      )?.groups?.["file"] ?? "";

    const named = (prefix: string) =>
      files.filter((file) => file.startsWith(prefix));

    const upFront = [entry, ...staticImports(entry)];

    const outside = (names: readonly string[]) =>
      names.filter((name) => !upFront.includes(name));

    const element = named("element.").filter((file) => file.endsWith(".js"));

    const notice = [
      ...element,
      ...outside(element.flatMap(staticImports)),
      ...named("element.").filter((file) => file.endsWith(".css")),
    ];

    const start = named("start.");

    const measurement = [
      ...start,
      ...outside(start.flatMap(staticImports)),
      ...named("module.slim.no-external."),
    ];

    const sizes = {
      measurement: gzip([...new Set(measurement)]),
      notice: gzip([...new Set(notice)]),
      upFront: gzip([...new Set(upFront)]),
    };

    writeFileSync(
      path.join(output, "site-budgets.json"),
      JSON.stringify(
        { budgets, files: { measurement, notice, upFront }, sizes },
        null,
        2
      )
    );

    expect(entry).not.toBe("");
    expect(sizes.upFront).toBeLessThanOrEqual(budgets.upFront);
    expect(sizes.notice).toBeLessThanOrEqual(budgets.notice);
    expect(sizes.measurement).toBeLessThanOrEqual(budgets.measurement);
  });
});
