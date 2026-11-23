"use client";

import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "peal-ui/components/select";
import { Textarea } from "peal-ui/components/textarea";
import { useId, useState } from "react";
import type { ReactNode } from "react";

import { isHexColour } from "#studio/clip-options.ts";

// The inspector's fields. Each change is one command of the engine, so
// one undo: a number or a text is applied when it is left or Enter is
// pressed, a slider when it is let go, a choice at once.

/** A section of the inspector, under a small heading. */
export const FieldSection = ({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}) => (
  <section className="flex flex-col gap-3 border-b p-4 last:border-b-0">
    <h2 className="text-sm font-medium">{title}</h2>
    {children}
  </section>
);

/** Two fields side by side. */
export const FieldRow = ({ children }: { readonly children: ReactNode }) => (
  <div className="grid grid-cols-2 gap-2">{children}</div>
);

/** A labelled choice among values, each named by `nameOf`. */
export const ChoiceField = <Value extends number | string>({
  disabled = false,
  label,
  nameOf,
  onChange,
  options,
  value,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly nameOf: (value: Value) => string;
  readonly onChange: (value: Value) => void;
  readonly options: readonly Value[];
  readonly value: Value;
}) => {
  const id = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={String(value)}
        disabled={disabled}
        onValueChange={(chosen: string | null) => {
          const found = options.find((each) => String(each) === chosen);

          if (found !== undefined) {
            onChange(found);
          }
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue>{nameOf(value)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((each) => (
            <SelectItem key={String(each)} value={String(each)}>
              {nameOf(each)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

/** A number, applied when left or on Enter, kept within its bounds. */
export const NumberField = ({
  disabled = false,
  label,
  max,
  min,
  onCommit,
  step = 0.1,
  unit,
  value,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly max?: number;
  readonly min?: number;
  readonly onCommit: (value: number) => void;
  readonly step?: number;
  /** What follows the number, for a screen reader and the eye: "s", "px". */
  readonly unit?: string;
  readonly value: number;
}) => {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);

  const commit = () => {
    if (typed === null) {
      return;
    }

    const read = Number(typed);

    setTyped(null);

    if (typed.trim() === "" || !Number.isFinite(read)) {
      return;
    }

    const bounded = Math.min(max ?? read, Math.max(min ?? read, read));

    if (bounded !== value) {
      onCommit(bounded);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          value={typed ?? String(Math.round(value * 100) / 100)}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }

            if (event.key === "Escape") {
              setTyped(null);
            }
          }}
        />
        {unit === undefined ? null : (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-7 -translate-y-1/2 text-xs">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

/** A value along a range, applied when the thumb is let go. */
export const RangeField = ({
  disabled = false,
  format,
  label,
  max,
  min,
  onCommit,
  step,
  value,
}: {
  readonly disabled?: boolean;
  readonly format: (value: number) => string;
  readonly label: string;
  readonly max: number;
  readonly min: number;
  readonly onCommit: (value: number) => void;
  readonly step: number;
  readonly value: number;
}) => {
  const [moving, setMoving] = useState<number | null>(null);
  const shown = moving ?? value;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm leading-none font-medium select-none">
          {label}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
          {format(shown)}
        </span>
      </div>
      <Slider
        value={shown}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        format={format}
        onValueChange={(next: number) => {
          setMoving(next);
        }}
        onValueCommit={(next: number) => {
          setMoving(null);

          if (next !== value) {
            onCommit(next);
          }
        }}
      >
        <SliderControl className="relative flex h-5 w-full cursor-pointer touch-none items-center select-none data-[disabled]:cursor-default data-[disabled]:opacity-50">
          <SliderTrack className="bg-border relative h-1 w-full rounded-full">
            <SliderIndicator className="bg-primary rounded-full" />
            <SliderThumb
              aria-label={label}
              className="bg-background border-primary has-[:focus-visible]:outline-ring/50 top-1/2 size-3.5 -translate-y-1/2 rounded-full border-2 shadow-sm outline-none has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2"
            />
          </SliderTrack>
        </SliderControl>
      </Slider>
    </div>
  );
};

/** A colour as `#RRGGBB`, with its swatch, applied when left or on Enter. */
export const ColourField = ({
  disabled = false,
  label,
  onCommit,
  value,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly onCommit: (value: string) => void;
  readonly value: string;
}) => {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);
  const shown = typed ?? value;

  const commit = () => {
    if (typed === null) {
      return;
    }

    setTyped(null);

    const colour = typed.startsWith("#") ? typed : `#${typed}`;

    if (isHexColour(colour) && colour.toLowerCase() !== value.toLowerCase()) {
      onCommit(colour.toLowerCase());
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="size-8 shrink-0 rounded-md border bg-(--swatch)"
          style={{ "--swatch": isHexColour(shown) ? shown : value }}
        />
        <Input
          id={id}
          disabled={disabled}
          spellCheck={false}
          maxLength={7}

          value={shown}
          onChange={(event) => {
            setTyped(event.target.value);
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commit();
            }

            if (event.key === "Escape") {
              setTyped(null);
            }
          }}
        />
      </div>
    </div>
  );
};

/** Words, applied when left. */
export const WordsField = ({
  disabled = false,
  label,
  maxLength,
  onCommit,
  value,
}: {
  readonly disabled?: boolean;
  readonly label: string;
  readonly maxLength: number;
  readonly onCommit: (value: string) => void;
  readonly value: string;
}) => {
  const id = useId();
  const [typed, setTyped] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        dir="auto"
        rows={3}
        disabled={disabled}
        maxLength={maxLength}
        value={typed ?? value}
        onChange={(event) => {
          setTyped(event.target.value);
        }}
        onBlur={() => {
          if (typed !== null && typed !== value) {
            onCommit(typed);
          }

          setTyped(null);
        }}
      />
    </div>
  );
};
