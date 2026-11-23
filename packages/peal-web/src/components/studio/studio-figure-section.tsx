"use client";

import { useTranslations } from "next-intl";

import type { ClipChanges } from "#studio/edit-document.ts";
import { figureSizeOf, figureWith } from "#studio/figures.ts";
import type { FigureAsset, FigureSize } from "#studio/figures.ts";

import {
  ColourField,
  FieldRow,
  FieldSection,
  NumberField,
  RangeField,
} from "./studio-fields.tsx";

// A shape's settings: its fill, its stroke (none at a width of 0) and
// its size by its kind. Its box follows its size and stroke.

const percent = (value: number) => `${String(Math.round(value * 100))}%`;

// The most a size takes, in pixels: the largest frame Peal renders.
const largest = 3840;

const SizeFields = ({
  disabled,
  onSize,
  size,
}: {
  readonly disabled: boolean;
  readonly onSize: (size: FigureSize) => void;
  readonly size: FigureSize;
}) => {
  const t = useTranslations("Studio.inspector.shapes");

  const pixels = (
    label: string,
    value: number,
    apply: (pixels: number) => FigureSize,
    min = 1
  ) => (
    <NumberField
      disabled={disabled}
      label={label}
      min={min}
      max={largest}
      step={1}
      unit="px"
      value={value}
      onCommit={(next) => {
        onSize(apply(next));
      }}
    />
  );

  if (size.kind === "circle") {
    return pixels(t("radius"), size.radius, (radius) => ({ ...size, radius }));
  }

  if (size.kind === "line") {
    return (
      <FieldRow>
        {pixels(t("lineLength"), size.length, (length) => ({
          ...size,
          length,
        }))}
        {pixels(t("thickness"), size.thickness, (thickness) => ({
          ...size,
          thickness,
        }))}
      </FieldRow>
    );
  }

  return (
    <>
      <FieldRow>
        {pixels(t("width"), size.width, (width) => ({ ...size, width }))}
        {pixels(t("height"), size.height, (height) => ({ ...size, height }))}
      </FieldRow>
      {pixels(
        t("cornerRadius"),
        size.cornerRadius,
        (cornerRadius) => ({ ...size, cornerRadius }),
        0
      )}
    </>
  );
};

/** The chosen shape's fill, stroke and size. */
export const FigureSection = ({
  asset,
  disabled,
  onClip,
}: {
  readonly asset: FigureAsset;
  readonly disabled: boolean;
  readonly onClip: (changes: ClipChanges) => void;
}) => {
  const t = useTranslations("Studio.inspector.shapes");
  const fill = asset.fill ?? {};
  const strokeColour = asset.stroke?.color ?? "#000000";
  const strokeWidth = asset.stroke?.width ?? 0;

  const change = (changed: FigureAsset) => {
    onClip({ asset: changed });
  };

  return (
    <FieldSection title={t(`kinds.${asset.shape}`)}>
      <ColourField
        disabled={disabled}
        label={t("fill")}
        value={fill.color ?? "#ffffff"}
        onCommit={(color) => {
          change({ ...asset, fill: { ...fill, color } });
        }}
      />
      <RangeField
        disabled={disabled}
        label={t("fillOpacity")}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        value={fill.opacity ?? 1}
        onCommit={(opacity) => {
          change({ ...asset, fill: { ...fill, opacity } });
        }}
      />
      <FieldRow>
        <ColourField
          disabled={disabled}
          label={t("stroke")}
          value={strokeColour}
          onCommit={(color) => {
            change(
              figureWith(asset, {
                stroke: { color, width: strokeWidth === 0 ? 4 : strokeWidth },
              })
            );
          }}
        />
        <NumberField
          disabled={disabled}
          label={t("strokeWidth")}
          min={0}
          max={100}
          step={1}
          unit="px"
          value={strokeWidth}
          onCommit={(width) => {
            change(
              figureWith(asset, {
                stroke: { color: strokeColour, width },
              })
            );
          }}
        />
      </FieldRow>
      <SizeFields
        disabled={disabled}
        size={figureSizeOf(asset)}
        onSize={(size) => {
          change(figureWith(asset, { size }));
        }}
      />
    </FieldSection>
  );
};
