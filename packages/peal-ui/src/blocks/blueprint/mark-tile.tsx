import { renderElement } from "@ui-sdk/react/primitive";
import type { PartProps } from "@ui-sdk/react/primitive";

import { siteIcons } from "../../lib/site-icons";
import type { SiteIcon } from "../../lib/site-icons";
import { cn } from "../../lib/utils";
import { Mark } from "./mark";
import type { SiteMark } from "./mark";

type MarkTileProps = Omit<
  PartProps<"span">,
  "aria-label" | "children" | "className" | "role"
> & {
  readonly className?: string | undefined;
  /**
   * The brand's or the icon's name for screen readers, when the tile stands
   * alone; without it, the tile is hidden from them, as beside its name.
   */
  readonly label?: string | undefined;
  /** 32 px around a 16 px mark, as a menu row has, or 40 around 20. */
  readonly size?: 32 | 40 | undefined;
} & (
    | { readonly icon: SiteIcon; readonly mark?: undefined }
    | { readonly icon?: undefined; readonly mark: SiteMark }
  );

/**
 * A brand's mark or a lucide icon in a bordered tile (DESIGN.md, Site, Mega
 * menu and Marks on the site), in ink.
 */
const MarkTile = ({
  className,
  icon,
  label,
  mark,
  render,
  size = 32,
  ...props
}: MarkTileProps) => {
  const glyph = size === 40 ? "size-5" : "size-4";
  const Icon = siteIcons[icon ?? "globe"];

  return renderElement(
    "span",
    {
      ...props,
      "aria-hidden": label === undefined ? "true" : undefined,
      "aria-label": label,
      children:
        mark === undefined ? (
          <Icon aria-hidden="true" strokeWidth={1.75} className={glyph} />
        ) : (
          <Mark mark={mark} className={glyph} />
        ),
      className: cn(
        "bg-card text-foreground flex shrink-0 items-center justify-center rounded-md border",
        size === 40 ? "size-10" : "size-8",
        className
      ),
      "data-size": size,
      "data-slot": "mark-tile",
      role: label === undefined ? undefined : "img",
    },
    render
  );
};

export { MarkTile };

export type { MarkTileProps };
