import type { ReactElement } from "react";
import { Text } from "react-email";

import { bodyText, colors, radii } from "./theme.ts";
import { unbroken } from "./unbroken.tsx";

/** What an email sets apart under its body: DESIGN.md's `email-callout`. */
export const Highlight = ({
  children,
}: {
  readonly children: string;
}): ReactElement => (
  <Text
    style={{
      ...bodyText,
      backgroundColor: colors.quiet,
      borderRadius: radii.control,
      fontWeight: 500,
      margin: "0 0 24px",
      padding: "12px 16px",
    }}
  >
    {unbroken(children)}
  </Text>
);
