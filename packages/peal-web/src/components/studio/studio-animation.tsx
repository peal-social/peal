"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";

import type { ClipChanges, StudioClip } from "#studio/edit-document.ts";
import {
  animatedProperties,
  animationOf,
  clipSecondsOf,
  keyframesOf,
  propertyChanges,
  propertyOf,
  propertyRanges,
  stillOf,
  tweenEasings,
  tweenInterpolations,
  tweenValueOf,
  withKeyframeAdded,
  withKeyframeChanged,
  withKeyframeRemoved,
} from "#studio/tweens.ts";
import type { AnimatedProperty, Tween } from "#studio/tweens.ts";

import {
  ChoiceField,
  FieldRow,
  NumberField,
  RangeSlider,
  SwitchField,
} from "./studio-fields.tsx";

// A clip's place, size, turn and opacity, each a still value on a slider
// or, once Animate is on, keyframes: from a value to another, from a time
// of the clip for a length, in a way (linear, a curve and its easing, or a
// jump). Shotstack plays them; the SDK's preview plays them too.

const percent = (value: number) => `${String(Math.round(value * 100))}%`;

const degrees = (value: number) => `${String(Math.round(value))}°`;

/** The slider of a still value: as the layout offered them before. */
interface StillRange {
  readonly format: (value: number) => string;
  readonly max: number;
  readonly min: number;
  readonly step: number;
}

const stillRanges: Readonly<Record<AnimatedProperty, StillRange>> = {
  offsetX: { format: percent, max: 1, min: -1, step: 0.01 },
  offsetY: { format: percent, max: 1, min: -1, step: 0.01 },
  opacity: { format: percent, max: 1, min: 0, step: 0.05 },
  rotate: { format: degrees, max: 180, min: -180, step: 1 },
  scale: { format: percent, max: 3, min: 0.1, step: 0.05 },
};

interface PropertyProps {
  readonly clip: StudioClip;
  readonly disabled: boolean;
  readonly onClip: (changes: ClipChanges) => void;
  readonly property: AnimatedProperty;
}

// One keyframe: its values, its time, its way, and its removal.
const KeyframeRow = ({
  disabled,
  index,
  onChange,
  onRemove,
  property,
  tween,
}: {
  readonly disabled: boolean;
  readonly index: number;
  readonly onChange: (changes: Partial<Tween>) => void;
  readonly onRemove: () => void;
  readonly property: AnimatedProperty;
  readonly tween: Tween;
}) => {
  const t = useTranslations("Studio.inspector.keyframes");
  const range = propertyRanges[property];
  const unit = property === "rotate" ? "°" : undefined;
  const position = index + 1;

  return (
    <li
      aria-label={t("keyframe", { position })}
      className="bg-muted/40 flex flex-col gap-2 rounded-md border p-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {t("keyframe", { position })}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          disabled={disabled}
          aria-label={t("remove", { position })}
          onClick={onRemove}
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      <FieldRow>
        <NumberField
          disabled={disabled}
          label={t("from")}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          value={tweenValueOf(tween, "from", range.rest)}
          onCommit={(from) => {
            onChange({ from });
          }}
        />
        <NumberField
          disabled={disabled}
          label={t("to")}
          min={range.min}
          max={range.max}
          step={range.step}
          unit={unit}
          value={tweenValueOf(tween, "to", range.rest)}
          onCommit={(to) => {
            onChange({ to });
          }}
        />
      </FieldRow>
      <FieldRow>
        <NumberField
          disabled={disabled}
          label={t("start")}
          min={0}
          unit="s"
          value={tween.start ?? 0}
          onCommit={(start) => {
            onChange({ start });
          }}
        />
        <NumberField
          disabled={disabled}
          label={t("length")}
          min={0.1}
          unit="s"
          value={tween.length ?? 1}
          onCommit={(length) => {
            onChange({ length });
          }}
        />
      </FieldRow>
      <FieldRow>
        <ChoiceField
          disabled={disabled}
          label={t("interpolation")}
          options={tweenInterpolations}
          value={tween.interpolation ?? "linear"}
          nameOf={(each) => t(`interpolations.${each}`)}
          onChange={(interpolation) => {
            onChange({ interpolation });
          }}
        />
        {tween.interpolation === "bezier" ? (
          <ChoiceField
            disabled={disabled}
            label={t("easing")}
            options={tweenEasings}
            value={tween.easing ?? "easeInOut"}
            nameOf={(each) => t(`easings.${each}`)}
            onChange={(easing) => {
              onChange({ easing });
            }}
          />
        ) : null}
      </FieldRow>
    </li>
  );
};

