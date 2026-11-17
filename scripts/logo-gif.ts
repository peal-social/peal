// Renders the READMEs' animated logo, .github/logo/peal-cube.gif: the
// site's pixel cube (scripts/logo-gif/cube.ts) in headless Chromium, one
// frame at a time with the clock set per frame, then a GIF through
// ffmpeg's palettegen and paletteuse.
//
//   bun scripts/logo-gif.ts [--frames <folder>]
//
// It needs Playwright's Chromium (`bunx playwright-core install
// chromium-headless-shell`) and ffmpeg on the PATH, or in FFMPEG. With
// --frames, it keeps the PNG frames in that folder.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import { $ } from "bun";
import { Schema } from "effect";
import { chromium } from "playwright-core";

const root = path.join(import.meta.dir, "..");
const output = path.join(root, ".github/logo/peal-cube.gif");

// Displayed at 160 CSS pixels in the READMEs, rendered at twice that.
const size = 160;
const scale = 2;
const fps = 20;

// The loop: the mark's own angle held, then one eased turn back to it.
// Opposite faces share a colour, but a half turn flips the top face's
// shading, so the image repeats only after a whole turn.
const hold = 1.2;
const turn = 4.8;
const angle = 2 * Math.PI;

const frames = Math.round((hold + turn) * fps);

// Starts and ends at rest, so the turn eases into the hold.
const ease = (progress: number) => (1 - Math.cos(Math.PI * progress)) / 2;

const yawAt = (frame: number) => {
  const seconds = frame / fps;

  return seconds < hold ? 0 : angle * ease((seconds - hold) / turn);
};

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: { frames: { type: "string" } },
});

const bundle = await Bun.build({
  entrypoints: [path.join(import.meta.dir, "logo-gif/cube.ts")],
  minify: true,
  target: "browser",
});

const [script] = bundle.outputs;

if (!bundle.success || script === undefined) {
  throw new Error("The cube's script did not build.", { cause: bundle.logs });
}

// What the page's drawFrames answers: one PNG data URL a frame.
const PngFramesSchema = Schema.Array(
  Schema.String.check(Schema.isStartingWith("data:image/png;base64,"))
);

const browser = await chromium.launch();

const pngs = await (async () => {
  try {
    const page = await browser.newPage({
      deviceScaleFactor: scale,
      viewport: { height: size, width: size },
    });

    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">
      <canvas style="display:block;width:${size}px;height:${size}px"></canvas>
      <script type="module">${await script.text()}</script></body></html>`
    );

    const yaws = Array.from({ length: frames }, (_, frame) => yawAt(frame));

    const answer: unknown = await page.evaluate(
      `drawFrames(${JSON.stringify(yaws)})`
    );

    return Schema.decodeUnknownSync(PngFramesSchema)(answer);
  } finally {
    await browser.close();
  }
})();

const folder =
  values.frames ?? (await mkdtemp(path.join(tmpdir(), "peal-cube-")));

await mkdir(folder, { recursive: true });

await Promise.all(
  pngs.map(async (png, frame) => {
    const data = Buffer.from(png.slice(png.indexOf(",") + 1), "base64");

    await Bun.write(
      path.join(folder, `${String(frame).padStart(3, "0")}.png`),
      data
    );
  })
);

const ffmpeg = Bun.env["FFMPEG"] ?? "ffmpeg";

// One palette for every frame, keeping a transparent index; no dithering
// by the palette, since the art's own tones are already few.
const filter =
  "split[a][b];[a]palettegen=max_colors=32:reserve_transparent=1:stats_mode=full[p];[b][p]paletteuse=dither=none:alpha_threshold=128";

await $`${ffmpeg} -v error -y -framerate ${fps} -i ${path.join(folder, "%03d.png")} -filter_complex ${filter} -loop 0 ${output}`;

if (values.frames === undefined) {
  await rm(folder, { force: true, recursive: true });
}

console.log(
  `Wrote ${path.relative(root, output)}: ${frames} frames at ${fps} fps.`
);
