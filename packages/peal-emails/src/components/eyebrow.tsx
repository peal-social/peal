import type { ReactElement } from "react";
import { Text } from "react-email";

import { captionText, colors, monoFamily } from "./theme.ts";

/** A label over a list, in mono and lowercase. */
export const Eyebrow = ({
  children,
}: {
  readonly children: string;
}): ReactElement => (
  <Text
    style={{
      ...captionText,
      color: colors.muted,
      fontFamily: monoFamily,
      letterSpacing: "0.04em",
      margin: "0 0 8px",
      textTransform: "lowercase",
    }}
  >
    {children}
  </Text>
);
