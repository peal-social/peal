"use client";

import { Schema } from "effect";
import { useTranslations } from "next-intl";

import {
  audioEffects,
  clipEffects,
  clipFilters,
  clipFits,
  clipPositions,
  clipTransitions,
  fontWeights,
  speedOf,
} from "#studio/clip-options.ts";
import {
  editAspects,
  editFonts,
  editFrameRates,
  editResolutions,
} from "#studio/edit-document.ts";
import type {
  AssetOf,
  ClipChanges,
  ClipKind,
  EditAspect,
  EditResolution,
  EditSettings,
  StudioClip,
} from "#studio/edit-document.ts";

import {
  ChoiceField,
  ColourField,
  FieldRow,
  FieldSection,
  NumberField,
  RangeField,
  WordsField,
} from "./studio-fields.tsx";

// The inspector beside the stage: the chosen clip's settings, by what it
// holds, then the video's. Every field reads the engine's document and
// sends one change. A value Shotstack animates (keyframes) is left to the
// document: its field shows the value at rest.

/** The longest text a clip takes, as the server's limits allow. */
const maxClipText = 1000;

const none = "none";

const effectOptions = [none, ...clipEffects] as const;

const transitionOptions = [none, ...clipTransitions] as const;

const horizontals = ["left", "center", "right"] as const;

const verticals = ["top", "middle", "bottom"] as const;

const isNumber = Schema.is(Schema.Finite);

// A number as written, or `fallback` for one Shotstack animates or leaves out.
const numberOr = (
  value: number | string | readonly object[] | undefined,
  fallback: number
): number => (isNumber(value) ? value : fallback);

const oneOf = <Value extends number | string>(
  value: number | string | undefined,
  options: readonly Value[],
  fallback: Value
): Value => options.find((each) => each === value) ?? fallback;

const percent = (value: number) => `${String(Math.round(value * 100))}%`;

/** What the inspector asks the editor to change. */
export interface InspectorActions {
  readonly onBackground: (colour: string) => void;
  readonly onClip: (changes: ClipChanges) => void;
  readonly onOutput: (output: {
    readonly aspectRatio?: EditAspect;
    readonly fps?: number;
    readonly resolution?: EditResolution;
  }) => void;
}

interface SectionProps {
  readonly clip: StudioClip;
  readonly disabled: boolean;
  readonly onClip: (changes: ClipChanges) => void;
}

// A motion's or a transition's name in words: "Slide left, slow".
const useMotionName = () => {
  const t = useTranslations("Studio.motions");

  return (name: string) => {
    const named = speedOf(name);

    return named === null
      ? t("none")
      : t("named", { name: t(`names.${named.base}`), speed: named.speed });
  };
};

const TimingSection = ({
  clip,
  disabled,
  kind,
  onClip,
}: SectionProps & { readonly kind: ClipKind }) => {
  const t = useTranslations("Studio.inspector");

  return (
    <FieldSection title={t(`kinds.${kind}`)}>
      <FieldRow>
        <NumberField
          disabled={disabled}
          label={t("start")}
          min={0}
          unit="s"
          value={numberOr(clip.start, 0)}
          onCommit={(start) => {
            onClip({ start });
          }}
        />
        <NumberField
          disabled={disabled}
          label={t("length")}
          min={0.1}
          unit="s"
          value={numberOr(clip.length, 1)}
          onCommit={(length) => {
            onClip({ length });
          }}
        />
      </FieldRow>
    </FieldSection>
  );
};

const SoundSection = ({
  asset,
  disabled,
  onClip,
}: {
  readonly asset: AssetOf<"audio"> | AssetOf<"video">;
  readonly disabled: boolean;
  readonly onClip: (changes: ClipChanges) => void;
}) => {
  const t = useTranslations("Studio.inspector");

  return (
    <FieldSection title={t("sound")}>
      <RangeField
        disabled={disabled}
        label={t("volume")}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={numberOr(asset.volume, 1)}
        onCommit={(volume) => {
          onClip({ asset: { ...asset, volume } });
        }}
      />
      <NumberField
        disabled={disabled}
        label={t("trim")}
        min={0}
        unit="s"
        value={asset.trim ?? 0}
        onCommit={(trim) => {
          onClip({ asset: { ...asset, trim } });
        }}
      />
      {asset.type === "audio" ? (
        <ChoiceField
          disabled={disabled}
          label={t("fades")}
          options={audioEffects}
          value={asset.effect ?? "none"}
          nameOf={(effect) => t(`audioEffects.${effect}`)}
          onChange={(effect) => {
            onClip({ asset: { ...asset, effect } });
          }}
        />
      ) : null}
    </FieldSection>
  );
};

