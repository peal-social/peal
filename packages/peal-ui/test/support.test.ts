import { Option, Predicate, Schema } from "effect";
import { retentionPeriods } from "peal-contract/data-processing";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  conversationCookieSeconds,
  hasConversation,
  identify,
  identityCommandsOf,
  sessionCookieName,
  sessionDataOf,
} from "../src/lib/support/crisp";
import {
  launcherCell,
  launcherFrame,
  launcherGrid,
  stillLauncherFrame,
  typingDot,
} from "../src/lib/support/launcher-art";
import { launcherLabel, supportMessages } from "../src/lib/support/messages";
import {
  supportAttributes,
  supportWebsiteId,
} from "../src/lib/support/settings";

const website = "4d7aa8f1-6f97-4c6a-bcd8-79850beab6dc";

describe("the support chat's settings", () => {
  it("turns the chat off when unset or blank", () => {
    expect(
      supportWebsiteId(undefined, "SITE_CRISP_WEBSITE_ID")
    ).toBeUndefined();
    expect(supportWebsiteId("  ", "SITE_CRISP_WEBSITE_ID")).toBeUndefined();
  });

  it("takes a Crisp website's id, in any case", () => {
    expect(supportWebsiteId(` ${website.toUpperCase()} `, "X")).toBe(website);
  });

  it("refuses anything else, naming the setting", () => {
    expect(() =>
      supportWebsiteId("not-an-id", "DOCS_CRISP_WEBSITE_ID")
    ).toThrow(/DOCS_CRISP_WEBSITE_ID/u);
  });

  it("names the person only where one is given", () => {
    expect(
      supportAttributes(website, {
        locale: "fr",
        placement: "float",
        source: "site",
      })
    ).toStrictEqual({
      "data-art": "pixel",
      "data-email": undefined,
      "data-email-signature": undefined,
      "data-locale": "fr",
      "data-name": undefined,
      "data-placement": "float",
      "data-source": "site",
      "data-user-id": undefined,
      "data-website-id": website,
      "data-workspace-id": undefined,
    });
  });
});

const artOn = (source: "app" | "blog" | "docs" | "site") =>
  supportAttributes(website, {
    locale: "en",
    placement: source === "app" ? "bar" : "float",
    source,
  })["data-art"];

describe("the launcher's look", () => {
  it("is the pixel bubble on the site and the blog, an icon elsewhere", () => {
    expect(artOn("site")).toBe("pixel");
    expect(artOn("blog")).toBe("pixel");
    expect(artOn("docs")).toBe("icon");
    expect(artOn("app")).toBe("icon");
  });
});

describe("the glue to Crisp", () => {
  it("finds a conversation only in Crisp's cookie for this website", () => {
    const name = sessionCookieName(website);

    expect(hasConversation(`a=1; ${name}=session_1`, website)).toBe(true);
    expect(hasConversation(`${name}=`, website)).toBe(false);
    expect(hasConversation("a=1", website)).toBe(false);
    expect(
      hasConversation(
        `${sessionCookieName("00000000-0000-4000-8000-000000000000")}=s`,
        website
      )
    ).toBe(false);
  });

  it("hands Peal's team ids alone beside a signed-in person's chat", () => {
    expect(
      sessionDataOf({
        email: "ada@example.com",
        name: "Ada",
        userId: "user-1",
        workspaceId: "workspace-1",
      })
    ).toStrictEqual([
      ["user_id", "user-1"],
      ["workspace_id", "workspace-1"],
    ]);
  });

  it("keeps the conversation's cookie as long as the privacy policy says", () => {
    expect(conversationCookieSeconds).toBe(
      retentionPeriods.supportCookie.days * 86_400
    );
  });
});

// What the page's stand-in for Crisp reads of a command: a handler
// (`on`, an event, a function), and any command's verb and its name.
const isHandler = (input: unknown): input is () => void =>
  Predicate.isFunction(input);

const decodeHandler = Schema.decodeUnknownOption(
  Schema.Tuple([Schema.Literal("on"), Schema.String, Schema.declare(isHandler)])
);

const decodeStep = Schema.decodeUnknownOption(
  Schema.TupleWithRest(Schema.Tuple([Schema.String, Schema.String]), [
    Schema.Unknown,
  ])
);

// A page with Crisp's queue and its cookie, which writes down, in order,
// each command pushed and each cookie expired (by name and the domain it
// was expired on, `host` for the page's own host).
const pageWithConversation = () => {
  const done: string[] = [];
  const handlers = new Map<string, () => void>();

  vi.stubGlobal("window", {
    $crisp: {
      push: (command: readonly unknown[]) => {
        for (const [, event, handler] of Option.toArray(
          decodeHandler(command)
        )) {
          handlers.set(event, handler);
        }

        for (const [verb, name] of Option.toArray(decodeStep(command))) {
          done.push(`${verb} ${name}`);
        }
      },
    },
  });
  vi.stubGlobal("location", { hostname: "app.peal.example" });
  vi.stubGlobal("document", {
    createElement: () => ({
      addEventListener: () => {
        // The script never fails here.
      },
    }),
    get cookie() {
      return `${sessionCookieName(website)}=session_1; theme=light`;
    },
    set cookie(written: string) {
      const [pair = "", ...attributes] = written.split("; ");
      const domain = attributes.find((part) => part.startsWith("domain="));

      done.push(
        `expire ${decodeURIComponent(pair.slice(0, pair.indexOf("=")))} ${
          domain === undefined ? "host" : domain.slice("domain=".length)
        }`
      );
    },
    head: {
      append: () => {
        // Crisp's script is never fetched here.
      },
    },
  });

  return { done, handlers };
};

