import type { ReactElement, ReactNode } from "react";
import { Section } from "react-email";

import { gutterClass } from "./enhancements.ts";
import { gutter } from "./theme.ts";

/** A band of the card, between its gutters. */
export const Gutter = ({
  bottom = "0",
  children,
  top = "0",
}: {
  readonly bottom?: string;
  readonly children: ReactNode;
  readonly top?: string;
}): ReactElement => (
  // Both on the cell: a class on the table would add its padding.
  <Section
    style={{ padding: `${top} ${gutter} ${bottom}` }}
    tdClassName={gutterClass}
  >
    {children}
  </Section>
);
