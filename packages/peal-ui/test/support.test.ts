import { retentionPeriods } from "peal-contract/data-processing";
import { describe, expect, it } from "vitest";

import {
  conversationCookieSeconds,
  hasConversation,
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
