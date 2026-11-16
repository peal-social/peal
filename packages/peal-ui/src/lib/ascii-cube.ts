// The site's hero art (DESIGN.md, Site): Peal's cube rendered by Three.js at
// one pixel per character cell, then drawn on a 2D canvas as Geist Mono
// glyphs picked by brightness, each face in its colour of the mark. GSAP
// runs the intro, the slow turn and the scroll-linked tilt.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BoxGeometry,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";

/** The mark's three colours, as CSS colours: top, left and right faces. */
export interface AsciiCubeColours {
  readonly left: string;
  readonly right: string;
  readonly top: string;
}

export interface AsciiCubeOptions {
  /** The canvas the glyphs are drawn on, sized by its parent. */
  readonly canvas: HTMLCanvasElement;
  readonly colours: AsciiCubeColours;
  /** The monospace font family, such as Geist Mono's. */
  readonly fontFamily: string;
  /** The element whose passage through the window tilts the cube. */
  readonly scrollTarget: Element;
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

// Brightness ramp, dim to bright, with no dots: the art is glyph blocks.
const ramp = "-=+x*%#@";

// One cell is one rendered pixel; Geist Mono's advance is 0.6 em.
const cellWidth = 9;
const cellHeight = 15;
const fontSize = 14;

// The mark's isometric view: a quarter turn around the vertical, then the
// cube tipped toward the reader until its top is a rhombus.
const isoYaw = Math.PI / 4;
const isoPitch = Math.atan(1 / Math.SQRT2);

// Half the camera's height in world units: the cube (edge 1) stands about
// 1.63 tall at the iso angle, so this leaves a margin around it.
const halfHeight = 1.08;

// Radians per second of the slow turn.
const turnSpeed = 0.3;

const vertexShader = `
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Red carries the face (1 top, 2 left, 3 right, over 3), green the shade
// and blue whether the pixel is on the face's edge, drawn densest.
const fragmentShader = `
  uniform float face;
  varying vec3 vNormal;
  varying vec2 vUv;
  void main() {
    vec3 light = normalize(vec3(-0.2, 0.8, 1.0));
    float lambert = max(dot(normalize(vNormal), light), 0.0);
    float across = 0.5 + 0.5 * (vUv.x + vUv.y) * 0.5;
    float shade = clamp(0.25 + 0.95 * lambert * across, 0.0, 1.0);
    float inset = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    gl_FragColor = vec4(face / 3.0, shade, step(inset, 0.045), 1.0);
  }
`;

const faceMaterial = (face: number) =>
  new ShaderMaterial({
    fragmentShader,
    uniforms: { face: { value: face } },
    vertexShader,
  });

export const createAsciiCube = ({
  canvas,
  colours,
  fontFamily,
  scrollTarget,
}: AsciiCubeOptions): AsciiCube => {
  gsap.registerPlugin(ScrollTrigger);

  const context = canvas.getContext("2d");
  const renderer = new WebGLRenderer({ alpha: true, antialias: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x00_00_00, 0);

  const target = new WebGLRenderTarget(1, 1);
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

  const fills = ["", colours.top, colours.left, colours.right];

  let columns = 0;
  let rows = 0;
  let pixels = new Uint8Array(0);
  // Each cell's threshold for the intro's reveal, fixed per size.
  let thresholds = new Float32Array(0);

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

  // The glyph for one cell, empty where the cube is not, or not yet.
  const glyphAt = (row: number, column: number, reveal: number) => {
    // Render targets count rows from the bottom.
    const index = ((rows - 1 - row) * columns + column) * 4;
    const face = Math.round(((pixels[index] ?? 0) / 255) * 3);
    const threshold = thresholds[row * columns + column] ?? 0;

    if ((pixels[index + 3] ?? 0) === 0 || face === 0 || threshold > reveal) {
      return { fill: "", glyph: "" };
    }

    const fill = fills[face] ?? colours.left;

    // Cells about to settle show a passing glyph during the intro.
    if (reveal < 1 && reveal - threshold < 0.08) {
      return {
        fill,
        glyph: ramp[Math.floor(Math.random() * ramp.length)] ?? "",
      };
    }

    if ((pixels[index + 2] ?? 0) > 127) {
      return { fill, glyph: ramp.at(-1) ?? "" };
    }

    const shade = (pixels[index + 1] ?? 0) / 255;

    const level = Math.min(
      ramp.length - 2,
      Math.floor(shade * (ramp.length - 1))
    );

    return { fill, glyph: ramp[level] ?? "" };
  };

  const draw = () => {
    if (context === null || columns === 0 || rows === 0) {
      return;
    }

    const { pitch, reveal, scale, yaw } = pose();

    cube.rotation.set(pitch, yaw, 0);
    cube.scale.setScalar(scale);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, columns, rows, pixels);
    renderer.setRenderTarget(null);

    context.clearRect(0, 0, columns * cellWidth, rows * cellHeight);

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const cell = glyphAt(row, column, reveal);

        if (cell.glyph !== "") {
          context.fillStyle = cell.fill;
          context.fillText(
            cell.glyph,
            column * cellWidth + cellWidth / 2,
            row * cellHeight + cellHeight / 2
          );
        }
      }
    }
  };

  const resize = () => {
    const { height, width } = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    columns = Math.max(1, Math.floor(width / cellWidth));
    rows = Math.max(1, Math.floor(height / cellHeight));
    canvas.width = Math.round(columns * cellWidth * ratio);
    canvas.height = Math.round(rows * cellHeight * ratio);
    context?.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (context !== null) {
      context.font = `${fontSize}px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
    }

    const halfWidth =
      (halfHeight * (columns * cellWidth)) / (rows * cellHeight);

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    target.setSize(columns, rows);
    pixels = new Uint8Array(columns * rows * 4);
    thresholds = Float32Array.from({ length: columns * rows }, () =>
      Math.random()
    );
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
