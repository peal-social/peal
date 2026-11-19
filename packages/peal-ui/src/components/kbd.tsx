import type * as React from "react";

import { cn } from "../lib/utils";

const Kbd = ({ className, ...props }: React.ComponentProps<"kbd">) => (
  <kbd
    data-slot="kbd"
    className={cn(
      "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-mono text-xs font-normal select-none [&_svg:not([class*='size-'])]:size-3",
      className
    )}
    {...props}
  />
);

const KbdGroup = ({ className, ...props }: React.ComponentProps<"kbd">) => (
  <kbd
    data-slot="kbd-group"
    className={cn("inline-flex items-center gap-1", className)}
    {...props}
  />
);

/**
 * Keys pressed one after the other, like G then C. `then` is the word
 * between two keys, in the reader's language.
 */
const KbdSequence = ({
  className,
  keys,
  then,
  ...props
}: Omit<React.ComponentProps<"kbd">, "children"> & {
  readonly keys: readonly string[];
  readonly then: string;
}) => (
  <KbdGroup
    data-slot="kbd-sequence"
    className={cn("text-muted-foreground font-sans text-xs", className)}
    {...props}
  >
    {keys.map((key, index) => (
      // A sequence may repeat a key (G then G): the keys up to this one
      // name its place.
      <span key={keys.slice(0, index + 1).join(" ")} className="contents">
        {index === 0 ? null : <span>{then}</span>}
        <Kbd>{key.toUpperCase()}</Kbd>
      </span>
    ))}
  </KbdGroup>
);

export { Kbd, KbdGroup, KbdSequence };
