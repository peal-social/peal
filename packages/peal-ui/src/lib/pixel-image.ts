// An image in pixel art (DESIGN.md, Pixel art): the picture scaled onto the
// canvas's 5 px cells as it would cover them, each cell's darkness mapped
// to the mark's four tones (yellow lightest, then lavender, blue and the
// deep blue) through the 4x4 Bayer dither, and the lightest left empty for
// the page to show through. It holds still: an image never moves.
import { pixelCell, threshold } from "./pixel-palette";
import type { PixelTones } from "./pixel-palette";

export interface PixelImageArt {
  readonly dispose: () => void;
}

// The page's tones (lavender, blue, deep blue, yellow) from the lightest
// to the darkest: yellow, lavender, blue, deep blue.
const byLightness = [3, 0, 1, 2];

// Where each tone starts, by darkness: yellow takes a narrow band of the
// lightest, so a pale sky stays mostly empty rather than turning yellow.
const steps = [0.14, 0.24, 0.46, 0.7];

// The tone of a cell from its darkness, from 0 to 1, dithered across each
// step: -1 for none.
const toneOf = (darkness: number, column: number, row: number) => {
  const dithered = darkness + (threshold(column, row) - 0.5) * 0.16;

  return steps.filter((step) => dithered >= step).length - 1;
};

// The image's luminance per cell, as it covers a grid of this size.
const sampled = (
  image: HTMLImageElement,
  columns: number,
  rows: number
): Uint8ClampedArray | undefined => {
  const scratch = document.createElement("canvas");
  scratch.width = columns;
  scratch.height = rows;

  const context = scratch.getContext("2d", { willReadFrequently: true });

  if (context === null) {
    return undefined;
  }

  const scale = Math.max(
    columns / image.naturalWidth,
    rows / image.naturalHeight
  );

  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    (columns - width) / 2,
    (rows - height) / 2,
    width,
    height
  );

  // An image from another origin without CORS taints the canvas.
  try {
    return context.getImageData(0, 0, columns, rows).data;
  } catch {
    return undefined;
  }
};

/**
 * Draws a loaded image on the canvas in pixel art, and again when the
 * canvas is resized. Returns undefined when the image cannot be read, such
 * as one from another origin served without CORS: the page then keeps the
 * plain image.
 */
export const createPixelImage = (
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  tones: PixelTones
): PixelImageArt | undefined => {
  const context = canvas.getContext("2d");

  if (context === null || sampled(image, 1, 1) === undefined) {
    return undefined;
  }

  const draw = () => {
    const { height, width } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const columns = Math.max(1, Math.floor(width / pixelCell));
    const rows = Math.max(1, Math.floor(height / pixelCell));
    const data = sampled(image, columns, rows);

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (data === undefined) {
      return;
    }

    const size = Math.round(pixelCell * ratio);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const index = (row * columns + column) * 4;
        const alpha = (data[index + 3] ?? 0) / 255;

        const luminance =
          (0.2126 * (data[index] ?? 255) +
            0.7152 * (data[index + 1] ?? 255) +
            0.0722 * (data[index + 2] ?? 255)) /
          255;

        const tone = toneOf((1 - luminance) * alpha, column, row);
        const colour = tones[byLightness[tone] ?? 0];

        if (tone >= 0 && colour !== undefined) {
          context.fillStyle = colour;
          context.fillRect(
            Math.round(column * pixelCell * ratio),
            Math.round(row * pixelCell * ratio),
            size,
            size
          );
        }
      }
    }
  };

  const observer = new ResizeObserver(draw);
  observer.observe(canvas);

  return {
    dispose: () => {
      observer.disconnect();
    },
  };
};
