// The pixel art's shaders (DESIGN.md, Pixel art): the GLSL the cube's second
// pass and the pixel field share (a per-cell hash and the 4x4 Bayer
// matrix), and a small WebGL2 runner that draws one fragment shader over a
// canvas, for art that needs no scene and so no Three.js.

/** A per-cell hash, from 0 to 1, stable for a cell. */
export const glslHash = `
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
`;

/** The 4x4 Bayer threshold of a cell, from 0 to 1, as pixel-palette's. */
export const glslBayer = `
  float bayer(vec2 p) {
    vec2 q = mod(p, 4.0);
    int i = int(q.x + q.y * 4.0);
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
      3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i] + 0.5) / 16.0;
  }
`;

export interface PixelShader {
  /** Draws a frame at this time, in seconds. */
  readonly draw: (time: number) => void;
  readonly dispose: () => void;
}

export interface PixelShaderOptions {
  readonly canvas: HTMLCanvasElement;
  /**
   * The fragment shader's body, in GLSL ES 3.00 after `#version` and the
   * precision, writing `colour`. It reads `resolution` (device pixels),
   * `ratio` (device pixels per CSS pixel) and `time` (seconds), and the
   * colours and floats below.
   */
  readonly fragment: string;
  /** Called after each resize, so the art can redraw its still frame. */
  readonly onResize?: (() => void) | undefined;
  /** vec3 uniforms the fragment declares, such as colours, set once. */
  readonly colours?:
    | Readonly<Record<string, readonly [number, number, number]>>
    | undefined;
  /** Float uniforms the fragment declares, set once. */
  readonly floats?: Readonly<Record<string, number>> | undefined;
}

const vertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | undefined => {
  const shader = gl.createShader(type);

  if (shader === null) {
    return undefined;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true
    ? shader
    : undefined;
};

const link = (gl: WebGL2RenderingContext, fragment: string) => {
  const program = gl.createProgram();
  const vertexShader = compile(gl, gl.VERTEX_SHADER, vertex);

  const fragmentShader = compile(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
precision highp float;
uniform vec2 resolution;
uniform float ratio;
uniform float time;
out vec4 colour;
${fragment}`
  );

  if (vertexShader !== undefined && fragmentShader !== undefined) {
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  return gl.getProgramParameter(program, gl.LINK_STATUS) === true
    ? program
    : undefined;
};

/**
 * Draws a fragment shader over the whole canvas, at the screen's pixel
 * ratio, or returns undefined where WebGL2 is missing: the art then stays
 * empty, which is still decoration.
 */
export const createPixelShader = ({
  canvas,
  fragment,
  colours = {},
  floats = {},
  onResize,
}: PixelShaderOptions): PixelShader | undefined => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });

  if (gl === null) {
    return undefined;
  }

  const program = link(gl, fragment);

  if (program === undefined) {
    return undefined;
  }

  gl.useProgram(program);

  // One triangle that covers the screen.
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW
  );

  const position = gl.getAttribLocation(program, "position");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  for (const [name, value] of Object.entries(floats)) {
    gl.uniform1f(gl.getUniformLocation(program, name), value);
  }

  for (const [name, [red, green, blue]] of Object.entries(colours)) {
    gl.uniform3f(gl.getUniformLocation(program, name), red, green, blue);
  }

  const resolution = gl.getUniformLocation(program, "resolution");
  const ratioLocation = gl.getUniformLocation(program, "ratio");
  const timeLocation = gl.getUniformLocation(program, "time");

  const draw = (time: number) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(timeLocation, time);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const { height, width } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;

    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    gl.uniform1f(ratioLocation, ratio);
    onResize?.();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  return {
    dispose: () => {
      observer.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
    draw,
  };
};
