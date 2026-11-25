// The art of Peal's emails, committed in peal-emails: what the script draws,
// byte for byte, and what its files say.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { emailArt } from "../scripts/email-art/art";
import { artSources, assetsFolder } from "../scripts/email-art/files";
import { facetsOf } from "../scripts/email-art/mark";
import { layouts } from "../src/lib/pixel-glow";
import { readGif, readPalettePng, readRgbaPng } from "./email-art-reader";

const sources = artSources();

const drawn = emailArt(sources);

const committed = (name: string) =>
  Uint8Array.from(readFileSync(path.join(assetsFolder, name)));

const kilobyte = 1024;

// Each glow's tones as colours: `--name` ones as tokens.css gives them.
const tones = new Set(
  Object.values(layouts).flatMap((glows) =>
    glows.flatMap((glow) =>
      glow.tones.map((tone) =>
        tone.startsWith("--")
          ? new RegExp(`${tone}: (?<value>[^;]+);`, "u").exec(sources.tokens)
              ?.groups?.["value"]
          : tone
      )
    )
  )
);

const usedColours = (colours: readonly string[], pixels: readonly number[]) =>
  [...new Set(pixels)].flatMap((index) =>
    index === 0 ? [] : [colours[index]]
  );

describe("the emails' art", () => {
  it("is four files", () => {
    expect([...drawn.keys()].toSorted()).toStrictEqual([
      "footer.png",
      "header.gif",
      "header.png",
      "mark.png",
    ]);
  });

  it.each([...drawn])(
    "%s is committed as the script draws it (if not, run `bun nx run peal-ui:email-art`)",
    (name, bytes) => {
      expect(Buffer.compare(committed(name), bytes)).toBe(0);
    }
  );

  it.each(["footer.png", "header.png", "mark.png"])(
    "%s is at most 4 kB",
    (name) => {
      expect(committed(name).length).toBeLessThanOrEqual(4 * kilobyte);
    }
  );

  it("header.gif is at most 200 kB", () => {
    expect(committed("header.gif").length).toBeLessThanOrEqual(200 * kilobyte);
  });
});

describe("the moving header", () => {
  const gif = readGif(committed("header.gif"));

  it("plays once: it has 38 frames and says nothing of repeating", () => {
    expect(gif.version).toBe("GIF89a");
    expect([gif.width, gif.height]).toStrictEqual([600, 180]);
    expect(gif.frames).toHaveLength(38);
    expect(gif.applications).toStrictEqual([]);
    expect(
      Buffer.from(committed("header.gif")).includes("NETSCAPE2.0")
    ).toBeFalsy();
  });

  it("lasts 4.8 s before its last frame, under the five of WCAG 2.2.2", () => {
    const moving = gif.frames.slice(0, -1);

    expect(moving.reduce((sum, { delay }) => sum + delay, 0)).toBe(481);
  });

  it("clears each frame for the next, and leaves the last in place", () => {
    expect(gif.frames.map(({ disposal }) => disposal)).toStrictEqual([
      ...Array.from({ length: 37 }, () => 2),
      1,
    ]);
  });

  it("starts and ends on the still", () => {
    const { pixels } = readPalettePng(committed("header.png"), 600);

    expect(pixels).toHaveLength(600 * 180);
    expect(gif.frames.at(0)?.pixels).toStrictEqual(pixels);
    expect(gif.frames.at(-1)?.pixels).toStrictEqual(pixels);
  });

  it("moves, gently: under a twentieth of its pixels from frame to frame", () => {
    const changes = gif.frames
      .slice(1)
      .map(
        ({ pixels }, index) =>
          pixels.filter((pixel, at) => pixel !== gif.frames[index]?.pixels[at])
            .length
      );

    expect(Math.min(...changes)).toBeGreaterThan(0);
    expect(Math.max(...changes)).toBeLessThan((600 * 180) / 20);
  });

  it("holds the glow's tones alone, on nothing", () => {
    const used = gif.frames.flatMap(({ pixels }) =>
      usedColours(gif.colours, pixels)
    );

    expect(used.filter((colour) => !tones.has(colour))).toStrictEqual([]);
  });
});

describe("the stills", () => {
  it.each([
    { height: 180, name: "header.png", width: 600 },
    { height: 160, name: "footer.png", width: 1200 },
  ])(
    "$name holds the glow's tones alone, on a clear ground",
    ({ height, name, width }) => {
      const { clear, colours, pixels } = readPalettePng(committed(name), width);

      const used = usedColours(colours, pixels);

      expect(pixels).toHaveLength(width * height);
      expect(clear).toStrictEqual([0]);
      expect(used.length).toBeGreaterThan(3);
      expect(used.filter((colour) => !tones.has(colour))).toStrictEqual([]);
    }
  );
});

describe("the mark", () => {
  const facets = facetsOf(sources.mark);

  it("is drawn from the six facets of the app's icon", () => {
    expect(facets).toHaveLength(6);
  });

  it("holds the mark's fills, at their opacities, on a clear ground", () => {
    const pixels = readRgbaPng(committed("mark.png"), 112);

    const shown = new Set(
      pixels
        .filter(({ alpha }) => alpha > 0)
        .map(({ alpha, colour }) => `${colour} ${alpha}`)
    );

    expect(pixels).toHaveLength(112 * 112);
    expect(pixels.at(0)?.alpha).toBe(0);
    expect(
      facets
        .map(
          ({ colour: [red, green, blue], opacity }) =>
            `#${Buffer.from([red, green, blue]).toString("hex")} ${Math.round(opacity * 255)}`
        )
        .filter((fill) => !shown.has(fill))
    ).toStrictEqual([]);
  });
});
