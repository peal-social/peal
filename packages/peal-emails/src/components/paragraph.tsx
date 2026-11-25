import type { ReactElement } from "react";
import { Text } from "react-email";

import { bodyText } from "./theme.ts";

/** A paragraph of an email's body. */
export const Paragraph = ({
  children,
}: {
  readonly children: string;
}): ReactElement => (
  <Text style={{ ...bodyText, margin: "0 0 24px" }}>{children}</Text>
);
