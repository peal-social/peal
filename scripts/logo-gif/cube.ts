// The READMEs' animated logo: the site's hero art (DESIGN.md, Site, Hero
// art), Peal's cube rendered by Three.js at one pixel per cell into a
// small target, then drawn as square pixels with ordered dithering, each
// face in its colour of the mark. The shaders are the site's
// (packages/peal-ui/src/lib/ascii-cube.ts); here the clock is set per
// frame by the capture script, `scripts/logo-gif.ts`, instead of a ticker.
/// <reference lib="dom" />
import {
  BoxGeometry,
  Color,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";

/** The mark's three colours, from peal-ui's tokens: top, left and right. */
const colours = { left: "#415eee", right: "#b9a6ff", top: "#ffca00" };

// The site's cell, in CSS pixels.
const cell = { height: 5, width: 5 };

// The mark's isometric view: a quarter turn around the vertical, then the
// cube tipped toward the reader until its top is a rhombus.
const isoYaw = Math.PI / 4;
const isoPitch = Math.atan(1 / Math.SQRT2);

// Half the camera's height in world units: the cube (edge 1) stands about
// 1.63 tall at the iso angle, so this leaves a margin around it.
const halfHeight = 0.95;

const cubeVertex = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Red carries the face (1 top, 2 left, 3 right, over 3), green the shade
// and blue whether the pixel is on the face's edge.
const cubeFragment = `
  uniform float face;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vec3 light = normalize(vec3(-0.2, 0.8, 1.0));
    float lambert = max(dot(normalize(vNormal), light), 0.0);
    float across = 0.5 + 0.5 * (vUv.x + vUv.y) * 0.5;
    float shade = clamp(0.25 + 0.95 * lambert * across, 0.0, 1.0);
    float inset = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    gl_FragColor = vec4(face / 3.0, shade, step(inset, 0.03), 1.0);
  }
`;

const screenVertex = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Reads the cell under each fragment from the cube's target and draws it:
// face colour, shade and edge. The site's intro reveal is left out, since
// the GIF loops on the turn alone.
const screenFragment = `
  uniform sampler2D cube;
  uniform vec2 cellSize;
  uniform vec2 grid;
  uniform vec2 offset;
  uniform vec3 top;
  uniform vec3 left;
  uniform vec3 right;

  float bayer(vec2 p) {
    vec2 q = mod(p, 4.0);
    int i = int(q.x + q.y * 4.0);
    float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
      3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
    return (m[i] + 0.5) / 16.0;
  }

  void main() {
    vec2 position = gl_FragCoord.xy - offset;
    vec2 cell = floor(position / cellSize);
    if (any(lessThan(cell, vec2(0.0))) || any(greaterThanEqual(cell, grid))) {
      discard;
    }
    vec4 texel = texture2D(cube, (cell + 0.5) / grid);
    float face = floor(texel.r * 3.0 + 0.5);
    if (texel.a == 0.0 || face < 0.5) {
      discard;
    }
    vec3 colour = face < 1.5 ? top : (face < 2.5 ? left : right);

    // Four steps per face, from a darker to a lighter tone of its colour,
    // chosen by the shade with a 4x4 Bayer matrix between them.
    float tone = clamp(floor(texel.g * 3.0 + bayer(cell)), 0.0, 3.0);
    if (texel.b > 0.5) {
      tone = 0.0;
    }
    vec3 dark = colour * 0.72;
    vec3 light = mix(colour, vec3(1.0), 0.28);
    gl_FragColor = vec4(mix(dark, light, tone / 3.0), 1.0);
  }
`;

const faceMaterial = (face: number) =>
  new ShaderMaterial({
    fragmentShader: cubeFragment,
    uniforms: { face: { value: face } },
    vertexShader: cubeVertex,
  });

// A CSS colour as its sRGB components, which the shader writes unchanged.
const srgb = (css: string) => {
  const colour = new Color(css);
  const components = { b: 0, g: 0, r: 0 };

  colour.getRGB(components, SRGBColorSpace);

  return new Vector3(components.r, components.g, components.b);
};

/**
 * Draws the cube on `canvas`, sized by its CSS box at the page's pixel
 * ratio, and returns the function that draws it turned by `yaw` radians
 * from the mark's own angle.
 */
const createCube = (canvas: HTMLCanvasElement) => {
  const ratio = window.devicePixelRatio;
  const { height, width } = canvas.getBoundingClientRect();
  const columns = Math.max(1, Math.floor(width / cell.width));
  const rows = Math.max(1, Math.floor(height / cell.height));

  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: false,
    canvas,
    preserveDrawingBuffer: true,
  });

  renderer.setClearColor(0x00_00_00, 0);
  renderer.setPixelRatio(ratio);
  renderer.setSize(width, height, false);

  const target = new WebGLRenderTarget(columns, rows, {
    magFilter: NearestFilter,
    minFilter: NearestFilter,
  });

  const halfWidth =
    (halfHeight * (columns * cell.width)) / (rows * cell.height);

  const camera = new OrthographicCamera(
    -halfWidth,
    halfWidth,
    halfHeight,
    -halfHeight,
    0.1,
    10
  );

  camera.position.set(0, 0, 4);

  // BoxGeometry's groups: +x, -x, +y, -y, +z, -z. At the iso angle -x is
  // the left face and +z the right one, as in the mark.
  const top = faceMaterial(1);
  const left = faceMaterial(2);
  const right = faceMaterial(3);

  const cube = new Mesh(new BoxGeometry(1, 1, 1), [
    left,
    left,
    top,
    top,
    right,
    right,
  ]);

  const scene = new Scene();

  scene.add(cube);

  // Whole device pixels per cell, so every cell has the same size.
  const cellSize = new Vector2(
    Math.round(cell.width * ratio),
    Math.round(cell.height * ratio)
  );

  const screen = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: screenFragment,
    uniforms: {
      cellSize: { value: cellSize },
      cube: { value: target.texture },
      grid: { value: new Vector2(columns, rows) },
      left: { value: srgb(colours.left) },
      offset: {
        value: new Vector2(
          Math.floor((canvas.width - columns * cellSize.x) / 2),
          Math.floor((canvas.height - rows * cellSize.y) / 2)
        ),
      },
      right: { value: srgb(colours.right) },
      top: { value: srgb(colours.top) },
    },
    vertexShader: screenVertex,
  });

  const quad = new Mesh(new PlaneGeometry(2, 2), screen);

  quad.frustumCulled = false;

  const screenScene = new Scene();

  screenScene.add(quad);

  return (yaw: number) => {
    cube.rotation.set(isoPitch, isoYaw + yaw, 0);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screenScene, camera);
  };
};

const canvas = document.querySelector("canvas");

if (canvas !== null) {
  const draw = createCube(canvas);

  // What the capture script calls: each frame's turn, drawn in order, as
  // PNG data URLs with their transparency.
  const drawFrames = (yaws: readonly number[]) =>
    yaws.map((yaw) => {
      draw(yaw);

      return canvas.toDataURL("image/png");
    });

  Object.assign(window, { drawFrames });
}
