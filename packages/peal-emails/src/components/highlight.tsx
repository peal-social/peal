import type { ReactElement } from "react";
import { Text } from "react-email";

import { bodyText, colors, radii } from "./theme.ts";

/** What an email sets apart in a box under its body. */
export const Highlight = ({
  children,
}: {
  readonly children: string;
}): ReactElement => (
  <Text
    style={{
      ...bodyText,
      border: `2px solid ${colors.ink}`,
      borderRadius: radii.control,
      fontWeight: 600,
      margin: "0 0 24px",
      padding: "12px 16px",
    }}
  >
    {children}
  </Text>
);