const TextSection = ({
  asset,
  clip,
  disabled,
  onClip,
}: SectionProps & { readonly asset: AssetOf<"rich-text"> }) => {
  const t = useTranslations("Studio.inspector");
  const font = asset.font ?? {};
  const background = asset.background ?? {};
  const align = asset.align ?? {};

  const change = (changes: Partial<AssetOf<"rich-text">>) => {
    onClip({ asset: { ...asset, ...changes } });
  };

  return (
    <FieldSection title={t("text")}>
      <WordsField
        disabled={disabled}
        label={t("words")}
        maxLength={maxClipText}
        value={asset.text}
        onCommit={(text) => {
          change({ text });
        }}
      />
      <ChoiceField
        disabled={disabled}
        label={t("font")}
        options={editFonts}
        value={oneOf(font.family, editFonts, "Geist")}
        nameOf={(family) => family}
        onChange={(family) => {
          change({ font: { ...font, family } });
        }}
      />
      <FieldRow>
        <NumberField
          disabled={disabled}
          label={t("size")}
          min={8}
          max={400}
          step={1}
          unit="px"
          value={font.size ?? 48}
          onCommit={(size) => {
            change({ font: { ...font, size } });
          }}
        />
        <ChoiceField
          disabled={disabled}
          label={t("weight")}
          options={fontWeights}
          value={fontWeights.find((each) => each === font.weight) ?? 400}
          nameOf={(weight) => t("weights", { weight })}
          onChange={(weight) => {
            change({ font: { ...font, weight } });
          }}
        />
      </FieldRow>
      <ColourField
        disabled={disabled}
        label={t("colour")}
        value={font.color ?? "#ffffff"}
        onCommit={(color) => {
          change({ font: { ...font, color } });
        }}
      />
      <FieldRow>
        <ChoiceField
          disabled={disabled}
          label={t("alignHorizontal")}
          options={horizontals}
          value={align.horizontal ?? "center"}
          nameOf={(each) => t(`align.${each}`)}
          onChange={(horizontal) => {
            change({ align: { ...align, horizontal } });
          }}
        />
        <ChoiceField
          disabled={disabled}
          label={t("alignVertical")}
          options={verticals}
          value={align.vertical ?? "middle"}
          nameOf={(each) => t(`align.${each}`)}
          onChange={(vertical) => {
            change({ align: { ...align, vertical } });
          }}
        />
      </FieldRow>
      <ColourField
        disabled={disabled}
        label={t("background")}
        value={background.color ?? "#000000"}
        onCommit={(color) => {
          change({
            background: {
              ...background,
              color,
              opacity: background.opacity ?? 0.6,
            },
          });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("backgroundOpacity")}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={background.color === undefined ? 0 : (background.opacity ?? 1)}
        onCommit={(opacity) => {
          change({
            background: {
              ...background,
              color: background.color ?? "#000000",
              opacity,
            },
          });
        }}
      />
      <FieldRow>
        <NumberField
          disabled={disabled}
          label={t("boxWidth")}
          min={1}
          max={3840}
          step={1}
          unit="px"
          value={clip.width ?? 800}
          onCommit={(width) => {
            onClip({ width });
          }}
        />
        <NumberField
          disabled={disabled}
          label={t("boxHeight")}
          min={1}
          max={3840}
          step={1}
          unit="px"
          value={clip.height ?? 200}
          onCommit={(height) => {
            onClip({ height });
          }}
        />
      </FieldRow>
    </FieldSection>
  );
};

const LayoutSection = ({
  clip,
  disabled,
  kind,
  onClip,
}: SectionProps & { readonly kind: ClipKind }) => {
  const t = useTranslations("Studio.inspector");
  const offset = clip.offset ?? {};
  const x = numberOr(offset.x, 0);
  const y = numberOr(offset.y, 0);

  return (
    <FieldSection title={t("layout")}>
      {kind === "image" || kind === "video" ? (
        <ChoiceField
          disabled={disabled}
          label={t("fit")}
          options={clipFits}
          value={clip.fit ?? "crop"}
          nameOf={(fit) => t(`fits.${fit}`)}
          onChange={(fit) => {
            onClip({ fit });
          }}
        />
      ) : null}
      <ChoiceField
        disabled={disabled}
        label={t("position")}
        options={clipPositions}
        value={clip.position ?? "center"}
        nameOf={(position) => t(`positions.${position}`)}
        onChange={(position) => {
          onClip({ position });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("offsetX")}
        min={-1}
        max={1}
        step={0.01}
        format={percent}
        value={x}
        onCommit={(moved) => {
          onClip({ offset: { x: moved, y } });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("offsetY")}
        min={-1}
        max={1}
        step={0.01}
        format={percent}
        value={y}
        onCommit={(moved) => {
          onClip({ offset: { x, y: moved } });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("scale")}
        min={0.1}
        max={3}
        step={0.05}
        format={percent}
        value={numberOr(clip.scale, 1)}
        onCommit={(scale) => {
          onClip({ scale });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("opacity")}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={numberOr(clip.opacity, 1)}
        onCommit={(opacity) => {
          onClip({ opacity });
        }}
      />
    </FieldSection>
  );
};

const MotionSection = ({ clip, disabled, onClip }: SectionProps) => {
  const t = useTranslations("Studio.inspector");
  const motionName = useMotionName();
  const transition = clip.transition ?? {};

  return (
    <FieldSection title={t("motion")}>
      <ChoiceField
        disabled={disabled}
        label={t("effect")}
        options={effectOptions}
        value={clip.effect ?? none}
        nameOf={motionName}
        onChange={(effect) => {
          onClip({ effect: effect === none ? undefined : effect });
        }}
      />
      <ChoiceField
        disabled={disabled}
        label={t("transitionIn")}
        options={transitionOptions}
        value={transition.in ?? none}
        nameOf={motionName}
        onChange={(entering) => {
          onClip({ transition: { ...transition, in: entering } });
        }}
      />
      <ChoiceField
        disabled={disabled}
        label={t("transitionOut")}
        options={transitionOptions}
        value={transition.out ?? none}
        nameOf={motionName}
        onChange={(leaving) => {
          onClip({ transition: { ...transition, out: leaving } });
        }}
      />
      <ChoiceField
        disabled={disabled}
        label={t("filter")}
        options={clipFilters}
        value={clip.filter ?? none}
        nameOf={(filter) => t(`filters.${filter}`)}
        onChange={(filter) => {
          onClip({ filter });
        }}
      />
    </FieldSection>
  );
};

const ClipSettings = ({
  clip,
  disabled,
  kind,
  onClip,
}: SectionProps & { readonly kind: ClipKind }) => {
  const { asset } = clip;
  const visual = kind !== "audio";

  return (
    <>
      <TimingSection
        clip={clip}
        disabled={disabled}
        kind={kind}
        onClip={onClip}
      />
      {asset.type === "audio" || asset.type === "video" ? (
        <SoundSection asset={asset} disabled={disabled} onClip={onClip} />
      ) : null}
      {asset.type === "rich-text" ? (
        <TextSection
          asset={asset}
          clip={clip}
          disabled={disabled}
          onClip={onClip}
        />
      ) : null}
      {visual ? (
        <LayoutSection
          clip={clip}
          disabled={disabled}
          kind={kind}
          onClip={onClip}
        />
      ) : null}
      {visual ? (
        <MotionSection clip={clip} disabled={disabled} onClip={onClip} />
      ) : null}
    </>
  );
};

const VideoSection = ({
  actions,
  disabled,
  settings,
}: {
  readonly actions: InspectorActions;
  readonly disabled: boolean;
  readonly settings: EditSettings;
}) => {
  const t = useTranslations("Studio.inspector");

  return (
    <FieldSection title={t("video")}>
      <ChoiceField
        disabled={disabled}
        label={t("shape")}
        options={editAspects}
        value={settings.aspectRatio}
        nameOf={(aspectRatio) => t(`aspects.${aspectRatio}`)}
        onChange={(aspectRatio) => {
          actions.onOutput({ aspectRatio });
        }}
      />
      <FieldRow>
        <ChoiceField
          disabled={disabled}
          label={t("resolution")}
          options={editResolutions}
          value={settings.resolution}
          nameOf={(resolution) => t(`resolutions.${resolution}`)}
          onChange={(resolution) => {
            actions.onOutput({ resolution });
          }}
        />
        <ChoiceField
          disabled={disabled}
          label={t("frameRate")}
          options={editFrameRates}
          value={oneOf(settings.fps, editFrameRates, 25)}
          nameOf={(fps) => t("fps", { fps })}
          onChange={(fps) => {
            actions.onOutput({ fps });
          }}
        />
      </FieldRow>
      <ColourField
        disabled={disabled}
        label={t("backdrop")}
        value={settings.background}
        onCommit={(colour) => {
          actions.onBackground(colour);
        }}
      />
    </FieldSection>
  );
};

/** The inspector: the chosen clip's settings, then the video's. */
export const StudioInspector = ({
  actions,
  clip,
  disabled,
  kind,
  settings,
}: {
  readonly actions: InspectorActions;
  readonly clip: StudioClip | null;
  readonly disabled: boolean;
  readonly kind: ClipKind | null;
  readonly settings: EditSettings;
}) => {
  const t = useTranslations("Studio.inspector");

  return (
    <aside
      aria-label={t("label")}
      className="flex min-w-0 flex-col rounded-lg border lg:absolute lg:inset-0 lg:overflow-y-auto"
    >
      {clip === null || kind === null ? (
        <p className="text-muted-foreground border-b p-4 text-sm">
          {t("nothingChosen")}
        </p>
      ) : (
        <ClipSettings
          clip={clip}
          disabled={disabled}
          kind={kind}
          onClip={(changes) => {
            actions.onClip(changes);
          }}
        />
      )}
      <VideoSection actions={actions} disabled={disabled} settings={settings} />
    </aside>
  );
};
