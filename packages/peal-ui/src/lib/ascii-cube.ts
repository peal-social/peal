// The site's hero art (DESIGN.md, Site): Peal's cube rendered by Three.js at
// one pixel per cell into a small target, then drawn on the canvas by a
// second, full-screen shader pass, as square pixels with ordered dithering
// or as Geist Mono glyphs picked by brightness, each face in its colour of
// the mark. Nothing is read back from the GPU. GSAP runs the intro, the
// slow turn and the scroll-linked spin.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BoxGeometry,
  CanvasTexture,
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

import { pixelCell } from "./pixel-palette";
import { glslBayer, glslHash } from "./pixel-shader";

/** The mark's three colours, as CSS colours: top, left and right faces. */
export interface AsciiCubeColours {
  readonly left: string;
  readonly right: string;
  readonly top: string;
}

/** Square dithered pixels, or Geist Mono glyphs. */
export type AsciiCubeVariant = "glyphs" | "pixels";

export interface AsciiCubeOptions {
  /** The canvas the art is drawn on, sized by its parent. */
  readonly canvas: HTMLCanvasElement;
  readonly colours: AsciiCubeColours;
  /** The monospace font family, such as Geist Mono's, for glyphs. */
  readonly fontFamily: string;
  /** The element whose passage through the window spins the cube. */
  readonly scrollTarget: Element;
  readonly variant: AsciiCubeVariant;
}

export interface AsciiCube {
  /** Stops the turn and the intro where they are. */
  readonly pause: () => void;
  /** Runs the intro once, then the slow turn. */
  readonly play: () => void;
  /** Draws one still frame, the mark's own angle, and keeps it on resize. */
  readonly still: () => void;
  readonly dispose: () => void;
}

// Brightness ramp, dim to bright, with no dots.
const ramp = ["-", "=", "+", "x", "*", "%", "#", "@"] as const;

// Each variant's cell, in CSS pixels, and the glyphs' font size.
const cells = {
  glyphs: { font: 8.5, height: 8, width: 6 },
  pixels: { font: 0, height: pixelCell, width: pixelCell },
} as const;

// The mark's isometric view: a quarter turn around the vertical, then the
// cube tipped toward the reader until its top is a rhombus.
const isoYaw = Math.PI / 4;
const isoPitch = Math.atan(1 / Math.SQRT2);

// Half the camera's height in world units: the cube (edge 1) stands about
// 1.63 tall at the iso angle, so this leaves a margin around it.
const halfHeight = 1.08;

// Radians per second of the slow turn.
const turnSpeed = 0.3;

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
// face colour, shade, edge, and the intro's reveal by a per-cell threshold.
const screenFragment = `
  uniform sampler2D cube;
  uniform sampler2D atlas;
  uniform vec2 cellSize;
  uniform vec2 grid;
  uniform vec2 offset;
  uniform float reveal;
  uniform float time;
  uniform float glyphs;
  uniform vec3 top;
  uniform vec3 left;
  uniform vec3 right;

  ${glslHash}
  ${glslBayer}

  void main() {
    vec2 position = gl_FragCoord.xy - offset;
    vec2 cell = floor(position / cellSize);
    if (any(lessThan(cell, vec2(0.0))) || any(greaterThanEqual(cell, grid))) {
      discard;
    }
    vec4 texel = texture2D(cube, (cell + 0.5) / grid);
    float face = floor(texel.r * 3.0 + 0.5);
    float threshold = hash(cell);
    if (texel.a == 0.0 || face < 0.5 || threshold > reveal) {
      discard;
    }
    vec3 colour = face < 1.5 ? top : (face < 2.5 ? left : right);
    bool settling = reveal < 1.0 && reveal - threshold < 0.08;
    float flicker = hash(cell + floor(time * 24.0));

    if (glyphs > 0.5) {
      float level = settling
        ? floor(flicker * 8.0)
        : (texel.b > 0.5 ? 7.0 : min(6.0, floor(texel.g * 7.0)));
      vec2 inCell = fract(position / cellSize);
      float alpha = texture2D(atlas, vec2((level + inCell.x) / 8.0, inCell.y)).a;
      gl_FragColor = vec4(colour * alpha, alpha);
      return;
    }

    // Four steps per face, from a darker to a lighter tone of its colour,
    // chosen by the shade with a 4x4 Bayer matrix between them.
    float tone = clamp(floor(texel.g * 3.0 + bayer(cell)), 0.0, 3.0);
    if (texel.b > 0.5) {
      tone = 0.0;
    }
    if (settling) {
      tone = flicker > 0.5 ? 3.0 : 1.0;
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

// The ramp's glyphs side by side in white, one cell each, at the screen's
// pixel ratio, for the glyphs variant.
const glyphAtlas = (fontFamily: string, ratio: number) => {
  const { font, height, width } = cells.glyphs;
  const atlas = document.createElement("canvas");
  atlas.width = Math.round(width * ratio) * ramp.length;
  atlas.height = Math.round(height * ratio);

  const context = atlas.getContext("2d");
  const cellWidth = atlas.width / ramp.length;

  if (context !== null) {
    context.fillStyle = "#ffffff";
    context.font = `${font * ratio}px ${fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";

    for (const [index, glyph] of ramp.entries()) {
      context.fillText(glyph, (index + 0.5) * cellWidth, atlas.height / 2);
    }
  }

  const texture = new CanvasTexture(atlas);
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;

  return texture;
};

