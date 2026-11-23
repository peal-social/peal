"use client";

import { useTranslations } from "next-intl";

import type { CaptionAsset } from "#studio/captions.ts";
import { editFonts } from "#studio/edit-document.ts";

import {
  ChoiceField,
  ColourField,
  FieldRow,
  FieldSection,
  NumberField,
  RangeField,
} from "./studio-fields.tsx";

// A caption's settings: the sound or film its words come from, then how
// they look. Where it sits is the layout's position and offset, as for
// any clip.

const percent = (value: number) => `${String(Math.round(value * 100))}%`;

// The choice shown when the clip a caption named is gone.
const missing = "missing";

/** A clip a caption may take its words from, as the inspector names it. */
export interface CaptionSourceChoice {
  readonly alias: string;
  readonly id: string;
  readonly label: string;
}

const oneOf = <Value extends string>(
  value: string | undefined,
  options: readonly Value[],
  fallback: Value
): Value => options.find((each) => each === value) ?? fallback;

// Where the words come from: a sound or a film of the edit.
const SourceField = ({
  disabled,
  linked,
  onSource,
  sources,
}: {
  readonly disabled: boolean;
  readonly linked: string | null;
  readonly onSource: (sourceId: string) => void;
  readonly sources: readonly CaptionSourceChoice[];
}) => {
  const t = useTranslations("Studio.inspector.captions");
  const current = sources.find(({ alias }) => alias === linked)?.id ?? missing;

  const options = [
    ...(current === missing ? [missing] : []),
    ...sources.map(({ id }) => id),
  ];

  return (
    <ChoiceField
      disabled={disabled}
      label={t("source")}
      options={options}
      value={current}
      nameOf={(id) =>
        sources.find((each) => each.id === id)?.label ?? t("missingSource")
      }
      onChange={(id) => {
        if (id !== missing) {
          onSource(id);
        }
      }}
    />
  );
};

/** The chosen caption's source and style. */
export const CaptionSection = ({
  asset,
  disabled,
  linked,
  onAsset,
  onSource,
  sources,
}: {
  readonly asset: CaptionAsset;
  readonly disabled: boolean;
  /** The alias its words come from. */
  readonly linked: string | null;
  readonly onAsset: (asset: CaptionAsset) => void;
  readonly onSource: (sourceId: string) => void;
  readonly sources: readonly CaptionSourceChoice[];
}) => {
  const t = useTranslations("Studio.inspector");
  const font = asset.font ?? {};
  const spoken = asset.active?.font ?? {};
  const background = asset.background ?? {};

  return (
    <FieldSection title={t("captions.title")}>
      <SourceField
        disabled={disabled}
        linked={linked}
        sources={sources}
        onSource={onSource}
      />
      <p className="text-muted-foreground text-xs">{t("captions.hint")}</p>
      <ChoiceField
        disabled={disabled}
        label={t("font")}
        options={editFonts}
        value={oneOf(font.family, editFonts, "Geist")}
        nameOf={(family) => family}
        onChange={(family) => {
          onAsset({ ...asset, font: { ...font, family } });
        }}
      />
      <NumberField
        disabled={disabled}
        label={t("size")}
        min={8}
        max={400}
        step={1}
        unit="px"
        value={font.size ?? 48}
        onCommit={(size) => {
          onAsset({ ...asset, font: { ...font, size: Math.round(size) } });
        }}
      />
      <FieldRow>
        <ColourField
          disabled={disabled}
          label={t("colour")}
          value={font.color ?? "#ffffff"}
          onCommit={(color) => {
            onAsset({ ...asset, font: { ...font, color } });
          }}
        />
        <ColourField
          disabled={disabled}
          label={t("captions.spoken")}
          value={spoken.color ?? font.color ?? "#ffffff"}
          onCommit={(color) => {
            onAsset({
              ...asset,
              active: { ...asset.active, font: { ...spoken, color } },
            });
          }}
        />
      </FieldRow>
      <ColourField
        disabled={disabled}
        label={t("background")}
        value={background.color ?? "#000000"}
        onCommit={(color) => {
          onAsset({
            ...asset,
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
          onAsset({
            ...asset,
            background: {
              ...background,
              color: background.color ?? "#000000",
              opacity,
            },
          });
        }}
      />
    </FieldSection>
  );
};