// A property's keyframes, with a way to add one after the last.
const Keyframes = ({
  clip,
  disabled,
  onClip,
  property,
  tweens,
}: PropertyProps & { readonly tweens: readonly Tween[] }) => {
  const t = useTranslations("Studio.inspector.keyframes");
  const clipLength = clipSecondsOf(clip, 4);

  // Keyframes have no ids: their place names them.
  const rows = tweens.map((tween, index) => ({
    index,
    key: `${property}-${String(index)}`,
    tween,
  }));

  const set = (next: readonly Tween[]) => {
    onClip(
      propertyChanges(
        clip,
        property,
        next.length === 0 ? stillOf(property, tweens) : next
      )
    );
  };

  return (
    <>
      <ol className="flex flex-col gap-2">
        {rows.map(({ index, key, tween }) => (
          <KeyframeRow
            key={key}
            disabled={disabled}
            index={index}
            property={property}
            tween={tween}
            onChange={(changes) => {
              set(withKeyframeChanged(tweens, index, changes));
            }}
            onRemove={() => {
              set(withKeyframeRemoved(tweens, index));
            }}
          />
        ))}
      </ol>
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled}
        onClick={() => {
          set(withKeyframeAdded(tweens, clipLength));
        }}
      >
        <PlusIcon aria-hidden data-icon="inline-start" />
        {t("add")}
      </Button>
    </>
  );
};

// One property: its name, its value or "Animated", the Animate switch,
// then its slider or its keyframes.
const AnimatedField = (props: PropertyProps) => {
  const { clip, disabled, onClip, property } = props;
  const t = useTranslations("Studio.inspector");
  const value = propertyOf(clip, property);
  const tweens = keyframesOf(value);
  const still = stillOf(property, value);
  const range = stillRanges[property];
  const label = t(`properties.${property}`);

  const handleAnimate = (animate: boolean) => {
    onClip(
      propertyChanges(
        clip,
        property,
        animate ? animationOf(property, value, clipSecondsOf(clip, 4)) : still
      )
    );
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm leading-none font-medium select-none">
          {label}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {tweens === null ? range.format(still) : t("keyframes.animated")}
        </span>
      </div>
      {tweens === null ? (
        <RangeSlider
          disabled={disabled}
          label={label}
          min={range.min}
          max={range.max}
          step={range.step}
          format={range.format}
          value={still}
          onCommit={(moved) => {
            onClip(propertyChanges(clip, property, moved));
          }}
        />
      ) : (
        <Keyframes {...props} tweens={tweens} />
      )}
      <SwitchField
        checked={tweens !== null}
        disabled={disabled}
        label={t("keyframes.animate", { property })}
        onChange={handleAnimate}
      />
    </div>
  );
};

/** A clip's offset, scale, rotation and opacity, each still or animated. */
export const AnimatedFields = ({
  clip,
  disabled,
  onClip,
}: Omit<PropertyProps, "property">) => (
  <>
    {animatedProperties.map((property) => (
      <AnimatedField
        key={property}
        clip={clip}
        disabled={disabled}
        property={property}
        onClip={onClip}
      />
    ))}
  </>
);