const expired = [
  `expire crisp-client/session/${website} host`,
  `expire crisp-client/session/${website} app.peal.example`,
  `expire crisp-client/session/${website} peal.example`,
];

// Crisp's state is the page's: each case loads the glue anew.
const freshGlue = async () => {
  vi.resetModules();

  return await import("../src/lib/support/crisp");
};

describe("forgetting the conversation at sign-out", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("expires the conversation's cookie where Crisp is not loaded", async () => {
    const { done } = pageWithConversation();
    const glue = await freshGlue();

    glue.forgetConversation();

    expect(done).toStrictEqual(expired);
  });

  // The page loads anew right after, so the reset Crisp queues may never
  // reach it: the cookie goes too, and the next page starts afresh.
  it("resets Crisp's session where it is loaded, then expires its cookie all the same", async () => {
    const { done, handlers } = pageWithConversation();
    const glue = await freshGlue();

    glue.startCrisp(website, "en");
    // Crisp's session is ready once its loader calls back.
    handlers.get("session:loaded")?.();
    expect(glue.crispReady()).toBe(true);

    done.length = 0;
    glue.forgetConversation();

    expect(done).toStrictEqual(["do session:reset", ...expired]);
  });
});

describe("the launcher's art", () => {
  it("is 24 px square", () => {
    expect(launcherGrid * launcherCell).toBe(24);
  });

  it("stays on its grid", () => {
    for (const state of ["active", "idle", "loading", "unread"] as const) {
      for (const time of [0, 100, 400, 900, 3999]) {
        for (const { x, y } of launcherFrame(state, time)) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(launcherGrid);
          expect(y).toBeLessThan(launcherGrid);
        }
      }
    }
  });

  it("types once every few seconds at rest, and on while active", () => {
    expect(typingDot("idle", 0)).toBe(0);
    expect(typingDot("idle", 300)).toBe(1);
    expect(typingDot("idle", 2000)).toBeUndefined();
    expect(typingDot("active", 2000)).toBeDefined();
  });

  it("lifts the typing dot in yellow, and keeps the others white at rest", () => {
    const frame = launcherFrame("active", 0);

    const top = (x: number) =>
      frame.findLast((cell) => cell.x === x && cell.y === 3)?.tone;

    expect(top(2)).toBe("typing");
    expect(top(5)).toBe("body");
  });

  it("shows waiting replies as yellow dots, still too", () => {
    const tones = new Set(stillLauncherFrame("unread").map(({ tone }) => tone));

    expect(tones.has("typing")).toBe(true);
    expect(tones.has("dot")).toBe(false);
  });
});

describe("the launcher's strings", () => {
  it("have the same keys in English and French", () => {
    expect(Object.keys(supportMessages.fr)).toStrictEqual(
      Object.keys(supportMessages.en)
    );
  });

  it("say how many replies wait", () => {
    expect(launcherLabel(supportMessages.en, 0)).toBe("Chat with Peal");
    expect(launcherLabel(supportMessages.en, 2)).toBe(
      "Chat with Peal, 2 unread"
    );
  });
});

const person = {
  email: "ada@example.test",
  name: "Ada",
  userId: "3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f",
  workspaceId: "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f70",
};

// The server's signature of the address, which Crisp verifies.
const signature =
  "a4c921058897c197f1db3c26023ca8bc06b14a14eb1ae2d0d81967327859471b";

describe("the person the chat names", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is named with the email and its signature, as Crisp verifies it", () => {
    expect(
      identityCommandsOf({ ...person, emailSignature: signature })[0]
    ).toStrictEqual(["set", "user:email", [person.email, signature]]);
  });

  it("is named with the email alone where the server signs nothing", () => {
    expect(identityCommandsOf(person)[0]).toStrictEqual([
      "set",
      "user:email",
      [person.email],
    ]);
  });

  it("reaches Crisp's queue with the pair", () => {
    const queued: unknown[] = [];
    vi.stubGlobal("window", { $crisp: queued });

    identify({ ...person, emailSignature: signature });

    expect(queued).toStrictEqual([
      ["set", "user:email", [person.email, signature]],
      ["set", "user:nickname", [person.name]],
      [
        "set",
        "session:data",
        [
          [
            ["user_id", person.userId],
            ["workspace_id", person.workspaceId],
          ],
        ],
      ],
    ]);
  });

  it("carries the signature on the app's launcher", () => {
    expect(
      supportAttributes(website, {
        locale: "en",
        person: { ...person, emailSignature: signature },
        placement: "menu",
        source: "app",
      })["data-email-signature"]
    ).toBe(signature);
  });
});
