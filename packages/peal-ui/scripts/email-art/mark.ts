import { rgbOf } from "./colours";
import type { Rgb } from "./colours";

type Point = readonly [x: number, y: number];

interface Facet {
  readonly colour: Rgb;
  readonly corners: readonly [Point, Point, Point];
  readonly opacity: number;
}

const pointOf = (text = ""): Point => {
  const [x = 0, y = 0] = text.split(" ").map(Number);

  return [x, y];
};

/** The facets of the mark's SVG: triangles, each with a flat fill. */
export const facetsOf = (svg: string): readonly Facet[] =>
  [
    ...svg.matchAll(
      /<path d="M(?<a>[\d. ]+)L(?<b>[\d. ]+)L(?<c>[\d. ]+)Z" fill="(?<fill>#[0-9a-f]{6})"(?: fill-opacity="(?<opacity>[\d.]+)")? \/>/gu
    ),
  ].map(({ groups }) => ({
    colour: rgbOf(groups?.["fill"] ?? ""),
    corners: [
      pointOf(groups?.["a"]),
      pointOf(groups?.["b"]),
      pointOf(groups?.["c"]),
    ],
    opacity: Number(groups?.["opacity"] ?? 1),
  }));

// The side of the square the SVG is drawn in.
const sideOfBox = (svg: string): number =>
  Number(/viewBox="0 0 (?<side>\d+) \d+"/u.exec(svg)?.groups?.["side"]);

// Which side of the line from `a` to `b` a point is on.
const sideOf = ([x, y]: Point, [ax, ay]: Point, [bx, by]: Point) =>
  (x - bx) * (ay - by) - (ax - bx) * (y - by);

const holds = ([a, b, c]: Facet["corners"], point: Point) => {
  const sides = [sideOf(point, a, b), sideOf(point, b, c), sideOf(point, c, a)];

  return sides.every((side) => side >= 0) || sides.every((side) => side <= 0);
};

// Each pixel is sampled on a grid of 4 by 4 points.
const samples = 4;

const centres = Array.from(
  { length: samples },
  (_, index) => (index + 0.5) / samples
);

/** The mark, `size` pixels square, as red, green, blue and alpha bytes. */
export const markPixels = (svg: string, size: number): Uint8Array => {
  const facets = facetsOf(svg);
  const scale = sideOfBox(svg) / size;
  const bytes = new Uint8Array(size * size * 4);

  for (let index = 0; index < size * size; index += 1) {
    const x = index % size;
    const y = Math.floor(index / size);

    // The facets do not overlap: the first that holds a point colours it.
    const hits = centres
      .flatMap((dy) =>
        centres.map((dx): Point => [(x + dx) * scale, (y + dy) * scale])
      )
      .flatMap((point) =>
        facets.filter(({ corners }) => holds(corners, point)).slice(0, 1)
      );

    let alpha = 0;
    let red = 0;
    let green = 0;
    let blue = 0;

    for (const { colour, opacity } of hits) {
      alpha += opacity;
      red += colour[0] * opacity;
      green += colour[1] * opacity;
      blue += colour[2] * opacity;
    }

    if (alpha > 0) {
      bytes.set(
        [
          Math.round(red / alpha),
          Math.round(green / alpha),
          Math.round(blue / alpha),
          Math.round((alpha / samples ** 2) * 255),
        ],
        index * 4
      );
    }
  }

  return bytes;
};
