// A menu preview's art (DESIGN.md, Site): an icon's own SVG rasterised onto
// a small grid and drawn as square pixels on a 2D canvas, in the hero art's
// language (Bayer-dithered tones, crisp cells), with a pixel dissolve from
// one icon to the next and a scanline sweep while idle. No WebGL.

/** How much of each cell an icon covers, from 0 to 1, row by row. */
export interface PixelIcon {
  readonly columns: number;
  readonly coverage: Float32Array;
  readonly rows: number;
}

// Cells across the icon's square; the icon then sits centred on the canvas.
const iconCells = 34;

// Pixels sampled per cell while rasterising.
const sample = 5;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

const threshold = (column: number, row: number) =>
  ((bayer[(row % 4) * 4 + (column % 4)] ?? 0) + 0.5) / 16;

// A fixed per-cell order for the dissolve, so cells switch in a scatter.
const scatter = (column: number, row: number) => {
  const value = Math.sin(column * 12.9898 + row * 78.233) * 43_758.5453;

  return value - Math.floor(value);
};

/**
 * Rasterises an SVG element, such as a lucide icon or a brand's mark
 * already on the page, into cell coverage. Strokes and fills in
 * `currentColor` are drawn in black, since only coverage counts.
 */
export const rasterise = async (svg: SVGSVGElement): Promise<PixelIcon> => {
  const size = iconCells * sample;
  const copy = svg.cloneNode(true);

  if (!(copy instanceof SVGSVGElement)) {
    return { columns: 0, coverage: new Float32Array(0), rows: 0 };
  }

  copy.setAttribute("width", String(size));
  copy.setAttribute("height", String(size));
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.removeAttribute("class");

  const markup = new XMLSerializer()
    .serializeToString(copy)
    .replaceAll("currentColor", "#000");

  const image = new Image(size, size);
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  const coverage = new Float32Array(iconCells * iconCells);

  if (context === null) {
    return { columns: iconCells, coverage, rows: iconCells };
  }

  context.drawImage(image, 0, 0, size, size);

  const { data } = context.getImageData(0, 0, size, size);

  for (let row = 0; row < iconCells; row += 1) {
    for (let column = 0; column < iconCells; column += 1) {
      let alpha = 0;

      for (let y = 0; y < sample; y += 1) {
        for (let x = 0; x < sample; x += 1) {
          const index = ((row * sample + y) * size + column * sample + x) * 4;
          alpha += data[index + 3] ?? 0;
        }
      }

      coverage[row * iconCells + column] = alpha / (255 * sample * sample);
    }
  }

  return { columns: iconCells, coverage, rows: iconCells };
};

/** The four colours a pixel may take on the brand field, dim to bright. */
export interface PixelPalette {
  readonly tones: readonly [string, string, string, string];
}

export interface PixelArt {
  /** Draws the art, at once or through a dissolve from the current one. */
  readonly show: (icon: PixelIcon, animate: boolean) => void;
  /** Starts or stops the idle scanline. */
  readonly idle: (running: boolean) => void;
  readonly dispose: () => void;
}

// Cell size in CSS pixels, as the hero art's pixels.
const cellSize = 5;

const dissolveMs = 280;

const sweepMs = 2600;

export const createPixelArt = (
  canvas: HTMLCanvasElement,
  palette: PixelPalette
): PixelArt => {
  const context = canvas.getContext("2d");
  let current: PixelIcon | undefined;
  let previous: PixelIcon | undefined;
  let started = 0;
  let frame = 0;
  let idling = false;
  let columns = 0;
  let rows = 0;
  let ratio = 1;

  // The tone of a cell for an icon, or -1 where it draws nothing.
  const toneAt = (icon: PixelIcon | undefined, column: number, row: number) => {
    if (icon === undefined) {
      return -1;
    }

    const x = column - Math.floor((columns - icon.columns) / 2);
    const y = row - Math.floor((rows - icon.rows) / 2);

    if (x < 0 || y < 0 || x >= icon.columns || y >= icon.rows) {
      return -1;
    }

    const value = icon.coverage[y * icon.columns + x] ?? 0;

    if (value < 0.12) {
      return -1;
    }

    // Blue, lavender and white by coverage, brighter toward the icon's top,
    // dithered; yellow catches the light on the top rows only.
    const dither = threshold(x, y);
    const lift = 0.6 * (1 - y / icon.rows);
    const tone = Math.min(2, Math.floor(value * 1.4 + lift + dither));

    return tone === 2 && y < icon.rows * 0.3 && dither < 0.5 ? 3 : tone;
  };

  const draw = (now: number) => {
    if (context === null) {
      return;
    }

    const progress = previous === undefined ? 1 : (now - started) / dissolveMs;
    const sweep = idling ? ((now % sweepMs) / sweepMs) * (rows + 8) - 4 : -99;

    context.clearRect(0, 0, canvas.width, canvas.height);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const switched = scatter(column, row) < progress;
        let tone = toneAt(switched ? current : previous, column, row);

        if (tone >= 0 && Math.abs(row - sweep) < 1.5) {
          tone = Math.min(3, tone + 1);
        }

        if (tone >= 0) {
          context.fillStyle = palette.tones[tone] ?? "#ffffff";
          context.fillRect(
            Math.round(column * cellSize * ratio),
            Math.round(row * cellSize * ratio),
            Math.round(cellSize * ratio),
            Math.round(cellSize * ratio)
          );
        }
      }
    }

    if (progress >= 1) {
      previous = undefined;
    }

    frame = previous !== undefined || idling ? requestAnimationFrame(draw) : 0;
  };

  // Draws now, ending any frame already asked for, so one loop runs.
  const redraw = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    draw(performance.now());
  };

  const schedule = () => {
    if (frame === 0) {
      frame = requestAnimationFrame(draw);
    }
  };

  const resize = () => {
    const { height, width } = canvas.getBoundingClientRect();
    ratio = window.devicePixelRatio || 1;
    columns = Math.floor(width / cellSize);
    rows = Math.floor(height / cellSize);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    redraw();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  return {
    dispose: () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    },
    idle: (running) => {
      idling = running;

      if (running) {
        schedule();
      }
    },
    show: (icon, animate) => {
      previous = animate && current !== undefined ? current : undefined;
      current = icon;
      started = performance.now();

      if (animate) {
        schedule();
      } else {
        redraw();
      }
    },
  };
};
