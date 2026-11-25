import type { ReactElement } from "react";
import { Hr } from "react-email";

import { colors } from "./theme.ts";

/** A hairline across the card, between its gutters. */
export const Divider = (): ReactElement => (
  <Hr
    style={{
      borderColor: colors.hairline,
      borderTop: `1px solid ${colors.hairline}`,
      margin: "8px 0 24px",
    }}
  />
);
