import type { ReactElement, ReactNode } from "react";
import { Section } from "react-email";

import { colors, radii } from "./theme.ts";

/** A bordered block inside the card, such as a digest's workspace. */
export const Panel = ({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement => (
  <Section
    style={{
      border: `1px solid ${colors.hairline}`,
      borderRadius: radii.control,
      margin: "0 0 24px",
      // What it holds ends on a margin of 16px: 20px all around.
      padding: "20px 20px 4px",
    }}
  >
    {children}
  </Section>
);
