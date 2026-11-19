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
import { asPerson } from "./support/person.ts";

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

describe("the site's measurement", { serial: true }, () => {
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
      Schema.Array(Schema.Tuple([Schema.Number, Schema.Number, Schema.String]))
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
    expect(textOf(view.properties["$current_url"])).toBe(`${site()}/pricing/`);
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
    await expect(notice.getByText(/^You didn’t allow this on /u)).toBeVisible();
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

    expect(await cookieNames(browser)).toContain(visitorCookie);

    const since = linesSoFar();

    await browser.goto(`${site()}/pricing/`);

    const pricing = await pageViewOf(since, "/pricing/", "a followed view");

    await browser.goto(`${site()}/privacy/`);

    const privacy = await pageViewOf(since, "/privacy/", "a third page's view");

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
    await asPerson(browser);

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

    const next = linesSoFar();

    await browser.goto(`${site()}/`);

    const view = await pageViewOf(next, "/", "a view after the sign-up");

    expect(view.distinctId).not.toBe(visitor);
    expect(view.distinctId).not.toBe("$posthog_cookieless");
  });
});

describe("a browser that asks not to be followed", { serial: true }, () => {
  test("is never asked nor measured", async ({ browser, screen }) => {
    await asPerson(browser);
    await browser.addInitScript(
      "Object.defineProperty(Navigator.prototype, 'globalPrivacyControl', { configurable: true, get: () => true })"
    );
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
});

describe("the notice with reduced motion", { serial: true }, () => {
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
        await expect(screen.getByRole("region", titles[locale])).toBeVisible();
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

    test(`shows at 1280 px in ${locale}`, async ({ app, browser, screen }) => {
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
