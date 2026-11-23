// What a clip can be set to, as Shotstack's Edit schema lists it
// (`@shotstack/schemas` 1.27.0), in the order the inspector offers them.

/** A clip's motion over its length. */
export const clipEffects = [
  "zoomIn",
  "zoomInSlow",
  "zoomInFast",
  "zoomOut",
  "zoomOutSlow",
  "zoomOutFast",
  "slideLeft",
  "slideLeftSlow",
  "slideLeftFast",
  "slideRight",
  "slideRightSlow",
  "slideRightFast",
  "slideUp",
  "slideUpSlow",
  "slideUpFast",
  "slideDown",
  "slideDownSlow",
  "slideDownFast",
] as const;

/** How a clip comes in or goes out. */
export const clipTransitions = [
  "fade",
  "fadeSlow",
  "fadeFast",
  "reveal",
  "revealSlow",
  "revealFast",
  "wipeLeft",
  "wipeLeftSlow",
  "wipeLeftFast",
  "wipeRight",
  "wipeRightSlow",
  "wipeRightFast",
  "slideLeft",
  "slideLeftSlow",
  "slideLeftFast",
  "slideRight",
  "slideRightSlow",
  "slideRightFast",
  "slideUp",
  "slideUpSlow",
  "slideUpFast",
  "slideDown",
  "slideDownSlow",
  "slideDownFast",
  "carouselLeft",
  "carouselLeftSlow",
  "carouselLeftFast",
  "carouselRight",
  "carouselRightSlow",
  "carouselRightFast",
  "carouselUp",
  "carouselUpSlow",
  "carouselUpFast",
  "carouselDown",
  "carouselDownSlow",
  "carouselDownFast",
  "shuffleTopRight",
  "shuffleTopRightSlow",
  "shuffleTopRightFast",
  "shuffleRightTop",
  "shuffleRightTopSlow",
  "shuffleRightTopFast",
  "shuffleRightBottom",
  "shuffleRightBottomSlow",
  "shuffleRightBottomFast",
  "shuffleBottomRight",
  "shuffleBottomRightSlow",
  "shuffleBottomRightFast",
  "shuffleBottomLeft",
  "shuffleBottomLeftSlow",
  "shuffleBottomLeftFast",
  "shuffleLeftBottom",
  "shuffleLeftBottomSlow",
  "shuffleLeftBottomFast",
  "shuffleLeftTop",
  "shuffleLeftTopSlow",
  "shuffleLeftTopFast",
  "shuffleTopLeft",
  "shuffleTopLeftSlow",
  "shuffleTopLeftFast",
  "zoom",
] as const;

/** A colour treatment of the whole clip; `none` is Shotstack's own. */
export const clipFilters = [
  "none",
  "blur",
  "boost",
  "contrast",
  "darken",
  "greyscale",
  "lighten",
  "muted",
  "negative",
] as const;

/** How a picture fills the frame. */
export const clipFits = ["crop", "cover", "contain", "none"] as const;

/** Where a clip sits in the frame, before its offset. */
export const clipPositions = [
  "topLeft",
  "top",
  "topRight",
  "left",
  "center",
  "right",
  "bottomLeft",
  "bottom",
  "bottomRight",
] as const;

/** How a sound fades. */
export const audioEffects = [
  "none",
  "fadeIn",
  "fadeOut",
  "fadeInFadeOut",
] as const;

/** Text weights offered. */
export const fontWeights = [300, 400, 500, 600, 700, 800, 900] as const;

/** What a motion or a transition does, whatever its speed. */
export const motionBases = [
  "zoomIn",
  "zoomOut",
  "slideLeft",
  "slideRight",
  "slideUp",
  "slideDown",
  "fade",
  "reveal",
  "wipeLeft",
  "wipeRight",
  "carouselLeft",
  "carouselRight",
  "carouselUp",
  "carouselDown",
  "shuffleTopRight",
  "shuffleRightTop",
  "shuffleRightBottom",
  "shuffleBottomRight",
  "shuffleBottomLeft",
  "shuffleLeftBottom",
  "shuffleLeftTop",
  "shuffleTopLeft",
  "zoom",
] as const;

export type MotionBase = (typeof motionBases)[number];

/** The speeds Shotstack gives a motion or a transition. */
export type Speed = "fast" | "normal" | "slow";

/**
 * A motion's or transition's name split into what it does and how fast,
 * for the catalogue to say: `slideLeftSlow` is `slideLeft`, `slow`. None
 * for a name Shotstack does not give.
 */
export const speedOf = (
  name: string
): { readonly base: MotionBase; readonly speed: Speed } | null => {
  let speed: Speed = "normal";

  if (name.endsWith("Slow")) {
    speed = "slow";
  } else if (name.endsWith("Fast")) {
    speed = "fast";
  }

  const stem = speed === "normal" ? name : name.slice(0, -4);
  const base = motionBases.find((each) => each === stem);

  return base === undefined ? null : { base, speed };
};

/** Whether a text is a colour Shotstack takes: `#RRGGBB`. */
export const isHexColour = (text: string): boolean =>
  /^#[\da-f]{6}$/iu.test(text);
