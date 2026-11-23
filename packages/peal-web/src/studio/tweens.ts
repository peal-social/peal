import type { components } from "@shotstack/schemas";
import { Schema } from "effect";

import type { StudioClip } from "#studio/edit-document.ts";

// A clip's properties that Shotstack animates with keyframes (its
// tweens): each is a still number or a list of keyframes, each from a
// value to another over a stretch of the clip. The SDK plays them in the
// preview as the render does.

export type Tween = components["schemas"]["Tween"];

/** The properties the inspector animates, in the order it shows them. */
export const animatedProperties = [
  "offsetX",
  "offsetY",
  "scale",
  "rotate",
  "opacity",
] as const;

export type AnimatedProperty = (typeof animatedProperties)[number];

/** A property's value: a still number, or keyframes. */
export type PropertyValue = number | readonly Tween[];

/** How a keyframe goes from its value to the next. */
export const tweenInterpolations = ["linear", "bezier", "constant"] as const;

export type TweenInterpolation = (typeof tweenInterpolations)[number];

/** How a curve speeds up or slows down, as Shotstack's schema lists them. */
export const tweenEasings = [
  "ease",
  "easeIn",
  "easeOut",
  "easeInOut",
  "easeInQuad",
  "easeInCubic",
  "easeInQuart",
  "easeInQuint",
  "easeInSine",
  "easeInExpo",
  "easeInCirc",
  "easeInBack",
  "easeOutQuad",
  "easeOutCubic",
  "easeOutQuart",
  "easeOutQuint",
  "easeOutSine",
  "easeOutExpo",
  "easeOutCirc",
  "easeOutBack",
  "easeInOutQuad",
  "easeInOutCubic",
  "easeInOutQuart",
  "easeInOutQuint",
  "easeInOutSine",
  "easeInOutExpo",
  "easeInOutCirc",
  "easeInOutBack",
] as const;

export type TweenEasing = (typeof tweenEasings)[number];

/** What a property takes: its bounds, its step and its unit. */
export interface PropertyRange {
  readonly max: number;
  readonly min: number;
  /** Where a first animation starts from, when the still value is `reach`. */
  readonly away: number;
  /** Where a first animation goes from the still value. */
  readonly reach: number;
  /** Its value when the clip says none. */
  readonly rest: number;
  readonly step: number;
}

/** Each property's range, as Shotstack's schema bounds it. */
export const propertyRanges: Readonly<Record<AnimatedProperty, PropertyRange>> =
  {
    offsetX: { away: -0.2, max: 10, min: -10, reach: 0.2, rest: 0, step: 0.01 },
    offsetY: { away: -0.2, max: 10, min: -10, reach: 0.2, rest: 0, step: 0.01 },
    opacity: { away: 0, max: 1, min: 0, reach: 1, rest: 1, step: 0.05 },
    rotate: { away: 0, max: 360, min: -360, reach: 45, rest: 0, step: 1 },
    scale: { away: 0.8, max: 10, min: 0, reach: 1, rest: 1, step: 0.05 },
  };

const isNumber = Schema.is(Schema.Finite);

const isTweens = Schema.is(
  Schema.Array(Schema.Record(Schema.String, Schema.Unknown))
);

/** A keyframe's start or end value as a number, or `fallback`. */
export const tweenValueOf = (
  tween: Tween | undefined,
  end: "from" | "to",
  fallback: number
): number => {
  const value = tween?.[end];

  return isNumber(value) ? value : fallback;
};

/** A clip's length in seconds, or `fallback` for one Shotstack works out. */
export const clipSecondsOf = (clip: StudioClip, fallback: number): number =>
  isNumber(clip.length) ? clip.length : fallback;

