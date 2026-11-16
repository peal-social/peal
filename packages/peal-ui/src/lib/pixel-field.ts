// The pixel field (DESIGN.md, Pixel art): a slow noise in the mark's colours
// on 5 px cells, Bayer-dithered between four tones and empty where it is
// low, drawn by one fragment shader through pixel-shader's runner.
import { pixelCell } from "./pixel-palette";
import type { PixelTones } from "./pixel-palette";
import { createPixelShader, glslBayer, glslHash } from "./pixel-shader";

export interface PixelField {
  /** Moves the noise on, frame by frame, until paused. */
  readonly play: () => void;
  /** Stops where it is. */
  readonly pause: () => void;
  /** Stops, and keeps one frame drawn through resizes. */
  readonly still: () => void;
  readonly dispose: () => void;
}

// Four octaves of value noise over the cells, drifting slowly; about half
// the cells stay empty, so the page shows through, and yellow only peaks.
const fragment = `
uniform vec3 tone0;
uniform vec3 tone1;
uniform vec3 tone2;
uniform vec3 tone3;
uniform float cell;
uniform float seed;

${glslHash}
${glslBayer}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i + seed);
  float b = hash(i + vec2(1.0, 0.0) + seed);
  float c = hash(i + vec2(0.0, 1.0) + seed);
  float d = hash(i + vec2(1.0, 1.0) + seed);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    value += amplitude * noise(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 c = floor(gl_FragCoord.xy / (cell * ratio));
  float n = fbm(c * 0.05 + vec2(time * 0.035, time * -0.02));
  float level = floor(n * 7.0 + bayer(c) - 3.8);
  if (level < 0.0) {
    colour = vec4(0.0);
    return;
  }
  vec3 tone = level < 1.0 ? tone0 : (level < 2.0 ? tone1 : (level < 3.0 ? tone2 : tone3));
  colour = vec4(tone, 1.0);
}
`;

// A CSS colour as its sRGB components from 0 to 1, as the page paints it.
const rgb = (css: string): readonly [number, number, number] => {
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  if (context === null) {
    return [0, 0, 0];
  }

  context.fillStyle = css;
  context.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

  return [red / 255, green / 255, blue / 255];
};

/**
 * Starts the pixel field on a canvas, paused on its first frame, or
 * returns undefined where WebGL2 is missing.
 */
export const createPixelField = (
  canvas: HTMLCanvasElement,
  tones: PixelTones,
  seed: number
): PixelField | undefined => {
  let time = 0;
  let last = 0;
  let frame = 0;

  const shader = createPixelShader({
    canvas,
    colours: {
      tone0: rgb(tones[0]),
      tone1: rgb(tones[1]),
      tone2: rgb(tones[2]),
      tone3: rgb(tones[3]),
    },
    floats: { cell: pixelCell, seed: seed * 17.13 },
    fragment,
    onResize: () => {
      shader?.draw(time);
    },
  });

  if (shader === undefined) {
    return undefined;
  }

  const tick = (now: number) => {
    // A long gap, such as a background tab, does not jump the noise.
    time += Math.min(now - last, 50) / 1000;
    last = now;
    shader.draw(time);
    frame = requestAnimationFrame(tick);
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
  };

  return {
    dispose: () => {
      stop();
      shader.dispose();
    },
    pause: stop,
    play: () => {
      if (frame === 0) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    still: () => {
      stop();
      shader.draw(time);
    },
  };
};