export const createAsciiCube = ({
  canvas,
  colours,
  fontFamily,
  scrollTarget,
  variant,
}: AsciiCubeOptions): AsciiCube => {
  gsap.registerPlugin(ScrollTrigger);

  const cell = cells[variant];
  const renderer = new WebGLRenderer({ alpha: true, antialias: false, canvas });
  renderer.setClearColor(0x00_00_00, 0);

  const target = new WebGLRenderTarget(1, 1, {
    magFilter: NearestFilter,
    minFilter: NearestFilter,
  });

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.set(0, 0, 4);

  // BoxGeometry's groups: +x, -x, +y, -y, +z, -z. At the iso angle -x is
  // the left face and +z the right one, as in the mark.
  const top = faceMaterial(1);
  const left = faceMaterial(2);
  const right = faceMaterial(3);
  const geometry = new BoxGeometry(1, 1, 1);
  const cube = new Mesh(geometry, [left, left, top, top, right, right]);
  scene.add(cube);

  let atlas = glyphAtlas(fontFamily, window.devicePixelRatio || 1);

  const uniforms = {
    atlas: { value: atlas },
    cellSize: { value: new Vector2(1, 1) },
    cube: { value: target.texture },
    glyphs: { value: variant === "glyphs" ? 1 : 0 },
    grid: { value: new Vector2(1, 1) },
    left: { value: srgb(colours.left) },
    offset: { value: new Vector2(0, 0) },
    reveal: { value: 0 },
    right: { value: srgb(colours.right) },
    time: { value: 0 },
    top: { value: srgb(colours.top) },
  };

  const screen = new ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    fragmentShader: screenFragment,
    uniforms,
    vertexShader: screenVertex,
  });

  const quad = new Mesh(new PlaneGeometry(2, 2), screen);
  quad.frustumCulled = false;
  const screenScene = new Scene();
  screenScene.add(quad);

  // What GSAP animates: the intro's reveal, scale and spin, and the scroll.
  const motion = { reveal: 0, scale: 0.82, scroll: 0, spin: -1.4 };
  let elapsed = 0;
  let mode: "paused" | "playing" | "still" = "paused";

  // The cube's pose for this frame: the mark's own angle when still.
  const pose = () => {
    if (mode === "still") {
      return { pitch: isoPitch, reveal: 1, scale: 1, yaw: isoYaw };
    }

    return {
      pitch: isoPitch - motion.scroll * 0.3,
      reveal: motion.reveal,
      scale: motion.scale,
      yaw: isoYaw + motion.spin + elapsed * turnSpeed + motion.scroll * Math.PI,
    };
  };

  const draw = () => {
    const { pitch, reveal, scale, yaw } = pose();

    cube.rotation.set(pitch, yaw, 0);
    cube.scale.setScalar(scale);
    uniforms.reveal.value = reveal;
    uniforms.time.value = elapsed;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(screenScene, camera);
  };

  const resize = () => {
    const { height, width } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const columns = Math.max(1, Math.floor(width / cell.width));
    const rows = Math.max(1, Math.floor(height / cell.height));

    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);

    // Whole device pixels per cell, so every cell has the same size.
    const cellSize = new Vector2(
      Math.round(cell.width * ratio),
      Math.round(cell.height * ratio)
    );

    uniforms.cellSize.value = cellSize;
    uniforms.grid.value = new Vector2(columns, rows);
    uniforms.offset.value = new Vector2(
      Math.floor((canvas.width - columns * cellSize.x) / 2),
      Math.floor((canvas.height - rows * cellSize.y) / 2)
    );

    if (variant === "glyphs") {
      atlas.dispose();
      atlas = glyphAtlas(fontFamily, ratio);
      uniforms.atlas.value = atlas;
    }

    const halfWidth =
      (halfHeight * (columns * cell.width)) / (rows * cell.height);

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    target.setSize(columns, rows);
    draw();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  const intro = gsap.to(motion, {
    duration: 2.2,
    ease: "power3.out",
    paused: true,
    reveal: 1,
    scale: 1,
    spin: 0,
  });

  const scroll = ScrollTrigger.create({
    end: "bottom top",
    onUpdate: (self) => {
      motion.scroll = self.progress;
    },
    start: "top top",
    trigger: scrollTarget,
  });

  const tick = (_time: number, deltaTime: number) => {
    // A long gap, such as a background tab, does not jump the turn.
    elapsed += Math.min(deltaTime, 50) / 1000;
    draw();
  };

  return {
    dispose: () => {
      gsap.ticker.remove(tick);
      intro.kill();
      scroll.kill();
      observer.disconnect();
      geometry.dispose();
      top.dispose();
      left.dispose();
      right.dispose();
      quad.geometry.dispose();
      screen.dispose();
      atlas.dispose();
      target.dispose();
      renderer.dispose();
    },
    pause: () => {
      mode = "paused";
      gsap.ticker.remove(tick);
      intro.pause();
    },
    play: () => {
      if (mode === "playing") {
        return;
      }

      mode = "playing";
      intro.play();
      gsap.ticker.add(tick);
    },
    still: () => {
      mode = "still";
      gsap.ticker.remove(tick);
      intro.pause();
      draw();
    },
  };
};