/** The property as the clip holds it, or nothing. */
export const propertyOf = (
  clip: StudioClip,
  property: AnimatedProperty
): PropertyValue | undefined => {
  const values: Readonly<Record<AnimatedProperty, PropertyValue | undefined>> =
    {
      offsetX: clip.offset?.x,
      offsetY: clip.offset?.y,
      opacity: clip.opacity,
      rotate: clip.transform?.rotate?.angle,
      scale: clip.scale,
    };

  return values[property];
};

/** The property's keyframes, or none when it is still. */
export const keyframesOf = (
  value: PropertyValue | undefined
): readonly Tween[] | null =>
  value !== undefined && !isNumber(value) && isTweens(value) && value.length > 0
    ? value
    : null;

/**
 * The property's still value: its number, else its first keyframe's
 * start, else the value Shotstack gives it.
 */
export const stillOf = (
  property: AnimatedProperty,
  value: PropertyValue | undefined
): number => {
  const { rest } = propertyRanges[property];

  if (isNumber(value)) {
    return value;
  }

  return tweenValueOf(keyframesOf(value)?.[0], "from", rest);
};

const rounded = (value: number): number => Math.round(value * 100) / 100;

/**
 * The property animated for the first time: one keyframe from its still
 * value to where it goes (or, already there, from further away to it: a
 * fade in, a zoom in), over the clip's first second (or all of it, when
 * shorter), on a curve that eases in and out.
 */
export const animationOf = (
  property: AnimatedProperty,
  value: PropertyValue | undefined,
  clipLength: number
): readonly Tween[] => {
  const still = stillOf(property, value);
  const { away, reach } = propertyRanges[property];
  const arrives = still === reach;

  return [
    {
      easing: "easeInOut",
      from: rounded(arrives ? away : still),
      interpolation: "bezier",
      length: Math.min(1, rounded(clipLength)),
      start: 0,
      to: rounded(reach),
    },
  ];
};

/** A keyframe after the last, holding its value for a second. */
export const withKeyframeAdded = (
  tweens: readonly Tween[],
  clipLength: number
): readonly Tween[] => {
  const last = tweens.at(-1);
  const start = rounded((last?.start ?? 0) + (last?.length ?? 0));
  const held = last?.to ?? last?.from ?? 0;

  return [
    ...tweens,
    {
      from: held,
      interpolation: "linear",
      length: Math.max(0.1, Math.min(1, rounded(clipLength - start))),
      start,
      to: held,
    },
  ];
};

/** The keyframe at `index` changed; an easing goes with a curve only. */
export const withKeyframeChanged = (
  tweens: readonly Tween[],
  index: number,
  changes: Partial<Tween>
): readonly Tween[] =>
  tweens.map((tween, at) => {
    if (at !== index) {
      return tween;
    }

    const { easing, ...changed } = { ...tween, ...changes };

    return changed.interpolation === "bezier"
      ? { ...changed, easing: easing ?? "easeInOut" }
      : changed;
  });

/** The keyframes without the one at `index`. */
export const withKeyframeRemoved = (
  tweens: readonly Tween[],
  index: number
): readonly Tween[] => tweens.filter((_, at) => at !== index);

/** The fields of a clip a property's change sets. */
export type PropertyChanges = Partial<
  Pick<StudioClip, "offset" | "opacity" | "scale" | "transform">
>;

/**
 * The clip's change that sets the property, the fields around it kept:
 * an offset keeps its other axis, a rotation the other transforms.
 */
export const propertyChanges = (
  clip: StudioClip,
  property: AnimatedProperty,
  value: PropertyValue
): PropertyChanges => {
  const set = isNumber(value) ? value : [...value];

  if (property === "offsetX") {
    return { offset: { ...clip.offset, x: set } };
  }

  if (property === "offsetY") {
    return { offset: { ...clip.offset, y: set } };
  }

  if (property === "rotate") {
    return {
      transform: {
        ...clip.transform,
        rotate: { ...clip.transform?.rotate, angle: set },
      },
    };
  }

  return property === "scale" ? { scale: set } : { opacity: set };
};
