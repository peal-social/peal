"use client";

import { PixelIcon } from "peal-ui/blocks/art/pixel-icon";
import type { SiteIcon } from "peal-ui/lib/site-icons";
import { useEffect, useState } from "react";

// The pixel icon's dissolve, for review: the showcase moves from one icon
// to the next every two seconds, as a menu does when the pointer moves
// from row to row.
export const IconCycle = ({
  icons,
}: {
  readonly icons: readonly SiteIcon[];
}) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % Math.max(1, icons.length));
    }, 2000);

    return () => {
      clearInterval(timer);
    };
  }, [icons.length]);

  return (
    <PixelIcon
      animate
      className="h-64"
      icon={icons[index] ?? "globe"}
      on="field"
    />
  );
};
