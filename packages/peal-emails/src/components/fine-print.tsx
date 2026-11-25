import type { ReactElement, ReactNode } from "react";
import { Text } from "react-email";

import { colors, smallText } from "./theme.ts";

/** Small, muted text: an email's foot, a digest's figures. */
export const FinePrint = ({
  children,
}: {
  readonly children: ReactNode;
}): ReactElement => (
  <Text style={{ ...smallText, color: colors.muted, margin: "0 0 16px" }}>
    {children}
  </Text>
);
