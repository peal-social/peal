import type { AssetOf, StudioClip } from "#studio/edit-document.ts";

// Shotstack's shapes, the editor's figures, as it adds and changes them:
// a rectangle, a circle or a line, filled and stroked, in a box as large
// as the figure and its stroke, so the preview's handles hold the figure
// and nothing more. Shotstack's schema takes whole pixels for every size.

export type FigureAsset = AssetOf<"shape">;

/** The shapes Shotstack draws, in the order the toolbar offers them. */
export const figureKinds = ["rectangle", "circle", "line"] as const;

export type FigureKind = (typeof figureKinds)[number];

/** A shape's own size, by its kind. */
export type FigureSize =
  | {
      readonly cornerRadius: number;
      readonly height: number;
      readonly kind: "rectangle";
      readonly width: number;
    }
  | { readonly kind: "circle"; readonly radius: number }
  | {
      readonly kind: "line";
      readonly length: number;
      readonly thickness: number;
    };

/**
 * A figure's stroke: none at a width of 0. The SDK merges a change into
 * the asset it has, so a stroke is never taken off the asset, only thinned
 * to nothing.
 */
export interface FigureStroke {
  readonly color: string;
  readonly width: number;
}

// How long a shape shows when it is added, as a still does.
const figureSeconds = 4;

const whole = (pixels: number): number => Math.max(1, Math.round(pixels));

// The field of Shotstack's asset that names the figure drawn.
const kindField = "shape";

const sizes: Readonly<Record<FigureKind, FigureSize>> = {
  circle: { kind: "circle", radius: 200 },
  line: { kind: "line", length: 600, thickness: 8 },
  rectangle: { cornerRadius: 0, height: 400, kind: "rectangle", width: 600 },
};

/** The shape's size as its asset says, its kind's default where it says none. */
export const figureSizeOf = (asset: FigureAsset): FigureSize => {
  if (asset.shape === "circle") {
    return { kind: "circle", radius: asset.circle?.radius ?? 200 };
  }

  if (asset.shape === "line") {
    return {
      kind: "line",
      length: asset.line?.length ?? 600,
      thickness: asset.line?.thickness ?? 8,
    };
  }

  return {
    cornerRadius: asset.rectangle?.cornerRadius ?? 0,
    height: asset.rectangle?.height ?? 400,
    kind: "rectangle",
    width: asset.rectangle?.width ?? 600,
  };
};

// The shape's own fields, in whole pixels, and the box around it with
// room for its stroke on each side.
const sizedAsset = (
  asset: FigureAsset,
  size: FigureSize,
  strokeWidth: number
): FigureAsset => {
  const edge = Math.ceil(strokeWidth) * 2;

  const {
    circle: _circle,
    line: _line,
    rectangle: _rectangle,
    ...rest
  } = asset;

  if (size.kind === "circle") {
    const radius = whole(size.radius);

    return {
      ...rest,
      circle: { radius },
      height: radius * 2 + edge,
      [kindField]: "circle",
      width: radius * 2 + edge,
    };
  }

  if (size.kind === "line") {
    const length = whole(size.length);
    const thickness = whole(size.thickness);

    return {
      ...rest,
      height: thickness + edge,
      line: { length, thickness },
      [kindField]: "line",
      width: length + edge,
    };
  }

  const width = whole(size.width);
  const height = whole(size.height);

  return {
    ...rest,
    height: height + edge,
    rectangle: {
      cornerRadius: Math.max(0, Math.round(size.cornerRadius)),
      height,
      width,
    },
    [kindField]: "rectangle",
    width: width + edge,
  };
};

/**
 * The figure with its size or its stroke changed, its box sized to them
 * both.
 */
export const figureWith = (
  asset: FigureAsset,
  changes: {
    readonly size?: FigureSize;
    readonly stroke?: FigureStroke;
  }
): FigureAsset => {
  const stroke = changes.stroke ?? asset.stroke;
  const kept: FigureAsset = stroke === undefined ? asset : { ...asset, stroke };

  return sizedAsset(
    kept,
    changes.size ?? figureSizeOf(asset),
    stroke?.width ?? 0
  );
};

/** A white figure at `start`, centred, without a stroke. */
export const figureClipOf = (kind: FigureKind, start: number): StudioClip => ({
  asset: figureWith(
    {
      fill: { color: "#ffffff", opacity: 1 },
      [kindField]: kind,
      type: "shape",
    },
    { size: sizes[kind] }
  ),
  length: figureSeconds,
  position: "center",
  start,
});
