import type { StudioClip } from "#studio/edit-document.ts";

// Shapes ("figures" in code, as the lint rules refuse "shape" in a name),
// as inline SVG: the SDK's toolbar for SVG clips sets their fill and
// corners, where it has none for Shotstack's own shape asset.

export type FigureKind = "circle" | "rectangle";

// How long a shape shows when it is added, as a still does.
const figureSeconds = 4;

const sizes: Readonly<
  Record<FigureKind, { readonly height: number; readonly width: number }>
> = {
  circle: { height: 400, width: 400 },
  rectangle: { height: 400, width: 600 },
};

const drawings: Readonly<Record<FigureKind, string>> = {
  circle: '<circle cx="200" cy="200" r="200" fill="#b9a6ff"/>',
  rectangle: '<rect x="0" y="0" width="600" height="400" fill="#b9a6ff"/>',
};

/** A lavender shape in the middle of the frame, at `start`. */
export const figureClipOf = (kind: FigureKind, start: number): StudioClip => {
  const { height, width } = sizes[kind];

  return {
    asset: {
      src: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${drawings[kind]}</svg>`,
      type: "svg",
    },
    fit: "none",
    height,
    length: figureSeconds,
    position: "center",
    start,
    width,
  };
};
