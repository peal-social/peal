import type { ReactElement, ReactNode } from "react";
import { Text } from "react-email";

import { colors, smallText } from "./theme.ts";

/** What an email says last: why it came, who signs it. */
export const FinePrint = ({
  children,
  last = false,
}: {
  readonly children: ReactNode;
  /** Whether nothing follows it. */
  readonly last?: boolean;
}): ReactElement => (
  <Text
    style={{
      ...smallText,
      color: colors.muted,
      margin: last ? 0 : "0 0 24px",
    }}
  >
    {children}
  </Text>
);
